"""Kisan Sathi voice + chat agent (LiveKit Agents, Sarvam speech, OpenAI brain, Supabase data).

Flow:  IntakeAgent (identify by mobile) -> TradeAgent (retailer/distributor ordering)
                                        -> FarmerAgent (crop advice, dosage, where to buy)

Voice and chat share one LiveKit room. The web app sets the participant attribute
``mode`` to "voice" or "chat" (and optionally ``language``, e.g. "mr-IN").
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Annotated, Literal

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    NOT_GIVEN,
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    ToolError,
    TurnHandlingOptions,
    cli,
    function_tool,
    inference,
    room_io,
)
from livekit.plugins import ai_coustics, openai, sarvam
from pydantic import BaseModel, Field

import languages
import prompts
from db import DB, DBError, compact

logger = logging.getLogger("agent")

load_dotenv(".env.local")

QUOTE_TTL_SECONDS = 10 * 60
MAX_CARTONS_PER_LINE = 10_000


# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
@dataclass
class SessionState:
    db: DB
    tts: sarvam.TTS
    room_name: str
    channel: Literal["voice", "chat"] = "voice"
    language: str = languages.DEFAULT_LANGUAGE
    language_locked: bool = False  # customer chose a language explicitly
    conversation_id: str | None = None
    customer: dict | None = None
    role: str | None = None  # active role: farmer | retailer | distributor
    pending_mobile: str | None = None  # number looked up but not registered yet
    last_quote: dict | None = None
    last_quote_at: float = 0.0
    _lang_candidate: str | None = None
    # shown in the website's "Live Actions" panel
    activity: dict = field(default_factory=dict)
    _bg: set = field(default_factory=set)

    @property
    def customer_id(self) -> str | None:
        return self.customer["customer_id"] if self.customer else None

    @property
    def state_code(self) -> str | None:
        return self.customer.get("state_code") if self.customer else None

    def spawn(self, coro) -> None:
        task = asyncio.create_task(coro)
        self._bg.add(task)
        task.add_done_callback(self._bg.discard)


def _profile_for_prompt(c: dict) -> str:
    """A short profile summary for the system prompt (keeps tokens low)."""
    parts = [
        f"Name: {c.get('name')}",
        f"Roles: {', '.join(c.get('roles') or [])}",
        f"State: {c.get('state')}, district {c.get('district') or 'unknown'}, pincode {c.get('pincode') or 'unknown'}",
    ]
    if c.get("shop_name"):
        parts.append(f"Shop: {c['shop_name']}")
    if c.get("crops"):
        parts.append(
            "Crops: " + "; ".join(f"{x['crop']} {x['acres']} acres" for x in c["crops"])
        )
    if c.get("recent_orders"):
        parts.append("Recent orders: " + compact(c["recent_orders"]))
    if c.get("last_advisory"):
        parts.append("Last advice: " + compact(c["last_advisory"]))
    if c.get("major_crops_in_state"):
        parts.append(
            "Major crops in their state: " + ", ".join(c["major_crops_in_state"])
        )
    return "\n".join(parts)


def _err(e: DBError) -> ToolError:
    return ToolError(e.for_llm())


# ---------------------------------------------------------------------------
# Tool argument models
# ---------------------------------------------------------------------------
class OrderLine(BaseModel):
    sku_code: str = Field(
        description="Pack code from search_products or the profile, e.g. SYN-PEGA-250G"
    )
    cartons: int = Field(description="Number of cartons (whole number)")
    allow_backorder: bool = Field(
        description="True only if the customer agreed to take available stock now and backorder the rest"
    )


class CropAcres(BaseModel):
    crop: str = Field(description="Crop in English, e.g. wheat, paddy, apple")
    acres: float = Field(description="Acres of this crop")


# ---------------------------------------------------------------------------
# Base agent with tools every stage needs
# ---------------------------------------------------------------------------
class BaseAgent(Agent):
    template: str = prompts.INTAKE

    def __init__(self, state: SessionState, **kwargs) -> None:
        self.state = state
        super().__init__(instructions=self.render(), **kwargs)

    def render(self) -> str:
        c = self.state.customer or {}
        return self.template.format(
            language_name=languages.name(self.state.language),
            profile=_profile_for_prompt(c) if c else "",
            role=self.state.role or "",
            channel="typed chat" if self.state.channel == "chat" else "a voice call",
        )

    async def refresh(self) -> None:
        await self.update_instructions(self.render())

    async def apply_language(self, code: str, *, lock: bool = False) -> None:
        code = languages.normalise(code)
        self.state.language_locked = self.state.language_locked or lock
        if code == self.state.language:
            return
        self.state.language = code
        self.state.tts.update_options(target_language_code=code)
        await self.refresh()
        if self.state.conversation_id:
            self.state.spawn(
                self.state.db.update_conversation(
                    self.state.conversation_id, {"language": code}
                )
            )
        logger.info("language -> %s", code)

    @function_tool
    async def set_language(
        self,
        context: RunContext[SessionState],
        language: Annotated[
            str,
            Field(
                description="Language name or code, e.g. Hindi, Marathi, English, ta-IN"
            ),
        ],
    ) -> str:
        """Switch the conversation language when the customer asks for it or clearly speaks another language."""
        await self.apply_language(language, lock=True)
        return f"Language set to {languages.name(self.state.language)}. Continue in that language."

    @function_tool
    async def talk_to_human(
        self,
        context: RunContext[SessionState],
        reason: Annotated[
            str,
            Field(
                description="Short reason in English, e.g. 'wants agronomist', 'payment issue'"
            ),
        ],
    ) -> str:
        """Hand the customer to a human team member. Use when asked, or when you cannot help or are unsure."""
        try:
            res = await self.state.db.escalate(
                self.state.customer_id, self.state.conversation_id, reason
            )
        except DBError as e:
            raise _err(e) from e
        return compact(
            {
                **res,
                "tell_customer": "Our team will call you back on your registered mobile soon.",
            }
        )


class CustomerAgent(BaseAgent):
    """Shared tools once the customer is identified."""

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions="Greet the customer by name in one short sentence and ask how you can help today."
        )

    @function_tool
    async def update_profile(
        self,
        context: RunContext[SessionState],
        name: str | None = None,
        shop_name: str | None = None,
        address_line: str | None = None,
        village: str | None = None,
        district: str | None = None,
        city: str | None = None,
        state: str | None = None,
        pincode: str | None = None,
        new_mobile: Annotated[
            str | None, Field(description="Only if the customer changed their number")
        ] = None,
        add_role: Annotated[
            Literal["farmer", "retailer", "distributor"] | None,
            Field(description="Add a role if the customer also farms or runs a shop"),
        ] = None,
    ) -> str:
        """Update the customer's saved details. Pass only the fields that changed. Confirm changes with the customer first."""
        changes = {
            k: v
            for k, v in {
                "name": name,
                "shop_name": shop_name,
                "address_line": address_line,
                "village": village,
                "district": district,
                "city": city,
                "state": state,
                "pincode": pincode,
                "mobile": new_mobile,
                "add_role": add_role,
            }.items()
            if v
        }
        if not changes:
            raise ToolError("Nothing to update.")
        try:
            self.state.customer = await self.state.db.update_customer(
                self.state.customer_id, changes
            )
        except DBError as e:
            raise _err(e) from e
        await self.refresh()
        return "Profile updated."

    async def _search(self, query, crop, category, role) -> str:
        db = self.state.db
        try:
            res = await db.search_products(
                query, crop, category, self.state.state_code, role, 3
            )
            if not res and crop:
                res = await db.search_products(
                    None, crop, category, self.state.state_code, role, 3
                )
        except DBError as e:
            raise _err(e) from e
        if not res:
            return "No matching product in our catalogue. Ask what they need it for, or log it with log_missing_product."
        return compact(res)


# ---------------------------------------------------------------------------
# Stage 1: identify or register
# ---------------------------------------------------------------------------
class IntakeAgent(BaseAgent):
    template = prompts.INTAKE

    def __init__(self, state: SessionState, **kwargs) -> None:
        # People pause while saying a mobile number; wait a little longer before replying.
        kwargs.setdefault("min_endpointing_delay", 1.2)
        kwargs.setdefault("max_endpointing_delay", 4.0)
        super().__init__(state, **kwargs)

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions=f"Greet the customer warmly as the {prompts.COMPANY} assistant in one sentence and ask for their mobile number."
        )

    def _next_agent(self) -> Agent:
        kw = {"state": self.state, "chat_ctx": self.chat_ctx}
        if self.state.role == "farmer":
            return FarmerAgent(**kw)
        return TradeAgent(**kw)

    async def _on_identified(self, profile: dict) -> None:
        st = self.state
        st.customer = profile
        st.pending_mobile = None
        if not st.language_locked and profile.get("language"):
            await self.apply_language(profile["language"])
        if st.conversation_id:
            st.spawn(
                st.db.update_conversation(
                    st.conversation_id, {"customer_id": profile["customer_id"]}
                )
            )

    @function_tool
    async def lookup_customer(
        self,
        context: RunContext[SessionState],
        mobile: Annotated[
            str, Field(description="10-digit mobile number, digits only")
        ],
    ):
        """Look up the customer by mobile number."""
        digits = "".join(ch for ch in mobile if ch.isdigit())[-10:]
        if len(digits) != 10 or digits[0] not in "6789":
            raise ToolError(
                "INVALID_MOBILE: ask the customer to say their 10-digit mobile number again."
            )
        try:
            profile = await self.state.db.find_customer(digits)
        except DBError as e:
            raise _err(e) from e
        if not profile:
            self.state.pending_mobile = digits
            return "Not registered. Ask whether they are a farmer, retailer or distributor, then collect registration details."
        await self._on_identified(profile)
        roles = profile.get("roles") or []
        if len(roles) == 1:
            self.state.role = roles[0]
            return self._next_agent(), f"Found {profile['name']} ({roles[0]})."
        return f"Found {profile['name']} with roles {roles}. Ask which they need today, then call continue_as."

    @function_tool
    async def continue_as(
        self,
        context: RunContext[SessionState],
        role: Literal["farmer", "retailer", "distributor"],
    ):
        """After lookup, continue with the role the customer chose for this conversation."""
        c = self.state.customer
        if not c:
            raise ToolError("Look up the customer first.")
        if role not in (c.get("roles") or []):
            raise ToolError(
                f"Customer is not registered as {role}. Ask if they want to add that role."
            )
        self.state.role = role
        return self._next_agent(), f"Continuing as {role}."

    @function_tool
    async def register_customer(
        self,
        context: RunContext[SessionState],
        role: Literal["farmer", "retailer", "distributor"],
        name: str,
        state: Annotated[str, Field(description="Indian state name, in English")],
        district: str | None = None,
        pincode: Annotated[str | None, Field(description="6-digit pincode")] = None,
        village: str | None = None,
        city: str | None = None,
        shop_name: Annotated[
            str | None, Field(description="Required for retailer and distributor")
        ] = None,
        address_line: Annotated[
            str | None, Field(description="Street or market address, for delivery")
        ] = None,
        crops: Annotated[
            list[CropAcres] | None,
            Field(description="Farmers only: each crop and its acres"),
        ] = None,
    ):
        """Register a new customer after lookup_customer found no match. Confirm the details with the customer first."""
        if not self.state.pending_mobile:
            raise ToolError("Call lookup_customer with their mobile number first.")
        try:
            profile = await self.state.db.register_customer(
                mobile=self.state.pending_mobile,
                name=name,
                role=role,
                state=state,
                district=district,
                city=city,
                village=village,
                pincode=pincode,
                shop_name=shop_name,
                address_line=address_line,
                language=self.state.language,
            )
        except DBError as e:
            raise _err(e) from e
        self.state.language_locked = True  # keep the language they registered in
        for c in crops or []:
            if c.crop and c.acres and c.acres > 0:
                try:
                    profile = await self.state.db.upsert_crop(
                        profile["customer_id"], c.crop, c.acres, None, None, False
                    )
                except DBError as e:
                    logger.warning("could not save crop %s: %s", c.crop, e.code)
        await self._on_identified(profile)
        self.state.role = role
        return self._next_agent(), "Registered."


# ---------------------------------------------------------------------------
# Stage 2a: retailers and distributors
# ---------------------------------------------------------------------------
class TradeAgent(CustomerAgent):
    template = prompts.TRADE

    @function_tool
    async def search_products(
        self,
        context: RunContext[SessionState],
        query: Annotated[
            str | None,
            Field(
                description="Product, company, active ingredient or pest, in English"
            ),
        ] = None,
        crop: Annotated[
            str | None, Field(description="Crop in English, e.g. paddy, cotton, wheat")
        ] = None,
        category: Literal["insecticide", "fungicide", "herbicide"] | None = None,
    ) -> str:
        """Search the catalogue. Returns products with packs, carton price for this customer, minimum order and stock."""
        return await self._search(query, crop, category, self.state.role)

    @function_tool
    async def find_alternatives(
        self,
        context: RunContext[SessionState],
        sku_code: Annotated[
            str, Field(description="Pack code that is out of stock or not allowed")
        ],
    ) -> str:
        """Find in-stock alternatives (same active ingredient first, then products for the same pests)."""
        try:
            res = await self.state.db.alternatives(
                sku_code, self.state.state_code, self.state.role
            )
        except DBError as e:
            raise _err(e) from e
        return (
            compact(res)
            if res
            else "No in-stock alternative found. Offer notify_when_in_stock or a human."
        )

    @function_tool
    async def quote_order(
        self, context: RunContext[SessionState], items: list[OrderLine]
    ) -> str:
        """Get a fresh quote with live price and stock, and hold available stock for 10 minutes. Always call before place_order."""
        lines = self._lines(items)
        try:
            quote = await self.state.db.quote(
                self.state.customer_id, self.state.role, lines
            )
        except DBError as e:
            raise _err(e) from e
        self.state.last_quote = quote
        self.state.last_quote_at = time.monotonic()
        self.state.spawn(self.state.db.save_cart(self.state.customer_id, lines))
        return compact(quote)

    @function_tool
    async def place_order(
        self,
        context: RunContext[SessionState],
        items: list[OrderLine],
        customer_confirmed: Annotated[
            bool,
            Field(description="True only if the customer just said yes to the quote"),
        ],
        payment_mode: Literal["cod", "credit"] = "cod",
    ) -> str:
        """Place the order exactly as quoted, after the customer confirmed."""
        st = self.state
        if not customer_confirmed:
            raise ToolError(
                "Read the quote to the customer and wait for a clear yes first."
            )
        if not st.last_quote or time.monotonic() - st.last_quote_at > QUOTE_TTL_SECONDS:
            raise ToolError(
                "No fresh quote. Call quote_order again and confirm with the customer."
            )
        quoted = {
            ln["sku_code"]
            for ln in st.last_quote.get("lines", [])
            if ln.get("status") in ("ok", "partial_stock")
        }
        lines = self._lines(items)
        if not all(ln["sku_code"] in quoted for ln in lines):
            raise ToolError(
                "The items differ from the last quote. Call quote_order with these items first."
            )
        try:
            res = await st.db.place_order(
                st.customer_id,
                st.role,
                lines,
                payment_mode,
                st.channel,
                st.conversation_id,
            )
        except DBError as e:
            raise _err(e) from e
        st.last_quote = None
        try:
            st.customer = await st.db.customer_profile(st.customer_id)
            await self.refresh()
        except DBError:
            pass
        return compact(res)

    @function_tool
    async def order_history(
        self,
        context: RunContext[SessionState],
        order_number: Annotated[
            str | None, Field(description="e.g. ORD1005; leave empty for recent orders")
        ] = None,
    ) -> str:
        """Get status and items of this customer's orders."""
        try:
            res = await self.state.db.orders(self.state.customer_id, order_number)
        except DBError as e:
            raise _err(e) from e
        return compact(res) if res else "No orders found."

    @function_tool
    async def cancel_order(
        self,
        context: RunContext[SessionState],
        order_number: str,
        customer_confirmed: Annotated[
            bool,
            Field(
                description="True only after the customer confirmed the cancellation"
            ),
        ],
    ) -> str:
        """Cancel an order that has not been dispatched yet."""
        if not customer_confirmed:
            raise ToolError("Confirm with the customer before cancelling.")
        try:
            return compact(
                await self.state.db.cancel_order(self.state.customer_id, order_number)
            )
        except DBError as e:
            raise _err(e) from e

    @function_tool
    async def notify_when_in_stock(
        self,
        context: RunContext[SessionState],
        sku_code: str,
        cartons: int | None = None,
    ) -> str:
        """Record that the customer wants this out-of-stock pack, so the team can notify them."""
        try:
            await self.state.db.log_restock(self.state.customer_id, sku_code, cartons)
        except DBError as e:
            raise _err(e) from e
        return "Logged. Tell the customer we will inform them when it is back in stock."

    @function_tool
    async def log_missing_product(
        self,
        context: RunContext[SessionState],
        description: Annotated[str, Field(description="What the customer asked for")],
    ) -> str:
        """Record demand for a product we do not carry."""
        try:
            await self.state.db.log_demand(self.state.customer_id, description)
        except DBError as e:
            raise _err(e) from e
        return "Logged for the team."

    @function_tool
    async def switch_to_crop_advice(self, context: RunContext[SessionState]):
        """The customer wants crop advice for their own farm."""
        self.state.role = "farmer"
        return FarmerAgent(
            state=self.state, chat_ctx=self.chat_ctx
        ), "Switching to crop advice."

    @staticmethod
    def _lines(items: list[OrderLine]) -> list[dict]:
        if not items:
            raise ToolError("NO_ITEMS: ask which packs and how many cartons.")
        out = []
        for it in items:
            if it.cartons <= 0 or it.cartons > MAX_CARTONS_PER_LINE:
                raise ToolError(
                    "INVALID_QUANTITY: cartons must be a whole number above zero."
                )
            out.append(
                {
                    "sku_code": it.sku_code.upper(),
                    "qty": it.cartons,
                    "allow_backorder": it.allow_backorder,
                }
            )
        return out


# ---------------------------------------------------------------------------
# Stage 2b: farmers
# ---------------------------------------------------------------------------
class FarmerAgent(CustomerAgent):
    template = prompts.FARMER

    async def on_enter(self) -> None:
        if (self.state.customer or {}).get("crops"):
            await super().on_enter()
        else:
            self.session.generate_reply(
                instructions="Greet the farmer by name. Ask which crops they grow and how many acres of each, "
                "then save them with update_crop before giving advice."
            )

    @function_tool
    async def get_crop_problems(
        self,
        context: RunContext[SessionState],
        crop: Annotated[
            str, Field(description="Crop in English, e.g. paddy, cotton, soybean")
        ],
    ) -> str:
        """Known problems for a crop with their symptoms and our recommended products. Compare with what the farmer sees."""
        try:
            res = await self.state.db.crop_issues(crop, self.state.state_code)
        except DBError as e:
            raise _err(e) from e
        return (
            compact(res)
            if res
            else "No problems recorded for this crop. Do not guess; offer talk_to_human."
        )

    @function_tool
    async def search_products(
        self,
        context: RunContext[SessionState],
        query: Annotated[
            str | None,
            Field(description="Product, active ingredient or pest, in English"),
        ] = None,
        crop: Annotated[str | None, Field(description="Crop in English")] = None,
        category: Literal["insecticide", "fungicide", "herbicide"] | None = None,
    ) -> str:
        """Search products (farmers see MRP per pack, not trade prices)."""
        return await self._search(query, crop, category, None)

    @function_tool
    async def calculate_quantity(
        self,
        context: RunContext[SessionState],
        product: Annotated[str, Field(description="Product name, e.g. Coragen")],
        crop: Annotated[str, Field(description="Crop in English")],
        symptoms: Annotated[
            str | None,
            Field(description="What the farmer described, in English (for history)"),
        ] = None,
        diagnosed_issue: Annotated[
            str | None, Field(description="Issue name from get_crop_problems, if any")
        ] = None,
        acres: Annotated[
            float | None,
            Field(
                description="Acres of THIS crop as the farmer said. Leave empty to use the saved acres for this crop."
            ),
        ] = None,
    ) -> str:
        """Dose per acre, total quantity, best packs to buy, water, how to apply, safety and waiting period. Also saves the advice to the farmer's history."""
        st = self.state
        crop_key = crop.strip().lower()
        saved = next(
            (c for c in (st.customer or {}).get("crops", []) if c["crop"] == crop_key),
            None,
        )
        if acres is None:
            if not saved:
                raise ToolError(
                    f"ACRES_REQUIRED: ask how many acres of {crop_key} the farmer has."
                )
            acres = float(saved["acres"])
        if acres <= 0 or acres > 10_000:
            raise ToolError("ACRES_REQUIRED: ask for the acres again.")
        try:
            result = await st.db.farmer_quantity(product, crop, acres)
        except DBError as e:
            raise _err(e) from e

        if not saved:  # remember a crop the farmer mentioned for the first time
            try:
                st.customer = await st.db.upsert_crop(
                    st.customer_id, crop_key, acres, None, None, False
                )
                await self.refresh()
            except DBError as e:
                logger.warning("could not save crop: %s", e.code)

        best = (result.get("pack_options") or [{}])[0]
        st.spawn(
            st.db.save_advisory(
                customer_id=st.customer_id,
                crop=crop_key,
                symptoms=symptoms or "Asked for dosage",
                issue=diagnosed_issue,
                confidence="medium" if diagnosed_issue else None,
                recommendation={
                    "product": result.get("product") or product,
                    "acres": acres,
                    "total": result.get("total_needed"),
                    "packs": f"{best.get('packs')} x {best.get('pack')}"
                    if best
                    else None,
                },
                conversation_id=st.conversation_id,
            )
        )
        return compact(result)

    @function_tool
    async def find_nearby_retailers(
        self,
        context: RunContext[SessionState],
        product: Annotated[str, Field(description="Product name")],
    ) -> str:
        """Registered retailers near the farmer who have this product in stock."""
        c = self.state.customer or {}
        try:
            res = await self.state.db.nearby_retailers(
                product, c.get("pincode"), c.get("state_code"), c.get("district")
            )
        except DBError as e:
            raise _err(e) from e
        if not res:
            return "No registered retailer nearby has it in stock. Offer talk_to_human so the team can arrange it."
        return compact(res)

    @function_tool
    async def update_crop(
        self,
        context: RunContext[SessionState],
        crop: Annotated[str, Field(description="Crop in English")],
        acres: float | None = None,
        season: Literal["kharif", "rabi", "zaid", "perennial"] | None = None,
        sowing_date: Annotated[
            str | None, Field(description="YYYY-MM-DD if known")
        ] = None,
        remove: Annotated[
            bool, Field(description="True if the farmer no longer grows this crop")
        ] = False,
    ) -> str:
        """Add or update a crop the farmer grows, or remove it."""
        try:
            self.state.customer = await self.state.db.upsert_crop(
                self.state.customer_id, crop, acres, season, sowing_date, remove
            )
        except DBError as e:
            raise _err(e) from e
        await self.refresh()
        return "Crops updated."

    @function_tool
    async def save_advisory(
        self,
        context: RunContext[SessionState],
        crop: str,
        symptoms: Annotated[
            str, Field(description="What the farmer described, in English")
        ],
        diagnosed_issue: Annotated[
            str | None, Field(description="Issue name from get_crop_problems, if any")
        ] = None,
        confidence: Literal["high", "medium", "low"] | None = None,
        recommended_product: str | None = None,
        quantity_advice: Annotated[
            str | None, Field(description="e.g. '3 x 700 ml for 3 acres'")
        ] = None,
        crop_stage: str | None = None,
        area_affected: str | None = None,
        escalated: bool = False,
    ) -> str:
        """Save this advice to the farmer's history. Call at the end of every advice."""
        rec = (
            {"product": recommended_product, "quantity": quantity_advice}
            if recommended_product
            else None
        )
        try:
            await self.state.db.save_advisory(
                customer_id=self.state.customer_id,
                crop=crop,
                symptoms=symptoms,
                issue=diagnosed_issue,
                confidence=confidence,
                recommendation=rec,
                crop_stage=crop_stage,
                area_affected=area_affected,
                conversation_id=self.state.conversation_id,
                escalated=escalated,
            )
        except DBError as e:
            raise _err(e) from e
        return "Saved."

    @function_tool
    async def switch_to_ordering(self, context: RunContext[SessionState]):
        """The customer also runs a shop and wants to order stock."""
        roles = (self.state.customer or {}).get("roles") or []
        trade = next((r for r in ("distributor", "retailer") if r in roles), None)
        if not trade:
            raise ToolError(
                "Not registered as retailer or distributor. Farmers buy from nearby retailers."
            )
        self.state.role = trade
        return TradeAgent(
            state=self.state, chat_ctx=self.chat_ctx
        ), "Switching to ordering."


# ---------------------------------------------------------------------------
# Session wiring
# ---------------------------------------------------------------------------
server = AgentServer()


def _build_tts(language: str) -> sarvam.TTS:
    return sarvam.TTS(
        target_language_code=language,
        model=os.getenv("SARVAM_TTS_MODEL", "bulbul:v3"),
        speaker=os.getenv("SARVAM_TTS_SPEAKER", "priya"),
        pace=float(os.getenv("SARVAM_TTS_PACE", "1.0")),
        speech_sample_rate=24000,
    )


# ---------------------------------------------------------------------------
# Live Actions: tell the website what the agent is doing
# ---------------------------------------------------------------------------
ACTIVITY_TOPIC = "agent.activity"

TOOL_LABELS = {
    "lookup_customer": "Looked up customer",
    "register_customer": "Registered new customer",
    "continue_as": "Chose conversation type",
    "set_language": "Changed language",
    "talk_to_human": "Requested a call back from the team",
    "update_profile": "Updated profile",
    "search_products": "Searched products",
    "find_alternatives": "Found alternatives",
    "quote_order": "Prepared quote and held stock",
    "place_order": "Placed order",
    "order_history": "Checked orders",
    "cancel_order": "Cancelled order",
    "notify_when_in_stock": "Saved restock request",
    "log_missing_product": "Logged product request",
    "switch_to_crop_advice": "Switched to crop advice",
    "switch_to_ordering": "Switched to ordering",
    "get_crop_problems": "Checked crop problems",
    "calculate_quantity": "Calculated dose and quantity",
    "find_nearby_retailers": "Found nearby retailers",
    "update_crop": "Updated crops",
    "save_advisory": "Saved advice",
}


def _stage(session: AgentSession) -> str:
    agent = session.current_agent
    if isinstance(agent, FarmerAgent):
        return "Crop advice"
    if isinstance(agent, TradeAgent):
        return "Helping with an order"
    return "Identifying customer"


def _snapshot(session: AgentSession, state: SessionState) -> dict:
    c = state.customer or {}
    place = ", ".join(x for x in (c.get("district"), c.get("state")) if x)
    return {
        "status": _stage(session),
        "channel": state.channel,
        "language": languages.name(state.language),
        "customer": c.get("name"),
        "role": state.role,
        "location": place or None,
        **state.activity,
    }


def _parse(output: str | None) -> dict:
    try:
        data = json.loads(output or "")
        return data if isinstance(data, dict) else {}
    except (ValueError, TypeError):
        return {}


def _note_tool(state: SessionState, name: str, args: dict, out: dict) -> str | None:
    """Update the activity snapshot from a tool call; return a short detail line."""
    a = state.activity
    if name == "search_products":
        q = " ".join(str(x) for x in (args.get("query"), args.get("crop")) if x)
        return q or args.get("category")
    if name in ("calculate_quantity", "find_nearby_retailers"):
        a["product"] = out.get("product") or args.get("product")
        if args.get("crop"):
            a["crop"] = args["crop"]
        if out.get("total_needed"):
            return f"{a['product']}: {out['total_needed']} for {out.get('acres')} acres"
        return a["product"]
    if name == "get_crop_problems":
        a["crop"] = args.get("crop")
        return a["crop"]
    if name == "quote_order":
        a["quote_total"] = out.get("total")
        return f"Total {out.get('total')} rupees" if out.get("total") else None
    if name == "place_order":
        a["order_number"] = out.get("order_number")
        a["quote_total"] = out.get("total")
        return out.get("order_number")
    if name == "cancel_order":
        return out.get("order_number")
    if name == "talk_to_human":
        ref = str(out.get("escalation_id") or "")[:8].upper()
        a["reference"] = ref or None
        return args.get("reason")
    if name == "save_advisory":
        a["crop"] = args.get("crop") or a.get("crop")
    return None


def _apply_mode(session: AgentSession, state: SessionState, mode: str | None) -> None:
    channel = "chat" if mode == "chat" else "voice"
    state.channel = channel
    voice = channel == "voice"
    session.input.set_audio_enabled(voice)
    session.output.set_audio_enabled(voice)
    agent = session.current_agent
    if isinstance(agent, BaseAgent):
        state.spawn(agent.refresh())
    logger.info("mode -> %s", channel)


@server.rtc_session(agent_name=os.getenv("AGENT_NAME", "kisan-sathi"))
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name}

    db = await DB.connect()
    # In `lk agent console` (terminal testing) there is no real web participant.
    participant: rtc.RemoteParticipant | None = None
    attrs: dict[str, str] = {}
    if not ctx.is_fake_job():
        await ctx.connect()
        participant = await ctx.wait_for_participant()
        attrs = dict(participant.attributes or {})
    requested_lang = attrs.get("language")
    language = languages.normalise(requested_lang)

    tts = _build_tts(language)
    state = SessionState(
        db=db,
        tts=tts,
        room_name=ctx.room.name,
        language=language,
        language_locked=bool(requested_lang),
        channel="chat" if attrs.get("mode") == "chat" else "voice",
    )

    session = AgentSession[SessionState](
        userdata=state,
        # Sarvam listens in any Indian language and reports which one it heard.
        stt=sarvam.STT(
            language="unknown", model=os.getenv("SARVAM_STT_MODEL", "saaras:v4")
        ),
        llm=openai.LLM(
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"), temperature=0.3
        ),
        tts=tts,
        max_tool_steps=6,
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
            interruption={"mode": "adaptive"},
            # Off: tools place orders, so never generate before the user finishes.
            preemptive_generation={"enabled": False},
        ),
    )

    state.conversation_id = await db.start_conversation(
        state.channel, ctx.room.name, language
    )

    # --- log every message to Supabase
    @session.on("conversation_item_added")
    def _on_item(ev) -> None:
        item = ev.item
        role = getattr(item, "role", None)
        text = getattr(item, "text_content", None)
        if state.conversation_id and role in ("user", "assistant") and text:
            state.spawn(
                db.log_message(
                    state.conversation_id, "user" if role == "user" else "agent", text
                )
            )

    # --- follow the customer's spoken language (confirmed twice, English only on request)
    @session.on("user_input_transcribed")
    def _on_transcript(ev) -> None:
        if not ev.is_final or not ev.language or state.language_locked:
            return
        detected = str(ev.language)
        if detected in ("unknown", "en-IN") or len(ev.transcript.split()) < 3:
            state._lang_candidate = None
            return
        code = languages.normalise(detected)
        if code == state.language:
            state._lang_candidate = None
        elif state._lang_candidate == code:
            state._lang_candidate = None
            agent = session.current_agent
            if isinstance(agent, BaseAgent):
                state.spawn(agent.apply_language(code))
        else:
            state._lang_candidate = code

    # --- Live Actions feed for the website
    async def _publish(payload: dict) -> None:
        try:
            await ctx.room.local_participant.publish_data(
                json.dumps(payload, ensure_ascii=False, default=str),
                topic=ACTIVITY_TOPIC,
                reliable=True,
            )
        except Exception:
            logger.debug("could not publish activity", exc_info=True)

    def publish_snapshot() -> None:
        if participant:
            state.spawn(
                _publish({"type": "snapshot", "snapshot": _snapshot(session, state)})
            )

    @session.on("function_tools_executed")
    def _on_tools(ev) -> None:
        outputs = {o.call_id: o for o in ev.function_call_outputs if o}
        for call in ev.function_calls:
            out = outputs.get(call.call_id)
            ok = not (out and out.is_error)
            args = _parse(call.arguments)
            detail = (
                _note_tool(state, call.name, args, _parse(out.output if out else None))
                if ok
                else None
            )
            if participant:
                state.spawn(
                    _publish(
                        {
                            "type": "tool",
                            "tool": call.name,
                            "label": TOOL_LABELS.get(
                                call.name, call.name.replace("_", " ")
                            ),
                            "detail": detail,
                            "ok": ok,
                            "at": time.time(),
                            "snapshot": _snapshot(session, state),
                        }
                    )
                )

    @session.on("agent_state_changed")
    def _on_agent_state(ev) -> None:
        if getattr(ev, "new_state", None) == "listening":
            publish_snapshot()

    # --- voice <-> chat switching from the web app
    @ctx.room.on("participant_attributes_changed")
    def _on_attrs(changed: dict, p: rtc.Participant) -> None:
        if not participant or p.identity != participant.identity:
            return
        if changed.get("language"):
            agent = session.current_agent
            if isinstance(agent, BaseAgent):
                state.spawn(agent.apply_language(changed["language"], lock=True))
            publish_snapshot()
        if "mode" in changed:
            _apply_mode(session, state, changed["mode"])
            publish_snapshot()
            if state.conversation_id:
                state.spawn(
                    db.update_conversation(
                        state.conversation_id, {"channel": state.channel}
                    )
                )

    async def _on_shutdown() -> None:
        if state.conversation_id:
            await db.update_conversation(
                state.conversation_id,
                {"ended_at": datetime.now(timezone.utc).isoformat()},
            )

    ctx.add_shutdown_callback(_on_shutdown)

    await session.start(
        agent=IntakeAgent(state=state),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            participant_identity=participant.identity if participant else NOT_GIVEN,
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
            # Typed messages from the web chat arrive on the lk.chat topic and get a reply.
            text_input=True,
            # Agent replies (and live transcripts) are sent back as text for the chat window.
            text_output=True,
        ),
    )
    if participant:
        _apply_mode(session, state, attrs.get("mode"))
        publish_snapshot()


if __name__ == "__main__":
    cli.run_app(server)

"""Thin async wrapper around the Supabase RPC functions the agent uses.

All business rules (prices, stock, holds, order placement, state routing) live in
Postgres functions named ``agent_*``. The agent never calculates prices or stock
itself; it only calls these functions and speaks the results.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from postgrest.exceptions import APIError
from supabase import AsyncClient, acreate_client

logger = logging.getLogger("agent.db")

# Error codes raised by the SQL functions, mapped to plain guidance for the LLM.
ERROR_HINTS: dict[str, str] = {
    "INVALID_MOBILE": "The mobile number is not a valid 10-digit Indian mobile number. Ask the customer to repeat it.",
    "INVALID_PINCODE": "The pincode is not a valid 6-digit Indian pincode. Ask again.",
    "INVALID_ROLE": "Role must be farmer, retailer or distributor.",
    "NAME_REQUIRED": "Ask for the customer's name.",
    "UNKNOWN_STATE": "The state name was not recognised. Ask the customer to say their state again.",
    "SHOP_AND_PINCODE_REQUIRED": "Retailers and distributors must give a shop or business name and pincode.",
    "ALREADY_REGISTERED": "This mobile number is already registered. Look the customer up instead.",
    "MOBILE_IN_USE": "That new mobile number already belongs to another customer.",
    "ACRES_REQUIRED": "Ask how many acres the crop is on.",
    "CUSTOMER_NOT_FOUND": "Customer record not found. Identify the customer again.",
    "ROLE_NOT_ALLOWED": "This customer is not registered for that role, so they cannot order at trade prices.",
    "STATE_REQUIRED": "The customer's state is missing. Ask for it and update the profile.",
    "STATE_NOT_SERVICEABLE": "We do not deliver to this customer's state yet. Apologise and offer a call back from the team.",
    "PRODUCT_NOT_ALLOWED_IN_STATE": "This product cannot be sold in the customer's state. Offer an alternative.",
    "INSUFFICIENT_STOCK": "Stock is lower than requested. Offer to take what is available, wait, or take available now and backorder the rest.",
    "BELOW_MOQ": "The quantity is below the minimum order. Tell the customer the minimum and suggest it.",
    "NO_PRICE": "No price is set for this pack. Offer to connect the customer to the team.",
    "UNKNOWN_SKU": "One of the pack codes is wrong. Search the product again to get the correct pack.",
    "SKU_NOT_FOUND": "One of the packs is no longer available. Search the product again.",
    "NO_ITEMS": "No items were given for the order.",
    "INVALID_QUANTITY": "Quantity must be a whole number of cartons greater than zero.",
    "ORDER_NOT_FOUND": "No order with that number was found for this customer.",
    "CANNOT_CANCEL": "The order has already been dispatched or closed, so it cannot be cancelled. Offer to connect the team.",
    "NO_DOSAGE_FOR_CROP": "This product is not recommended for that crop on its label. Do not advise it for this crop.",
}


class DBError(Exception):
    def __init__(self, code: str, detail: str | None = None) -> None:
        self.code = code
        self.detail = detail
        super().__init__(code)

    def for_llm(self) -> str:
        hint = ERROR_HINTS.get(
            self.code, "Something went wrong. Apologise and offer to connect the team."
        )
        return f"{self.code}: {hint}" + (f" ({self.detail})" if self.detail else "")


class DB:
    def __init__(self, client: AsyncClient) -> None:
        self._c = client

    @classmethod
    async def connect(cls) -> DB:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        return cls(await acreate_client(url, key))

    async def rpc(
        self, fn: str, params: dict[str, Any], keep_nulls: bool = False
    ) -> Any:
        # Omit empty optional args so SQL defaults apply; keep_nulls for required-but-nullable args.
        clean = (
            params if keep_nulls else {k: v for k, v in params.items() if v is not None}
        )
        try:
            res = await self._c.rpc(fn, clean).execute()
            return res.data
        except APIError as e:
            code = (e.message or "").strip().split()[0] if e.message else "DB_ERROR"
            logger.warning("rpc %s failed: %s %s", fn, e.message, e.details)
            raise DBError(code, e.details) from e

    # ---------- customers ----------
    async def find_customer(self, mobile: str) -> dict | None:
        return await self.rpc("agent_find_customer", {"p_mobile": mobile})

    async def customer_profile(self, customer_id: str) -> dict:
        return await self.rpc("agent_customer_profile", {"p_customer_id": customer_id})

    async def register_customer(self, **kw: Any) -> dict:
        return await self.rpc(
            "agent_register_customer", {f"p_{k}": v for k, v in kw.items()}
        )

    async def update_customer(self, customer_id: str, changes: dict) -> dict:
        return await self.rpc(
            "agent_update_customer",
            {"p_customer_id": customer_id, "p_changes": changes},
        )

    async def upsert_crop(
        self,
        customer_id: str,
        crop: str,
        acres: float | None,
        season: str | None,
        sowing_date: str | None,
        remove: bool,
    ) -> dict:
        return await self.rpc(
            "agent_upsert_crop",
            {
                "p_customer_id": customer_id,
                "p_crop": crop,
                "p_acres": acres,
                "p_season": season,
                "p_sowing_date": sowing_date,
                "p_remove": remove,
            },
        )

    # ---------- catalogue ----------
    async def search_products(
        self,
        query: str | None,
        crop: str | None,
        category: str | None,
        state: str | None,
        role: str | None,
        limit: int = 3,
    ) -> list:
        return await self.rpc(
            "agent_search_products",
            {
                "p_query": query,
                "p_crop": crop,
                "p_category": category,
                "p_state": state,
                "p_role": role,
                "p_limit": limit,
            },
        )

    async def alternatives(self, sku_code: str, state: str, role: str | None) -> list:
        return await self.rpc(
            "agent_alternatives",
            {"p_sku_code": sku_code, "p_state": state, "p_role": role},
        )

    # ---------- trade ----------
    async def quote(self, customer_id: str, role: str, items: list[dict]) -> dict:
        return await self.rpc(
            "agent_quote",
            {"p_customer_id": customer_id, "p_role": role, "p_items": items},
        )

    async def place_order(
        self,
        customer_id: str,
        role: str,
        items: list[dict],
        payment_mode: str,
        channel: str,
        conversation_id: str | None,
    ) -> dict:
        return await self.rpc(
            "agent_place_order",
            {
                "p_customer_id": customer_id,
                "p_role": role,
                "p_items": items,
                "p_payment_mode": payment_mode,
                "p_channel": channel,
                "p_conversation_id": conversation_id,
            },
        )

    async def orders(
        self, customer_id: str, order_number: str | None, limit: int = 5
    ) -> list:
        return await self.rpc(
            "agent_orders",
            {
                "p_customer_id": customer_id,
                "p_order_number": order_number,
                "p_limit": limit,
            },
        )

    async def cancel_order(self, customer_id: str, order_number: str) -> dict:
        return await self.rpc(
            "agent_cancel_order",
            {"p_customer_id": customer_id, "p_order_number": order_number},
        )

    async def save_cart(self, customer_id: str, items: list[dict]) -> None:
        await self.rpc(
            "agent_save_cart", {"p_customer_id": customer_id, "p_items": items}
        )

    async def log_restock(
        self, customer_id: str, sku_code: str, qty: int | None
    ) -> dict:
        return await self.rpc(
            "agent_log_restock",
            {"p_customer_id": customer_id, "p_sku_code": sku_code, "p_qty": qty},
        )

    async def log_demand(self, customer_id: str | None, query: str) -> None:
        await self.rpc(
            "agent_log_demand",
            {"p_customer_id": customer_id, "p_query": query},
            keep_nulls=True,
        )

    # ---------- advisory ----------
    async def crop_issues(self, crop: str, state: str | None) -> list:
        return await self.rpc("agent_crop_issues", {"p_crop": crop, "p_state": state})

    async def farmer_quantity(self, product: str, crop: str, acres: float) -> dict:
        return await self.rpc(
            "agent_farmer_quantity",
            {"p_product": product, "p_crop": crop, "p_acres": acres},
        )

    async def nearby_retailers(
        self, product: str, pincode: str | None, state: str, district: str | None
    ) -> list:
        return await self.rpc(
            "agent_nearby_retailers",
            {
                "p_product": product,
                "p_pincode": pincode,
                "p_state": state,
                "p_district": district,
            },
        )

    async def save_advisory(self, **kw: Any) -> dict:
        return await self.rpc(
            "agent_save_advisory", {f"p_{k}": v for k, v in kw.items()}
        )

    async def escalate(
        self, customer_id: str | None, conversation_id: str | None, reason: str
    ) -> dict:
        return await self.rpc(
            "agent_escalate",
            {
                "p_customer_id": customer_id,
                "p_conversation_id": conversation_id,
                "p_reason": reason,
            },
            keep_nulls=True,
        )

    # ---------- conversation log (direct table writes) ----------
    async def start_conversation(
        self, channel: str, room: str, language: str
    ) -> str | None:
        try:
            res = (
                await self._c.table("conversations")
                .insert(
                    {"channel": channel, "livekit_room": room, "language": language}
                )
                .execute()
            )
            return res.data[0]["id"]
        except Exception:
            logger.exception("could not start conversation log")
            return None

    async def update_conversation(self, conversation_id: str, fields: dict) -> None:
        try:
            await (
                self._c.table("conversations")
                .update(fields)
                .eq("id", conversation_id)
                .execute()
            )
        except Exception:
            logger.exception("could not update conversation")

    async def log_message(
        self, conversation_id: str, sender: str, content: str
    ) -> None:
        try:
            await (
                self._c.table("messages")
                .insert(
                    {
                        "conversation_id": conversation_id,
                        "sender": sender,
                        "content": content,
                    }
                )
                .execute()
            )
        except Exception:
            logger.exception("could not log message")


def compact(data: Any) -> str:
    """Serialise tool results compactly for the LLM."""
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"), default=str)

# ruff: noqa: N812
"""Offline tests for the agent's tool logic (no LLM, no network).

Run: uv run pytest
Full conversation tests against LiveKit Cloud live in scenarios.yaml
(`lk agent simulate text --scenarios scenarios.yaml`).
"""

import asyncio
import os

import pytest

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test")

from livekit.agents import ToolError
from livekit.agents.llm import ToolContext
from livekit.plugins import sarvam

import agent as A
import languages as L


class FakeDB:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def __getattr__(self, name):
        async def fn(*args, **kwargs):
            self.calls.append(name)
            if name == "find_customer":
                return {
                    "customer_id": "c1",
                    "name": "Anil",
                    "roles": ["retailer"],
                    "state_code": "MH",
                    "state": "Maharashtra",
                    "language": "mr-IN",
                    "crops": [],
                }
            if name == "quote":
                return {
                    "lines": [
                        {"sku_code": "SYN-PEGA-250G", "status": "ok"},
                        {"sku_code": "FMC-CORA-300ML", "status": "out_of_stock"},
                    ]
                }
            if name == "place_order":
                return {"order_number": "ORD1001"}
            if name == "customer_profile":
                return {"customer_id": "c1", "name": "Anil", "roles": ["retailer"]}
            if name == "farmer_quantity":
                return {"acres": args[2]}
            if name in ("register_customer", "upsert_crop"):
                return {
                    "customer_id": "c1",
                    "name": "Ravi",
                    "roles": ["farmer"],
                    "crops": [],
                }
            return {}

        return fn


class Ctx:
    pass


@pytest.fixture
def state(monkeypatch):
    async def noop(self, *a, **k):
        return None

    monkeypatch.setattr(A.BaseAgent, "update_instructions", noop)
    tts = sarvam.TTS(
        target_language_code="hi-IN", model="bulbul:v3", speaker="priya", api_key="x"
    )
    return A.SessionState(db=FakeDB(), tts=tts, room_name="test")


def line(code: str, cartons: int = 3) -> A.OrderLine:
    return A.OrderLine(sku_code=code, cartons=cartons, allow_backorder=False)


def test_tool_schemas_are_valid_for_openai_strict_mode(state):
    for cls in (A.IntakeAgent, A.TradeAgent, A.FarmerAgent):
        schemas = ToolContext(cls(state=state).tools).parse_function_tools(
            "openai", strict=True
        )
        assert schemas


def test_language_normalisation():
    assert L.normalise("Marathi") == "mr-IN"
    assert L.normalise("as-IN") == "bn-IN"  # Assamese falls back to Bengali voice
    assert L.normalise(None) == "hi-IN"


async def test_lookup_hands_off_to_trade_agent_and_switches_language(state):
    intake = A.IntakeAgent(state=state)
    with pytest.raises(ToolError):
        await intake.lookup_customer(Ctx(), "12345")
    agent, _ = await intake.lookup_customer(Ctx(), "+91 90000 00007")
    assert isinstance(agent, A.TradeAgent)
    assert state.language == "mr-IN"


async def test_order_requires_fresh_confirmed_quote(state):
    agent, _ = await A.IntakeAgent(state=state).lookup_customer(Ctx(), "9000000007")
    items = [line("syn-pega-250g")]
    with pytest.raises(ToolError):  # no quote yet
        await agent.place_order(Ctx(), items, True)
    await agent.quote_order(Ctx(), items)
    with pytest.raises(ToolError):  # customer did not confirm
        await agent.place_order(Ctx(), items, False)
    with pytest.raises(ToolError):  # item was out of stock in the quote
        await agent.place_order(Ctx(), [line("FMC-CORA-300ML", 1)], True)
    assert "ORD1001" in await agent.place_order(Ctx(), items, True)


def test_rejects_zero_cartons():
    with pytest.raises(ToolError):
        A.TradeAgent._lines([line("X", 0)])


async def test_farmer_quantity_uses_saved_acres(state):
    state.customer = {
        "customer_id": "c1",
        "roles": ["farmer"],
        "crops": [{"crop": "onion", "acres": 2}],
    }
    farmer = A.FarmerAgent(state=state)
    assert '"acres":2.0' in await farmer.calculate_quantity(
        Ctx(), "Amistar Top", "Onion"
    )
    with pytest.raises(ToolError):  # farmer-only customers cannot order trade stock
        await farmer.switch_to_ordering(Ctx())


async def test_new_crop_is_saved_and_advice_logged(state):
    state.customer = {"customer_id": "c1", "roles": ["farmer"], "crops": []}
    farmer = A.FarmerAgent(state=state)
    with pytest.raises(ToolError):  # must not guess acres for an unsaved crop
        await farmer.calculate_quantity(Ctx(), "Tilt", "soybean")
    await farmer.calculate_quantity(
        Ctx(), "Tilt", "soybean", symptoms="yellow leaves", acres=3
    )
    await asyncio.sleep(0)
    assert "upsert_crop" in state.db.calls
    assert "save_advisory" in state.db.calls


async def test_registration_saves_farmer_crops(state):
    intake = A.IntakeAgent(state=state)
    state.pending_mobile = "9876500001"
    agent, _ = await intake.register_customer(
        Ctx(), "farmer", "Ravi", "Punjab", crops=[A.CropAcres(crop="wheat", acres=6)]
    )
    assert isinstance(agent, A.FarmerAgent)
    assert state.db.calls.count("upsert_crop") == 1

"""Integration tests for the agent CRUD critical path (hits live backend)."""
import uuid

import pytest

pytestmark = pytest.mark.asyncio


async def test_health(http):
    r = await http.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["db"] is True
    assert body["redis"] is True


async def test_agent_crud_round_trip(http):
    name = f"pytest-agent-{uuid.uuid4().hex[:8]}"
    payload = {
        "name": name,
        "role": "test fixture",
        "system_prompt": "You are a unit-test fixture.",
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.3,
        "max_tokens": 256,
        "tools": ["calculator"],
        "channels": [],
    }

    # CREATE
    r = await http.post("/agents", json=payload)
    assert r.status_code == 201, r.text
    created = r.json()
    agent_id = created["id"]
    assert created["name"] == name
    assert created["tools"] == ["calculator"]

    try:
        # GET
        r = await http.get(f"/agents/{agent_id}")
        assert r.status_code == 200
        assert r.json()["id"] == agent_id

        # LIST contains it
        r = await http.get("/agents")
        assert r.status_code == 200
        assert any(a["id"] == agent_id for a in r.json())

        # PATCH
        r = await http.patch(
            f"/agents/{agent_id}",
            json={"temperature": 0.9, "max_tokens": 512},
        )
        assert r.status_code == 200
        updated = r.json()
        assert updated["temperature"] == 0.9
        assert updated["max_tokens"] == 512
        # untouched fields preserved
        assert updated["name"] == name

    finally:
        # DELETE — also verifies cleanup
        r = await http.delete(f"/agents/{agent_id}")
        assert r.status_code == 204

        r = await http.get(f"/agents/{agent_id}")
        assert r.status_code == 404


async def test_agent_create_rejects_blank_name(http):
    r = await http.post("/agents", json={"name": ""})
    assert r.status_code == 422  # pydantic validation error

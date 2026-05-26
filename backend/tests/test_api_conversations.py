"""Integration tests for the message-delivery critical path (conversation persistence)."""
import uuid

import pytest

pytestmark = pytest.mark.asyncio


async def test_conversations_endpoint_listable(http):
    r = await http.get("/conversations")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_conversation_messages_for_missing_conv_404(http):
    fake = uuid.uuid4()
    r = await http.get(f"/conversations/{fake}/messages")
    assert r.status_code == 404


async def test_tools_endpoint_exposes_registry(http):
    r = await http.get("/tools")
    assert r.status_code == 200
    tools = r.json()["tools"]
    # Critical tools used by templates must be registered.
    assert "calculator" in tools
    assert "current_time" in tools
    assert "web_search" in tools


async def test_stats_endpoint_shape(http):
    r = await http.get("/stats")
    assert r.status_code == 200
    body = r.json()
    assert "totals" in body
    assert "recent_agent_runs" in body
    assert "recent_workflow_runs" in body
    totals = body["totals"]
    for key in ("agents", "workflows", "input_tokens", "output_tokens", "cost_usd"):
        assert key in totals

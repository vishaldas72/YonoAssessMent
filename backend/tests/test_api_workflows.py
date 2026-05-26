"""Integration tests for the workflow execution critical path."""
import uuid

import pytest

pytestmark = pytest.mark.asyncio


async def test_workflow_round_trip(http):
    # Create a throwaway agent so we can reference it from a graph node
    agent_payload = {
        "name": f"pytest-agent-{uuid.uuid4().hex[:8]}",
        "model": "llama-3.3-70b-versatile",
        "tools": [],
    }
    r = await http.post("/agents", json=agent_payload)
    assert r.status_code == 201
    agent_id = r.json()["id"]

    # Create the workflow
    wf_payload = {"name": f"pytest-wf-{uuid.uuid4().hex[:8]}", "description": "round-trip"}
    r = await http.post("/workflows", json=wf_payload)
    assert r.status_code == 201
    wf = r.json()
    wf_id = wf["id"]
    assert wf["version"] == 1

    try:
        # Patch with a real linear graph
        graph = {
            "graph": {
                "nodes": [
                    {"id": "n1", "type": "start", "position": {"x": 0, "y": 0}, "data": {}},
                    {
                        "id": "n2",
                        "type": "agent",
                        "position": {"x": 200, "y": 0},
                        "data": {"agent_id": agent_id, "label": "agent"},
                    },
                    {"id": "n3", "type": "end", "position": {"x": 400, "y": 0}, "data": {}},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                ],
            }
        }
        r = await http.patch(f"/workflows/{wf_id}", json=graph)
        assert r.status_code == 200
        patched = r.json()
        assert patched["version"] == 2
        assert len(patched["graph"]["nodes"]) == 3
        assert len(patched["graph"]["edges"]) == 2

        # Reload — graph persisted exactly
        r = await http.get(f"/workflows/{wf_id}")
        assert r.status_code == 200
        reloaded = r.json()
        assert reloaded["graph"]["nodes"][1]["data"]["agent_id"] == agent_id

    finally:
        # Clean up
        await http.delete(f"/workflows/{wf_id}")
        await http.delete(f"/agents/{agent_id}")


async def test_workflow_rejects_dangling_edge(http):
    # An edge pointing at a non-existent node must be rejected by schema validation
    bad = {
        "name": f"pytest-bad-{uuid.uuid4().hex[:8]}",
        "graph": {
            "nodes": [
                {"id": "n1", "type": "start", "position": {"x": 0, "y": 0}, "data": {}},
                {"id": "n2", "type": "end", "position": {"x": 200, "y": 0}, "data": {}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "target": "n999"},  # n999 doesn't exist
            ],
        },
    }
    r = await http.post("/workflows", json=bad)
    assert r.status_code == 422
    assert "unknown node" in r.text or "n999" in r.text


async def test_template_seeded_and_instantiable(http):
    # The seeder runs at startup; verify both templates are present.
    r = await http.get("/workflows")
    assert r.status_code == 200
    templates = [w for w in r.json() if w["is_template"]]
    assert len(templates) >= 2

    research = next(
        (w for w in templates if "Research" in w["name"]), None
    )
    assert research is not None, "Research template not seeded"

    # Instantiate it
    r = await http.post(f"/workflows/{research['id']}/instantiate")
    assert r.status_code == 201
    clone = r.json()
    try:
        assert clone["is_template"] is False
        assert clone["name"].endswith("(copy)")
        # Clone graph is identical structure
        assert len(clone["graph"]["nodes"]) == len(research["graph"]["nodes"])
    finally:
        await http.delete(f"/workflows/{clone['id']}")

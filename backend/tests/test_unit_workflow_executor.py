"""Unit tests for the workflow executor's topology logic (no I/O, no LLM)."""
import pytest

from app.runtime.workflow import WorkflowExecutionError, topological_order


def _graph(nodes, edges):
    return {"nodes": nodes, "edges": edges}


def test_linear_pipeline_orders_correctly():
    g = _graph(
        nodes=[
            {"id": "n1", "type": "start"},
            {"id": "n2", "type": "agent", "data": {"agent_id": "a"}},
            {"id": "n3", "type": "agent", "data": {"agent_id": "b"}},
            {"id": "n4", "type": "end"},
        ],
        edges=[
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4"},
        ],
    )
    order = topological_order(g)
    assert [n["id"] for n in order] == ["n1", "n2", "n3", "n4"]


def test_missing_start_raises():
    g = _graph(
        nodes=[{"id": "n1", "type": "agent"}, {"id": "n2", "type": "end"}],
        edges=[{"id": "e1", "source": "n1", "target": "n2"}],
    )
    with pytest.raises(WorkflowExecutionError, match="no start"):
        topological_order(g)


def test_missing_end_raises():
    g = _graph(
        nodes=[{"id": "n1", "type": "start"}, {"id": "n2", "type": "agent"}],
        edges=[{"id": "e1", "source": "n1", "target": "n2"}],
    )
    with pytest.raises(WorkflowExecutionError, match="no end"):
        topological_order(g)


def test_dangling_node_raises():
    # n2 (agent) has no outgoing edge and is not the end node
    g = _graph(
        nodes=[
            {"id": "n1", "type": "start"},
            {"id": "n2", "type": "agent"},
            {"id": "n3", "type": "end"},
        ],
        edges=[{"id": "e1", "source": "n1", "target": "n2"}],
    )
    with pytest.raises(WorkflowExecutionError, match="no outgoing edge"):
        topological_order(g)


def test_cycle_detected():
    g = _graph(
        nodes=[
            {"id": "n1", "type": "start"},
            {"id": "n2", "type": "agent"},
            {"id": "n3", "type": "agent"},
            {"id": "n4", "type": "end"},
        ],
        edges=[
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n2"},  # cycle
        ],
    )
    with pytest.raises(WorkflowExecutionError, match="Cycle"):
        topological_order(g)

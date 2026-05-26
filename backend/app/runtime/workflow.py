"""Workflow executor.

Linear pipeline: start → agent₁ → agent₂ → … → end.
Each agent node receives the output of the previous node as its prompt.
The first agent receives the workflow's input. The end node's input is the final output.
"""
from __future__ import annotations

import uuid
from typing import Any, AsyncIterator


from app.models.workflow import Workflow
from app.repos import agents as agents_repo
from app.runtime.agent import run_agent_stream


class WorkflowExecutionError(Exception):
    pass


def topological_order(graph: dict) -> list[dict]:
    """Return nodes in execution order. Requires exactly one start, one end, linear.

    For M5 we don't support branching — if a node has multiple successors we pick the
    first deterministically (sorted by target id) and warn via the returned events.
    """
    nodes = {n["id"]: n for n in graph.get("nodes", [])}
    edges = graph.get("edges", [])
    succ: dict[str, list[str]] = {n: [] for n in nodes}
    for e in edges:
        if e["source"] in succ and e["target"] in nodes:
            succ[e["source"]].append(e["target"])
    for k in succ:
        succ[k].sort()

    starts = [n for n in nodes.values() if n["type"] == "start"]
    if not starts:
        raise WorkflowExecutionError("Workflow has no start node")
    if len(starts) > 1:
        raise WorkflowExecutionError("Workflow has multiple start nodes")
    ends = [n for n in nodes.values() if n["type"] == "end"]
    if not ends:
        raise WorkflowExecutionError("Workflow has no end node")

    order: list[dict] = []
    visited: set[str] = set()
    current = starts[0]["id"]
    while current is not None:
        if current in visited:
            raise WorkflowExecutionError(f"Cycle detected at node {current}")
        visited.add(current)
        order.append(nodes[current])
        if nodes[current]["type"] == "end":
            break
        next_nodes = succ.get(current, [])
        if not next_nodes:
            raise WorkflowExecutionError(
                f"Node {current} has no outgoing edge and is not an end node"
            )
        current = next_nodes[0]
    return order


async def execute_workflow_stream(
    session_factory,
    workflow: Workflow,
    input_text: str,
) -> AsyncIterator[dict[str, Any]]:
    """Yield events as the workflow runs. Caller persists + publishes them.

    Events emitted:
      - workflow_started {input}
      - node_started {node_id, node_type, agent?}
      - any event from the single-agent runtime (assistant_message, tool_result, …)
        decorated with node_id
      - node_finished {node_id, output, input_tokens, output_tokens}
      - workflow_finished {output, input_tokens, output_tokens}
      - error {error}
    """
    graph = workflow.graph or {}
    try:
        order = topological_order(graph)
    except WorkflowExecutionError as e:
        yield {"type": "error", "error": str(e)}
        return

    yield {"type": "workflow_started", "input": input_text}

    current_text = input_text
    total_in = 0
    total_out = 0

    for node in order:
        node_id = node["id"]
        node_type = node["type"]

        if node_type == "start":
            yield {"type": "node_started", "node_id": node_id, "node_type": "start"}
            yield {"type": "node_finished", "node_id": node_id, "output": current_text}
            continue

        if node_type == "end":
            yield {"type": "node_started", "node_id": node_id, "node_type": "end"}
            yield {"type": "node_finished", "node_id": node_id, "output": current_text}
            break

        if node_type == "agent":
            agent_id = (node.get("data") or {}).get("agent_id")
            if not agent_id:
                yield {
                    "type": "error",
                    "node_id": node_id,
                    "error": f"Agent node {node_id} has no bound agent",
                }
                return

            async with session_factory() as session:
                agent = await agents_repo.get_agent(session, uuid.UUID(str(agent_id)))
            if agent is None:
                yield {
                    "type": "error",
                    "node_id": node_id,
                    "error": f"Agent {agent_id} not found",
                }
                return

            yield {
                "type": "node_started",
                "node_id": node_id,
                "node_type": "agent",
                "agent_id": str(agent.id),
                "agent_name": agent.name,
            }

            node_in = 0
            node_out = 0
            final_text: str | None = None
            try:
                async for ev in run_agent_stream(agent, current_text):
                    ev_out = {**ev, "node_id": node_id}
                    if ev.get("type") == "assistant_message":
                        node_in += ev.get("input_tokens") or 0
                        node_out += ev.get("output_tokens") or 0
                        if not ev.get("tool_calls") and ev.get("content"):
                            final_text = ev["content"]
                    yield ev_out
            except Exception as e:
                yield {"type": "error", "node_id": node_id, "error": str(e)}
                return

            total_in += node_in
            total_out += node_out
            current_text = final_text or current_text

            yield {
                "type": "node_finished",
                "node_id": node_id,
                "output": current_text,
                "input_tokens": node_in,
                "output_tokens": node_out,
            }
            continue

        yield {
            "type": "error",
            "node_id": node_id,
            "error": f"Unsupported node type: {node_type}",
        }
        return

    yield {
        "type": "workflow_finished",
        "output": current_text,
        "input_tokens": total_in,
        "output_tokens": total_out,
    }

"""Single-agent runtime built on LangGraph's prebuilt ReAct agent."""
from __future__ import annotations

from typing import Any, AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from app.models.agent import Agent
from app.runtime.llm import get_llm
from app.runtime.tools import get_tools


def build_agent(agent: Agent):
    llm = get_llm(
        model=agent.model or None,
        temperature=agent.temperature,
        max_tokens=agent.max_tokens,
    )
    tools = get_tools(agent.tools or [])
    return create_react_agent(llm, tools)


async def run_agent_stream(
    agent: Agent,
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Yield runtime events: messages, tool calls, tool results, errors.

    `history`: list of {role: 'user'|'assistant', content: str} for prior turns.
    Each event is a JSON-serializable dict with at least a `type` field.
    """
    graph = build_agent(agent)

    messages: list = []
    if agent.system_prompt:
        messages.append(SystemMessage(content=agent.system_prompt))
    for h in history or []:
        role = h.get("role")
        content = h.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=prompt))

    yield {"type": "run_started", "prompt": prompt}

    try:
        async for chunk in graph.astream({"messages": messages}, stream_mode="updates"):
            for node_name, node_state in chunk.items():
                new_messages = node_state.get("messages") if isinstance(node_state, dict) else None
                if not new_messages:
                    continue
                for msg in new_messages:
                    yield _serialize_message(node_name, msg)
    except Exception as e:
        yield {"type": "error", "error": str(e)}
        raise

    yield {"type": "run_finished"}


def _serialize_message(node: str, msg) -> dict[str, Any]:
    cls = msg.__class__.__name__

    if cls == "AIMessage":
        tool_calls = []
        for tc in getattr(msg, "tool_calls", []) or []:
            tool_calls.append({
                "id": tc.get("id"),
                "name": tc.get("name"),
                "args": tc.get("args", {}),
            })
        usage = getattr(msg, "usage_metadata", None) or {}
        return {
            "type": "assistant_message",
            "node": node,
            "content": _msg_text(msg.content),
            "tool_calls": tool_calls,
            "input_tokens": usage.get("input_tokens"),
            "output_tokens": usage.get("output_tokens"),
        }
    if cls == "ToolMessage":
        return {
            "type": "tool_result",
            "node": node,
            "tool_call_id": getattr(msg, "tool_call_id", None),
            "name": getattr(msg, "name", None),
            "content": _msg_text(msg.content),
        }
    return {
        "type": "message",
        "node": node,
        "class": cls,
        "content": _msg_text(msg.content),
    }


def _msg_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, dict):
                parts.append(c.get("text") or c.get("content") or str(c))
            else:
                parts.append(str(c))
        return "\n".join(parts)
    return str(content)

"""Executes an agent run. Streams events to Redis pub/sub and persists each one."""
import asyncio
import uuid

from app.db import get_sessionmaker
from app.models.agent import Agent
from app.repos import runs as runs_repo
from app.runtime.agent import run_agent_stream
from app.services import bus


async def execute_run(
    run_id: uuid.UUID,
    agent: Agent,
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> str | None:
    """Run the agent and stream events. Designed for asyncio.create_task().

    Returns the final assistant text (or None if the run failed).
    """
    channel = bus.run_channel(run_id)
    sm = get_sessionmaker()
    seq = 0
    in_tokens = 0
    out_tokens = 0
    final_output: str | None = None

    async with sm() as session:
        run = await runs_repo.get_run(session, run_id)
        if run is None:
            return None
        await runs_repo.mark_started(session, run)

    try:
        async for event in run_agent_stream(agent, prompt, history=history):
            seq += 1
            if event.get("type") == "assistant_message":
                in_tokens += event.get("input_tokens") or 0
                out_tokens += event.get("output_tokens") or 0
                if not event.get("tool_calls") and event.get("content"):
                    final_output = event["content"]
            async with sm() as session:
                await runs_repo.add_event(session, run_id, seq, event["type"], event)
            await bus.publish(channel, {"seq": seq, **event})

        async with sm() as session:
            run = await runs_repo.get_run(session, run_id)
            if run is not None:
                await runs_repo.mark_finished(
                    session,
                    run,
                    status="succeeded",
                    output=final_output,
                    input_tokens=in_tokens,
                    output_tokens=out_tokens,
                )
        return final_output
    except Exception as e:
        async with sm() as session:
            run = await runs_repo.get_run(session, run_id)
            if run is not None:
                await runs_repo.mark_finished(
                    session,
                    run,
                    status="failed",
                    error=str(e),
                    input_tokens=in_tokens,
                    output_tokens=out_tokens,
                )
        await bus.publish(channel, {"seq": seq + 1, "type": "error", "error": str(e)})
        return None


def schedule_run(
    run_id: uuid.UUID,
    agent: Agent,
    prompt: str,
    history: list[dict[str, str]] | None = None,
) -> asyncio.Task:
    return asyncio.create_task(execute_run(run_id, agent, prompt, history=history))

"""Executes a workflow run. Persists events and publishes them to Redis."""
import asyncio
import uuid

from app.db import get_sessionmaker
from app.models.workflow import Workflow
from app.repos import workflow_runs as repo
from app.runtime.workflow import execute_workflow_stream
from app.services import bus


def workflow_run_channel(run_id: uuid.UUID) -> str:
    return f"wf_run:{run_id}"


async def execute_workflow_run(
    wf_run_id: uuid.UUID, workflow: Workflow, input_text: str
) -> None:
    """Run the workflow end-to-end. Designed for asyncio.create_task()."""
    sm = get_sessionmaker()
    channel = workflow_run_channel(wf_run_id)
    seq = 0
    in_tokens = 0
    out_tokens = 0
    final_output: str | None = None
    status = "succeeded"
    err: str | None = None

    async with sm() as session:
        run = await repo.get(session, wf_run_id)
        if run is None:
            return
        await repo.mark_started(session, run)

    try:
        async for event in execute_workflow_stream(sm, workflow, input_text):
            seq += 1
            etype = event.get("type")
            node_id = event.get("node_id")

            if etype == "workflow_finished":
                final_output = event.get("output")
                in_tokens = event.get("input_tokens") or 0
                out_tokens = event.get("output_tokens") or 0
            elif etype == "error":
                status = "failed"
                err = event.get("error")

            async with sm() as session:
                await repo.add_event(session, wf_run_id, seq, etype or "unknown", event, node_id)
            await bus.publish(channel, {"seq": seq, **event})

            if etype == "error":
                break
    except Exception as e:
        status = "failed"
        err = str(e)
        seq += 1
        async with sm() as session:
            await repo.add_event(session, wf_run_id, seq, "error", {"type": "error", "error": err})
        await bus.publish(channel, {"seq": seq, "type": "error", "error": err})

    async with sm() as session:
        run = await repo.get(session, wf_run_id)
        if run is not None:
            await repo.mark_finished(
                session,
                run,
                status=status,
                output=final_output,
                error=err,
                input_tokens=in_tokens,
                output_tokens=out_tokens,
            )


def schedule_workflow_run(
    wf_run_id: uuid.UUID, workflow: Workflow, input_text: str
) -> asyncio.Task:
    return asyncio.create_task(execute_workflow_run(wf_run_id, workflow, input_text))

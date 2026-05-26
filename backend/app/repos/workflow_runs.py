import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import WorkflowRun, WorkflowRunEvent


async def create(session: AsyncSession, workflow_id: uuid.UUID, input_text: str) -> WorkflowRun:
    run = WorkflowRun(workflow_id=workflow_id, input=input_text, status="pending")
    session.add(run)
    await session.commit()
    await session.refresh(run)
    return run


async def get(session: AsyncSession, run_id: uuid.UUID) -> WorkflowRun | None:
    return await session.get(WorkflowRun, run_id)


async def list_for_workflow(session: AsyncSession, workflow_id: uuid.UUID) -> list[WorkflowRun]:
    result = await session.execute(
        select(WorkflowRun)
        .where(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.created_at.desc())
    )
    return list(result.scalars().all())


async def mark_started(session: AsyncSession, run: WorkflowRun) -> None:
    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    await session.commit()


async def mark_finished(
    session: AsyncSession,
    run: WorkflowRun,
    status: str,
    output: str | None = None,
    error: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> None:
    run.status = status
    run.output = output
    run.error = error
    run.total_input_tokens = input_tokens
    run.total_output_tokens = output_tokens
    run.finished_at = datetime.now(timezone.utc)
    await session.commit()


async def add_event(
    session: AsyncSession,
    run_id: uuid.UUID,
    seq: int,
    type_: str,
    payload: dict[str, Any],
    node_id: str | None = None,
) -> WorkflowRunEvent:
    ev = WorkflowRunEvent(
        workflow_run_id=run_id, seq=seq, type=type_, payload=payload, node_id=node_id
    )
    session.add(ev)
    await session.commit()
    await session.refresh(ev)
    return ev


async def list_events(session: AsyncSession, run_id: uuid.UUID) -> list[WorkflowRunEvent]:
    result = await session.execute(
        select(WorkflowRunEvent)
        .where(WorkflowRunEvent.workflow_run_id == run_id)
        .order_by(WorkflowRunEvent.seq)
    )
    return list(result.scalars().all())

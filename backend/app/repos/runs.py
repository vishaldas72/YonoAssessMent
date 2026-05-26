import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.run import Run, RunEvent


async def create_run(session: AsyncSession, agent_id: uuid.UUID, prompt: str) -> Run:
    run = Run(agent_id=agent_id, input=prompt, status="pending")
    session.add(run)
    await session.commit()
    await session.refresh(run)
    return run


async def get_run(session: AsyncSession, run_id: uuid.UUID) -> Run | None:
    return await session.get(Run, run_id)


async def list_runs_for_agent(session: AsyncSession, agent_id: uuid.UUID) -> list[Run]:
    result = await session.execute(
        select(Run).where(Run.agent_id == agent_id).order_by(Run.created_at.desc())
    )
    return list(result.scalars().all())


async def mark_started(session: AsyncSession, run: Run) -> None:
    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    await session.commit()


async def mark_finished(
    session: AsyncSession,
    run: Run,
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
    session: AsyncSession, run_id: uuid.UUID, seq: int, type_: str, payload: dict[str, Any]
) -> RunEvent:
    event = RunEvent(run_id=run_id, seq=seq, type=type_, payload=payload)
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event


async def list_events(session: AsyncSession, run_id: uuid.UUID) -> list[RunEvent]:
    result = await session.execute(
        select(RunEvent).where(RunEvent.run_id == run_id).order_by(RunEvent.seq)
    )
    return list(result.scalars().all())

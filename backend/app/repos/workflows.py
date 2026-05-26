import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate


async def list_workflows(session: AsyncSession) -> list[Workflow]:
    result = await session.execute(select(Workflow).order_by(Workflow.updated_at.desc()))
    return list(result.scalars().all())


async def get_workflow(session: AsyncSession, workflow_id: uuid.UUID) -> Workflow | None:
    return await session.get(Workflow, workflow_id)


async def create_workflow(session: AsyncSession, data: WorkflowCreate) -> Workflow:
    payload = data.model_dump()
    payload["graph"] = data.graph.model_dump()
    wf = Workflow(**payload)
    session.add(wf)
    await session.commit()
    await session.refresh(wf)
    return wf


async def update_workflow(
    session: AsyncSession, wf: Workflow, data: WorkflowUpdate
) -> Workflow:
    updates = data.model_dump(exclude_unset=True)
    if "graph" in updates and updates["graph"] is not None:
        assert data.graph is not None  # narrowed by the condition above
        updates["graph"] = data.graph.model_dump()
    for field, value in updates.items():
        setattr(wf, field, value)
    wf.version += 1
    await session.commit()
    await session.refresh(wf)
    return wf


async def delete_workflow(session: AsyncSession, wf: Workflow) -> None:
    await session.delete(wf)
    await session.commit()

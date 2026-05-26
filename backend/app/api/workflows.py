import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.repos import workflows as repo
from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowRead, WorkflowUpdate

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowRead])
async def list_workflows(session: AsyncSession = Depends(get_session)):
    return await repo.list_workflows(session)


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: WorkflowCreate, session: AsyncSession = Depends(get_session)
):
    return await repo.create_workflow(session, payload)


@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(
    workflow_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    wf = await repo.get_workflow(session, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@router.patch("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(
    workflow_id: uuid.UUID,
    payload: WorkflowUpdate,
    session: AsyncSession = Depends(get_session),
):
    wf = await repo.get_workflow(session, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await repo.update_workflow(session, wf, payload)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    wf = await repo.get_workflow(session, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await repo.delete_workflow(session, wf)
    return None


@router.post(
    "/{workflow_id}/instantiate",
    response_model=WorkflowRead,
    status_code=status.HTTP_201_CREATED,
)
async def instantiate_template(
    workflow_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    template = await repo.get_workflow(session, workflow_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not template.is_template:
        raise HTTPException(status_code=400, detail="Source workflow is not a template")
    clone = Workflow(
        name=f"{template.name} (copy)",
        description=template.description,
        graph=template.graph,
        is_template=False,
        version=1,
    )
    session.add(clone)
    await session.commit()
    await session.refresh(clone)
    return clone

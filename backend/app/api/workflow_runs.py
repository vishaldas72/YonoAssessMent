import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session, get_sessionmaker
from app.repos import workflow_runs as runs_repo
from app.repos import workflows as wf_repo
from app.schemas.workflow import (
    WorkflowRunCreate,
    WorkflowRunEventRead,
    WorkflowRunRead,
)
from app.services import bus
from app.services.workflow_runner import schedule_workflow_run, workflow_run_channel

router = APIRouter(tags=["workflow-runs"])


@router.post(
    "/workflows/{workflow_id}/runs",
    response_model=WorkflowRunRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_workflow_run(
    workflow_id: uuid.UUID,
    payload: WorkflowRunCreate,
    session: AsyncSession = Depends(get_session),
):
    wf = await wf_repo.get_workflow(session, workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    run = await runs_repo.create(session, workflow_id, payload.input)
    schedule_workflow_run(run.id, wf, payload.input)
    return run


@router.get("/workflows/{workflow_id}/runs", response_model=list[WorkflowRunRead])
async def list_workflow_runs(
    workflow_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    return await runs_repo.list_for_workflow(session, workflow_id)


@router.get("/workflow-runs/{run_id}", response_model=WorkflowRunRead)
async def get_workflow_run(
    run_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    run = await runs_repo.get(session, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    return run


@router.get("/workflow-runs/{run_id}/events", response_model=list[WorkflowRunEventRead])
async def get_workflow_run_events(
    run_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    return await runs_repo.list_events(session, run_id)


@router.websocket("/ws/workflow-runs/{run_id}")
async def workflow_run_ws(websocket: WebSocket, run_id: uuid.UUID):
    await websocket.accept()
    sm = get_sessionmaker()

    async with sm() as session:
        run = await runs_repo.get(session, run_id)
        if run is None:
            await websocket.close(code=4404)
            return
        events = await runs_repo.list_events(session, run_id)
        for ev in events:
            await websocket.send_json({"seq": ev.seq, **ev.payload})
        if run.status in {"succeeded", "failed"}:
            await websocket.send_json({"type": "run_closed", "status": run.status})
            await websocket.close()
            return

    channel = workflow_run_channel(run_id)
    try:
        async for event in bus.subscribe(channel):
            await websocket.send_json(event)
            etype = event.get("type")
            if etype in {"workflow_finished", "error"}:
                break
    except WebSocketDisconnect:
        return
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

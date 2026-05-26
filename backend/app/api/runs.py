import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session, get_sessionmaker
from app.repos import agents as agents_repo
from app.repos import runs as runs_repo
from app.runtime.tools import list_tool_names
from app.schemas.run import RunCreate, RunEventRead, RunRead
from app.services import bus
from app.services.runner import schedule_run

router = APIRouter(tags=["runs"])


@router.get("/tools")
async def list_tools():
    return {"tools": list_tool_names()}


@router.post(
    "/agents/{agent_id}/runs",
    response_model=RunRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_run(
    agent_id: uuid.UUID,
    payload: RunCreate,
    session: AsyncSession = Depends(get_session),
):
    agent = await agents_repo.get_agent(session, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    run = await runs_repo.create_run(session, agent_id, payload.prompt)
    schedule_run(run.id, agent, payload.prompt)
    return run


@router.get("/agents/{agent_id}/runs", response_model=list[RunRead])
async def list_agent_runs(
    agent_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    return await runs_repo.list_runs_for_agent(session, agent_id)


@router.get("/runs/{run_id}", response_model=RunRead)
async def get_run(run_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    run = await runs_repo.get_run(session, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/runs/{run_id}/events", response_model=list[RunEventRead])
async def get_run_events(
    run_id: uuid.UUID, session: AsyncSession = Depends(get_session)
):
    return await runs_repo.list_events(session, run_id)


@router.websocket("/ws/runs/{run_id}")
async def run_events_ws(websocket: WebSocket, run_id: uuid.UUID):
    await websocket.accept()

    # Replay any events already persisted so late subscribers see history.
    sm = get_sessionmaker()
    async with sm() as session:
        run = await runs_repo.get_run(session, run_id)
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

    channel = bus.run_channel(run_id)
    try:
        async for event in bus.subscribe(channel):
            await websocket.send_json(event)
            if event.get("type") in {"run_finished", "error"}:
                break
    except WebSocketDisconnect:
        return
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

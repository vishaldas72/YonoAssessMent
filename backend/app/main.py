import asyncio
import logging
from contextlib import asynccontextmanager

import redis.asyncio as redis_async
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.agents import router as agents_router
from app.api.conversations import router as conversations_router
from app.api.models import router as models_router
from app.api.runs import router as runs_router
from app.api.stats import router as stats_router
from app.api.workflow_runs import router as workflow_runs_router
from app.api.workflows import router as workflows_router
from app.channels.telegram import run_telegram_worker
from app.config import settings
from app.db import dispose_engine, get_engine, init_db
from app.seed import seed_starter_content

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_starter_content()
    app.state.redis = redis_async.from_url(settings.redis_url, decode_responses=True)

    stop_event = asyncio.Event()
    tg_task = asyncio.create_task(run_telegram_worker(stop_event))
    app.state.telegram_stop = stop_event
    app.state.telegram_task = tg_task

    try:
        yield
    finally:
        stop_event.set()
        try:
            await asyncio.wait_for(tg_task, timeout=5.0)
        except asyncio.TimeoutError:
            tg_task.cancel()
        await app.state.redis.close()
        await dispose_engine()


app = FastAPI(title="Yuno Agent Orchestrator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router)
app.include_router(runs_router)
app.include_router(conversations_router)
app.include_router(workflows_router)
app.include_router(workflow_runs_router)
app.include_router(stats_router)
app.include_router(models_router)


@app.get("/health")
async def health():
    db_ok = False
    redis_ok = False
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False
    try:
        pong = await app.state.redis.ping()
        redis_ok = bool(pong)
    except Exception:
        redis_ok = False

    status_str = "ok" if db_ok and redis_ok else "degraded"
    return {"status": status_str, "db": db_ok, "redis": redis_ok}


@app.get("/")
async def root():
    return {"service": "yuno-agent-orchestrator", "milestone": "M1"}

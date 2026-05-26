"""Telegram long-polling worker.

One agent (the first one with 'telegram' in its `channels` list) is the responder.
Each incoming user message becomes a Run; the run's final output is sent back.
Conversation continuity is preserved per Telegram chat via the conversations table.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_sessionmaker
from app.models.agent import Agent
from app.repos import conversations as conv_repo
from app.repos import runs as runs_repo
from app.services.runner import execute_run

log = logging.getLogger(__name__)

API_BASE = "https://api.telegram.org"
CHANNEL = "telegram"
HISTORY_LIMIT = 20  # last N messages passed to the agent as context


async def _send_message(client: httpx.AsyncClient, chat_id: int | str, text: str) -> None:
    if not text:
        return
    try:
        # Telegram caps message length at 4096 chars.
        for chunk in _chunk_text(text, 4000):
            await client.post(
                f"{API_BASE}/bot{settings.telegram_bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": chunk},
                timeout=15.0,
            )
    except Exception as e:
        log.warning("Telegram sendMessage failed: %s", e)


def _chunk_text(text: str, size: int):
    for i in range(0, len(text), size):
        yield text[i: i + size]


async def _find_telegram_agent(session: AsyncSession) -> Agent | None:
    result = await session.execute(
        select(Agent).where(Agent.channels.contains(["telegram"])).order_by(Agent.created_at)
    )
    return result.scalars().first()


async def _handle_message(
    chat_id: int,
    user_text: str,
    sender_name: str | None,
    client: httpx.AsyncClient,
) -> None:
    sm = get_sessionmaker()

    async with sm() as session:
        agent = await _find_telegram_agent(session)
        if agent is None:
            await _send_message(
                client,
                chat_id,
                "⚠️ No agent is bound to the telegram channel. Open the UI and add 'telegram' to an agent's channels.",
            )
            return

        conv = await conv_repo.get_or_create(
            session,
            channel=CHANNEL,
            external_id=str(chat_id),
            agent_id=agent.id,
            title=sender_name,
        )

        prior_messages = await conv_repo.list_messages(session, conv.id)
        history = [
            {"role": m.role, "content": m.content} for m in prior_messages[-HISTORY_LIMIT:]
        ]

        await conv_repo.add_message(session, conv, role="user", content=user_text)

        run = await runs_repo.create_run(session, agent.id, user_text)
        agent_for_run = agent  # detach-safe; agent is a fully loaded object

    output = await execute_run(run.id, agent_for_run, user_text, history=history)
    reply = output or "⚠️ The agent did not produce a reply."

    async with sm() as session:
        conv_reload = await conv_repo.get_conversation(session, conv.id)
        if conv_reload is not None:
            await conv_repo.add_message(
                session, conv_reload, role="assistant", content=reply, run_id=run.id
            )

    await _send_message(client, chat_id, reply)


async def _process_update(client: httpx.AsyncClient, update: dict[str, Any]) -> None:
    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return
    text = msg.get("text")
    if not text:
        return
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    if chat_id is None:
        return
    sender = msg.get("from") or {}
    sender_name = (
        sender.get("username")
        or " ".join(filter(None, [sender.get("first_name"), sender.get("last_name")]))
        or None
    )
    try:
        await _handle_message(int(chat_id), text, sender_name, client)
    except Exception as e:
        log.exception("Failed to handle telegram update: %s", e)


async def run_telegram_worker(stop_event: asyncio.Event) -> None:
    """Long-poll Telegram and process updates until stop_event is set."""
    token = settings.telegram_bot_token
    if not token:
        log.info("TELEGRAM_BOT_TOKEN not set — telegram worker disabled.")
        return

    offset = 0
    log.info("Telegram worker started.")
    async with httpx.AsyncClient() as client:
        # Drop any pending updates so we only respond to new ones.
        try:
            r = await client.get(
                f"{API_BASE}/bot{token}/getUpdates",
                params={"offset": -1, "timeout": 0},
                timeout=10.0,
            )
            data = r.json()
            if data.get("ok") and data.get("result"):
                offset = data["result"][-1]["update_id"] + 1
        except Exception as e:
            log.warning("Initial Telegram getUpdates failed (will retry in loop): %s", e)

        while not stop_event.is_set():
            try:
                r = await client.get(
                    f"{API_BASE}/bot{token}/getUpdates",
                    params={"offset": offset, "timeout": 25},
                    timeout=35.0,
                )
                data = r.json()
                if not data.get("ok"):
                    log.warning("Telegram getUpdates not ok: %s", data)
                    await asyncio.sleep(2)
                    continue
                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    asyncio.create_task(_process_update(client, update))
            except (httpx.ReadTimeout, httpx.ConnectTimeout):
                continue
            except Exception as e:
                log.warning("Telegram poll error: %s", e)
                await asyncio.sleep(2)

    log.info("Telegram worker stopped.")

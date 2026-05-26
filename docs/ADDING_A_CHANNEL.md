# Adding a new messaging channel

A "channel" is an external surface where users talk to an agent (Telegram, Slack, WhatsApp, Discord, email, …). Each agent has a `channels[]` array; the first agent that lists your channel name handles inbound messages on that channel.

We'll use **Slack** as the worked example. The existing Telegram worker ([`backend/app/channels/telegram.py`](../backend/app/channels/telegram.py)) is the reference implementation — copy its shape.

## Step 1 — Add config

`backend/app/config.py`:

```python
class Settings(BaseSettings):
    ...
    slack_bot_token: str = ""
    slack_app_token: str = ""    # for Socket Mode, if using
```

`.env.example`:

```env
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
```

## Step 2 — Write the worker

Create `backend/app/channels/slack.py`. The shape should match `telegram.py`:

```python
import asyncio
import logging
from app.config import settings
from app.db import get_sessionmaker
from app.models.agent import Agent
from app.repos import conversations as conv_repo
from app.repos import runs as runs_repo
from app.services.runner import execute_run
from sqlalchemy import select

log = logging.getLogger(__name__)
CHANNEL = "slack"
HISTORY_LIMIT = 20


async def _find_slack_agent(session):
    result = await session.execute(
        select(Agent).where(Agent.channels.contains(["slack"])).order_by(Agent.created_at)
    )
    return result.scalars().first()


async def _handle_message(channel_id: str, user_id: str, text: str):
    sm = get_sessionmaker()
    async with sm() as session:
        agent = await _find_slack_agent(session)
        if agent is None:
            return  # no agent bound to slack
        conv = await conv_repo.get_or_create(
            session, channel=CHANNEL, external_id=channel_id, agent_id=agent.id
        )
        prior = await conv_repo.list_messages(session, conv.id)
        history = [{"role": m.role, "content": m.content} for m in prior[-HISTORY_LIMIT:]]
        await conv_repo.add_message(session, conv, role="user", content=text)
        run = await runs_repo.create_run(session, agent.id, text)

    reply = await execute_run(run.id, agent, text, history=history) or "(no reply)"

    async with sm() as session:
        conv_reload = await conv_repo.get_conversation(session, conv.id)
        if conv_reload is not None:
            await conv_repo.add_message(
                session, conv_reload, role="assistant", content=reply, run_id=run.id
            )

    # Send the reply via Slack Web API
    await _post_to_slack(channel_id, reply)


async def run_slack_worker(stop_event: asyncio.Event) -> None:
    if not settings.slack_bot_token:
        log.info("SLACK_BOT_TOKEN not set — slack worker disabled.")
        return
    # ... open the Slack Socket Mode WebSocket / Events API listener
    # ... for each incoming "message" event, asyncio.create_task(_handle_message(...))
```

The key contract: when a user message arrives, you call `execute_run(...)` and then send the result back via the channel's API. Persistence happens automatically through the `conversations` repo.

## Step 3 — Wire it into lifespan

`backend/app/main.py`:

```python
from app.channels.slack import run_slack_worker
...
async def lifespan(app):
    ...
    slack_stop = asyncio.Event()
    slack_task = asyncio.create_task(run_slack_worker(slack_stop))
    app.state.slack_stop = slack_stop
    app.state.slack_task = slack_task
    try:
        yield
    finally:
        slack_stop.set()
        await asyncio.wait_for(slack_task, timeout=5.0)
```

## Step 4 — Surface the channel in the UI

`frontend/app/agents/page.tsx`:

```tsx
const AVAILABLE_CHANNELS = ["telegram", "slack"];  // ← add yours
```

That single string array drives the channel-toggle pills on the agent form. Nothing else in the UI needs to change — the conversation thread page is channel-agnostic.

## Step 5 — Recreate the backend container

`docker compose up -d --force-recreate backend` (a plain restart won't re-read the new env vars from `.env`).

## How the abstraction holds up

The conversation thread page in the UI doesn't know about Telegram or Slack — it shows whatever's in `conversation_messages`. The single-agent runtime doesn't know either; it just takes prompt + history and emits events. The only channel-specific code is:

1. **Incoming**: how to subscribe (long-poll, webhook, WebSocket)
2. **Outgoing**: how to send a reply (`POST /sendMessage` vs `chat.postMessage`)

Both stay in `app/channels/<name>.py`. Everything else is shared.

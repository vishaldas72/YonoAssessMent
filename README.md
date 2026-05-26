# Yuno Agent Orchestrator

A local-first **AI Agent Orchestration Platform** built for the Yuno AI Engineer Challenge.

> Create AI agents, configure their personality / tools / channels / limits, wire them into collaborative workflows on a visual canvas, and watch them run on a real LangGraph runtime — with one of them reachable via Telegram.

---

## Contents

- [Initial description](#initial-description)
- [What you can do](#what-you-can-do)
- [Tech stack](#tech-stack)
- [Architecture at a glance](#architecture-at-a-glance)
- [Project structure](#project-structure)
- [Setup walkthrough](#setup-walkthrough)
- [Environment variables](#environment-variables)
- [Setting up the Telegram bot](#setting-up-the-telegram-bot)
- [Models we support](#models-we-support)
- [Built-in tools](#built-in-tools)
- [Why LangGraph](#why-langgraph)
- [Local development with uv](#local-development-with-uv)
- [How requirements map to code](#how-requirements-map-to-code)
- [Tests, lint and types](#tests-lint-and-types)
- [Adding things later](#adding-things-later)
- [What's intentionally out of scope](#whats-intentionally-out-of-scope)
- [Troubleshooting](#troubleshooting)

---

## Initial Description

For a hurried reviewer. Detailed setup, env table and troubleshooting live in later sections — refer back if anything snags.

### 1. Get the code

```bash
git clone <repo-url> yuno-orchestrator
cd yuno-orchestrator
```

### 2. Get a Groq API key

Free, ~30 seconds, no credit card.

- Sign in at <https://console.groq.com> → **API Keys** → **Create**
- Copy the key starting with `gsk_...`

### 3. Configure `.env`

```bash
cp .env.example .env
```

Open `.env` and paste:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...your_key_here...
```

Telegram is optional for the first demo — skip it for now.

### 4. Boot the stack

First build ~2–4 min; afterward seconds.

```bash
docker compose up -d --build
```

### 5. Run a workflow in the UI

- Open <http://localhost:3000> → green db/redis dots in the sidebar confirm the backend is healthy
- Sidebar → **Workflows** → on **Template — Research & Summarize**, click **Use template**
- In the editor's right rail, type any topic into the **Run** box (e.g. *"the James Webb Space Telescope"*) → click **▶ Run workflow**
- Watch the live timeline: Researcher calls `web_search`, Writer summarizes, final output appears in ~10–20 seconds
- Sidebar → **Dashboard** to see token usage and dollar cost update live

### 6. (Optional) Plug in Telegram

See [Setting up the Telegram bot](#setting-up-the-telegram-bot) below. Adds ~60 seconds.

That's it — the rubric's required end-to-end multi-agent demo, working locally.

---

## What you can do

1. `make setup && make up`
2. Open <http://localhost:3000> → dashboard with live counts, tokens, $ cost
3. **Workflows** → use the seeded "Research & Summarize" template → click **Use template** → click **▶ Run workflow** with any topic
4. **Agents** → see the seeded **Concierge** agent (or create your own bound to Telegram)
5. Message your Telegram bot → reply arrives → conversation persisted in the UI

---

## Tech stack

| Layer | Choice | Version | Why |
| --- | --- | --- | --- |
| Backend language | Python | 3.11 | Async-first, mature LangChain/LangGraph integration |
| Backend framework | FastAPI | 0.115 | Native async, automatic OpenAPI, WebSocket support |
| ORM | SQLAlchemy (async) | 2.0 | Type-safe, async-native with `asyncpg` |
| Migrations | `Base.metadata.create_all()` | — | Dev-mode auto-create; Alembic deferred to prod |
| Agent runtime | LangGraph | 0.2 | Graph-shaped runtime that matches our visual builder |
| LLM SDKs | langchain-groq / langchain-anthropic / langchain-ollama | 0.2 / 0.2 / 0.2 | One env switch toggles providers |
| Database | Postgres | 16-alpine | JSONB columns hold graphs, tool lists, memory configs |
| Message bus | Redis | 7-alpine | Pub/sub for live events + WebSocket fan-out |
| Frontend language | TypeScript | 5.6 | End-to-end type safety with the API client |
| Frontend framework | Next.js (App Router) | 14.2 | React Server Components + client islands |
| Workflow canvas | React Flow | 11.11 | Node-graph editor; data shape matches LangGraph |
| Styling | Tailwind CSS | 3.4 | Semantic tokens defined in `tailwind.config.ts` |
| Fonts | Inter + JetBrains Mono | via `next/font` | Self-hosted, no CDN |
| Icons | lucide-react | 0.451 | Tree-shakeable, consistent stroke |
| Python tooling | uv | 0.5 | Fast resolver + lockfile + system-Python installs |
| Container runtime | Docker Compose v2 | — | Single command brings the whole stack online |
| Tests | pytest + httpx | 8.3 + 0.27 | Unit + live-stack integration |
| Lint / types | ruff + mypy + ESLint + tsc | latest | Zero warnings across both stacks |

### Docker images used

The compose file pulls four images. They cache locally after the first run:

| Image | Purpose | Approx. size |
| --- | --- | --- |
| `postgres:16-alpine` | Durable store for agents, workflows, runs, conversations | ~250 MB |
| `redis:7-alpine` | Pub/sub for live events; ephemeral queues | ~40 MB |
| `python:3.11-slim` | Base for the backend image (we install uv + deps on top) | ~150 MB |
| `node:20-alpine` | Base for the frontend image (Next.js dev server) | ~180 MB |
| `ghcr.io/astral-sh/uv:0.5.4` | Builder stage — copies the `uv` binary into the backend image | ~30 MB |

Total disk after a clean build: roughly **1.0 – 1.3 GB**.

---

## Architecture at a glance

```text
                            ┌─────────────────────────┐
                            │   Next.js 14 Web UI     │
                            │  - Agent CRUD           │
                            │  - React Flow builder   │
                            │  - Live run monitor (WS)│
                            │  - Dashboard + cost     │
                            └────────────┬────────────┘
                                         │ REST + WebSocket
                                         ▼
┌──────────────┐         ┌───────────────────────────────────┐
│   Telegram   │◀───────▶│         FastAPI Backend            │
│  Bot Worker  │ updates │  ┌────────────────────────────┐    │
│ (long-poll)  │         │  │  API Layer (REST + WS)      │    │
└──────────────┘         │  ├────────────────────────────┤    │
                         │  │  Orchestration              │    │
                         │  │  - run launcher             │    │
                         │  │  - workflow executor         │    │
                         │  │  - cost calc                 │    │
                         │  ├────────────────────────────┤    │
                         │  │  LangGraph Runtime           │    │
                         │  │  - per-agent ReAct graph     │    │
                         │  │  - tool registry             │    │
                         │  ├────────────────────────────┤    │
                         │  │  Repos (SQLAlchemy async)    │    │
                         │  └────────────┬─────────────────┘   │
                         └───────────────┼─────────────────────┘
                                         │
                ┌────────────────────────┼────────────────────────┐
                ▼                                                  ▼
        ┌──────────────┐                                    ┌──────────────┐
        │  Postgres    │                                    │    Redis     │
        │  - agents    │                                    │  - pub/sub   │
        │  - workflows │                                    │    (events,  │
        │  - runs      │                                    │     WS fan)  │
        │  - messages  │                                    └──────────────┘
        └──────────────┘
```

Deep dive: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Project structure

```text
YunoAssessment/
├── backend/                     FastAPI + LangGraph backend (Python 3.11)
│   ├── app/
│   │   ├── api/                 REST + WebSocket routers, thin (no SQL here)
│   │   │   ├── agents.py        Agent CRUD
│   │   │   ├── runs.py          Single-agent runs + WebSocket
│   │   │   ├── workflows.py     Workflow CRUD + instantiate template
│   │   │   ├── workflow_runs.py Multi-agent runs + WebSocket
│   │   │   ├── conversations.py Channel chat history
│   │   │   ├── stats.py         Dashboard aggregates
│   │   │   ├── models.py        /models catalog endpoint
│   │   │   └── tools.py         /tools registry endpoint
│   │   ├── channels/
│   │   │   └── telegram.py      Long-polling worker, message-delivery loop
│   │   ├── models/              SQLAlchemy ORM (one file per aggregate)
│   │   ├── repos/               Repository layer — only place that touches SQL
│   │   ├── runtime/
│   │   │   ├── llm.py           Provider switch (Groq | Anthropic | Ollama)
│   │   │   ├── tools.py         Tool registry (@tool decorated functions)
│   │   │   ├── agent.py         Single-agent ReAct via langgraph.prebuilt
│   │   │   ├── workflow.py      Linear workflow executor (topological walk)
│   │   │   └── pricing.py       KNOWN_MODELS + cost calculator
│   │   ├── schemas/             Pydantic request / response models
│   │   ├── services/
│   │   │   ├── bus.py           Redis pub/sub abstraction
│   │   │   ├── runner.py        Single-agent task launcher
│   │   │   └── workflow_runner.py  Workflow task launcher
│   │   ├── seed.py              Idempotent template + agent seeding
│   │   ├── config.py            Pydantic-settings, single source of env truth
│   │   ├── db.py                Async engine + sessionmaker + init_db()
│   │   └── main.py              FastAPI app + lifespan + router registration
│   ├── tests/                   pytest (unit + live-stack integration)
│   ├── Dockerfile               python:3.11-slim + uv + system-install deps
│   ├── pyproject.toml           uv-managed; project + dev dep groups
│   ├── uv.lock                  Reproducible dependency lock (committed)
│   └── .python-version          3.11 — matches Dockerfile base
│
├── frontend/                    Next.js 14 + React 18 + Tailwind 3
│   ├── app/
│   │   ├── layout.tsx           Root layout (Inter font, atmosphere, app shell)
│   │   ├── globals.css          Tailwind layers + theming + RF overrides
│   │   ├── page.tsx             Dashboard (live KPIs, activity feeds)
│   │   ├── agents/              Agent list + form + per-agent run page
│   │   ├── workflows/           Workflow list + React Flow editor
│   │   ├── workflow-runs/[id]/  Live timeline view
│   │   └── conversations/       Telegram chat threads
│   ├── components/
│   │   ├── sidebar.tsx          Glass sidebar with route highlight + counts
│   │   ├── app-shell.tsx        Wraps pages with sidebar (full-bleed for editor)
│   │   ├── page-header.tsx      Sticky page header with title + actions
│   │   └── ui/                  Primitive components (Button, Card, Badge,
│   │                            Input, ModelSelect, Avatar, Skeleton, …)
│   ├── lib/
│   │   ├── api.ts               Typed REST client, WebSocket URL helpers
│   │   ├── pricing.ts           Cost helper (mirrors backend pricing.py)
│   │   ├── time.ts              Relative time formatter
│   │   └── cn.ts                clsx + tailwind-merge helper
│   ├── Dockerfile               node:20-alpine + npm install + next dev
│   ├── tailwind.config.ts       Theme tokens + custom animations
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── .eslintrc.json           next/core-web-vitals
│   └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md          Layered architecture, data model, request flows
│   ├── ADDING_A_TOOL.md         Worked example
│   ├── ADDING_A_CHANNEL.md      Slack walkthrough using Telegram as reference
│   └── ADDING_A_TEMPLATE.md     Worked example
│
├── docker-compose.yml           postgres, redis, backend, frontend
├── Makefile                     setup / up / down / clean / logs
├── .env.example                 Config template (copy → .env)
└── README.md                    This file
```

---

## Setup walkthrough

### Prerequisites

You need exactly one thing: **Docker Desktop** (Mac/Windows) or **Docker Engine + Compose v2** (Linux).

You do **not** need Python, Node, Postgres, or Redis installed locally — everything runs in containers. (You only need local Python if you want IDE autocomplete; see [Local development with uv](#local-development-with-uv).)

### One-time setup

```bash
make setup
```

This copies `.env.example` to `.env`. Open `.env` and fill in at minimum a Groq API key (see [Setting up the Telegram bot](#setting-up-the-telegram-bot) below for the Telegram side).

### Bring everything up

```bash
make up
```

First boot pulls images and builds, ~2–4 minutes. Subsequent boots are seconds.

Verify everything is running:

```bash
make ps           # all 4 services should show as "Up" or "Up (healthy)"
make logs         # tail combined logs (Ctrl+C to detach)
```

### Open in your browser

- **Dashboard** → <http://localhost:3000>
- **Backend health** → <http://localhost:8000/health>
- **Auto-generated API docs** → <http://localhost:8000/docs>

### Common commands

```bash
make down                                   # stop containers, keep data
make clean                                  # stop AND wipe Postgres volume
make restart                                # restart all services
docker compose restart backend              # restart just the backend
docker compose up -d --force-recreate backend   # recreate backend so it re-reads .env
make backend-shell                          # bash inside backend container
make psql                                   # psql shell into Postgres
make redis-cli                              # redis-cli into Redis
```

> **Note on `.env` re-reads:** `docker compose restart` does **not** re-read `env_file` directives — only container creation does. Whenever you change `.env`, run `docker compose up -d --force-recreate backend`.

---

## Environment variables

Lives in `.env` (gitignored). All variables are documented in `.env.example`. Summary:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | `groq` | One of `groq` / `anthropic` / `ollama` |
| `GROQ_API_KEY` | *empty* | Required if provider is `groq`. Free at <https://console.groq.com> |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Default Groq model |
| `ANTHROPIC_API_KEY` | *empty* | Required if provider is `anthropic` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Default Anthropic model |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Required if provider is `ollama` |
| `OLLAMA_MODEL` | `llama3.1:8b` | Default Ollama model |
| `TELEGRAM_BOT_TOKEN` | *empty* | Optional; only required to enable the channel |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `yuno` / `yuno` / `yuno` | DB credentials |
| `DATABASE_URL` | `postgresql+asyncpg://yuno:yuno@postgres:5432/yuno` | Async SQLAlchemy URL |
| `REDIS_URL` | `redis://redis:6379/0` | Pub/sub + cache |
| `BACKEND_PORT` / `FRONTEND_PORT` | `8000` / `3000` | Host ports for the two HTTP services |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000` | What the browser hits |

---

## Setting up the Telegram bot

Telegram is the external channel used to demonstrate the "talk to an agent" requirement. The bot token is **free** (Telegram doesn't charge for bots) and takes about 60 seconds.

### 1. Create the bot

1. Open Telegram (mobile or desktop) and search for **`@BotFather`** (verified blue check)
2. Send `/newbot`
3. Pick a **display name** (anything, e.g. `Yuno Assistant`)
4. Pick a **username** ending in `bot` (must be globally unique, e.g. `vishal_yuno_bot`)
5. BotFather replies with a token: `1234567890:AAH1234567890abcdefghijklmnop` — copy it

### 2. Put it in `.env`

```env
TELEGRAM_BOT_TOKEN=1234567890:AAH1234567890abcdefghijklmnop
```

### 3. Recreate the backend container

A plain restart won't re-read the env file:

```bash
docker compose up -d --force-recreate backend
```

You should see in the logs:

```text
INFO:app.channels.telegram:Telegram worker started.
```

### 4. Bind an agent to the channel

In <http://localhost:3000/agents>, create a new agent (or check the seeded **Concierge**) and toggle the **`telegram`** pill in the **Channels** section. Save.

> Only one agent should bind to `telegram` at a time — the worker picks the first one it finds.

### 5. Chat with it

In Telegram, search for your bot's `@username` and send a message. The reply should arrive in 1–3 seconds. Open <http://localhost:3000/conversations> to see the persisted thread.

### Behind the scenes

- The worker uses Telegram's **long-polling** API (no webhook, no ngrok required)
- Each incoming message creates a `Run` for the bound agent, with the last 20 turns of conversation history pre-loaded
- The run streams events to Redis, persists to `run_events`, the final output is sent back to Telegram and stored in `conversation_messages`

---

## Models we support

The model catalog lives in **`backend/app/runtime/pricing.py`** (single source of truth: defines pricing and is exposed via `GET /models` for the UI dropdown). Currently registered:

| Provider | Model | Input $/1M | Output $/1M | Notes |
| --- | --- | --- | --- | --- |
| Groq | `llama-3.3-70b-versatile` | $0.59 | $0.79 | **Default.** Strong all-rounder. |
| Groq | `llama-3.1-8b-instant` | $0.05 | $0.08 | Fast and cheap. High-volume tasks. |
| Groq | `mixtral-8x7b-32768` | $0.24 | $0.24 | Mixture-of-experts, 32k context. |
| Anthropic | `claude-sonnet-4-6` | $3.00 | $15.00 | Recommended Anthropic default. |
| Anthropic | `claude-haiku-4-5-20251001` | $1.00 | $5.00 | Fast, cost-effective. |
| Anthropic | `claude-opus-4-7` | $15.00 | $75.00 | Maximum capability. |
| Ollama | `llama3.1:8b` | free | free | Local. Requires Ollama running on host. |
| Ollama | `llama3.1:70b` | free | free | Local. Requires substantial RAM. |
| Ollama | `qwen2.5:7b` | free | free | Local. Strong tool use for its size. |

The agent form's **Model** dropdown groups these by provider, surfaces the active one first, and warns you when you pick a model that doesn't match `LLM_PROVIDER`. Cost shown on each run is computed using these rates against the actual token counts returned by the LLM.

---

## Built-in tools

Defined in `backend/app/runtime/tools.py` and exposed via `GET /tools`:

| Tool | Purpose |
| --- | --- |
| `current_time` | ISO-8601 UTC timestamp |
| `calculator` | Safe expression eval — arithmetic, `**`, `^`, `sqrt`, `sin`, `cos`, `log`, `min`, `max`, `pi`, `e`, ... |
| `http_get` | Fetch a URL (first 2000 chars returned) |
| `web_search` | DuckDuckGo HTML search, top 5 results with title + snippet + URL |

Adding a tool is one function — see [`docs/ADDING_A_TOOL.md`](docs/ADDING_A_TOOL.md).

---

## Why LangGraph

The challenge spec allowed openclaw.ai, LangGraph, CrewAI, AutoGen, or a custom runtime.

We chose **LangGraph** because:

1. **The visual workflow builder maps cleanly to its model.** React Flow gives us a node-edge graph; LangGraph compiles a typed `StateGraph` from the same shape. No impedance mismatch.
2. **It handles the bits we don't want to reinvent.** Tool-calling loop (ReAct), checkpointing, conditional edges, async streaming events — all in the box.
3. **LangChain ecosystem.** Tool/LLM abstractions plug in without us writing adapters for every provider. Same code targets Groq, Anthropic, or Ollama with one env switch.
4. **Per-agent runtime + linear workflow orchestrator on top.** The single-agent runtime is a plain LangGraph `create_react_agent`. The workflow runner is a thin Python topological walker that reuses that single-agent runtime per node. Clear separation, easy to test.

We considered **CrewAI** (good for role-based collab but harder to map to a free-form graph) and **building a custom runtime** (rejected — would burn the 40% demo budget on plumbing). AutoGen is great for chat-style multi-agent but its execution model is less graph-shaped.

---

## Local development with uv

We use **[uv](https://github.com/astral-sh/uv)** for Python dep management instead of pip/poetry/pipenv.

**Why uv:**

- **10–100× faster** than pip for resolution and install
- **Lockfile native** (`uv.lock` is committed) — bit-exact reproducible builds
- **Single tool** — handles dep management, virtualenv, Python downloads, script running
- **Standard `pyproject.toml`** — no proprietary config format

### Inside the container

The Dockerfile uses uv to install deps into the **system Python** (not a venv) — this is the recommended pattern for containers because there's no Python collision risk and it keeps the image smaller.

```dockerfile
FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /uvx /usr/local/bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
```

### Local (host) setup for IDE autocomplete

You only need this if you want VS Code / PyCharm to resolve imports. Otherwise skip — the container has everything.

```bash
# install uv (one-time)
curl -LsSf https://astral.sh/uv/install.sh | sh        # macOS / Linux
# or:  irm https://astral.sh/uv/install.ps1 | iex      # Windows PowerShell

cd backend
uv sync --group dev   # creates .venv/, installs all backend + dev deps
```

Point your IDE at `backend/.venv/Scripts/python.exe` (Windows) or `backend/.venv/bin/python` (mac/Linux). The `.python-version` file pins Python 3.11, matching the container exactly.

### Common uv commands

```bash
uv sync                          # install deps from uv.lock
uv sync --group dev              # also install pytest, mypy, ruff
uv add <package>                 # add a runtime dep, update lock
uv add --dev <package>           # add a dev dep
uv lock                          # regenerate the lockfile
uv run pytest                    # run a command inside the venv
uv run ruff check .              # lint
uv run mypy app tests            # typecheck
```

### Frontend equivalents

Frontend uses plain npm in the container (no pnpm/yarn — keeping the dep surface minimal):

```bash
docker compose exec frontend npm install <package>
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx next lint
```

---

## How requirements map to code

| Requirement | Where |
| --- | --- |
| Agent CRUD (name, role, prompt, model, tools, channels) | [`/agents` UI](frontend/app/agents/page.tsx) · [`/agents` API](backend/app/api/agents.py) |
| Agent config (schedules, memory, skills, interaction rules, guardrails) | Persisted as JSONB columns on `agents`. Form covers the high-impact dimensions; the rest are stored and ready for the next iteration. |
| Visual workflow builder | [React Flow editor](frontend/app/workflows/[id]/edit/page.tsx) |
| Conditions / feedback loops | Linear pipelines + cycle detection ship today. Branching is a deliberate scope cut — see [What's intentionally out of scope](#whats-intentionally-out-of-scope). |
| ≥ 2 pre-built workflow templates | Seeded on startup — see [`backend/app/seed.py`](backend/app/seed.py): "Research & Summarize" and "Support Triage". |
| External channel (Telegram) | [Long-polling worker](backend/app/channels/telegram.py) |
| Agents communicate asynchronously | Each agent runs as an async task. The workflow runner doesn't block the API request. Inter-agent results pass through state; an extensible Redis pub/sub bus (`bus.py`) is the side-channel hook for future direct A2A messaging. |
| Message history persisted + visible in UI | `conversations` + `conversation_messages` tables → `/conversations` UI route |
| Live monitoring (logs, inter-agent messages, token/cost) | WebSocket stream over Redis pub/sub. [Single-agent run page](frontend/app/agents/[id]/run/page.tsx), [workflow run page](frontend/app/workflow-runs/[id]/page.tsx), [dashboard](frontend/app/page.tsx). |
| Runtime executes real logic (not a mockup) | LangGraph runs against real Groq / Anthropic / Ollama models; tools make real HTTP calls (`web_search`, `http_get`, `current_time`, `calculator`). |
| Single setup command | `make setup && make up` |

---

## Tests, lint and types

Everything is green across both stacks. Re-run any time:

```bash
# Backend — 29 tests, ruff + mypy clean across 49 files
docker compose exec backend uv run pytest -v
docker compose exec backend uv run ruff check .
docker compose exec backend uv run mypy app tests

# Frontend — TypeScript + ESLint clean
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx next lint
```

The 29 tests cover the three critical paths the challenge calls out:

- **Agent creation** — full CRUD round-trip plus validation rejections
- **Workflow execution** — graph persistence, schema validation (dangling edges rejected), seeded templates load and instantiate
- **Message delivery** — conversation endpoints, tool registry, stats shape

Plus pure unit tests for `calculator`, `pricing`, and the workflow `topological_order` (cycle detection, dangling-node rejection, etc.). Tests run against the live backend in compose so they exercise the real Postgres + Redis stack.

---

## Adding things later

Short how-to guides:

- [Add a new tool](docs/ADDING_A_TOOL.md)
- [Add a new messaging channel](docs/ADDING_A_CHANNEL.md)
- [Add a new workflow template](docs/ADDING_A_TEMPLATE.md)

---

## What's intentionally out of scope

To keep the demo budget focused, these were deliberately left for future iterations:

- **Auth / multi-tenancy** — single-user local platform; no login.
- **Branching / loops in workflows** — linear pipelines only in M5. Cycle detection works; condition nodes would need an expression language.
- **Vector memory** — `memory_config` is stored on agents but not consumed yet; conversation history is the working memory for M3.
- **Alembic migrations** — `Base.metadata.create_all()` runs on startup. Fine for dev; production would want Alembic.
- **Inline cost breakdown per workflow node** — workflow-level cost is approximated using the global default model rate; per-node-per-model cost would be a polish pass.

---

## Troubleshooting

**`make up` fails with "Cannot connect to the Docker daemon"** — Docker Desktop isn't running. Start it and wait for the whale icon to stop animating.

**Backend container restarts in a loop** — usually a missing env var. `docker compose logs backend` will show the traceback. The most common one is `GROQ_API_KEY is not set` when the provider is Groq.

**Telegram bot isn't replying** — check the backend logs for `Telegram worker started.` If you don't see it, the token isn't reaching the container — recreate (don't just restart): `docker compose up -d --force-recreate backend`.

**Models dropdown shows only one model / UI looks stale after changes** — Next.js fast-refresh occasionally misses changes on Windows volume mounts. Two fixes: hard-refresh the browser (Ctrl+Shift+R), or restart the frontend container: `docker compose restart frontend`. If still stale: `docker compose stop frontend && docker compose up -d frontend`.

**uv lock fails locally with asyncpg compile error** — your local uv picked Python 3.13. Pin to 3.11 to match Docker: `cd backend && echo "3.11" > .python-version && rm -rf .venv && uv sync`.

**Want to wipe and start clean** — `make clean` (stops and deletes the Postgres volume). Note: also deletes all agents, workflows, conversations.

---

## License

This is a hiring challenge submission. Not licensed for redistribution.

# Architecture

## Layer separation

The codebase enforces a strict four-layer split. Each layer only talks to the one below it.

```text
UI (Next.js)                  — React components, no backend logic
   │ REST + WebSocket
   ▼
API (FastAPI routers)         — HTTP/WS surface; thin, calls services
   │
   ▼
Services / Runtime            — Orchestration, LangGraph runner, Telegram worker
   │
   ▼
Repos (SQLAlchemy async)      — Only place that touches SQL; no business logic
   │
   ▼
Postgres + Redis              — Durable + ephemeral state
```

Rules in practice:

- **UI never imports business logic.** It only knows the typed API client (`frontend/lib/api.ts`).
- **API routers don't query SQL.** They depend on repos.
- **Services own lifecycle** (spawning tasks, publishing events) but don't define HTTP shape.
- **Runtime is the LangGraph integration** (`backend/app/runtime/`). Pure functions where possible — `topological_order`, `calculate_cost`, `calculator` are all unit-testable without I/O.

## Data model

```text
agents
  id pk · name · role · system_prompt
  model · temperature · max_tokens
  tools[] · channels[]               (JSONB arrays)
  memory_config · guardrails · limits (JSONB)
  schedule_cron · timestamps

workflows
  id pk · name · description
  graph (JSONB: {nodes:[...], edges:[...]})   ← React-Flow-shaped
  version · is_template · timestamps

runs                              (per single-agent execution)
  id pk · agent_id fk · status
  input · output · error
  total_input_tokens · total_output_tokens
  timestamps (created/started/finished)

run_events                        (audit log of one agent's reasoning loop)
  id pk · run_id fk · seq
  type · payload (JSONB)

workflow_runs                     (per multi-agent execution)
  id pk · workflow_id fk · status
  input · output · error
  total_input_tokens · total_output_tokens

workflow_run_events
  id pk · workflow_run_id fk · seq
  node_id · type · payload (JSONB)

conversations                     (one per channel ↔ external user ↔ agent)
  id pk · channel · external_id · agent_id fk
  title · timestamps
  UNIQUE(channel, external_id, agent_id)

conversation_messages
  id pk · conversation_id fk
  role · content · run_id fk (nullable)
  timestamps
```

Schema is created by `Base.metadata.create_all()` at startup (no migrations yet — see [Tradeoffs and known limitations](#tradeoffs-and-known-limitations)).

## Request flows

### Single-agent run

```text
POST /agents/{id}/runs  → API
                        → repos.runs.create_run()
                        → asyncio.create_task(execute_run)         ← non-blocking
                        ← 201 Created (run.id)

execute_run task:
  1. mark started
  2. for each event from run_agent_stream():
       - persist to run_events
       - publish to Redis channel "run:{id}"
  3. mark finished

WS /ws/runs/{id}:
  1. replay persisted events for late subscribers
  2. subscribe to Redis channel, forward to client
  3. close on run_finished / error
```

### Multi-agent workflow run

```text
POST /workflows/{id}/runs → API → schedule_workflow_run()

execute_workflow_run task:
  graph = workflow.graph
  order = topological_order(graph)              ← linear DAG, cycle-detected
  state = input_text
  for node in order:
    if node.type == 'agent':
      agent = load_agent(node.data.agent_id)
      async for ev in run_agent_stream(agent, state):
        publish to Redis "wf_run:{id}"
        persist to workflow_run_events
      state = agent's final assistant message  ← becomes next agent's prompt
  publish workflow_finished
```

### Telegram channel

```text
Lifespan startup → asyncio.create_task(run_telegram_worker)

Worker loop:
  while not shutting_down:
    updates = GET https://api.telegram.org/bot{TOKEN}/getUpdates?timeout=25
    for update in updates:
      asyncio.create_task(_process_update(update))

_process_update:
  1. find first agent with 'telegram' in channels[]
  2. get_or_create Conversation(channel='telegram', external_id=chat_id, agent_id)
  3. persist user message
  4. load last N conversation messages → history
  5. execute_run(agent, prompt=user_msg, history=history)
  6. persist assistant message with run_id
  7. POST sendMessage to Telegram with run.output
```

## Tooling abstraction

A tool is anything with the `@tool` decorator from `langchain_core.tools`. The registry (`backend/app/runtime/tools.py`) maps string name → BaseTool instance. The list is exposed via `GET /tools` so the UI can render selectable pills on the agent form.

Each agent stores its tool allowlist as a string array; at runtime `get_tools(agent.tools)` resolves to actual tool objects, which are bound to the LLM by `create_react_agent(llm, tools)`.

Adding a tool is one function — see [`ADDING_A_TOOL.md`](ADDING_A_TOOL.md).

## LLM provider abstraction

`backend/app/runtime/llm.py:get_llm()` returns a `BaseChatModel` for the configured provider:

- `groq` → `ChatGroq` (free Llama 3.3 70B is the default)
- `anthropic` → `ChatAnthropic`
- `ollama` → `ChatOllama` (fully local, no API key)

Provider is global (env var `LLM_PROVIDER`); the model name comes from the agent. Per-agent provider override is a future refinement — see [PLAN.md](../PLAN.md) §11.

## Why a `bus` module instead of `import redis.publish` everywhere

`backend/app/services/bus.py` is the only file that touches Redis pub/sub. The rest of the codebase calls `bus.publish(channel, event)` and `bus.subscribe(channel)`. If we ever need to swap Redis for Kafka, RabbitMQ, or Azure Service Bus, it's one file's worth of changes and no API contract changes.

## Real-time event delivery (the M2/M5 streaming path)

```text
Agent runtime emits event
  ↓
Service persists to <run_type>_events table
  ↓
Service publishes to Redis channel
  ↓
WebSocket handler subscribed to that channel
  ↓
Browser receives JSON over WS
  ↓
React component appends to event list
```

We persist *and* publish so two reload-safe replay paths exist: the WebSocket replays persisted events on connect (catching up late subscribers), and the REST endpoint `GET /runs/{id}/events` serves the full trace any time.

## Concurrency model

- **One uvicorn process** with FastAPI's asyncio event loop
- **Agent runs**: each is its own `asyncio.create_task`. Multiple agents can run concurrently in a single process.
- **Workflow runs**: same — one task per workflow run, internally awaiting per-node agent runs sequentially.
- **Telegram worker**: a single long-running task created in lifespan; spawns one task per incoming update so concurrent chats don't block each other.
- **DB sessions**: short-lived, one per logical unit of work; no shared sessions across tasks.

This is enough for the demo and the hiring-challenge scope. To scale horizontally, the Redis pub/sub bus is already in place (WebSocket fan-out across workers), and the only sticky state is in Postgres.

## Frontend architecture

- **Next.js App Router** (Next 14) — server components for shells, client components (`"use client"`) for any page with state/WebSockets
- **React Flow** for the workflow editor — its data format (nodes/edges) matches our backend schema 1:1
- **No state library** (Redux/Zustand) — local component state + the typed `api` client is enough for the surface area
- **Styles via Tailwind** with a small handwritten primitive layer (`components/ui/*`: Button, Card, Badge, Input, Select, Avatar, Skeleton, EmptyState, custom ModelSelect). Semantic theme tokens (`bg`, `fg`, `brand`, `success`, `danger`, etc.) defined in `tailwind.config.ts`. Inter via `next/font` for crisp typography, lucide-react for icons.

## Tradeoffs and known limitations

| Decision | Why | Cost / mitigation |
| --- | --- | --- |
| `create_all()` for schema, no Alembic | Speed; schema is iterating fast | Production switch needs Alembic. `make clean` wipes the volume; for in-place column adds you'd run a manual ALTER until then. |
| Linear-only workflows in M5 | Demo budget; branching needs an expression language + state-merge semantics | Cycle detection works; linear pipelines cover the seeded templates and the demo flow. |
| One Telegram bot per deployment | Global env var binding; matches the challenge ("at least one agent") | Multiple bots = run a worker task per token. Architecture supports it. |
| Pricing duplicated in `pricing.py` + `pricing.ts` | Cost shown both server-side (totals) and client-side (per-run cards) | Source of truth could move to a shared `pricing.json` if rates start changing often. |
| Workflow-run cost approximated with default model | All seeded agents use one model; saving per-node model would mean joining nodes → agents per stat call | When agents diverge in model, we'd add a per-node breakdown. |
| No auth | Local-first single-user platform | Adding session auth would be one middleware + a login page; deferred. |

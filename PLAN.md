# AI Agent Orchestration Platform — Implementation Plan

> Living document. Update as decisions evolve. Source-of-truth for architecture, scope, and tradeoffs for the Yuno AI Engineer Challenge.

## 1. Goal

Build a local-first platform where users can:

- Create and configure AI agents (personality, tools, schedules, memory, guardrails, limits)
- Wire agents into collaborative workflows via a visual builder (conditions, feedback loops)
- Run agents on a real runtime executing real tools, communicating asynchronously
- Talk to at least one agent through **Telegram**
- Monitor everything live (logs, inter-agent messages, token/cost) in a web UI

Single `make setup && make up` (or `docker compose up`) should bring the whole stack online.

## 2. Stack Decisions

| Layer | Choice | Why |
| --- | --- | --- |
| Agent runtime | **LangGraph** (Python) | Graph model maps 1:1 to the visual workflow builder (nodes = agents/tools, edges = conditions). Native support for branching, loops, checkpointing, human-in-the-loop. Mature ecosystem. |
| Backend | **FastAPI** (Python) | Hosts LangGraph in-process. Async-first. WebSocket support for live monitoring. Same language as runtime → no IPC tax. |
| Frontend | **Next.js (App Router) + React** | Strong ecosystem for the workflow builder (React Flow). Server components for fast initial loads, client components for live updates. |
| Workflow UI | **React Flow** | De facto standard for node-graph editors; serializes cleanly to the LangGraph schema. |
| Persistence | **Postgres** | Agents, workflows, runs, messages, tool calls, token usage. Single relational store keeps it simple. |
| Queue / pub-sub | **Redis** | Async agent-to-agent messages, run state, WebSocket fan-out. Doubles as LangGraph checkpoint store if needed. |
| Channel | **Telegram Bot API** | No business verification, bot token in minutes, works locally via long-polling (no ngrok needed). |
| LLM | **Anthropic Claude** (Sonnet 4.6 default, configurable per agent) | Best-in-class tool use; per-agent model override supported. |
| Container | **Docker Compose** | One command to bring up Postgres, Redis, backend, frontend, Telegram worker. |
| Tests | **pytest** (backend) + **Vitest/Playwright** (frontend) | Cover critical paths only — agent CRUD, workflow execution, message delivery. |

## 3. High-Level Architecture

```text
                            ┌─────────────────────────┐
                            │   Next.js Web UI        │
                            │  - Agent CRUD           │
                            │  - Workflow builder     │
                            │  - Live monitor (WS)    │
                            │  - Chat / message log   │
                            └────────────┬────────────┘
                                         │ REST + WebSocket
                                         ▼
┌──────────────┐         ┌───────────────────────────────────┐
│  Telegram    │◀───────▶│         FastAPI Backend            │
│  Bot Worker  │  events │  ┌────────────────────────────┐    │
│ (long-poll)  │         │  │  API Layer (REST + WS)      │    │
└──────────────┘         │  ├────────────────────────────┤    │
                         │  │  Orchestration Service       │    │
                         │  │  - run launcher              │    │
                         │  │  - scheduler (APScheduler)   │    │
                         │  │  - guardrails / limits       │    │
                         │  ├────────────────────────────┤    │
                         │  │  LangGraph Runtime           │    │
                         │  │  - per-workflow compiled     │    │
                         │  │    StateGraph                │    │
                         │  │  - tool registry             │    │
                         │  │  - checkpointer (Postgres)   │    │
                         │  ├────────────────────────────┤    │
                         │  │  Repositories (SQLAlchemy)   │    │
                         │  └────────────┬─────────────────┘   │
                         └───────────────┼─────────────────────┘
                                         │
                ┌────────────────────────┼────────────────────────┐
                ▼                                                  ▼
        ┌──────────────┐                                    ┌──────────────┐
        │  Postgres    │                                    │    Redis     │
        │  - agents    │                                    │  - pubsub    │
        │  - workflows │                                    │  - queues    │
        │  - runs      │                                    │  - WS fan-out│
        │  - messages  │                                    └──────────────┘
        │  - tool_calls│
        │  - usage     │
        └──────────────┘
```

### Key separation

- **UI layer** (Next.js) — never talks to the runtime directly; only REST + WebSocket.
- **Orchestration layer** (FastAPI services) — owns lifecycle, scheduling, guardrails, persistence.
- **Runtime layer** (LangGraph) — pure execution; receives a compiled graph + state, emits events.
- **Persistence layer** (SQLAlchemy repos) — only place that touches Postgres.

## 4. Data Model (initial)

```text
agents          (id, name, role, system_prompt, model, temperature,
                 tools[], channels[], memory_config, guardrails, limits,
                 schedule_cron, created_at, updated_at)

workflows       (id, name, description, graph_json, version, is_template)

workflow_nodes  (denormalized into graph_json for now; promote if needed)

runs            (id, workflow_id, status, started_at, finished_at,
                 trigger_type, trigger_payload, total_tokens, total_cost_usd)

messages        (id, run_id, from_agent_id, to_agent_id|null, channel,
                 role, content, tool_calls_json, tokens_in, tokens_out,
                 cost_usd, created_at)

tool_calls      (id, message_id, tool_name, args_json, result_json,
                 latency_ms, status, error)

memory_entries  (id, agent_id, kind, key, value, embedding|null, created_at)

channel_bindings(id, agent_id, channel, external_id, config_json)
```

## 5. Agent Configuration Surface (the "configurable dimensions" metric)

1. Identity: name, role, avatar
2. System prompt
3. Model + temperature + max_tokens
4. Tool allowlist (from tool registry)
5. Channel bindings (Telegram, internal, webhook)
6. Memory: type (none / buffer / summary / vector), retention, scope
7. Schedule: cron expression for autonomous runs
8. Interaction rules: who it can message, who can message it
9. Guardrails: blocked topics, max tool calls per run, PII redaction
10. Limits: max tokens/run, max cost/day, max runtime seconds
11. Skills: free-text capability tags surfaced to the planner

## 6. Built-in Tools (initial set)

- `web_search` (Tavily or DuckDuckGo HTML)
- `http_get` / `http_post` (allowlisted hosts)
- `send_telegram_message` (channel-aware)
- `send_agent_message` (inter-agent async via Redis pub-sub)
- `read_memory` / `write_memory`
- `python_eval_sandboxed` (subprocess, timeout, no network) — optional, behind flag
- `current_time`, `calculator`

Adding a tool = register a `BaseTool` subclass in `tools/registry.py`. Surface in UI via auto-generated schema.

## 7. Pre-built Workflow Templates (need ≥2)

1. **Research → Summarize → Notify**
   - Researcher agent (web_search) → Writer agent (summarize) → Notifier agent (send to Telegram).
   - Demonstrates: 3 agents, tool execution, channel out, conditions ("if results < 3, loop back").

2. **Customer Support Triage**
   - Telegram-facing Concierge agent → Classifier → either FAQ agent or Escalation agent (writes to a "human inbox" channel).
   - Demonstrates: external channel in, branching, memory of user history.

## 8. Live Monitoring

- WebSocket channel `/ws/runs/{run_id}` streams: token events, tool calls, agent messages, errors.
- UI: run timeline (Gantt-style), live message log, per-agent token/cost gauges.
- All events also persisted → replayable after the fact.

## 9. Project Layout

```text
/backend
  /app
    /api          # FastAPI routers (agents, workflows, runs, ws)
    /services     # orchestration, scheduler, guardrails
    /runtime      # LangGraph builders, tool registry
    /repos        # SQLAlchemy data access
    /channels     # telegram bot worker
    /models       # pydantic + SQLAlchemy models
    main.py
  /tests
  pyproject.toml

/frontend
  /app            # Next.js App Router pages
    /agents
    /workflows
    /runs
  /components
    /workflow-builder   # React Flow wrapper
    /monitor
  /lib            # api client, ws client
  package.json

/docker
  docker-compose.yml
  Dockerfile.backend
  Dockerfile.frontend

/docs
  ARCHITECTURE.md
  ADDING_A_TOOL.md
  ADDING_A_CHANNEL.md
  ADDING_A_TEMPLATE.md

PLAN.md            # this file
README.md
Makefile
.env.example
```

## 10. Milestones

| # | Milestone | Exit criteria |
| --- | --- | --- |
| M0 | Repo scaffold + docker-compose up | `make up` brings Postgres, Redis, backend, frontend online; health endpoint returns 200 |
| M1 | Agent CRUD (backend + UI) | Create/list/edit/delete agents through the UI; persists in Postgres |
| M2 | Single-agent run (no workflow) | Send a prompt via API → LangGraph runs → tool calls work → events stream over WS |
| M3 | Telegram channel | `/start` in Telegram routes to a designated agent; replies flow back; messages persisted |
| M4 | Workflow builder UI | React Flow editor, save graph JSON, validate against backend schema |
| M5 | Multi-agent execution | Compile workflow JSON → LangGraph; inter-agent messages via Redis; full event stream |
| M6 | Live monitor + token/cost | Run dashboard with timeline, message log, usage gauges |
| M7 | 2 workflow templates seeded | Templates load on first boot; one-click instantiate |
| M8 | Tests, docs, demo recording | pytest + Playwright green; README + ARCHITECTURE.md + demo gif |

## 11. Risks & Tradeoffs

- **LangGraph state vs. async A2A messaging.** LangGraph is inherently graph-step. To do true async agent-to-agent, we use Redis pub-sub for "side-channel" messages with a per-agent inbox node that polls. Tradeoff: extra moving part, but it satisfies the async requirement.
- **Visual builder fidelity.** React Flow gives us nodes/edges, but LangGraph compilation requires typed state. We constrain the builder to known node types (Agent, Tool, Condition, Loop, Channel) to keep the gap small.
- **Local-only constraint.** No cloud queue/secret manager. Telegram via long-polling sidesteps webhook tunneling. Anthropic key in `.env`.
- **Scope.** We deliberately skip: multi-tenant auth, RBAC, prod-grade observability, k8s manifests, fine-tuning. Mentioned in README as "out of scope, here's how I'd add it".
- **Custom runtime temptation.** Considered, rejected — LangGraph already gives us checkpoints, conditional edges, and streaming events; rebuilding wastes the 40% demo budget.

## 12. Open Questions

- Memory: do we ship vector memory (pgvector) in v1 or stub it? Leaning **stub + buffer/summary** for v1; pgvector if time allows.
- Cost tracking: hardcode Anthropic pricing table vs. read from a config file? **Config file** so model swaps don't require code changes.
- Auth: skip entirely (single-user local) vs. simple session? **Skip** — note in README.

## 13. Demo Script (for the recording)

1. Open UI → show empty Agents list.
2. Create 3 agents (Researcher, Writer, Notifier) via the form — show config surface.
3. Open Workflow builder → drag the "Research → Summarize → Notify" template.
4. Click Run → live monitor shows tool calls, inter-agent messages, token counts.
5. Switch to Telegram → message the Concierge agent → show response.
6. Show persisted message history in UI for the same conversation.
7. Recap architecture diagram from README.

---

*Last updated: 2026-05-26 — initial draft.*

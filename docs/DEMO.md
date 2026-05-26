# Demo recording checklist

Goal: a ~2 minute screen recording (or GIF) that hits every challenge requirement. The reviewer should see, in this order:

1. Single setup command works
2. Agent CRUD
3. Workflow builder
4. Multi-agent execution with live monitoring + token/cost
5. External channel (Telegram) — human messages an agent live and sees a reply
6. Persisted message history visible in the UI

Total expected wall time: 2–3 minutes.

## Before you press record

- [ ] `make clean && make up` — start from a fresh state so the seeded content is obvious
- [ ] Wait 30 seconds, then verify <http://localhost:3000> loads with the dashboard
- [ ] In a separate terminal: `docker compose logs -f backend` (so you can flash it briefly on screen if asked)
- [ ] Have Telegram open to your bot (e.g. `@vishal_yuno_bot`)
- [ ] Close other tabs / notifications
- [ ] Use a screen recorder that captures audio if you'll narrate (ScreenToGif, OBS, Loom)

## The script

### 0:00 — Setup verification (10 s)

> "One command to bring everything up — Postgres, Redis, FastAPI backend, Next.js frontend."

- Show terminal: `make up`
- Cut to dashboard at <http://localhost:3000>
- Point at the green db / redis dots, the seeded counts, the default model badge

### 0:10 — Tour the agent surface (20 s)

> "Agents have 11 configurable dimensions — name, role, prompt, model, temperature, tools, channels, memory, guardrails, limits, schedule."

- Click **Agents**
- Show the existing agents (Concierge, Calc Bot, Template Researcher…)
- Open the create form, scroll through fields. Don't actually submit — too slow.

### 0:30 — Workflow builder (30 s)

> "Workflows are graphs of agents. Drag, connect, save — same shape that compiles to LangGraph."

- Click **Workflows**
- Point at the **Templates** section. Click **Use template** on "Research & Summarize".
- In the editor: pan around, click the Researcher node to show the selection panel + agent binding dropdown
- Make a small edit (e.g. change a node position) → Save lights up → click Save

### 1:00 — Multi-agent execution (40 s)

> "Click Run, watch them collaborate live."

- In the sidebar **Run** box, type: `the SpaceX Starship`
- Click **▶ Run workflow**
- You're taken to the live timeline
- Narrate as events stream in: Researcher block fills with `web_search` tool call + result, then assistant message; Writer block fills with the final summary
- Point at tokens + cost in green at the top

### 1:40 — External channel (Telegram) (40 s)

> "One agent is reachable via Telegram. Same agent, real chat, persisted history."

- Open Telegram, your bot
- Send a message: `hi! what is the square root of 1444? then tell me the time`
- Wait for reply (~2 seconds)
- Cut back to browser → **Conversations** → click the chat → show the persisted thread with both messages

### 2:20 — Wrap (20 s)

> "Everything you saw is persisted. Token + cost tracking is live. The architecture separates UI, runtime, and persistence cleanly. Tests cover the critical paths."

- Cut to dashboard again — counts and total cost have updated
- Optional: brief look at `docker compose exec backend uv run pytest -v` → `29 passed`
- End.

## If something glitches mid-record

- **Workflow run hangs**: the LLM provider can occasionally rate-limit. Kill it (Ctrl-C the recorder is fine), restart with a different topic.
- **Telegram doesn't reply within 5 seconds**: the worker may be in the middle of a long-poll. Wait 5 more, then if nothing, `docker compose logs backend | findstr telegram` in another terminal to check it picked up the update. Most often it's fine — Groq just took a second.
- **Browser cache shows old UI** after a hot-reload: hard-refresh (Ctrl+Shift+R).

## After recording

- [ ] Trim opening/closing dead air
- [ ] Convert to MP4 if you want — GIF if you need ≤ 25 MB and the reviewer prefers it
- [ ] Add to the repo as `docs/demo.mp4` (or `.gif`)
- [ ] Add a one-line note + embedded link near the top of [`README.md`](../README.md)
- [ ] Rotate the keys in `.env` if the recording shows them on screen (Groq + Telegram tokens are leakable from a video frame)

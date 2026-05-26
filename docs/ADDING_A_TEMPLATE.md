# Adding a new workflow template

Templates are seeded at startup and badged in the UI as ready-to-run starting points. A reviewer can pick a template, click **Use template**, and have an editable workflow in one click.

## What "template" means here

A template is just a `Workflow` row with `is_template=True`. The seeder ([`backend/app/seed.py`](../backend/app/seed.py)) ensures specific named templates exist on every boot — idempotent, no duplication.

## Step 1 — Define the agents the template needs

In `backend/app/seed.py`, add entries to `SEED_AGENTS`:

```python
SEED_AGENTS: list[dict] = [
    # ...existing...
    {
        "name": "Template Translator",
        "role": "EN ↔ ES translator",
        "system_prompt": "You translate text between English and Spanish. Detect the source language and respond in the other.",
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.2,
        "max_tokens": 512,
        "tools": [],
        "channels": [],
    },
    {
        "name": "Template Polite Replier",
        "role": "Tone-softener",
        "system_prompt": "Rewrite the input to be polite and professional, preserving the meaning. Reply only with the rewritten text.",
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.4,
        "max_tokens": 512,
        "tools": [],
        "channels": [],
    },
]
```

The seeder is idempotent — it looks up by agent name and skips if present.

## Step 2 — Define the graph

Add a helper that builds the React-Flow-shaped graph for your template:

```python
def _translate_polite_graph(translator_id: str, polite_id: str) -> dict:
    return {
        "nodes": [
            {"id": "n1", "type": "start", "position": {"x": 40, "y": 120}, "data": {}},
            {"id": "n2", "type": "agent", "position": {"x": 240, "y": 120},
             "data": {"agent_id": translator_id, "label": "Template Translator"}},
            {"id": "n3", "type": "agent", "position": {"x": 480, "y": 120},
             "data": {"agent_id": polite_id, "label": "Template Polite Replier"}},
            {"id": "n4", "type": "end", "position": {"x": 720, "y": 120}, "data": {}},
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4"},
        ],
    }
```

Constraints:

- Exactly one `start` and one `end` node
- Linear (one path from start to end) — branching isn't supported yet
- Every `agent` node's `data.agent_id` must reference a real agent

## Step 3 — Register the template

In `seed_starter_content()`, add a call:

```python
async def seed_starter_content() -> None:
    sm = get_sessionmaker()
    async with sm() as session:
        agents_by_name: dict[str, Agent] = {}
        for spec in SEED_AGENTS:
            agent = await _get_or_create_agent(session, spec)
            agents_by_name[agent.name] = agent

        # ...existing templates...

        await _get_or_create_workflow_template(
            session,
            name="Template — Translate & Soften",     # must be unique
            description="Translates between EN/ES and then rewrites the result politely.",
            graph=_translate_polite_graph(
                str(agents_by_name["Template Translator"].id),
                str(agents_by_name["Template Polite Replier"].id),
            ),
        )
```

## Step 4 — Restart the backend

```bash
docker compose restart backend
```

You should see in the logs:

```text
INFO:app.seed:Seed complete: 6 agents, 3 templates ensured.
```

## Step 5 — Confirm in the UI

<http://localhost:3000/workflows> shows the new template card under **Templates**, with the dashed green border and a **Use template** button. Click it → editable copy → fill the **Run** prompt in the sidebar with e.g. *"Hi can you tell me when my order ships"* → ▶ Run workflow.

## Tips

- **Test the template before seeding it.** Build it manually in the UI first, save it, run it. Only then translate the node positions and IDs into seed code.
- **Use stable string IDs (`n1`, `n2`, …).** Don't reuse the UUIDs from your test workflow — they'd collide when the template is cloned.
- **Reuse existing agents where possible.** If your new template needs the same "Researcher" persona another template uses, point at the existing seeded agent instead of defining a duplicate.
- **Keep templates self-explanatory.** The description field shows in the UI card — write it for the reviewer, not for yourself.

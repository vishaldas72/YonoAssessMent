# Adding a new tool

A "tool" is any callable an agent can invoke during reasoning (e.g. `web_search`, `calculator`). Agents pick which tools they're allowed to use; the LLM decides when to call them.

## Step 1 — Define the function

Edit [`backend/app/runtime/tools.py`](../backend/app/runtime/tools.py). Decorate it with `@tool`. The docstring is sent to the LLM as the tool's description — write it for the model, not for humans.

```python
@tool
def get_weather(city: str) -> str:
    """Get current weather for a city. Returns a one-line summary."""
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(f"https://wttr.in/{city}?format=3")
            r.raise_for_status()
            return r.text.strip()
    except Exception as e:
        return f"Error: {e}"
```

Tips:

- **Always catch exceptions and return a string starting with `Error:`** — the agent can read this and recover. Raising would crash the run.
- **Type hints matter.** LangChain auto-generates the JSON schema from them. Use `str`, `int`, `float`, `bool`, or `list[...]`.
- **Keep return values text-shaped.** The LLM sees the string; deeply-nested JSON is fine as long as it's readable.

## Step 2 — Register it

In the same file, add it to the `TOOL_REGISTRY` dict at the bottom:

```python
TOOL_REGISTRY: dict[str, BaseTool] = {
    "current_time": cast(BaseTool, current_time),
    "calculator": cast(BaseTool, calculator),
    "http_get": cast(BaseTool, http_get),
    "web_search": cast(BaseTool, web_search),
    "get_weather": cast(BaseTool, get_weather),   # ← new
}
```

That's it. No other code needs to change:

- `GET /tools` now lists `get_weather`
- The agent-create UI shows it as a toggle pill
- Any agent that selects it can call it in its ReAct loop

## Step 3 — Restart

```bash
docker compose restart backend
```

(Uvicorn's `--reload` should pick it up automatically; restart is a safety net.)

## Step 4 — Test it

In the UI: create a new agent with `get_weather` enabled, run a prompt like *"What's the weather in Tokyo?"*. The live event stream should show the agent calling `get_weather({"city":"Tokyo"})` and using the result.

Optional but recommended — add a unit test in `backend/tests/test_unit_tools.py`:

```python
from app.runtime.tools import TOOL_REGISTRY

def test_get_weather_handles_unknown_city():
    result = TOOL_REGISTRY["get_weather"].invoke({"city": "Nowhereville123XYZ"})
    assert isinstance(result, str)  # never raises
```

## Tools that need configuration

If your tool needs an API key (e.g. Tavily, Serper), add it to:

1. `backend/app/config.py` — new `Settings` field
2. `.env.example` — placeholder

Then `from app.config import settings` inside the tool body. Don't read `os.environ` directly — `settings` is the single source of truth.

## What not to do

- **Don't do anything destructive.** Agents will eventually call your tool in ways you didn't anticipate. `rm -rf` style operations are off-limits.
- **Don't block on long I/O.** If a tool takes > 30s, the LLM may time out. Wrap heavy work in `httpx.AsyncClient` (you'd need to extend the registry to support async tools — LangChain does, but the current registry assumes sync).
- **Don't return giant blobs.** Cap output (we cap `http_get` at 2000 chars). Otherwise the next LLM call exceeds the context window and fails.

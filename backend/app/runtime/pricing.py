"""Per-model pricing + registry.

Sources (verified at time of writing):
  - Groq: https://groq.com/pricing/
  - Anthropic: https://www.anthropic.com/pricing
Update as needed — cost is computed at display time, not stored.
"""
from __future__ import annotations


# Single source of truth: each entry knows its provider, label, and rates.
KNOWN_MODELS: list[dict] = [
    # ---- Groq (free / very cheap) ----
    {
        "name": "llama-3.3-70b-versatile",
        "provider": "groq",
        "label": "Llama 3.3 70B Versatile",
        "input_per_1m": 0.59,
        "output_per_1m": 0.79,
        "notes": "Strong all-rounder. Best Groq default.",
    },
    {
        "name": "llama-3.1-8b-instant",
        "provider": "groq",
        "label": "Llama 3.1 8B Instant",
        "input_per_1m": 0.05,
        "output_per_1m": 0.08,
        "notes": "Fast and cheap. Good for high-volume simple tasks.",
    },
    {
        "name": "mixtral-8x7b-32768",
        "provider": "groq",
        "label": "Mixtral 8x7B",
        "input_per_1m": 0.24,
        "output_per_1m": 0.24,
        "notes": "Mixture-of-experts. Long context (32k).",
    },
    # ---- Anthropic (paid) ----
    {
        "name": "claude-sonnet-4-6",
        "provider": "anthropic",
        "label": "Claude Sonnet 4.6",
        "input_per_1m": 3.00,
        "output_per_1m": 15.00,
        "notes": "Balanced — recommended Anthropic default.",
    },
    {
        "name": "claude-haiku-4-5-20251001",
        "provider": "anthropic",
        "label": "Claude Haiku 4.5",
        "input_per_1m": 1.00,
        "output_per_1m": 5.00,
        "notes": "Fast, cost-effective for high-volume tasks.",
    },
    {
        "name": "claude-opus-4-7",
        "provider": "anthropic",
        "label": "Claude Opus 4.7",
        "input_per_1m": 15.00,
        "output_per_1m": 75.00,
        "notes": "Maximum capability. Slower, expensive.",
    },
    # ---- Ollama (local, free) ----
    {
        "name": "llama3.1:8b",
        "provider": "ollama",
        "label": "Llama 3.1 8B (local)",
        "input_per_1m": 0.0,
        "output_per_1m": 0.0,
        "notes": "Runs on your machine. Free but slower.",
    },
    {
        "name": "llama3.1:70b",
        "provider": "ollama",
        "label": "Llama 3.1 70B (local)",
        "input_per_1m": 0.0,
        "output_per_1m": 0.0,
        "notes": "Local big model. Requires substantial RAM.",
    },
    {
        "name": "qwen2.5:7b",
        "provider": "ollama",
        "label": "Qwen 2.5 7B (local)",
        "input_per_1m": 0.0,
        "output_per_1m": 0.0,
        "notes": "Local, strong tool use for its size.",
    },
]

# Derive the price lookup from the registry so we never get out of sync.
PRICING: dict[str, tuple[float, float]] = {
    m["name"]: (m["input_per_1m"], m["output_per_1m"]) for m in KNOWN_MODELS
}

DEFAULT_PRICE = (0.0, 0.0)


def price_for(model: str | None) -> tuple[float, float]:
    if not model:
        return DEFAULT_PRICE
    if model in PRICING:
        return PRICING[model]
    # Fuzzy fallback: longest prefix match (e.g. "claude-sonnet-4-6-20260101").
    best: tuple[str, tuple[float, float]] | None = None
    for key, val in PRICING.items():
        if model.startswith(key) and (best is None or len(key) > len(best[0])):
            best = (key, val)
    return best[1] if best else DEFAULT_PRICE


def calculate_cost(model: str | None, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = price_for(model)
    return (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000.0

"""Unit tests for the pricing config + cost helper."""
from app.runtime.pricing import calculate_cost, price_for


def test_known_groq_model():
    assert price_for("llama-3.3-70b-versatile") == (0.59, 0.79)


def test_known_anthropic_model():
    assert price_for("claude-sonnet-4-6") == (3.0, 15.0)


def test_unknown_model_is_free():
    assert price_for("totally-made-up-model") == (0.0, 0.0)


def test_fuzzy_prefix_match():
    # Versioned variants should still match via prefix
    rate = price_for("claude-sonnet-4-6-20260101")
    assert rate == (3.0, 15.0)


def test_calculate_cost_basic():
    # 1000 input + 500 output on Llama 3.3 70B = 1000 * 0.59 / 1e6 + 500 * 0.79 / 1e6
    cost = calculate_cost("llama-3.3-70b-versatile", 1000, 500)
    expected = (1000 * 0.59 + 500 * 0.79) / 1_000_000.0
    assert abs(cost - expected) < 1e-12


def test_calculate_cost_zero_for_unknown():
    assert calculate_cost("mystery-model", 100_000, 100_000) == 0.0


def test_calculate_cost_zero_tokens():
    assert calculate_cost("claude-sonnet-4-6", 0, 0) == 0.0

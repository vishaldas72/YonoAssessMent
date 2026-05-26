"""Unit tests for the calculator tool — pure function, no I/O."""
from app.runtime.tools import TOOL_REGISTRY


def _call(expr: str) -> str:
    # Invoke via the registry so the type is BaseTool (with .invoke()) rather
    # than the bare @tool-decorated Callable.
    return TOOL_REGISTRY["calculator"].invoke({"expression": expr})


def test_basic_arithmetic():
    assert _call("2 + 3") == "5"
    assert _call("10 - 4") == "6"
    assert _call("6 * 7") == "42"
    assert _call("20 / 4") == "5.0"


def test_parentheses_and_precedence():
    assert _call("(12 * 7) + 5") == "89"
    assert _call("2 * (3 + 4) * 5") == "70"


def test_power_operators():
    assert _call("2 ** 10") == "1024"
    # ^ is aliased to power (common-human notation)
    assert _call("3 ^ 4") == "81"


def test_sqrt():
    result = _call("sqrt(144)")
    assert float(result) == 12.0


def test_trig_with_constants():
    result = _call("sin(pi / 2)")
    assert abs(float(result) - 1.0) < 1e-9


def test_min_max_round():
    assert _call("max(3, 7, 2)") == "7"
    assert _call("min(3, 7, 2)") == "2"
    assert _call("round(3.7)") == "4"


def test_rejects_unsafe_input():
    # Names not in the allowlist must fail (no attribute access, no calls to anything)
    assert _call("__import__('os')").startswith("Error")
    assert _call("open('/etc/passwd')").startswith("Error")

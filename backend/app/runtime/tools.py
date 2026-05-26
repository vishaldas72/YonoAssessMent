"""Tool registry. Adding a tool = define a @tool function and add it to TOOLS."""
from __future__ import annotations

import ast
import math
import operator as op
from datetime import datetime, timezone
from typing import Any, Callable, cast

import httpx
from langchain_core.tools import BaseTool, tool


@tool
def current_time() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


_ALLOWED_OPS: dict[type[ast.AST], Callable[..., Any]] = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.Div: op.truediv,
    ast.FloorDiv: op.floordiv,
    ast.Mod: op.mod,
    ast.Pow: op.pow,
    ast.BitXor: op.pow,  # treat ^ as power (common-human notation)
    ast.USub: op.neg,
    ast.UAdd: op.pos,
}

_ALLOWED_FUNCS: dict[str, Callable[..., Any]] = {
    "sqrt": math.sqrt,
    "log": math.log,
    "log2": math.log2,
    "log10": math.log10,
    "exp": math.exp,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "floor": math.floor,
    "ceil": math.ceil,
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "pow": pow,
}

_ALLOWED_NAMES = {
    "pi": math.pi,
    "e": math.e,
    "tau": math.tau,
    "inf": math.inf,
}


def _safe_eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.Name) and node.id in _ALLOWED_NAMES:
        return _ALLOWED_NAMES[node.id]
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_OPS:
        return _ALLOWED_OPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_OPS:
        return _ALLOWED_OPS[type(node.op)](_safe_eval(node.operand))
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _ALLOWED_FUNCS:
        args = [_safe_eval(a) for a in node.args]
        return _ALLOWED_FUNCS[node.func.id](*args)
    raise ValueError(f"Unsupported expression: {ast.dump(node)}")


@tool
def calculator(expression: str) -> str:
    """Evaluate a math expression. Supports +-*/ ** ^ % //, parentheses, and functions:
    sqrt, log, log2, log10, exp, sin, cos, tan, asin, acos, atan, floor, ceil,
    abs, round, min, max, pow. Constants: pi, e, tau. Examples: 'sqrt(1444111)',
    '2 ** 10', '(3 + 4) * 5', 'sin(pi / 2)'."""
    try:
        tree = ast.parse(expression, mode="eval")
        result = _safe_eval(tree.body)
        return str(result)
    except Exception as e:
        return f"Error: {e}"


@tool
def http_get(url: str) -> str:
    """Fetch the body of a URL via HTTP GET. Returns up to 2000 characters."""
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
            text = r.text
            return text[:2000] + ("…" if len(text) > 2000 else "")
    except Exception as e:
        return f"Error: {e}"


@tool
def web_search(query: str) -> str:
    """Search the web via DuckDuckGo. Returns top results as a numbered list with title, snippet, and URL."""
    import re
    import html as html_lib

    try:
        with httpx.Client(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; YunoAgentPlatform/1.0)"},
        ) as client:
            r = client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query},
            )
            r.raise_for_status()
            body = r.text

        # Crude but reliable parse of the DDG HTML results.
        result_re = re.compile(
            r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>'
            r'.*?<a[^>]*class="result__snippet"[^>]*>(.*?)</a>',
            re.DOTALL,
        )

        def clean(s: str) -> str:
            s = re.sub(r"<[^>]+>", "", s)
            s = html_lib.unescape(s)
            return re.sub(r"\s+", " ", s).strip()

        def unwrap_url(u: str) -> str:
            m = re.search(r"uddg=([^&]+)", u)
            if m:
                from urllib.parse import unquote
                return unquote(m.group(1))
            return u

        results = []
        for i, m in enumerate(result_re.finditer(body), 1):
            url = unwrap_url(m.group(1))
            title = clean(m.group(2))
            snippet = clean(m.group(3))
            results.append(f"{i}. {title}\n   {snippet}\n   {url}")
            if len(results) >= 5:
                break

        if not results:
            return "No results found."
        return "\n\n".join(results)
    except Exception as e:
        return f"Error: {e}"


TOOL_REGISTRY: dict[str, BaseTool] = {
    "current_time": cast(BaseTool, current_time),
    "calculator": cast(BaseTool, calculator),
    "http_get": cast(BaseTool, http_get),
    "web_search": cast(BaseTool, web_search),
}


def get_tools(names: list[str]) -> list[BaseTool]:
    """Resolve tool names to BaseTool instances, ignoring unknown names."""
    return [TOOL_REGISTRY[n] for n in names if n in TOOL_REGISTRY]


def list_tool_names() -> list[str]:
    return sorted(TOOL_REGISTRY.keys())

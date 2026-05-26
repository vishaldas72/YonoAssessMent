"""Shared pytest fixtures.

Integration tests hit a live backend at API_BASE (defaults to http://localhost:8000),
the same instance docker-compose runs.  They create + clean up their own resources so
they're safe to run repeatedly.
"""
import os
from collections.abc import AsyncGenerator

import httpx
import pytest

API_BASE = os.environ.get("API_BASE", "http://localhost:8000")


@pytest.fixture
async def http() -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(base_url=API_BASE, timeout=15.0) as client:
        yield client

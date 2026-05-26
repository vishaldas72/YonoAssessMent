"""Tiny abstraction over Redis pub/sub. Swap for Kafka/SQS by replacing this file."""
import json
import uuid
from typing import AsyncIterator

import redis.asyncio as redis_async

from app.config import settings


def _client() -> redis_async.Redis:
    return redis_async.from_url(settings.redis_url, decode_responses=True)


def run_channel(run_id: uuid.UUID) -> str:
    return f"run:{run_id}"


async def publish(channel: str, payload: dict) -> None:
    client = _client()
    try:
        await client.publish(channel, json.dumps(payload, default=str))
    finally:
        await client.close()


async def subscribe(channel: str) -> AsyncIterator[dict]:
    client = _client()
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            data = message.get("data")
            if isinstance(data, (bytes, bytearray)):
                data = data.decode()
            try:
                yield json.loads(data)
            except Exception:
                yield {"type": "raw", "data": data}
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await client.close()

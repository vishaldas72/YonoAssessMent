import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    role: str = Field("", max_length=120)
    system_prompt: str = ""
    model: str = Field("", max_length=120)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(1024, ge=1, le=200_000)
    tools: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list)
    memory_config: dict[str, Any] = Field(default_factory=dict)
    guardrails: dict[str, Any] = Field(default_factory=dict)
    limits: dict[str, Any] = Field(default_factory=dict)
    schedule_cron: str | None = None


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    role: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    temperature: float | None = Field(None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(None, ge=1, le=200_000)
    tools: list[str] | None = None
    channels: list[str] | None = None
    memory_config: dict[str, Any] | None = None
    guardrails: dict[str, Any] | None = None
    limits: dict[str, Any] | None = None
    schedule_cron: str | None = None


class AgentRead(AgentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

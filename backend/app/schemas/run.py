import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RunCreate(BaseModel):
    prompt: str = Field(..., min_length=1)


class RunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    status: str
    input: str
    output: str | None
    error: str | None
    total_input_tokens: int
    total_output_tokens: int
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class RunEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_id: uuid.UUID
    seq: int
    type: str
    payload: dict[str, Any]
    created_at: datetime

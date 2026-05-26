import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GraphNode(BaseModel):
    id: str
    type: Literal["start", "agent", "end"]
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    data: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None = None


class Graph(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)

    @field_validator("edges")
    @classmethod
    def edges_refer_to_known_nodes(cls, edges, info):
        node_ids = {n.id for n in info.data.get("nodes", [])}
        for e in edges:
            if e.source not in node_ids or e.target not in node_ids:
                raise ValueError(
                    f"edge {e.id} references unknown node ({e.source} -> {e.target})"
                )
        return edges


class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: str = ""
    graph: Graph = Field(default_factory=Graph)
    is_template: bool = False


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=160)
    description: str | None = None
    graph: Graph | None = None
    is_template: bool | None = None


class WorkflowRead(WorkflowBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    created_at: datetime
    updated_at: datetime


class WorkflowRunCreate(BaseModel):
    input: str = Field(..., min_length=1)


class WorkflowRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workflow_id: uuid.UUID
    status: str
    input: str
    output: str | None
    error: str | None
    total_input_tokens: int
    total_output_tokens: int
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class WorkflowRunEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workflow_run_id: uuid.UUID
    seq: int
    node_id: str | None
    type: str
    payload: dict[str, Any]
    created_at: datetime

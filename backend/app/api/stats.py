from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.run import Run
from app.models.workflow import Workflow, WorkflowRun
from app.runtime.pricing import calculate_cost

router = APIRouter(tags=["stats"])


def _default_model() -> str:
    provider = settings.llm_provider.lower()
    if provider == "groq":
        return settings.groq_model
    if provider == "anthropic":
        return settings.anthropic_model
    if provider == "ollama":
        return settings.ollama_model
    return ""


@router.get("/stats")
async def stats(session: AsyncSession = Depends(get_session)):
    agents_count = (await session.execute(select(func.count(Agent.id)))).scalar_one()
    workflows_count = (
        await session.execute(select(func.count(Workflow.id)))
    ).scalar_one()
    runs_count = (await session.execute(select(func.count(Run.id)))).scalar_one()
    wf_runs_count = (
        await session.execute(select(func.count(WorkflowRun.id)))
    ).scalar_one()
    conv_count = (
        await session.execute(select(func.count(Conversation.id)))
    ).scalar_one()

    # Per-run cost = price(agent.model) * tokens
    agent_runs_q = await session.execute(
        select(
            Run.id,
            Run.status,
            Run.input,
            Run.output,
            Run.total_input_tokens,
            Run.total_output_tokens,
            Run.created_at,
            Run.finished_at,
            Run.agent_id,
            Agent.name,
            Agent.model,
        )
        .join(Agent, Agent.id == Run.agent_id, isouter=True)
        .order_by(Run.created_at.desc())
        .limit(8)
    )
    recent_agent_runs = []
    for r in agent_runs_q.all():
        cost = calculate_cost(r.model, r.total_input_tokens or 0, r.total_output_tokens or 0)
        recent_agent_runs.append(
            {
                "id": str(r.id),
                "agent_id": str(r.agent_id),
                "agent_name": r.name,
                "status": r.status,
                "input": (r.input or "")[:120],
                "output": (r.output or "")[:160] if r.output else None,
                "input_tokens": r.total_input_tokens,
                "output_tokens": r.total_output_tokens,
                "cost_usd": cost,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )

    # Workflow runs — we use the global default model for cost (approximation).
    default_model = _default_model()
    wf_runs_q = await session.execute(
        select(
            WorkflowRun.id,
            WorkflowRun.workflow_id,
            WorkflowRun.status,
            WorkflowRun.input,
            WorkflowRun.output,
            WorkflowRun.total_input_tokens,
            WorkflowRun.total_output_tokens,
            WorkflowRun.created_at,
            Workflow.name,
        )
        .join(Workflow, Workflow.id == WorkflowRun.workflow_id, isouter=True)
        .order_by(WorkflowRun.created_at.desc())
        .limit(8)
    )
    recent_workflow_runs = []
    for r in wf_runs_q.all():
        cost = calculate_cost(
            default_model,
            r.total_input_tokens or 0,
            r.total_output_tokens or 0,
        )
        recent_workflow_runs.append(
            {
                "id": str(r.id),
                "workflow_id": str(r.workflow_id),
                "workflow_name": r.name,
                "status": r.status,
                "input": (r.input or "")[:120],
                "output": (r.output or "")[:160] if r.output else None,
                "input_tokens": r.total_input_tokens,
                "output_tokens": r.total_output_tokens,
                "cost_usd": cost,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )

    # Totals: sum tokens across both run types.
    agent_tokens_q = await session.execute(
        select(
            func.coalesce(func.sum(Run.total_input_tokens), 0),
            func.coalesce(func.sum(Run.total_output_tokens), 0),
        )
    )
    a_in, a_out = agent_tokens_q.one()
    wf_tokens_q = await session.execute(
        select(
            func.coalesce(func.sum(WorkflowRun.total_input_tokens), 0),
            func.coalesce(func.sum(WorkflowRun.total_output_tokens), 0),
        )
    )
    w_in, w_out = wf_tokens_q.one()

    # Approximate total cost: agent runs cost computed per agent; workflow runs use default model.
    # Compute agent-runs cost in a second pass for accuracy.
    agent_cost_q = await session.execute(
        select(
            Run.total_input_tokens,
            Run.total_output_tokens,
            Agent.model,
        ).join(Agent, Agent.id == Run.agent_id, isouter=True)
    )
    total_cost = 0.0
    for in_tokens, out_tokens, model in agent_cost_q.all():
        total_cost += calculate_cost(model, in_tokens or 0, out_tokens or 0)
    total_cost += calculate_cost(default_model, w_in or 0, w_out or 0)

    return {
        "totals": {
            "agents": agents_count,
            "workflows": workflows_count,
            "agent_runs": runs_count,
            "workflow_runs": wf_runs_count,
            "conversations": conv_count,
            "input_tokens": int((a_in or 0) + (w_in or 0)),
            "output_tokens": int((a_out or 0) + (w_out or 0)),
            "cost_usd": total_cost,
        },
        "recent_agent_runs": recent_agent_runs,
        "recent_workflow_runs": recent_workflow_runs,
        "default_model": default_model,
    }

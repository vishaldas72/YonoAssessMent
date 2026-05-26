"""Idempotent seed of starter agents + workflow templates.

Runs at startup. Skips any item already present (looked up by name).
Templates use `is_template=True` so the UI can badge + offer "use template" clone.
"""
from __future__ import annotations

import logging

from sqlalchemy import select

from app.db import get_sessionmaker
from app.models.agent import Agent
from app.models.workflow import Workflow

log = logging.getLogger(__name__)


SEED_AGENTS: list[dict] = [
    {
        "name": "Template Researcher",
        "role": "Web researcher",
        "system_prompt": (
            "You are a web researcher. Use the web_search tool to gather facts about the "
            "user's topic. Then write a concise factual brief (3-5 bullet points) including "
            "key facts, dates, and notable details. Do not editorialize. Always cite at least "
            "one URL from search results."
        ),
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.2,
        "max_tokens": 1024,
        "tools": ["web_search"],
        "channels": [],
    },
    {
        "name": "Template Writer",
        "role": "Friendly summarizer",
        "system_prompt": (
            "You receive a research brief. Rewrite it as a warm, friendly 2-3 sentence "
            "summary a non-expert can understand. No bullet points. End with one short "
            "follow-up question the user might enjoy exploring."
        ),
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.5,
        "max_tokens": 512,
        "tools": [],
        "channels": [],
    },
    {
        "name": "Template Triage",
        "role": "First-line support classifier",
        "system_prompt": (
            "You are a customer support triage assistant. Classify the user's message as "
            "one of: BILLING, BUG, FEATURE_REQUEST, OTHER. Then write a one-line acknowledgment "
            "for the user. Format your reply exactly as:\n\n"
            "CATEGORY: <one of the labels above>\nREPLY: <single sentence acknowledgment>"
        ),
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.1,
        "max_tokens": 256,
        "tools": [],
        "channels": [],
    },
    {
        "name": "Template Escalation",
        "role": "Routes serious issues to a human inbox",
        "system_prompt": (
            "You receive a triage report (CATEGORY + REPLY). Decide whether to escalate. "
            "Escalate if CATEGORY is BILLING or BUG. For escalations, draft a short internal "
            "memo (3 sentences) summarizing the original issue and category. For "
            "FEATURE_REQUEST or OTHER, simply reply with the original REPLY line as-is. "
            "Always end with the line: ROUTED_TO: <human-inbox|user>"
        ),
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.2,
        "max_tokens": 384,
        "tools": [],
        "channels": [],
    },
]


def _research_workflow_graph(researcher_id: str, writer_id: str) -> dict:
    return {
        "nodes": [
            {"id": "n1", "type": "start", "position": {"x": 40, "y": 120}, "data": {}},
            {
                "id": "n2",
                "type": "agent",
                "position": {"x": 240, "y": 120},
                "data": {"agent_id": researcher_id, "label": "Template Researcher"},
            },
            {
                "id": "n3",
                "type": "agent",
                "position": {"x": 480, "y": 120},
                "data": {"agent_id": writer_id, "label": "Template Writer"},
            },
            {"id": "n4", "type": "end", "position": {"x": 720, "y": 120}, "data": {}},
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4"},
        ],
    }


def _triage_workflow_graph(triage_id: str, escalation_id: str) -> dict:
    return {
        "nodes": [
            {"id": "n1", "type": "start", "position": {"x": 40, "y": 120}, "data": {}},
            {
                "id": "n2",
                "type": "agent",
                "position": {"x": 240, "y": 120},
                "data": {"agent_id": triage_id, "label": "Template Triage"},
            },
            {
                "id": "n3",
                "type": "agent",
                "position": {"x": 480, "y": 120},
                "data": {"agent_id": escalation_id, "label": "Template Escalation"},
            },
            {"id": "n4", "type": "end", "position": {"x": 720, "y": 120}, "data": {}},
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4"},
        ],
    }


async def _get_or_create_agent(session, payload: dict) -> Agent:
    result = await session.execute(select(Agent).where(Agent.name == payload["name"]))
    existing = result.scalar_one_or_none()
    if existing is not None:
        return existing
    agent = Agent(**payload)
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return agent


async def _get_or_create_workflow_template(
    session, name: str, description: str, graph: dict
) -> Workflow:
    result = await session.execute(
        select(Workflow).where(Workflow.name == name, Workflow.is_template.is_(True))
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        return existing
    wf = Workflow(
        name=name, description=description, graph=graph, is_template=True, version=1
    )
    session.add(wf)
    await session.commit()
    await session.refresh(wf)
    return wf


async def seed_starter_content() -> None:
    sm = get_sessionmaker()
    try:
        async with sm() as session:
            agents_by_name: dict[str, Agent] = {}
            for spec in SEED_AGENTS:
                agent = await _get_or_create_agent(session, spec)
                agents_by_name[agent.name] = agent

            research_graph = _research_workflow_graph(
                str(agents_by_name["Template Researcher"].id),
                str(agents_by_name["Template Writer"].id),
            )
            await _get_or_create_workflow_template(
                session,
                name="Template — Research & Summarize",
                description=(
                    "Researcher uses web_search to gather facts about the input topic. "
                    "Writer rewrites the brief as a friendly summary. Run with any subject."
                ),
                graph=research_graph,
            )

            triage_graph = _triage_workflow_graph(
                str(agents_by_name["Template Triage"].id),
                str(agents_by_name["Template Escalation"].id),
            )
            await _get_or_create_workflow_template(
                session,
                name="Template — Support Triage",
                description=(
                    "Triage classifies an inbound support message; Escalation decides whether "
                    "to route it to a human inbox or reply directly. Run with a customer message."
                ),
                graph=triage_graph,
            )

            log.info("Seed complete: %d agents, 2 templates ensured.", len(agents_by_name))
    except Exception as e:
        log.exception("Seed failed: %s", e)

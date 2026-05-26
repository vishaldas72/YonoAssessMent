from fastapi import APIRouter

from app.config import settings
from app.runtime.pricing import KNOWN_MODELS

router = APIRouter(tags=["models"])


def _default_model() -> str:
    p = settings.llm_provider.lower()
    if p == "groq":
        return settings.groq_model
    if p == "anthropic":
        return settings.anthropic_model
    if p == "ollama":
        return settings.ollama_model
    return ""


@router.get("/models")
async def list_models():
    """Return the registered model catalog.

    UI uses this to populate the agent form's model dropdown. The `active_provider`
    field tells the UI which group to surface first; off-provider models still
    show but are marked so users know they'd need to switch LLM_PROVIDER.
    """
    return {
        "active_provider": settings.llm_provider.lower(),
        "default_model": _default_model(),
        "models": KNOWN_MODELS,
    }

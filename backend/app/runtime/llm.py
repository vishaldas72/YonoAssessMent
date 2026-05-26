from langchain_core.language_models import BaseChatModel
from pydantic import SecretStr

from app.config import settings


def get_llm(
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> BaseChatModel:
    """Return a LangChain chat model for the configured provider."""
    provider = settings.llm_provider.lower()

    if provider == "groq":
        from langchain_groq import ChatGroq

        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        return ChatGroq(
            api_key=SecretStr(settings.groq_api_key),
            model=model or settings.groq_model,
            temperature=temperature,
            max_tokens=max_tokens,
            stop_sequences=None,
        )

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        # langchain-anthropic's type stubs don't enumerate every accepted kwarg.
        return ChatAnthropic(  # type: ignore[call-arg]
            api_key=SecretStr(settings.anthropic_api_key),
            model=model or settings.anthropic_model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            base_url=settings.ollama_base_url,
            model=model or settings.ollama_model,
            temperature=temperature,
            num_predict=max_tokens,
        )

    raise RuntimeError(f"Unknown LLM_PROVIDER: {settings.llm_provider}")

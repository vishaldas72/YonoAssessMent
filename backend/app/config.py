from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://yuno:yuno@postgres:5432/yuno"
    redis_url: str = "redis://redis:6379/0"

    llm_provider: str = "groq"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.1:8b"

    telegram_bot_token: str = ""


settings = Settings()

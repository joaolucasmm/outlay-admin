from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service configuration, read from the environment (see the root .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str | None = None
    model_id: str | None = None
    prompt_version: str = "v1"
    cors_origins: list[str] = ["http://localhost:5173"]

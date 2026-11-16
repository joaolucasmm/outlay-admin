from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

Effort = Literal["low", "medium", "high", "xhigh", "max"]


class Settings(BaseSettings):
    """Service configuration, read from the environment (see the root .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The SDK also finds credentials without this (ANTHROPIC_AUTH_TOKEN, `ant auth login`).
    anthropic_api_key: str | None = None
    model_id: str = "claude-opus-5-5"
    # Extraction is a short, well-specified task: low effort keeps it fast and cheap.
    effort: Effort = "low"
    prompt_version: str = "v1"
    max_image_bytes: int = 5_000_000
    max_image_side: int = 1568
    cors_origins: list[str] = ["http://localhost:5173"]

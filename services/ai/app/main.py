from typing import Literal

import anthropic
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.receipts import router as receipts_router
from app.extraction.extractor import Extractor, load_prompt
from app.extraction.llm import AnthropicReceiptModel, ReceiptModel
from app.settings import Settings


class Health(BaseModel):
    status: Literal["ok"]


def default_model(settings: Settings) -> ReceiptModel:
    # Without an explicit key the SDK resolves credentials itself (env or `ant auth login`).
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return AnthropicReceiptModel(client, settings.model_id, settings.effort)


def create_app(settings: Settings | None = None, model: ReceiptModel | None = None) -> FastAPI:
    settings = settings or Settings()
    load_prompt(settings.prompt_version)  # fail fast on a bad PROMPT_VERSION
    app = FastAPI(title="Outlay AI service", version="0.2.0")
    app.state.settings = settings
    app.state.extractor = Extractor(
        model=model or default_model(settings), prompt_version=settings.prompt_version
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> Health:
        return Health(status="ok")

    app.include_router(receipts_router)
    return app


app = create_app()

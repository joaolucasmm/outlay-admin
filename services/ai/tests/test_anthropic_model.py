"""AnthropicReceiptModel against a stand-in client: checks the request we send and how
each kind of response is handled. No network."""

from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2 as httpx
import pytest
from pydantic import ValidationError

from app.extraction.images import PreparedImage
from app.extraction.llm import (
    AnthropicReceiptModel,
    InvalidModelOutputError,
    ProviderUnavailableError,
)
from app.extraction.schema import CategoryHint, ModelReceipt
from tests.fakes import receipt

IMAGE = PreparedImage(b"\x89PNG-bytes", "image/png", 10, 10)
CATEGORIES = [CategoryHint(code="MEALS", name="Meals")]


class StubMessages:
    def __init__(self, outcome: Any) -> None:
        self.outcome = outcome
        self.kwargs: dict[str, Any] = {}

    def parse(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


def model_with(outcome: Any) -> tuple[AnthropicReceiptModel, StubMessages]:
    messages = StubMessages(outcome)
    client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
    return AnthropicReceiptModel(client, "claude-opus-5-5", "low"), messages  # type: ignore[arg-type]


def response(stop_reason: str = "end_turn", parsed: ModelReceipt | None = None) -> Any:
    content = [SimpleNamespace(type="thinking"), SimpleNamespace(type="text", parsed_output=parsed)]
    return SimpleNamespace(stop_reason=stop_reason, model="claude-opus-5-5", content=content)


def test_sends_the_image_prompt_schema_and_fallbacks() -> None:
    model, messages = model_with(response(parsed=receipt()))

    answer = model.extract(IMAGE, "SYSTEM PROMPT", CATEGORIES)

    assert answer.receipt.merchant == "Padaria Central"
    assert answer.model == "claude-opus-5-5"
    sent = messages.kwargs
    assert sent["model"] == "claude-opus-5-5"
    assert sent["system"] == "SYSTEM PROMPT"
    assert sent["output_format"] is ModelReceipt
    assert sent["output_config"] == {"effort": "low"}
    assert sent["fallbacks"] == "default"
    assert sent["betas"] == ["server-side-fallback-2026-07-01"]
    image_block, text_block = sent["messages"][0]["content"]
    assert image_block["source"]["media_type"] == "image/png"
    assert image_block["source"]["type"] == "base64"
    assert "- MEALS: Meals" in text_block["text"]


@pytest.mark.parametrize(
    ("outcome", "reason"),
    [
        (response(stop_reason="refusal"), "refusal"),
        (response(stop_reason="max_tokens"), "max_tokens"),
        (response(parsed=None), "empty"),
    ],
)
def test_flags_unusable_answers_for_a_retry(outcome: Any, reason: str) -> None:
    model, _ = model_with(outcome)

    with pytest.raises(InvalidModelOutputError) as raised:
        model.extract(IMAGE, "p", CATEGORIES)
    assert raised.value.reason == reason


def test_flags_json_that_does_not_match_the_schema() -> None:
    try:
        ModelReceipt.model_validate_json('{"merchant": 1}')
    except ValidationError as error:
        invalid = error
    model, _ = model_with(invalid)

    with pytest.raises(InvalidModelOutputError) as raised:
        model.extract(IMAGE, "p", CATEGORIES)
    assert raised.value.reason == "invalid_output"


def api_error(cls: type[anthropic.APIStatusError], status: int) -> anthropic.APIStatusError:
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("boom", response=httpx.Response(status, request=request), body=None)


@pytest.mark.parametrize(
    ("error", "status"),
    [
        (api_error(anthropic.RateLimitError, 429), 503),
        (api_error(anthropic.AuthenticationError, 401), 502),
        (api_error(anthropic.InternalServerError, 500), 502),
        (
            anthropic.APIConnectionError(
                request=httpx.Request("POST", "https://api.anthropic.com/v1/messages")
            ),
            503,
        ),
        (anthropic.AnthropicError("no credentials"), 502),
    ],
)
def test_maps_provider_errors(error: Exception, status: int) -> None:
    model, _ = model_with(error)

    with pytest.raises(ProviderUnavailableError) as raised:
        model.extract(IMAGE, "p", CATEGORIES)
    assert raised.value.status == status

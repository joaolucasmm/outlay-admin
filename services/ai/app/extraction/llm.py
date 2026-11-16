"""The LLM behind receipt extraction, behind an interface so tests use a fake."""

import base64
from dataclasses import dataclass
from typing import Literal, Protocol

import anthropic
from pydantic import ValidationError

from app.extraction.images import PreparedImage
from app.extraction.schema import CategoryHint, ModelReceipt
from app.settings import Effort

InvalidReason = Literal["invalid_output", "refusal", "max_tokens", "empty"]


@dataclass(frozen=True)
class Usage:
    """Billed tokens of one call, as the API reported them."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0

    @classmethod
    def from_response(cls, usage: object) -> "Usage":
        def tokens(name: str) -> int:
            value = getattr(usage, name, 0)
            return value if isinstance(value, int) else 0

        return cls(
            tokens("input_tokens"),
            tokens("output_tokens"),
            tokens("cache_read_input_tokens"),
            tokens("cache_creation_input_tokens"),
        )


class InvalidModelOutputError(Exception):
    """The model answered, but not with a usable extraction. Worth one retry."""

    def __init__(
        self,
        reason: InvalidReason,
        *,
        model: str | None = None,
        usage: Usage | None = None,
        stop_reason: str | None = None,
    ) -> None:
        super().__init__(reason)
        self.reason: InvalidReason = reason
        # Billed even though unusable; None when the SDK raised before we saw the response.
        self.model = model
        self.usage = usage
        self.stop_reason = stop_reason


class ProviderUnavailableError(Exception):
    """The provider could not answer (outage, rate limit, credentials). Not retried here."""

    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


@dataclass(frozen=True)
class ModelAnswer:
    receipt: ModelReceipt
    model: str
    usage: Usage | None = None
    stop_reason: str | None = None


class ReceiptModel(Protocol):
    model_id: str

    def extract(
        self, image: PreparedImage, instructions: str, categories: list[CategoryHint]
    ) -> ModelAnswer: ...


def user_text(categories: list[CategoryHint]) -> str:
    if not categories:
        return "Extract the receipt. There are no categories to suggest from: use null."
    listed = "\n".join(f"- {c.code}: {c.name}" for c in categories)
    return f"Extract the receipt. Category codes you may suggest:\n{listed}"


class AnthropicReceiptModel:
    """Claude with vision and structured output (the response must match ModelReceipt)."""

    # Thinking is always on for this model family; leave room for it and the JSON.
    MAX_TOKENS = 8000

    def __init__(self, client: anthropic.Anthropic, model_id: str, effort: Effort) -> None:
        self._client = client
        self.model_id = model_id
        self._effort: Effort = effort

    def extract(
        self, image: PreparedImage, instructions: str, categories: list[CategoryHint]
    ) -> ModelAnswer:
        try:
            response = self._client.beta.messages.parse(
                model=self.model_id,
                max_tokens=self.MAX_TOKENS,
                system=instructions,
                output_config={"effort": self._effort},
                output_format=ModelReceipt,
                # On a safety refusal, the API retries on a suitable model in the same call.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": image.media_type,
                                    "data": base64.standard_b64encode(image.data).decode(),
                                },
                            },
                            {"type": "text", "text": user_text(categories)},
                        ],
                    }
                ],
            )
        except ValidationError as error:
            raise InvalidModelOutputError("invalid_output") from error
        except anthropic.RateLimitError as error:
            raise ProviderUnavailableError(
                503, "The AI provider is rate limiting requests."
            ) from error
        except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as error:
            raise ProviderUnavailableError(
                502, "The AI provider rejected the credentials."
            ) from error
        except anthropic.APIStatusError as error:
            detail = f"The AI provider failed ({error.status_code})."
            raise ProviderUnavailableError(502, detail) from error
        except anthropic.APIConnectionError as error:
            raise ProviderUnavailableError(503, "The AI provider could not be reached.") from error
        except anthropic.AnthropicError as error:  # e.g. no credentials configured
            raise ProviderUnavailableError(502, "The AI provider is not configured.") from error

        usage = Usage.from_response(getattr(response, "usage", None))

        def unusable(reason: InvalidReason) -> InvalidModelOutputError:
            return InvalidModelOutputError(
                reason, model=response.model, usage=usage, stop_reason=response.stop_reason
            )

        if response.stop_reason == "refusal":
            raise unusable("refusal")
        if response.stop_reason == "max_tokens":
            raise unusable("max_tokens")
        parsed = next(
            (block.parsed_output for block in response.content if block.type == "text"), None
        )
        if parsed is None:
            raise unusable("empty")
        return ModelAnswer(
            receipt=parsed, model=response.model, usage=usage, stop_reason=response.stop_reason
        )

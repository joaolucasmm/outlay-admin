"""Test doubles: no test ever calls a real LLM."""

import io
from collections.abc import Sequence
from dataclasses import dataclass, field

from PIL import Image

from app.extraction.images import PreparedImage
from app.extraction.llm import InvalidModelOutputError, ModelAnswer, ProviderUnavailableError
from app.extraction.schema import CategoryHint, ModelReceipt

Scripted = ModelReceipt | InvalidModelOutputError | ProviderUnavailableError


@dataclass
class Call:
    image: PreparedImage
    instructions: str
    categories: list[CategoryHint]


@dataclass
class FakeReceiptModel:
    """Returns (or raises) the scripted answers in order, recording every call."""

    script: Sequence[Scripted]
    model_id: str = "fake-model"
    calls: list[Call] = field(default_factory=list)

    def extract(
        self, image: PreparedImage, instructions: str, categories: list[CategoryHint]
    ) -> ModelAnswer:
        self.calls.append(Call(image, instructions, categories))
        step = self.script[len(self.calls) - 1]
        if isinstance(step, Exception):
            raise step
        return ModelAnswer(receipt=step, model=self.model_id)


def receipt(**overrides: object) -> ModelReceipt:
    values: dict[str, object] = {
        "merchant": "Padaria Central",
        "date": "2026-11-10",
        "total": "86.40",
        "currency": "BRL",
        "suggested_category_code": "MEALS",
        "confidence": "high",
    }
    values.update(overrides)
    return ModelReceipt.model_validate(values)


def image_bytes(size: tuple[int, int] = (400, 600), fmt: str = "PNG") -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, "white").save(out, format=fmt)
    return out.getvalue()

"""Receipt extraction: call the model, retry once, normalize, never fail on bad output."""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from app.extraction.images import PreparedImage
from app.extraction.llm import InvalidModelOutputError, ModelAnswer, ReceiptModel
from app.extraction.normalize import adjusted_confidence, normalize
from app.extraction.schema import CategoryHint, ReceiptExtraction

PROMPTS = Path(__file__).parent / "prompts"
ATTEMPTS = 2  # the first call plus one retry


@cache
def load_prompt(version: str) -> str:
    path = PROMPTS / f"{version}.md"
    if not path.is_file():
        raise ValueError(f"Unknown prompt version '{version}'.")
    return path.read_text(encoding="utf-8")


@dataclass
class Extractor:
    model: ReceiptModel
    prompt_version: str
    clock: Callable[[], float] = field(default=time.perf_counter)

    def extract(self, image: PreparedImage, categories: list[CategoryHint]) -> ReceiptExtraction:
        instructions = load_prompt(self.prompt_version)
        started = self.clock()
        failures: list[str] = []
        answer: ModelAnswer | None = None
        for _ in range(ATTEMPTS):
            try:
                answer = self.model.extract(image, instructions, categories)
                break
            except InvalidModelOutputError as error:
                failures.append(error.reason)
        latency_ms = max(0, round((self.clock() - started) * 1000))

        if answer is None:
            return ReceiptExtraction(
                merchant=None,
                date=None,
                total_minor=None,
                currency=None,
                suggested_category_code=None,
                confidence="low",
                notes=f"The receipt could not be read ({', '.join(failures)}). "
                "Fill in the fields manually.",
                model=self.model.model_id,
                prompt_version=self.prompt_version,
                latency_ms=latency_ms,
            )

        fields = normalize(answer.receipt, {c.code for c in categories})
        notes = [f"Dropped: {'; '.join(fields.issues)}."] if fields.issues else []
        if failures:
            notes.append(f"Succeeded after a retry ({failures[0]}).")
        return ReceiptExtraction(
            merchant=fields.merchant,
            date=fields.date,
            total_minor=fields.total_minor,
            currency=fields.currency,
            suggested_category_code=fields.suggested_category_code,
            confidence=adjusted_confidence(answer.receipt.confidence, fields.issues),
            notes=" ".join(notes) or None,
            model=answer.model,
            prompt_version=self.prompt_version,
            latency_ms=latency_ms,
        )

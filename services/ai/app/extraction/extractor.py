"""Receipt extraction: call the model, retry once, normalize, never fail on bad output."""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from app.extraction.images import PreparedImage
from app.extraction.llm import InvalidModelOutputError, ModelAnswer, ReceiptModel, Usage
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


@dataclass(frozen=True)
class Attempt:
    """One model call: what it returned, what it cost and how long it took."""

    outcome: str  # "ok", or the InvalidModelOutputError reason
    model: str | None
    usage: Usage | None
    stop_reason: str | None
    latency_s: float


@dataclass(frozen=True)
class ExtractionRun:
    extraction: ReceiptExtraction
    attempts: list[Attempt]


@dataclass
class Extractor:
    model: ReceiptModel
    prompt_version: str
    clock: Callable[[], float] = field(default=time.perf_counter)

    def extract(self, image: PreparedImage, categories: list[CategoryHint]) -> ReceiptExtraction:
        return self.extract_traced(image, categories).extraction

    def extract_traced(self, image: PreparedImage, categories: list[CategoryHint]) -> ExtractionRun:
        """Like `extract`, plus every attempt's usage and latency (used by the evals)."""
        instructions = load_prompt(self.prompt_version)
        started = self.clock()
        attempts: list[Attempt] = []
        answer: ModelAnswer | None = None
        for _ in range(ATTEMPTS):
            call_started = self.clock()
            try:
                answer = self.model.extract(image, instructions, categories)
            except InvalidModelOutputError as error:
                attempts.append(
                    Attempt(
                        error.reason,
                        error.model,
                        error.usage,
                        error.stop_reason,
                        self.clock() - call_started,
                    )
                )
                continue
            attempts.append(
                Attempt(
                    "ok",
                    answer.model,
                    answer.usage,
                    answer.stop_reason,
                    self.clock() - call_started,
                )
            )
            break
        latency_ms = max(0, round((self.clock() - started) * 1000))
        failures = [a.outcome for a in attempts if a.outcome != "ok"]

        if answer is None:
            extraction = ReceiptExtraction(
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
            return ExtractionRun(extraction, attempts)

        fields = normalize(answer.receipt, {c.code for c in categories})
        notes = [f"Dropped: {'; '.join(fields.issues)}."] if fields.issues else []
        if failures:
            notes.append(f"Succeeded after a retry ({failures[0]}).")
        extraction = ReceiptExtraction(
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
        return ExtractionRun(extraction, attempts)

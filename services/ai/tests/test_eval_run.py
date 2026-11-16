"""The eval harness, end to end, with stand-in models (no network).

Oracle and null models are the guide's two smoke tests: the oracle must score ~100%,
the null model ~0% (except where null is the right answer).
"""

import hashlib
import json
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app.extraction.images import PreparedImage
from app.extraction.llm import (
    InvalidModelOutputError,
    ModelAnswer,
    ProviderUnavailableError,
    Usage,
)
from app.extraction.schema import CategoryHint, ModelReceipt
from app.settings import Settings
from evals.report import build_report, load_variant
from evals.run import (
    Case,
    Config,
    HarnessChangedError,
    check_harness,
    load_cases,
    run_variant,
)

SETTINGS = Settings(anthropic_api_key=None)
USAGE = Usage(input_tokens=1500, output_tokens=200)


def cases(limit: int | None = None) -> list[Case]:
    return load_cases(split="all", limit=limit)


def by_image() -> dict[str, dict[str, object]]:
    return {hashlib.sha256(c.image.read_bytes()).hexdigest(): c.expected for c in cases()}


def receipt_from(expected: dict[str, object]) -> ModelReceipt:
    total = expected["total_minor"]
    return ModelReceipt(
        merchant=expected["merchant"],  # type: ignore[arg-type]
        date=expected["date"],  # type: ignore[arg-type]
        total=None if total is None else f"{int(total) / 100:.2f}",  # type: ignore[call-overload]
        currency=expected["currency"],  # type: ignore[arg-type]
        suggested_category_code=expected["category"],  # type: ignore[arg-type]
        confidence="low" if total is None else "high",
    )


class StubModel:
    """Answers through `respond(expected, call_number)`; thread-safe call counting."""

    def __init__(
        self,
        respond: Callable[[dict[str, object], int], ModelReceipt | Exception],
        model_id: str = "claude-opus-5-5",
        served: str | None = None,
    ) -> None:
        self.model_id = model_id
        self.served = served or model_id
        self.respond = respond
        self.answers = by_image()
        self.calls = 0
        self.lock = threading.Lock()

    def extract(
        self, image: PreparedImage, instructions: str, categories: list[CategoryHint]
    ) -> ModelAnswer:
        with self.lock:
            self.calls += 1
            number = self.calls
        outcome = self.respond(self.answers[hashlib.sha256(image.data).hexdigest()], number)
        if isinstance(outcome, Exception):
            raise outcome
        return ModelAnswer(outcome, self.served, USAGE, "end_turn")


def oracle(expected: dict[str, object], _: int) -> ModelReceipt:
    return receipt_from(expected)


def null(_: dict[str, object], __: int) -> ModelReceipt:
    return ModelReceipt(
        merchant=None,
        date=None,
        total=None,
        currency=None,
        suggested_category_code=None,
        confidence="low",
    )


def config(variant: str = "test-variant", reps: int = 1, **overrides: Any) -> Config:
    return Config(variant, "claude-opus-5-5", "v1", reps=reps, **{"concurrency": 4, **overrides})


def read(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_the_oracle_scores_100_percent(tmp_path: Path) -> None:
    summary = run_variant(cases(), config(), StubModel(oracle), SETTINGS, runs=tmp_path)

    assert summary.rows == 30
    assert summary.errors == 0
    assert summary.field_accuracy == pytest.approx(1.0)
    rows = read(tmp_path / "test-variant" / "results.jsonl")
    assert {r["model"] for r in rows} == {"claude-opus-5-5"}
    assert all(r["usage"]["input_tokens"] == 1500 for r in rows)
    assert (tmp_path / "test-variant" / "traces" / "rcpt-001_rep0.json").is_file()


def test_the_null_model_scores_only_the_unreadable_cases(tmp_path: Path) -> None:
    summary = run_variant(cases(), config(), StubModel(null), SETTINGS, runs=tmp_path)

    # 2 unreadable cases out of 30 are fully right; the rest score 0.
    assert summary.field_accuracy == pytest.approx(2 / 30)


def test_resumes_without_rerunning_finished_cases(tmp_path: Path) -> None:
    first = StubModel(oracle)
    run_variant(cases(5), config(reps=2), first, SETTINGS, runs=tmp_path)
    second = StubModel(oracle)
    summary = run_variant(cases(5), config(reps=2), second, SETTINGS, runs=tmp_path)

    assert first.calls == 10
    assert second.calls == 0
    assert summary.skipped == 10
    assert len(read(tmp_path / "test-variant" / "results.jsonl")) == 10


def test_a_retried_invalid_answer_is_recorded_with_both_attempts(tmp_path: Path) -> None:
    flaky = StubModel(
        lambda e, n: InvalidModelOutputError("invalid_output") if n == 1 else receipt_from(e)
    )
    run_variant(cases(1), config(concurrency=1), flaky, SETTINGS, runs=tmp_path)

    (row,) = read(tmp_path / "test-variant" / "results.jsonl")
    assert row["attempts"] == 2
    assert row["meta"]["attempt_outcomes"] == ["invalid_output", "ok"]
    assert row["grade"]["field_accuracy"] == 1.0


def test_provider_errors_go_to_the_sidecar_not_the_score(tmp_path: Path) -> None:
    broken = StubModel(lambda e, n: ProviderUnavailableError(502, "bad credentials"))
    summary = run_variant(cases(3), config(), broken, SETTINGS, runs=tmp_path)

    assert summary.rows == 0
    assert summary.field_accuracy is None
    errors = read(tmp_path / "test-variant" / "errors.jsonl")
    assert [e["failure_class"] for e in errors] == ["provider_error"] * 3
    # Nothing landed in results, so a rerun tries these cases again.
    assert not (tmp_path / "test-variant" / "results.jsonl").exists()


def test_rate_limits_are_retried_with_backoff_and_counted(tmp_path: Path) -> None:
    sleeps: list[float] = []
    limited = StubModel(
        lambda e, n: ProviderUnavailableError(503, "slow down") if n <= 2 else receipt_from(e)
    )
    run_variant(
        cases(1), config(concurrency=1), limited, SETTINGS, runs=tmp_path, sleep=sleeps.append
    )

    (row,) = read(tmp_path / "test-variant" / "results.jsonl")
    assert row["transient_retries"] == 2
    assert len(sleeps) == 2 and all(s > 0 for s in sleeps)


def test_an_answer_from_another_model_is_not_scored(tmp_path: Path) -> None:
    rerouted = StubModel(oracle, served="claude-opus-5")
    summary = run_variant(cases(2), config(), rerouted, SETTINGS, runs=tmp_path)

    assert summary.rows == 0
    errors = read(tmp_path / "test-variant" / "errors.jsonl")
    assert {e["failure_class"] for e in errors} == {"served_model_mismatch"}
    assert errors[0]["usage"]["input_tokens"] == 1500  # billed spend stays visible


def test_a_hung_call_hits_the_wall_clock_ceiling(tmp_path: Path) -> None:
    release = threading.Event()

    def hang(expected: dict[str, object], _: int) -> ModelReceipt:
        release.wait(5)
        return receipt_from(expected)

    run_variant(cases(1), config(timeout_s=0.2), StubModel(hang), SETTINGS, runs=tmp_path)
    release.set()

    (error,) = read(tmp_path / "test-variant" / "errors.jsonl")
    assert error["failure_class"] == "timeout"


def test_the_harness_gate_needs_an_explicit_approval(tmp_path: Path) -> None:
    lock = tmp_path / "harness.lock"
    with pytest.raises(HarnessChangedError):
        check_harness(lock, approve=False, digest="abc")
    check_harness(lock, approve=True, digest="abc")
    check_harness(lock, approve=False, digest="abc")
    with pytest.raises(HarnessChangedError):
        check_harness(lock, approve=False, digest="changed")


def test_the_report_compares_variants_on_the_same_cases(tmp_path: Path) -> None:
    def date_only_wrong(expected: dict[str, object], _: int) -> ModelReceipt:
        receipt = receipt_from(expected)
        if expected["date"] is None:
            return receipt
        return receipt.model_copy(update={"date": "2026-01-01"})

    run_variant(cases(), config("base"), StubModel(date_only_wrong), SETTINGS, runs=tmp_path)
    run_variant(cases(), config("better"), StubModel(oracle), SETTINGS, runs=tmp_path)

    base, better = load_variant("base", "test", tmp_path), load_variant("better", "test", tmp_path)
    report = build_report(base, [better], "test")

    # 18 readable cases lose 1 of 5 fields (0.8); the 2 unreadable ones stay right (1.0).
    assert "| **Field accuracy** (95% CI) | **82.0%**" in report
    assert "`better` - `base`: **+18.0%**" in report
    assert "better, beyond noise" in report
    assert "rcpt-001" in report  # the base variant's worst cases are listed
    assert "Synthetic receipts only" in report

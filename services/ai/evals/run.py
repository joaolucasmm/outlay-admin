"""Run the receipt extraction eval for one variant (model + prompt version).

    uv run python -m evals.run --variant opus55-v1 --model claude-opus-5-5 --prompt v1 \\
        --split test --reps 3

Calls the service's real `Extractor` (same normalization and retry as production), so it
measures what ships. Writes, under `evals/runs/<variant>/`:
- results.jsonl: one row per (case, rep), written as each finishes; reruns resume.
- errors.jsonl: attempts that produced no scorable output (provider error, timeout,
  served-model mismatch). Never scored as zero, never blocks a resume.
- traces/<case>_rep<k>.json: the full exchange per (case, rep), for debugging.

The harness gate refuses to run if the runner, grader or extraction code changed since
the last `--approve-harness`. That approval is the user's, not the agent's.
"""

import argparse
import dataclasses
import hashlib
import json
import random
import statistics
import sys
import threading
import time
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import anthropic

from app.extraction.extractor import ExtractionRun, Extractor, load_prompt
from app.extraction.images import prepare_image
from app.extraction.llm import (
    AnthropicReceiptModel,
    ProviderUnavailableError,
    ReceiptModel,
    Usage,
    user_text,
)
from app.extraction.schema import CategoryHint
from app.settings import Settings
from evals.grading import grade, predicted_fields
from evals.prices import cost_usd

ROOT = Path(__file__).parent
SERVICE = ROOT.parent
DATASET = ROOT / "dataset"
RUNS = ROOT / "runs"
HARNESS_LOCK = ROOT / "harness.lock"
HARNESS_FILES = [
    ROOT / "run.py",
    ROOT / "grading.py",
    SERVICE / "app" / "extraction" / "extractor.py",
    SERVICE / "app" / "extraction" / "llm.py",
    SERVICE / "app" / "extraction" / "normalize.py",
    SERVICE / "app" / "extraction" / "images.py",
    SERVICE / "app" / "extraction" / "schema.py",
    SERVICE / "uv.lock",
]

# The active categories of the Standard template: what the web app sends as hints.
CATEGORY_HINTS = [
    CategoryHint(code="MEALS", name="Meals"),
    CategoryHint(code="TRAVEL", name="Travel"),
    CategoryHint(code="LODGING", name="Lodging"),
    CategoryHint(code="OFFICE", name="Office supplies"),
    CategoryHint(code="CLIENT_ENT", name="Client entertainment"),
]


class HarnessChangedError(Exception):
    pass


@dataclass(frozen=True)
class Case:
    id: str
    image: Path
    split: str
    tags: list[str]
    expected: dict[str, object]
    source: str


def load_cases(
    dataset: Path = DATASET,
    split: str = "test",
    limit: int | None = None,
    ids: Sequence[str] = (),
) -> list[Case]:
    cases = []
    for line in (dataset / "labels.jsonl").read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        if split != "all" and row["split"] != split:
            continue
        if ids and row["id"] not in ids:
            continue
        cases.append(
            Case(
                row["id"],
                dataset / row["image"],
                row["split"],
                row["tags"],
                row["expected"],
                row.get("source", "synthetic"),
            )
        )
    return cases[:limit] if limit else cases


def harness_digest(files: Sequence[Path] = HARNESS_FILES) -> str:
    digest = hashlib.sha256()
    for path in sorted(files):
        digest.update(path.name.encode())
        digest.update(path.read_bytes().replace(b"\r\n", b"\n"))
    return digest.hexdigest()


def check_harness(lock: Path = HARNESS_LOCK, *, approve: bool, digest: str | None = None) -> None:
    current = digest or harness_digest()
    if approve:
        lock.write_text(current + "\n", encoding="utf-8")
        return
    recorded = lock.read_text(encoding="utf-8").strip() if lock.exists() else None
    if recorded != current:
        raise HarnessChangedError(
            "The eval harness (runner, grader or extraction code) changed since it was last "
            "approved. Review the change, then run once with --approve-harness."
        )


def _usage_dict(usage: Usage | None) -> dict[str, int]:
    return dataclasses.asdict(usage) if usage else {}


def _sum_usage(run: ExtractionRun) -> dict[str, int]:
    total: dict[str, int] = {}
    for attempt in run.attempts:
        for key, value in _usage_dict(attempt.usage).items():
            total[key] = total.get(key, 0) + value
    return total


@dataclass
class Writer:
    """Appends rows as cases finish, so a crash keeps what already ran."""

    directory: Path
    lock: threading.Lock = field(default_factory=threading.Lock)

    def __post_init__(self) -> None:
        (self.directory / "traces").mkdir(parents=True, exist_ok=True)

    def done(self) -> set[tuple[str, int]]:
        path = self.directory / "results.jsonl"
        if not path.exists():
            return set()
        rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
        return {(row["prompt_id"], row["rep"]) for row in rows}

    def append(self, name: str, row: dict[str, object]) -> None:
        with self.lock, (self.directory / name).open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    def trace(self, case_id: str, rep: int, turns: list[dict[str, object]]) -> None:
        path = self.directory / "traces" / f"{case_id}_rep{rep}.json"
        path.write_text(json.dumps(turns, ensure_ascii=False, indent=2), encoding="utf-8")


@dataclass
class Config:
    variant: str
    model_id: str
    prompt: str
    reps: int = 3
    concurrency: int = 4
    timeout_s: float = 180.0
    max_transient_retries: int = 3


def _with_ceiling(fn: Callable[[], ExtractionRun], timeout_s: float) -> ExtractionRun | None:
    """Hard wall-clock ceiling per case. The call may keep running in the background."""
    box: list[ExtractionRun | BaseException] = []

    def target() -> None:
        try:
            box.append(fn())
        except BaseException as error:  # handed back to the caller below
            box.append(error)

    worker = threading.Thread(target=target, daemon=True)
    worker.start()
    worker.join(timeout_s)
    if not box:
        return None
    result = box[0]
    if isinstance(result, BaseException):
        raise result
    return result


def run_case(
    case: Case,
    rep: int,
    config: Config,
    model: ReceiptModel,
    writer: Writer,
    settings: Settings,
    sleep: Callable[[float], None] = time.sleep,
    rng: random.Random | None = None,
) -> None:
    rng = rng or random.Random()
    image = prepare_image(
        case.image.read_bytes(),
        max_bytes=settings.max_image_bytes,
        max_side=settings.max_image_side,
    )
    extractor = Extractor(model=model, prompt_version=config.prompt)
    error_base = {"prompt_id": case.id, "rep": rep, "variant": config.variant}
    retries = 0
    started = time.perf_counter()
    while True:
        try:
            run = _with_ceiling(
                lambda: extractor.extract_traced(image, CATEGORY_HINTS), config.timeout_s
            )
        except ProviderUnavailableError as error:
            if error.status == 503 and retries < config.max_transient_retries:
                retries += 1
                sleep(min(30.0, 2**retries) * rng.uniform(0.5, 1.5))  # jittered backoff
                continue
            writer.append(
                "errors.jsonl",
                {**error_base, "failure_class": "provider_error", "status": error.status,
                 "detail": error.detail, "retries": retries},
            )  # fmt: skip
            return
        break
    if run is None:
        writer.append(
            "errors.jsonl",
            {**error_base, "failure_class": "timeout", "retries": retries,
             "detail": f"No answer within {config.timeout_s:.0f} s."},
        )  # fmt: skip
        return

    usage = _sum_usage(run)
    served = {a.model for a in run.attempts if a.model}
    if served - {config.model_id}:
        # A fallback or reroute answered: this row would measure a different model.
        writer.append(
            "errors.jsonl",
            {**error_base, "failure_class": "served_model_mismatch", "retries": retries,
             "detail": f"Asked for {config.model_id}, served by {sorted(served)}.",
             "model": sorted(served)[0], "usage": usage},
        )  # fmt: skip
        return

    extraction = run.extraction
    graded = grade(case.expected, extraction)
    outcomes = graded.pop("outcomes")
    final = run.attempts[-1]
    valid = final.outcome == "ok"
    truncated = not valid and any(a.outcome == "max_tokens" for a in run.attempts)
    writer.append(
        "results.jsonl",
        {
            "prompt_id": case.id,
            "prompt": str(case.image.relative_to(ROOT)).replace("\\", "/"),
            "tags": case.tags,
            "split": case.split,
            "rep": rep,
            "variant": config.variant,
            "prompt_version": config.prompt,
            "status": "truncated" if truncated else "ok",
            "stop_reason": final.stop_reason,
            "grade": graded,
            "outcomes": outcomes,
            "expected": case.expected,
            "predicted": predicted_fields(extraction),
            "confidence": extraction.confidence,
            "notes": extraction.notes,
            "valid_output": valid,
            "refusals": sum(a.outcome == "refusal" for a in run.attempts),
            "model": final.model or config.model_id,
            "usage": usage,
            "attempts": len(run.attempts),
            "transient_retries": retries,
            # Latency of the final model call only; retries and backoff stay out of it.
            "latency_s": round(final.latency_s, 3),
            "total_latency_s": round(time.perf_counter() - started, 3),
            "meta": {"source": case.source, "attempt_outcomes": [a.outcome for a in run.attempts]},
        },
    )
    turns: list[dict[str, object]] = [
        {"role": "system", "content": load_prompt(config.prompt)},
        {
            "role": "user",
            "content": user_text(CATEGORY_HINTS),
            "attachments": [{"kind": "image", "ref": f"dataset/images/{case.image.name}"}],
        },
    ]
    for attempt in run.attempts:
        turns.append(
            {
                "role": "assistant",
                "content": (
                    json.dumps(predicted_fields(extraction), ensure_ascii=False)
                    if attempt.outcome == "ok"
                    else f"(unusable answer: {attempt.outcome})"
                ),
            }
        )
    writer.trace(case.id, rep, turns)


@dataclass(frozen=True)
class Summary:
    rows: int
    errors: int
    skipped: int
    field_accuracy: float | None
    ci95: float | None
    cost_usd: float | None


def summarize(directory: Path, skipped: int = 0) -> Summary:
    def read(name: str) -> list[dict[str, object]]:
        path = directory / name
        if not path.exists():
            return []
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]

    rows = [r for r in read("results.jsonl") if r["status"] == "ok"]
    by_case: dict[str, list[float]] = {}
    for row in rows:
        graded = row["grade"]
        assert isinstance(graded, dict)
        by_case.setdefault(str(row["prompt_id"]), []).append(float(graded["field_accuracy"]))
    means = [statistics.fmean(v) for v in by_case.values()]
    mean = statistics.fmean(means) if means else None
    ci = 1.96 * statistics.stdev(means) / len(means) ** 0.5 if len(means) > 1 else None
    costs = [cost_usd(str(r["model"]), r["usage"]) for r in read("results.jsonl")]  # type: ignore[arg-type]
    total = None if any(c is None for c in costs) else sum(c for c in costs if c is not None)
    return Summary(len(rows), len(read("errors.jsonl")), skipped, mean, ci, total)


def run_variant(
    cases: Sequence[Case],
    config: Config,
    model: ReceiptModel,
    settings: Settings,
    runs: Path = RUNS,
    sleep: Callable[[float], None] = time.sleep,
) -> Summary:
    writer = Writer(runs / config.variant)
    done = writer.done()
    jobs = [(c, r) for c in cases for r in range(config.reps) if (c.id, r) not in done]
    skipped = len(cases) * config.reps - len(jobs)
    with ThreadPoolExecutor(max_workers=config.concurrency) as pool:
        futures = [
            pool.submit(run_case, case, rep, config, model, writer, settings, sleep)
            for case, rep in jobs
        ]
        for future in futures:
            future.result()
    return summarize(writer.directory, skipped)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--variant", required=True, help="output folder name, e.g. opus55-v1")
    parser.add_argument("--model", required=True, help="model id, e.g. claude-opus-5-5")
    parser.add_argument("--prompt", required=True, help="prompt version, e.g. v1")
    parser.add_argument("--split", choices=["dev", "test", "all"], default="test")
    parser.add_argument("--reps", type=int, default=3)
    parser.add_argument("--limit", type=int, help="only the first N cases (pilot runs)")
    parser.add_argument("--ids", nargs="*", default=[], help="only these case ids")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--timeout-s", type=float, default=180.0)
    parser.add_argument("--approve-harness", action="store_true")
    args = parser.parse_args(argv)

    try:
        check_harness(approve=args.approve_harness)
    except HarnessChangedError as error:
        print(error, file=sys.stderr)
        return 2

    settings = Settings()
    load_prompt(args.prompt)
    # Retries are the runner's, so they are counted (the SDK's own are invisible).
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, max_retries=0)
    model = AnthropicReceiptModel(client, args.model, settings.effort)
    config = Config(
        args.variant, args.model, args.prompt, args.reps, args.concurrency, args.timeout_s
    )
    cases = load_cases(split=args.split, limit=args.limit, ids=args.ids)

    started = time.perf_counter()
    summary = run_variant(cases, config, model, settings)
    elapsed = time.perf_counter() - started
    accuracy = (
        f"{summary.field_accuracy:.1%} ± {summary.ci95:.1%}"
        if summary.field_accuracy is not None and summary.ci95 is not None
        else "n/a"
    )
    cost = f"${summary.cost_usd:.4f}" if summary.cost_usd is not None else "unknown price"
    print(
        f"{args.variant}: {summary.rows} scored rows ({summary.skipped} resumed), "
        f"{summary.errors} errors, field accuracy {accuracy} (95% CI over cases), "
        f"cost {cost}, {elapsed:.0f} s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Compare eval variants and write a markdown report.

    uv run python -m evals.report --split test --baseline opus55-v1 \\
        --variants opus55-v2 haiku55-v2 --out reports/2026-11-20-v1-vs-v2.md

Every number is recomputed from the raw rows in `runs/<variant>/results.jsonl`.
Truncated rows are counted but kept out of the means; errors are counted separately.
"""

import argparse
import json
import random
import statistics
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from evals.grading import FIELDS
from evals.prices import cost_usd

ROOT = Path(__file__).parent
RUNS = ROOT / "runs"
DATASET = ROOT / "dataset"

Row = dict[str, Any]


def read_jsonl(path: Path) -> list[Row]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


@dataclass(frozen=True)
class Variant:
    name: str
    rows: list[Row]  # status ok, in the requested split
    truncated: int
    errors: int

    @property
    def models(self) -> list[str]:
        return sorted({str(r["model"]) for r in self.rows})

    @property
    def prompts(self) -> list[str]:
        return sorted({str(r["prompt_version"]) for r in self.rows})

    def case_means(self, metric: str = "field_accuracy") -> dict[str, float]:
        by_case: dict[str, list[float]] = {}
        for row in self.rows:
            by_case.setdefault(row["prompt_id"], []).append(float(row["grade"][metric]))
        return {case: statistics.fmean(values) for case, values in by_case.items()}


def load_variant(name: str, split: str, runs: Path = RUNS) -> Variant:
    rows = [
        r
        for r in read_jsonl(runs / name / "results.jsonl")
        if split == "all" or r["split"] == split
    ]
    ok = [r for r in rows if r["status"] == "ok"]
    errors = [
        e
        for e in read_jsonl(runs / name / "errors.jsonl")
        if not any(r["prompt_id"] == e["prompt_id"] and r["rep"] == e["rep"] for r in rows)
    ]
    return Variant(name, ok, len(rows) - len(ok), len(errors))


def mean_ci(values: Sequence[float]) -> tuple[float, float]:
    """Mean and a normal-approximation 95% half-width over cases."""
    mean = statistics.fmean(values)
    half = 1.96 * statistics.stdev(values) / len(values) ** 0.5 if len(values) > 1 else 0.0
    return mean, half


def paired_diff(
    base: dict[str, float], other: dict[str, float], seed: int = 7, resamples: int = 10_000
) -> tuple[float, float, float, int]:
    """Mean difference over shared cases with a bootstrap 95% interval (seeded)."""
    shared = sorted(base.keys() & other.keys())
    diffs = [other[c] - base[c] for c in shared]
    if not diffs:
        return 0.0, 0.0, 0.0, 0
    rng = random.Random(seed)
    boots = sorted(statistics.fmean(rng.choices(diffs, k=len(diffs))) for _ in range(resamples))
    return (
        statistics.fmean(diffs),
        boots[int(0.025 * resamples)],
        boots[int(0.975 * resamples) - 1],
        len(shared),
    )


def percentile(values: Sequence[float], q: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))
    return ordered[index]


def field_rate(rows: Sequence[Row], field: str) -> float:
    right = [r["outcomes"][field] in ("correct", "correct_null") for r in rows]
    return sum(right) / len(right) if right else 0.0


def hallucination_rate(rows: Sequence[Row]) -> tuple[int, int]:
    """Invented values among fields whose right answer is null."""
    nulls = [(r, f) for r in rows for f in FIELDS if r["expected"][f] is None]
    return sum(r["outcomes"][f] == "hallucinated" for r, f in nulls), len(nulls)


def pct(value: float) -> str:
    return f"{value:.1%}"


def money(value: float | None) -> str:
    return "n/a" if value is None else f"${value:.4f}"


def variant_table(variants: Sequence[Variant]) -> list[str]:
    head = ["Metric", *[f"`{v.name}`" for v in variants]]
    lines = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]

    def add(label: str, cells: Sequence[str]) -> None:
        lines.append(f"| {label} | " + " | ".join(cells) + " |")

    add("Model", [", ".join(v.models) or "—" for v in variants])
    add("Prompt", [", ".join(v.prompts) or "—" for v in variants])
    add("Cases / rows scored", [f"{len(v.case_means())} / {len(v.rows)}" for v in variants])
    cells = []
    for v in variants:
        means = list(v.case_means().values())
        if not means:
            cells.append("—")
            continue
        m, h = mean_ci(means)
        cells.append(f"**{pct(m)}** ± {pct(h)}")
    add("**Field accuracy** (95% CI)", cells)
    add(
        "All 5 fields right",
        [pct(statistics.fmean(v.case_means("all_correct").values())) if v.rows else "—"
         for v in variants],
    )  # fmt: skip
    for field in FIELDS:
        add(f"↳ {field}", [pct(field_rate(v.rows, field)) if v.rows else "—" for v in variants])
    hall = [hallucination_rate(v.rows) for v in variants]
    add("Hallucinated (of null fields)", [f"{h} / {n}" for h, n in hall])
    add(
        "Valid structured output",
        [pct(sum(bool(r["valid_output"]) for r in v.rows) / len(v.rows)) if v.rows else "—"
         for v in variants],
    )  # fmt: skip
    add("Refused attempts", [str(sum(int(r["refusals"]) for r in v.rows)) for v in variants])
    add("Truncated rows (excluded)", [str(v.truncated) for v in variants])
    add("Errors (excluded)", [str(v.errors) for v in variants])
    add(
        "Latency p50 / p95",
        [
            f"{percentile([r['latency_s'] for r in v.rows], 0.5):.1f} s / "
            f"{percentile([r['latency_s'] for r in v.rows], 0.95):.1f} s"
            if v.rows
            else "—"
            for v in variants
        ],
    )
    costs = []
    for v in variants:
        per_row = [cost_usd(str(r["model"]), r["usage"]) for r in v.rows]
        known = [c for c in per_row if c is not None]
        costs.append(money(statistics.fmean(known)) if known and len(known) == len(per_row)
                     else "n/a")  # fmt: skip
    add("Cost per receipt (mean)", costs)
    return lines


def difficulty_table(variants: Sequence[Variant]) -> list[str]:
    kinds = sorted({r["tags"][0] for v in variants for r in v.rows})
    head = ["Difficulty", *[f"`{v.name}`" for v in variants]]
    lines = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    for kind in kinds:
        cells = []
        for v in variants:
            rows = [r for r in v.rows if r["tags"][0] == kind]
            values = [float(r["grade"]["field_accuracy"]) for r in rows]
            cells.append(pct(statistics.fmean(values)) if values else "—")
        lines.append(f"| {kind} | " + " | ".join(cells) + " |")
    return lines


def worst_failures(variant: Variant, count: int = 6) -> list[str]:
    ranked = sorted(variant.case_means().items(), key=lambda item: item[1])[:count]
    lines: list[str] = []
    for case_id, score in ranked:
        if score >= 1.0:
            break
        row = min(
            (r for r in variant.rows if r["prompt_id"] == case_id),
            key=lambda r: r["grade"]["field_accuracy"],
        )
        wrong = [
            f"{f}: expected `{row['expected'][f]}`, got `{row['predicted'][f]}` "
            f"({row['outcomes'][f]})"
            for f in FIELDS
            if row["outcomes"][f] not in ("correct", "correct_null")
        ]
        lines.append(
            f"- **{case_id}** ({', '.join(row['tags'])}, mean {pct(score)}): " + "; ".join(wrong)
        )
    return lines or ["- None: every case scored 100%."]


def build_report(baseline: Variant, others: Sequence[Variant], split: str) -> str:
    variants = [baseline, *others]
    labels = read_jsonl(DATASET / "labels.jsonl")
    in_split = [r for r in labels if split == "all" or r["split"] == split]
    sources = sorted({str(r.get("source", "synthetic")) for r in in_split})
    lines = [
        f"# Receipt extraction eval: {' vs '.join(f'`{v.name}`' for v in variants)}",
        "",
        f"*{date.today().isoformat()}* · split **{split}** ({len(in_split)} cases, "
        f"sources: {', '.join(sources)}) · produced by `evals/report.py` from "
        "`evals/runs/*/results.jsonl`.",
        "",
        "The model only extracts; the policy engine decides compliance, so what matters here is "
        "whether each field is right. Field accuracy is the share of the 5 fields (merchant, "
        "date, total, currency, category) that match the label, averaged per case over reps; "
        "a null answer on an unreadable receipt counts as right, an invented one as a "
        "hallucination.",
        "",
        "## Results",
        "",
        *variant_table(variants),
        "",
        "## Change vs baseline (paired, same cases)",
        "",
    ]
    base_means = baseline.case_means()
    for other in others:
        diff, low, high, n = paired_diff(base_means, other.case_means())
        verdict = (
            "better, beyond noise"
            if low > 0
            else "worse, beyond noise"
            if high < 0
            else "no difference beyond noise"
        )
        lines.append(
            f"- `{other.name}` - `{baseline.name}`: **{diff:+.1%}** field accuracy "
            f"(95% bootstrap CI {low:+.1%} to {high:+.1%}, {n} cases): {verdict}."
        )
    lines += ["", "## By difficulty", "", *difficulty_table(variants), ""]
    for variant in variants:
        lines += [f"## Worst cases: `{variant.name}`", "", *worst_failures(variant), ""]
    if sources == ["synthetic"]:
        lines += [
            "## Limits",
            "",
            "- Synthetic receipts only (drawn by `evals/generate_receipts.py`). Real anonymized "
            "photos are still to be added, so absolute numbers likely overstate accuracy on "
            "real photos; the comparison between variants is the useful signal.",
            "",
        ]
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--variants", nargs="*", default=[])
    parser.add_argument("--split", choices=["dev", "test", "all"], default="test")
    parser.add_argument("--out", type=Path, help="markdown file (default: print)")
    args = parser.parse_args(argv)
    report = build_report(
        load_variant(args.baseline, args.split),
        [load_variant(v, args.split) for v in args.variants],
        args.split,
    )
    if args.out:
        out = args.out if args.out.is_absolute() else ROOT / args.out
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report, encoding="utf-8", newline="\n")
        print(f"wrote {out}")
    else:
        print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

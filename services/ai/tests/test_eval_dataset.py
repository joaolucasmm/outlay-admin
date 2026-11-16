"""Tier-1 checks over the whole dataset: shape, balance, duplicates, reproducibility."""

import json
from collections import Counter
from pathlib import Path

import pytest

from evals.render import Layout, draw
from evals.synthetic import PLAN, ascii_fold, build_dataset

DATASET = Path(__file__).parents[1] / "evals" / "dataset"
FIELDS = {"merchant", "date", "total_minor", "currency", "category"}


def labels() -> list[dict[str, object]]:
    lines = (DATASET / "labels.jsonl").read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines]


def test_has_thirty_cases_split_ten_dev_twenty_test() -> None:
    rows = labels()
    assert len(rows) == 30
    assert len({r["id"] for r in rows}) == 30
    assert Counter(r["split"] for r in rows) == {"dev": 10, "test": 20}


def test_every_difficulty_is_in_the_test_split() -> None:
    kinds = Counter(r["tags"][0] for r in labels() if r["split"] == "test")  # type: ignore[index]
    assert set(kinds) == set(PLAN)


def test_rows_are_complete_and_images_exist() -> None:
    for row in labels():
        expected = row["expected"]
        assert isinstance(expected, dict)
        assert set(expected) == FIELDS
        assert (DATASET / str(row["image"])).is_file()
        if row["tags"][0] == "unreadable":  # type: ignore[index]
            assert all(v is None for v in expected.values())
        else:
            assert all(v is not None for v in expected.values())


def test_thousands_cases_really_have_four_digit_totals() -> None:
    for row in labels():
        if row["tags"][0] == "thousands":  # type: ignore[index]
            assert row["expected"]["total_minor"] >= 100_000  # type: ignore[index, operator]


def test_ambiguous_dates_are_really_ambiguous_and_others_are_not() -> None:
    for row in labels():
        day = row["expected"]["date"]  # type: ignore[index]
        if day is None:
            continue
        month, dom = int(day[5:7]), int(day[8:10])
        if row["tags"][0] == "ambiguous_date":  # type: ignore[index]
            assert dom <= 12 and dom != month
        else:
            assert dom >= 13


def test_labels_are_reproducible_from_the_seed() -> None:
    regenerated = {c.id: c.expected for c in build_dataset()}
    assert regenerated == {r["id"]: r["expected"] for r in labels()}


def test_the_renderer_refuses_text_the_font_cannot_draw() -> None:
    assert ascii_fold("Pão Rückgeld Papelería") == "Pao Ruckgeld Papeleria"
    with pytest.raises(ValueError, match="Non-ASCII"):
        draw(Layout(["PÃO"], [], [("TOTAL", "1,00", True)], []))

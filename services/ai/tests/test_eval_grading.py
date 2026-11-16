import pytest

from app.extraction.schema import ReceiptExtraction
from evals.grading import field_outcome, grade, merchant_matches, normalize_merchant

EXPECTED: dict[str, object] = {
    "merchant": "Padaria Pao de Ouro",
    "date": "2026-01-15",
    "total_minor": 13090,
    "currency": "BRL",
    "category": "MEALS",
}
NULLS: dict[str, object] = dict.fromkeys(EXPECTED)


def extraction(**overrides: object) -> ReceiptExtraction:
    values: dict[str, object] = {
        "merchant": "PADARIA PÃO DE OURO LTDA",
        "date": "2026-01-15",
        "total_minor": 13090,
        "currency": "BRL",
        "suggested_category_code": "MEALS",
        "confidence": "high",
        "notes": None,
        "model": "m",
        "prompt_version": "v1",
        "latency_ms": 1,
    }
    values.update(overrides)
    return ReceiptExtraction.model_validate(values)


def test_normalizes_case_accents_punctuation_and_legal_suffixes() -> None:
    assert normalize_merchant("Padaria Pão-de-Ouro, LTDA.") == "padaria pao de ouro"
    assert normalize_merchant("Metro Cab Co.") == "metro cab"


@pytest.mark.parametrize(
    ("expected", "predicted", "match"),
    [
        ("Bluebird Diner", "BLUEBIRD DINER", True),
        ("Bluebird Diner", "Bluebird Dinner", True),  # one typo is still the merchant
        ("Bluebird Diner", "Bluebird", False),
        ("Harbor Inn", "Redwood Lodge", False),
    ],
)
def test_merchant_fuzzy_match(expected: str, predicted: str, match: bool) -> None:
    assert merchant_matches(expected, predicted) is match


@pytest.mark.parametrize(
    ("expected", "predicted", "outcome"),
    [
        (13090, 13090, "correct"),
        (13090, 13900, "wrong"),
        (13090, None, "missed"),
        (None, None, "correct_null"),
        (None, 13090, "hallucinated"),
    ],
)
def test_field_outcomes(expected: object, predicted: object, outcome: str) -> None:
    assert field_outcome("total_minor", expected, predicted) == outcome


def test_a_perfect_extraction() -> None:
    graded = grade(EXPECTED, extraction())
    assert graded["field_accuracy"] == 1.0
    assert graded["all_correct"] == 1.0
    assert graded["hallucinations"] == 0.0


def test_partial_credit_and_the_date_trap() -> None:
    graded = grade(EXPECTED, extraction(date="2026-15-01" and "2026-01-05", total_minor=None))
    assert graded["field_accuracy"] == pytest.approx(3 / 5)
    assert graded["all_correct"] == 0.0
    assert graded["outcomes"] == {
        "merchant": "correct",
        "date": "wrong",
        "total_minor": "missed",
        "currency": "correct",
        "category": "correct",
    }


def test_unreadable_receipts_reward_abstaining_and_flag_invention() -> None:
    abstained = extraction(
        merchant=None, date=None, total_minor=None, currency=None, suggested_category_code=None
    )
    assert grade(NULLS, abstained)["field_accuracy"] == 1.0

    invented = grade(NULLS, extraction())
    assert invented["field_accuracy"] == 0.0
    assert invented["hallucinations"] == 5.0

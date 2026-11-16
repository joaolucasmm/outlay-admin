"""Programmatic grading of one extraction against its ground truth.

Every field has a checkable right answer, so there is no LLM judge. A field is:
- correct: matches the label (merchant: fuzzy >= 0.9 after normalizing);
- correct_null: both are null (the receipt is unreadable and the model abstained);
- missed: the label has a value, the model returned null;
- wrong: both have values that differ;
- hallucinated: the label is null, the model invented a value.
"""

import re
import unicodedata
from difflib import SequenceMatcher
from typing import Literal

from app.extraction.schema import ReceiptExtraction

FIELDS = ("merchant", "date", "total_minor", "currency", "category")
Field = Literal["merchant", "date", "total_minor", "currency", "category"]
Outcome = Literal["correct", "correct_null", "missed", "wrong", "hallucinated"]

MERCHANT_THRESHOLD = 0.9
LEGAL_SUFFIXES = {"ltda", "me", "eireli", "sa", "s a", "llc", "inc", "co", "gmbh", "sl", "lda"}


def normalize_merchant(name: str) -> str:
    """Case, accents, punctuation and legal suffixes don't make a merchant different."""
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    words = re.sub(r"[^a-z0-9]+", " ", text).split()
    while words and words[-1] in LEGAL_SUFFIXES:
        words.pop()
    return " ".join(words)


def merchant_matches(expected: str, predicted: str) -> bool:
    a, b = normalize_merchant(expected), normalize_merchant(predicted)
    return a == b or SequenceMatcher(None, a, b).ratio() >= MERCHANT_THRESHOLD


def predicted_fields(extraction: ReceiptExtraction) -> dict[str, object]:
    return {
        "merchant": extraction.merchant,
        "date": extraction.date,
        "total_minor": extraction.total_minor,
        "currency": extraction.currency,
        "category": extraction.suggested_category_code,
    }


def field_outcome(field: str, expected: object, predicted: object) -> Outcome:
    if expected is None:
        return "correct_null" if predicted is None else "hallucinated"
    if predicted is None:
        return "missed"
    if field == "merchant":
        return "correct" if merchant_matches(str(expected), str(predicted)) else "wrong"
    return "correct" if expected == predicted else "wrong"


def grade(expected: dict[str, object], extraction: ReceiptExtraction) -> dict[str, object]:
    """Per-field outcomes plus the case metrics the report aggregates."""
    predicted = predicted_fields(extraction)
    outcomes = {f: field_outcome(f, expected[f], predicted[f]) for f in FIELDS}
    right = [o in ("correct", "correct_null") for o in outcomes.values()]
    return {
        "field_accuracy": sum(right) / len(FIELDS),
        "all_correct": 1.0 if all(right) else 0.0,
        "hallucinations": float(sum(o == "hallucinated" for o in outcomes.values())),
        "outcomes": outcomes,
    }

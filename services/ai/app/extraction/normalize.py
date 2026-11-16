"""Turn the model's loose output into validated, contract-shaped fields.

Anything that doesn't validate becomes null and is explained in `notes`; it never
raises. This is where "the model's word" stops and checked data starts.
"""

import datetime
import re
from dataclasses import dataclass, field

from app.extraction.schema import Confidence, ModelReceipt

# ISO 4217 minor-unit digits for the currencies the console supports, plus common ones.
CURRENCY_DIGITS: dict[str, int] = {
    "BRL": 2,
    "CAD": 2,
    "EUR": 2,
    "GBP": 2,
    "MXN": 2,
    "USD": 2,
    "ARS": 2,
    "CHF": 2,
    "CLP": 0,
    "JPY": 0,
}

AMOUNT = re.compile(r"^\d+(?:\.(\d+))?$")
MAX_MERCHANT = 120


@dataclass
class NormalizedFields:
    merchant: str | None = None
    date: str | None = None
    total_minor: int | None = None
    currency: str | None = None
    suggested_category_code: str | None = None
    issues: list[str] = field(default_factory=list)


def _date(value: str | None, issues: list[str]) -> str | None:
    if value is None:
        return None
    try:
        return datetime.date.fromisoformat(value.strip()).isoformat()
    except ValueError:
        issues.append(f"date '{value}' is not a valid YYYY-MM-DD date")
        return None


def _currency(value: str | None, issues: list[str]) -> str | None:
    if value is None:
        return None
    code = value.strip().upper()
    if code in CURRENCY_DIGITS:
        return code
    issues.append(f"currency '{value}' is not supported")
    return None


def _total(value: str | None, currency: str | None, issues: list[str]) -> int | None:
    if value is None:
        return None
    if currency is None:
        issues.append("the total has no known currency")
        return None
    text = value.strip().replace(",", "")
    match = AMOUNT.fullmatch(text)
    digits = CURRENCY_DIGITS[currency]
    fraction = match.group(1) if match else None
    if not match or (fraction is not None and len(fraction) > digits):
        issues.append(f"total '{value}' is not a valid {currency} amount")
        return None
    whole, _, frac = text.partition(".")
    return int(whole + frac.ljust(digits, "0"))


def normalize(raw: ModelReceipt, category_codes: set[str]) -> NormalizedFields:
    issues: list[str] = []
    merchant = (raw.merchant or "").strip()[:MAX_MERCHANT] or None
    currency = _currency(raw.currency, issues)
    suggested = raw.suggested_category_code
    if suggested is not None and suggested not in category_codes:
        issues.append(f"category '{suggested}' is not one of the tenant's categories")
        suggested = None
    return NormalizedFields(
        merchant=merchant,
        date=_date(raw.date, issues),
        total_minor=_total(raw.total, currency, issues),
        currency=currency,
        suggested_category_code=suggested,
        issues=issues,
    )


def adjusted_confidence(reported: Confidence, issues: list[str]) -> Confidence:
    """Fields we had to drop mean the model was less sure than it said."""
    return "medium" if issues and reported == "high" else reported

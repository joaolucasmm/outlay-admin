"""Shapes of the extraction: what the model must return, and what the API returns.

`ModelReceipt` is deliberately loose (strings as printed) so the model is never forced
to do arithmetic or currency maths. `ReceiptExtraction` is the validated, normalized
response defined by `packages/contracts/openapi.yaml`.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Confidence = Literal["high", "medium", "low"]


class ModelReceipt(BaseModel):
    """Structured output requested from the LLM (used as `output_format`)."""

    merchant: str | None = Field(description="Business name as printed, or null.")
    date: str | None = Field(description="Purchase date as YYYY-MM-DD, or null if unreadable.")
    total: str | None = Field(
        description=(
            "Grand total actually paid, digits with '.' as the decimal separator and no "
            "thousands separators (e.g. '1234.50'), or null."
        )
    )
    currency: str | None = Field(description="ISO 4217 code such as BRL, USD or EUR, or null.")
    suggested_category_code: str | None = Field(
        description="One of the provided category codes that fits the purchase, or null."
    )
    confidence: Confidence = Field(
        description=(
            "high if every field is clearly legible, medium if some are guessed, low otherwise."
        )
    )


class CategoryHint(BaseModel):
    code: str
    name: str


class ReceiptExtraction(BaseModel):
    """API response, serialized in camelCase like the rest of the contract."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    merchant: str | None
    date: str | None
    total_minor: int | None
    currency: str | None
    suggested_category_code: str | None
    confidence: Confidence
    notes: str | None
    model: str
    prompt_version: str
    latency_ms: int

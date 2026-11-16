"""The Pydantic response model must match packages/contracts/openapi.yaml, the source
of truth shared with the web app."""

from pathlib import Path
from typing import Any

import yaml

from app.extraction.schema import ReceiptExtraction
from app.main import create_app
from app.settings import Settings
from tests.fakes import FakeReceiptModel

CONTRACT = Path(__file__).parents[3] / "packages" / "contracts" / "openapi.yaml"


def contract() -> dict[str, Any]:
    loaded: dict[str, Any] = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return loaded


def test_receipt_extraction_matches_the_contract() -> None:
    expected = contract()["components"]["schemas"]["ReceiptExtraction"]
    actual = ReceiptExtraction.model_json_schema(by_alias=True)

    assert set(actual["properties"]) == set(expected["properties"])
    assert set(actual["required"]) == set(expected["required"])
    confidence = contract()["components"]["schemas"]["ReceiptConfidence"]["enum"]
    assert sorted(actual["properties"]["confidence"]["enum"]) == sorted(confidence)


def test_the_route_matches_the_contract() -> None:
    operation = contract()["paths"]["/v1/receipts/extract"]["post"]
    app = create_app(Settings(anthropic_api_key=None), model=FakeReceiptModel([]))

    route = app.openapi()["paths"]["/v1/receipts/extract"]["post"]
    form = operation["requestBody"]["content"]["multipart/form-data"]["schema"]
    assert set(form["properties"]) == {"image", "categories"}
    assert set(route["responses"]) >= set(operation["responses"])

import io
import json
from collections.abc import Sequence
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.extraction.llm import InvalidModelOutputError, ProviderUnavailableError
from app.main import create_app
from app.settings import Settings
from tests.fakes import FakeReceiptModel, Scripted, image_bytes, receipt

CATEGORIES = [{"code": "MEALS", "name": "Meals"}, {"code": "TRAVEL", "name": "Travel"}]


def client_for(script: Sequence[Scripted], **settings: Any) -> tuple[TestClient, FakeReceiptModel]:
    model = FakeReceiptModel(script)
    app = create_app(Settings(anthropic_api_key=None, **settings), model=model)
    return TestClient(app), model


def post(
    client: TestClient,
    data: bytes | None = None,
    categories: object = CATEGORIES,
    filename: str = "r.png",
) -> Any:
    form = {"categories": json.dumps(categories)} if categories is not None else {}
    return client.post(
        "/v1/receipts/extract",
        files={"image": (filename, data if data is not None else image_bytes(), "image/png")},
        data=form,
    )


def test_returns_normalized_fields_in_camel_case() -> None:
    client, model = client_for([receipt()])

    response = post(client)

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "merchant": "Padaria Central",
        "date": "2026-11-10",
        "totalMinor": 8640,
        "currency": "BRL",
        "suggestedCategoryCode": "MEALS",
        "confidence": "high",
        "notes": None,
        "model": "fake-model",
        "promptVersion": "v1",
        "latencyMs": body["latencyMs"],
    }
    assert isinstance(body["latencyMs"], int)
    # The model sees the prompt and the tenant's categories.
    assert "You only extract" in model.calls[0].instructions
    assert [c.code for c in model.calls[0].categories] == ["MEALS", "TRAVEL"]


def test_retries_once_after_invalid_output() -> None:
    client, model = client_for([InvalidModelOutputError("invalid_output"), receipt()])

    body = post(client).json()

    assert len(model.calls) == 2
    assert body["totalMinor"] == 8640
    assert body["notes"] == "Succeeded after a retry (invalid_output)."


def test_falls_back_to_low_confidence_after_two_failures() -> None:
    client, model = client_for(
        [InvalidModelOutputError("refusal"), InvalidModelOutputError("max_tokens")]
    )

    response = post(client)

    assert response.status_code == 200  # bad model output is not a server error
    body = response.json()
    assert len(model.calls) == 2
    assert body["confidence"] == "low"
    assert [body[k] for k in ("merchant", "date", "totalMinor", "currency")] == [None] * 4
    assert body["notes"].startswith("The receipt could not be read (refusal, max_tokens).")


@pytest.mark.parametrize(
    ("overrides", "field", "issue"),
    [
        ({"date": "2026-02-30"}, "date", "date '2026-02-30'"),
        ({"total": "86.405"}, "totalMinor", "total '86.405'"),
        ({"currency": "R$"}, "currency", "currency 'R$'"),
        ({"suggested_category_code": "GIFTS"}, "suggestedCategoryCode", "category 'GIFTS'"),
    ],
)
def test_drops_fields_that_do_not_validate(
    overrides: dict[str, object], field: str, issue: str
) -> None:
    client, _ = client_for([receipt(**overrides)])

    body = post(client).json()

    assert body[field] is None
    assert body["confidence"] == "medium"  # lowered from high
    assert issue in body["notes"]


def test_accepts_thousands_separators_and_zero_decimal_currencies() -> None:
    client, _ = client_for(
        [receipt(total="1,234.5", currency="usd"), receipt(total="1500", currency="JPY")]
    )

    first = post(client).json()
    second = post(client).json()

    assert (first["totalMinor"], first["currency"]) == (123450, "USD")
    assert (second["totalMinor"], second["currency"]) == (1500, "JPY")


def test_keeps_a_lower_confidence_as_reported() -> None:
    client, _ = client_for([receipt(confidence="low", merchant=None, total=None)])

    body = post(client).json()

    assert body["confidence"] == "low"
    assert body["merchant"] is None
    assert body["notes"] is None


def test_works_without_categories() -> None:
    client, model = client_for([receipt(suggested_category_code=None)])

    assert post(client, categories=None).status_code == 200
    assert model.calls[0].categories == []


@pytest.mark.parametrize(("status", "expected"), [(503, 503), (502, 502)])
def test_reports_provider_outages_as_problems(status: int, expected: int) -> None:
    client, _ = client_for([ProviderUnavailableError(status, "Down for maintenance.")])

    response = post(client)

    assert response.status_code == expected
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["detail"] == "Down for maintenance."


def test_rejects_files_that_are_not_images() -> None:
    client, model = client_for([])

    response = post(client, data=b"%PDF-1.7 not an image", filename="r.pdf")

    assert response.status_code == 415
    assert model.calls == []


def test_rejects_damaged_images() -> None:
    client, _ = client_for([])

    response = post(client, data=b"\x89PNG\r\n\x1a\n" + b"garbage" * 10)

    assert response.status_code == 422
    assert response.json()["title"] == "Unreadable image"


def test_rejects_images_over_the_size_limit() -> None:
    client, _ = client_for([], max_image_bytes=1000)

    assert post(client, data=image_bytes((800, 800))).status_code == 413


def test_rejects_malformed_category_hints() -> None:
    client, _ = client_for([])

    assert post(client, categories={"code": "MEALS"}).status_code == 422


def test_downscales_large_images_before_calling_the_model() -> None:
    client, model = client_for([receipt()], max_image_side=500)

    post(client, data=image_bytes((1000, 2000), fmt="JPEG"))

    sent = model.calls[0].image
    assert (sent.width, sent.height) == (250, 500)
    assert sent.media_type == "image/jpeg"
    with Image.open(io.BytesIO(sent.data)) as decoded:
        assert decoded.size == (250, 500)


def test_rejects_an_unknown_prompt_version() -> None:
    with pytest.raises(ValueError, match="Unknown prompt version 'v99'"):
        client_for([], prompt_version="v99")

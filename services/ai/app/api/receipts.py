from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import TypeAdapter, ValidationError

from app.api.problems import problem
from app.extraction.extractor import Extractor
from app.extraction.images import ImageError, prepare_image
from app.extraction.llm import ProviderUnavailableError
from app.extraction.schema import CategoryHint, ReceiptExtraction
from app.settings import Settings

router = APIRouter()

_categories = TypeAdapter(list[CategoryHint])


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_extractor(request: Request) -> Extractor:
    extractor: Extractor = request.app.state.extractor
    return extractor


@router.post(
    "/v1/receipts/extract",
    response_model=ReceiptExtraction,
    response_model_by_alias=True,
    responses={code: {"description": "Problem Details"} for code in (413, 415, 422, 502, 503)},
)
async def extract_receipt(
    image: Annotated[UploadFile, File(description="JPEG, PNG or WebP, up to 5 MB.")],
    settings: Annotated[Settings, Depends(get_settings)],
    extractor: Annotated[Extractor, Depends(get_extractor)],
    categories: Annotated[str | None, Form()] = None,
) -> ReceiptExtraction | JSONResponse:
    try:
        hints = _categories.validate_json(categories) if categories else []
    except ValidationError:
        return problem(
            422, "Invalid categories", "categories must be a JSON array of {code, name}."
        )

    # Read one byte past the limit so an oversized upload is rejected without loading it all.
    data = await image.read(settings.max_image_bytes + 1)
    try:
        prepared = prepare_image(
            data, max_bytes=settings.max_image_bytes, max_side=settings.max_image_side
        )
    except ImageError as error:
        return problem(error.status, error.title, error.detail)

    try:
        return extractor.extract(prepared, hints)
    except ProviderUnavailableError as error:
        return problem(error.status, "AI provider unavailable", error.detail)

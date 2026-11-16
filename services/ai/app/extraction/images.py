"""Validate and shrink uploaded receipt images before they reach the model."""

import io
from dataclasses import dataclass
from typing import Literal

from PIL import Image, UnidentifiedImageError

MediaType = Literal["image/jpeg", "image/png", "image/webp"]

_FORMATS: dict[MediaType, str] = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


class ImageError(Exception):
    def __init__(self, status: int, title: str, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.title = title
        self.detail = detail


@dataclass(frozen=True)
class PreparedImage:
    data: bytes
    media_type: MediaType
    width: int
    height: int


def sniff_media_type(data: bytes) -> MediaType | None:
    """Trust the bytes, not the file name or the declared content type."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def prepare_image(data: bytes, *, max_bytes: int, max_side: int) -> PreparedImage:
    if len(data) > max_bytes:
        raise ImageError(
            413, "Image too large", f"The image is larger than {max_bytes // 1_000_000} MB."
        )
    media_type = sniff_media_type(data)
    if media_type is None:
        raise ImageError(415, "Unsupported image", "Upload a JPEG, PNG or WebP image.")
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            if max(image.size) <= max_side:
                return PreparedImage(data, media_type, image.width, image.height)
            # Smaller images cost fewer tokens and less latency; text stays legible.
            image.thumbnail((max_side, max_side))
            resized: Image.Image = image
            if media_type == "image/jpeg" and resized.mode != "RGB":
                resized = resized.convert("RGB")
            out = io.BytesIO()
            resized.save(out, format=_FORMATS[media_type])
            return PreparedImage(out.getvalue(), media_type, resized.width, resized.height)
    except (UnidentifiedImageError, OSError) as error:
        raise ImageError(422, "Unreadable image", "The image file is damaged.") from error

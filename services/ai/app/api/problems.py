from fastapi.responses import JSONResponse


def problem(status: int, title: str, detail: str) -> JSONResponse:
    """RFC 9457 Problem Details, like the admin API."""
    slug = title.lower().replace(" ", "-")
    return JSONResponse(
        {
            "type": f"https://outlay.example/problems/{slug}",
            "title": title,
            "status": status,
            "detail": detail,
        },
        status_code=status,
        media_type="application/problem+json",
    )

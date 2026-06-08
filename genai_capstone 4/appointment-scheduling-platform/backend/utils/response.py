from typing import Any, Optional
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


def success_envelope(data: Any, message: str) -> dict:
    return {"success": True, "message": message, "data": data, "error": None}


def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
) -> JSONResponse:
    """Standardized success envelope — mirrors capstone's successResponse()."""
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder({
            "success": True,
            "message": message,
            "data": data,
            "error": None,
        }),
    )


def error_response(
    message: str = "An error occurred",
    error: Optional[Any] = None,
    status_code: int = 500,
) -> JSONResponse:
    """Standardized error envelope — mirrors capstone's errorResponse()."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "data": None,
            "error": error,
        },
    )

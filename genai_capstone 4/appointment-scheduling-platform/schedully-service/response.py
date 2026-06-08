"""
Response helpers — mirrors backend/utils/response.py format.
"""

from fastapi.responses import JSONResponse


def success_response(data, message="Success", status_code=200):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "message": message,
            "data": data,
            "error": None,
        },
    )


def error_response(message="Error", status_code=400):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "data": None,
            "error": message,
        },
    )

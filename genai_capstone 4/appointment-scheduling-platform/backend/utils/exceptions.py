from fastapi import HTTPException


class AppException(HTTPException):
    """
    Central exception class — equivalent to AppError.js in the capstone.
    Raise this anywhere in services/routers; the global handler formats it.
    """

    def __init__(self, message: str = "An error occurred", status_code: int = 500):
        super().__init__(status_code=status_code, detail=message)
        self.message = message


# ─── Convenience factory shortcuts ───────────────────────────────────────────

def not_found(resource: str = "Resource"):
    return AppException(f"{resource} not found", 404)


def bad_request(message: str = "Bad request"):
    return AppException(message, 400)


def unauthorized(message: str = "Unauthorized"):
    return AppException(message, 401)


def forbidden(message: str = "Forbidden — insufficient permissions"):
    return AppException(message, 403)


def conflict(message: str = "Conflict"):
    return AppException(message, 409)

from fastapi import HTTPException


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


def app_error_to_http(exc: AppError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"error": {"code": exc.code, "message": exc.message}},
    )

"""
Vlastní výjimky pro doménovou vrstvu.
FastAPI exception handlers jsou registrovány v main.py.
"""
from fastapi import HTTPException, status


class AppError(Exception):
    """Základní třída pro všechny aplikační výjimky."""
    def __init__(self, message: str, code: str = "APP_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, resource: str, identifier: str | int) -> None:
        super().__init__(f"{resource} '{identifier}' nenalezen.", code="NOT_FOUND")


class ConflictError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="CONFLICT")


class AuthenticationError(AppError):
    def __init__(self, message: str = "Neplatné přihlašovací údaje.") -> None:
        super().__init__(message, code="AUTHENTICATION_FAILED")


class AuthorizationError(AppError):
    def __init__(self, message: str = "Nedostatečná oprávnění.") -> None:
        super().__init__(message, code="AUTHORIZATION_FAILED")


class FileTooLargeError(AppError):
    def __init__(self, max_mb: int) -> None:
        super().__init__(f"Soubor přesahuje limit {max_mb} MB.", code="FILE_TOO_LARGE")


class InvalidFileTypeError(AppError):
    def __init__(self, allowed: frozenset[str]) -> None:
        allowed_str = ", ".join(sorted(allowed))
        super().__init__(
            f"Nepodporovaný typ souboru. Povolené formáty: {allowed_str}.",
            code="INVALID_FILE_TYPE",
        )


# ── HTTP konverze ─────────────────────────────────────────────────────────────

def to_http_exception(exc: AppError) -> HTTPException:
    mapping = {
        "NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "CONFLICT": status.HTTP_409_CONFLICT,
        "AUTHENTICATION_FAILED": status.HTTP_401_UNAUTHORIZED,
        "AUTHORIZATION_FAILED": status.HTTP_403_FORBIDDEN,
        "FILE_TOO_LARGE": status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        "INVALID_FILE_TYPE": status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    }
    status_code = mapping.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR)
    return HTTPException(status_code=status_code, detail={"code": exc.code, "message": exc.message})

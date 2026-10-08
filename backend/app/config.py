from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ciel_token: str
    device_token: str = ""
    postgres_password: str
    database_url: str
    ciel_timezone: str = "Asia/Manila"


def validate_settings(settings: Settings) -> None:
    errors: list[str] = []

    if len(settings.ciel_token) < 32:
        errors.append("CIEL_TOKEN must be at least 32 characters")
    if "change-me" in settings.ciel_token.lower():
        errors.append('CIEL_TOKEN must not contain "change-me"')

    if settings.device_token:
        if len(settings.device_token) < 32:
            errors.append("DEVICE_TOKEN must be at least 32 characters")
        if "change-me" in settings.device_token.lower():
            errors.append('DEVICE_TOKEN must not contain "change-me"')
        if settings.device_token == settings.ciel_token:
            errors.append("DEVICE_TOKEN must be different from CIEL_TOKEN")

    if not settings.postgres_password:
        errors.append("POSTGRES_PASSWORD must not be empty")
    elif "change-me" in settings.postgres_password.lower():
        errors.append('POSTGRES_PASSWORD must not contain "change-me"')

    if errors:
        raise ValueError("Invalid settings: " + "; ".join(errors))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

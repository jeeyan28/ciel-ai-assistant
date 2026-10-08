from fastapi.testclient import TestClient

from app import main
from app.config import get_settings
from app.main import app


def test_readyz_returns_ready_when_database_is_up(monkeypatch):
    monkeypatch.setenv("CIEL_TOKEN", "readyz-ciel-token-0123456789abcdef")
    monkeypatch.setenv("DEVICE_TOKEN", "")
    monkeypatch.setenv("POSTGRES_PASSWORD", "readyz-postgres-secret")
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test"
    )
    monkeypatch.setenv("CIEL_TIMEZONE", "Asia/Manila")
    get_settings.cache_clear()
    monkeypatch.setattr(main, "check_database", lambda: True)

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "provider": "unknown"}


def test_readyz_returns_not_ready_when_database_is_down(monkeypatch):
    monkeypatch.setenv("CIEL_TOKEN", "readyz-ciel-token-0123456789abcdef")
    monkeypatch.setenv("DEVICE_TOKEN", "")
    monkeypatch.setenv("POSTGRES_PASSWORD", "readyz-postgres-secret")
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test"
    )
    monkeypatch.setenv("CIEL_TIMEZONE", "Asia/Manila")
    get_settings.cache_clear()
    monkeypatch.setattr(main, "check_database", lambda: False)

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json() == {
        "error": {"code": "not_ready", "message": "database unreachable"}
    }

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def test_healthz(monkeypatch):
    monkeypatch.setenv("CIEL_TOKEN", "healthz-ciel-token-0123456789abcdef")
    monkeypatch.setenv("DEVICE_TOKEN", "")
    monkeypatch.setenv("POSTGRES_PASSWORD", "healthz-postgres-secret")
    monkeypatch.setenv("CIEL_TIMEZONE", "Asia/Manila")
    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

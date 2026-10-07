import pytest

from app.config import get_settings, validate_settings

SECRET_TOKEN = "cil-9f2b7e41-8a3d-4c56-b7e1-2f8a0d3c6e91"
SECRET_PASSWORD = "pg-secret-7d3e1a9c4b2f8e05"
SHORT_TOKEN = "too-short-secret"
PLACEHOLDER_TOKEN = "Change-Me-Change-Me-Change-Me-12"


def load_settings(monkeypatch, **overrides):
    env = {
        "CIEL_TOKEN": SECRET_TOKEN,
        "DEVICE_TOKEN": "",
        "POSTGRES_PASSWORD": SECRET_PASSWORD,
        "CIEL_TIMEZONE": "Asia/Manila",
    }
    env.update(overrides)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()
    return get_settings()


def test_short_token_fails(monkeypatch):
    settings = load_settings(monkeypatch, CIEL_TOKEN=SHORT_TOKEN)
    with pytest.raises(ValueError) as excinfo:
        validate_settings(settings)
    message = str(excinfo.value)
    assert "CIEL_TOKEN" in message
    assert "32" in message
    assert SHORT_TOKEN not in message
    assert SECRET_PASSWORD not in message


def test_change_me_token_fails(monkeypatch):
    settings = load_settings(monkeypatch, CIEL_TOKEN=PLACEHOLDER_TOKEN)
    with pytest.raises(ValueError) as excinfo:
        validate_settings(settings)
    message = str(excinfo.value)
    assert "CIEL_TOKEN" in message
    assert "change-me" in message.lower()
    assert PLACEHOLDER_TOKEN not in message
    assert SECRET_PASSWORD not in message


def test_equal_tokens_fail(monkeypatch):
    settings = load_settings(monkeypatch, DEVICE_TOKEN=SECRET_TOKEN)
    with pytest.raises(ValueError) as excinfo:
        validate_settings(settings)
    message = str(excinfo.value)
    assert "DEVICE_TOKEN" in message
    assert "different" in message
    assert SECRET_TOKEN not in message
    assert SECRET_PASSWORD not in message


def test_empty_postgres_password_fails(monkeypatch):
    settings = load_settings(monkeypatch, POSTGRES_PASSWORD="")
    with pytest.raises(ValueError) as excinfo:
        validate_settings(settings)
    message = str(excinfo.value)
    assert "POSTGRES_PASSWORD" in message
    assert "empty" in message
    assert SECRET_TOKEN not in message


def test_change_me_postgres_password_fails(monkeypatch):
    placeholder = "Change-Me-Password-1234"
    settings = load_settings(monkeypatch, POSTGRES_PASSWORD=placeholder)
    with pytest.raises(ValueError) as excinfo:
        validate_settings(settings)
    message = str(excinfo.value)
    assert "POSTGRES_PASSWORD" in message
    assert "change-me" in message.lower()
    assert placeholder not in message


def test_valid_config_passes(monkeypatch):
    settings = load_settings(monkeypatch)
    assert validate_settings(settings) is None

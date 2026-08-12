"""
Application configuration.

Secrets are read from environment variables so nothing sensitive is ever
committed to source control. See .env.example for the variables you need
to set before running the app.
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


def _require(name: str, dev_fallback: str) -> str:
    """Read a secret from the environment.

    In production you MUST set these via the environment (or a secrets
    manager). The fallback below only exists so the app can be tried out
    locally without extra setup, and a loud warning is printed so it's
    never mistaken for something safe to deploy.
    """
    value = os.environ.get(name)
    if value:
        return value
    print(f"[config] WARNING: {name} not set in environment, using an "
          f"insecure development fallback. Do NOT do this in production.")
    return dev_fallback


class Config:
    # Flask / signing secrets
    SECRET_KEY = _require("SECRET_KEY", "dev-secret-key-change-me")

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///vault.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT auth
    JWT_SECRET_KEY = _require("JWT_SECRET_KEY", "dev-jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=20)
    JWT_TOKEN_LOCATION = ["headers"]

    # Server-side key-wrapping secret used to wrap the per-user vault key
    # inside the JWT (see crypto_utils.wrap_vault_key / unwrap_vault_key).
    # This must be a urlsafe base64-encoded 32-byte key (Fernet format).
    KEY_WRAP_SECRET = _require(
        "KEY_WRAP_SECRET", "Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyMTI="
    )

    # PBKDF2 iterations for master-key derivation. NIST/OWASP currently
    # recommend >= 600,000 for PBKDF2-HMAC-SHA256 (2023 guidance); kept
    # lower here only if PBKDF2_ITERATIONS env var is set for faster local
    # testing.
    PBKDF2_ITERATIONS = int(os.environ.get("PBKDF2_ITERATIONS", "600000"))

    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

"""Central runtime configuration loaded from environment variables / `.env`.

Every URL, secret, and port lives in `.env` (see `.env.example`). Nothing here
should be edited to change a deployment; edit `.env` instead.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load the repository-root `.env` regardless of the working directory.
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is not set. Copy .env.example to .env and fill it in.")
    return value


def _csv(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Database
DATABASE_URL = _required("DATABASE_URL")

# Security
JWT_SECRET_KEY = _required("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "30"))

# Network
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "").rstrip("/")
CORS_ORIGINS = _csv("CORS_ORIGINS")

# Optional SMTP for password-reset emails. When SMTP_HOST is empty the reset
# link is written to the API log instead, so local demos work without email.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

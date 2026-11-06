"""
Settings from the environment (.env) and the operator data from config.local.json.

Relative paths are resolved against the bot folder (the parent of this package), so the bot can be
started from anywhere.
"""
import json
from os import getenv
from pathlib import Path
from typing import Final

from dotenv import load_dotenv

BOT_DIR: Final[Path] = Path(__file__).resolve().parent.parent

load_dotenv(BOT_DIR / ".env")


def _path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else BOT_DIR / path


TOKEN: Final[str] = getenv("TELEGRAM", "")
CONTAINER: Final[bool] = getenv("CONTAINER", "false").lower() == "true"

# PostgreSQL, e.g. postgresql://user:password@host:5432/ww3
DATABASE_URL: Final[str] = getenv("DATABASE_URL", "")

# The Mini App endpoints and the legal pages are served on this port
API_PORT: Final[int] = int(getenv("API_PORT") or 3790)
# Origins the game may call the endpoints from (CORS)
API_ORIGINS: Final[list[str]] = [
    origin.strip() for origin in (getenv("API_ORIGINS") or "https://ww3-sv.vercel.app").split(",") if origin.strip()
]

# Operator data (Impressum), app URL and admins; git-ignored, copied from config.example.json
CONFIG_PATH: Final[Path] = _path(getenv("CONFIG_PATH") or "config.local.json")
EXAMPLE_CONFIG_PATH: Final[Path] = BOT_DIR / "config.example.json"

LEGAL_DIR: Final[Path] = BOT_DIR / "legal"
PROFILE_PHOTO: Final[Path] = BOT_DIR / "res" / "profile.jpg"


def _load(path: Path) -> dict:
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def _sales_open(config: dict, example: dict) -> bool:
    """Nothing is sold while the Impressum still carries the example operator data."""
    operator = config.get("operator") or {}
    sample = example.get("operator") or {}
    return all(operator.get(key) and operator.get(key) != sample.get(key) for key in ("name", "street", "city", "email"))


CONFIG: Final[dict] = _load(CONFIG_PATH if CONFIG_PATH.exists() else EXAMPLE_CONFIG_PATH)
CONFIG_MISSING: Final[bool] = not CONFIG_PATH.exists()

APP_URL: Final[str] = (CONFIG.get("appUrl") or "").rstrip("/")
# Where the legal pages are linked as web pages; empty sends them as messages
LEGAL_URL: Final[str] = (CONFIG.get("legalUrl") or "").rstrip("/")
ADMIN_IDS: Final[list[int]] = [int(admin) for admin in CONFIG.get("adminIds") or []]
SALES_OPEN: Final[bool] = not CONFIG_MISSING and _sales_open(CONFIG, _load(EXAMPLE_CONFIG_PATH))
OPERATOR: Final[dict] = CONFIG.get("operator") or {}

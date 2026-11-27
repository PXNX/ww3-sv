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

# The feed of house adverts on a litfass server; empty shows the game's bundled adverts only
LITFASS_FEED_URL: Final[str] = getenv("LITFASS_FEED_URL", "")
# Unlocks the litfass network statistics on the admin page
LITFASS_STATS_TOKEN: Final[str] = getenv("LITFASS_STATS_TOKEN", "")

# The Mini App endpoints are served on this port
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


CONFIG: Final[dict] = _load(CONFIG_PATH if CONFIG_PATH.exists() else EXAMPLE_CONFIG_PATH)
CONFIG_MISSING: Final[bool] = not CONFIG_PATH.exists()

# The game website on Vercel; also the base of the legal links sent out by the bot
APP_URL: Final[str] = (CONFIG.get("appUrl") or "").rstrip("/")
ADMIN_IDS: Final[list[int]] = [int(admin) for admin in CONFIG.get("adminIds") or []]
OPERATOR: Final[dict] = CONFIG.get("operator") or {}

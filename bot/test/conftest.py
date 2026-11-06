"""
Shared test setup: the example operator data, a recording stand-in for the Bot API, and a fresh
schema in the PostgreSQL database given by TEST_DATABASE_URL for every test that needs one.
"""
import os
import sys
from pathlib import Path
from types import SimpleNamespace

os.environ["CONFIG_PATH"] = "config.example.json"
os.environ.setdefault("TELEGRAM", "test")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from telegram.error import BadRequest, Forbidden  # noqa: E402

from ww3bot import db  # noqa: E402

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")


class FakeBot:
    """Records every Bot API call as (method, args, kwargs) and answers like Telegram would."""

    def __init__(self):
        self.calls: list[tuple[str, tuple, dict]] = []
        self.refuse = None
        self.high_scores: list = []
        self.username = "game_ww3_bot"

    def methods(self) -> list[str]:
        return [call[0] for call in self.calls]

    def __getattr__(self, method: str):
        async def call(*args, **kwargs):
            self.calls.append((method, args, kwargs))
            if self.refuse:
                error = self.refuse(method, args, kwargs)
                if error:
                    raise error
            if method == "get_game_high_scores":
                return self.high_scores
            if method == "send_message":
                return SimpleNamespace(message_id=len(self.calls))
            if method == "create_invoice_link":
                return "https://t.me/$invoice"
            return True

        return call


@pytest.fixture
def bot() -> FakeBot:
    return FakeBot()


@pytest.fixture
async def database():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not set")
    await db.open_pool(TEST_DATABASE_URL)
    async with db.connection() as conn:
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
        await conn.execute(db.SCHEMA)
    yield
    await db.close_pool()


not_modified = lambda *_: BadRequest("Bad Request: BOT_SCORE_NOT_MODIFIED")  # noqa: E731
blocked = lambda *_: Forbidden("Forbidden: bot was blocked by the user")  # noqa: E731

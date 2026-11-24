"""
Gift codes that put revival tokens into the account wallet, once per Telegram account. They work as a
bot link (t.me/<bot>?start=MN5), as a Mini App link (?startapp=MN5) and typed in the supply depot.
"""
import re
from typing import Final

from ww3bot import db

# Code → revival tokens
GIFT_CODES: Final[dict[str, int]] = {"MN5": 5}


def normalize(code: str | None) -> str | None:
    """`mn5`, `MN-5` and `gift_MN5` all read as MN5; None for anything that is no gift code."""
    if not code:
        return None
    value = re.sub(r"[\s-]+", "", code).upper()
    value = value.removeprefix("GIFT_")
    return value if value in GIFT_CODES else None


async def redeem(user_id: int, code: str) -> tuple[str, int]:
    """("ok" | "used" | "unknown", revival tokens of the code)."""
    gift = normalize(code)
    if not gift:
        return "unknown", 0
    revives = GIFT_CODES[gift]
    row = await db.fetchone(
        "INSERT INTO gifts (user_id, code, revives, created_at) VALUES (%s, %s, %s, %s) "
        "ON CONFLICT (user_id, code) DO NOTHING RETURNING 1 AS added",
        (user_id, gift, revives, db.now()),
    )
    return ("ok" if row else "used"), revives

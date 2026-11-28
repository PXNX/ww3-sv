"""
Gifting cosmetics to friends. The sender registers a wrapped look with the bot, which returns a
short code usable as `t.me/<bot>?start=gift_<code>` or `?startapp=gift_<code>`. The recipient claims
it once; the bot keeps the record so a reload or a second device cannot duplicate it.
"""
import secrets
from typing import Final

from ww3bot import db

# Only these part/value pairs can be wrapped into a gift.
GIFTABLE: Final[dict[str, frozenset[str]]] = {
    "shirt": frozenset({"flamingo"}),
    "shirtColor": frozenset({"#00a8ff", "#fa983a", "#78909c"}),
}

CODE_PREFIX: Final[str] = "gift_"


def is_giftable(part: object, value: object) -> bool:
    return (
        isinstance(part, str)
        and isinstance(value, str)
        and value in GIFTABLE.get(part, frozenset())
    )


def start_param(code: str) -> str:
    return f"{CODE_PREFIX}{code}"


def code_from_param(param: str | None) -> str | None:
    if not param or not param.startswith(CODE_PREFIX):
        return None
    code = param[len(CODE_PREFIX) :]
    return code if code.isalnum() and 4 <= len(code) <= 24 else None


async def create(from_user: int, to_user: int | None, part: str, value: str) -> str:
    """Registers a wrapped look and returns its short claim code."""
    code = secrets.token_urlsafe(9).replace("-", "").replace("_", "")[:12]
    await db.execute(
        "INSERT INTO look_gifts (code, from_user, to_user, part, value, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (code, from_user, to_user, part, value, db.now()),
    )
    return code


async def claim(code: str, user_id: int) -> dict | None:
    """Claims a gift for this user; a gift aimed at someone else cannot be taken."""
    row = await db.fetchone("SELECT * FROM look_gifts WHERE code = %s", (code,))
    if not row or row["claimed_at"] is not None:
        return None
    if row["to_user"] is not None and row["to_user"] != user_id:
        return None
    await db.execute(
        "UPDATE look_gifts SET claimed_at = %s, claimed_by = %s WHERE code = %s AND claimed_at IS NULL",
        (db.now(), user_id, code),
    )
    return {"part": row["part"], "value": row["value"], "from": row["from_user"]}


async def pending(user_id: int) -> list[dict]:
    """Looks waiting for this account, including gifts addressed to anyone."""
    rows = await db.fetchall(
        "SELECT code, part, value, from_user FROM look_gifts "
        "WHERE claimed_at IS NULL AND (to_user = %s OR to_user IS NULL) ORDER BY created_at DESC LIMIT 10",
        (user_id,),
    )
    return [
        {"code": row["code"], "part": row["part"], "value": row["value"], "from": row["from_user"]}
        for row in rows
    ]

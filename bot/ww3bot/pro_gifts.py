"""Pro months bought as gifts: one code per purchase, claimed once by its recipient."""
import secrets
from typing import Final

from ww3bot import db
from ww3bot.referrals import BOT_USERNAME

PREFIX: Final[str] = "progift_"


def create_code() -> str:
    return secrets.token_urlsafe(9).replace("-", "").replace("_", "")[:12]


async def create(from_user: int, days: int) -> str:
    code = create_code()
    await db.execute(
        "INSERT INTO pro_gifts (code, from_user, days, created_at) VALUES (%s, %s, %s, %s)",
        (code, from_user, days, db.now()),
    )
    return code


def link(code: str) -> str:
    return f"https://t.me/{BOT_USERNAME}?start={PREFIX}{code}"


def code_from_param(param: str | None) -> str | None:
    if not param or not param.startswith(PREFIX):
        return None
    code = param[len(PREFIX) :]
    return code if code.isalnum() and 4 <= len(code) <= 24 else None


async def claim(code: str, user_id: int) -> int | None:
    row = await db.fetchone("SELECT * FROM pro_gifts WHERE code = %s", (code,))
    if not row or row["claimed_at"] is not None:
        return None
    await db.execute(
        "UPDATE pro_gifts SET claimed_at = %s, claimed_by = %s WHERE code = %s AND claimed_at IS NULL",
        (db.now(), user_id, code),
    )
    await db.execute(
        "UPDATE accounts SET pro_until = GREATEST(COALESCE(pro_until, 0), %s) WHERE user_id = %s",
        (db.now() + row["days"] * 24 * 3600, user_id),
    )
    return row["days"]

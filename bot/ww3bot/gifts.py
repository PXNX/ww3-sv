"""
Gift codes that credit an account once per Telegram user. A code either puts revival tokens into the
wallet or grants Pro for a fixed number of months. They work as a bot link (t.me/<bot>?start=MN5),
as a Mini App link (?startapp=MN5) and typed in the supply depot.
"""
import calendar
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Final

from ww3bot import db


@dataclass(frozen=True)
class Gift:
    """Exactly one reward per code. Pro months are calendar months, not a fixed number of days."""

    revives: int = 0
    pro_months: int = 0


# Code → reward
GIFT_CODES: Final[dict[str, Gift]] = {
    "MN5": Gift(revives=5),
    # Six months of Pro plus a small stack of revival tokens for the same code
    "PRO6M": Gift(revives=5, pro_months=6),
}


@dataclass(frozen=True)
class Redemption:
    status: str  # "ok" | "used" | "unknown"
    revives: int
    pro_until: int | None = None


def normalize(code: str | None) -> str | None:
    """`mn5`, `MN-5` and `gift_MN5` all read as MN5; None for anything that is no gift code."""
    if not code:
        return None
    value = re.sub(r"[\s-]+", "", code).upper()
    value = value.removeprefix("GIFT_")
    return value if value in GIFT_CODES else None


def plus_months(months: int, now: datetime | None = None) -> datetime:
    """Adds calendar months to now, clamping the day to the end of a shorter month."""
    now = now or datetime.now(timezone.utc)
    index = now.month - 1 + months
    year = now.year + index // 12
    month = index % 12 + 1
    day = min(now.day, calendar.monthrange(year, month)[1])
    return now.replace(year=year, month=month, day=day)


async def redeem(user_id: int, code: str) -> Redemption:
    """Redeems once per account. A Pro gift stacks on top of any Pro time already running."""
    gift_code = normalize(code)
    if not gift_code:
        return Redemption("unknown", 0)
    gift = GIFT_CODES[gift_code]

    # The gifts table is the one-per-account guard for every kind of reward
    row = await db.fetchone(
        "INSERT INTO gifts (user_id, code, revives, created_at) VALUES (%s, %s, %s, %s) "
        "ON CONFLICT (user_id, code) DO NOTHING RETURNING 1 AS added",
        (user_id, gift_code, gift.revives, db.now()),
    )
    if not row:
        return Redemption("used", gift.revives)

    until = None
    if gift.pro_months:
        current = await db.fetchone(
            "SELECT pro_until FROM accounts WHERE user_id = %s", (user_id,)
        )
        running_until = int(current["pro_until"]) if current and current["pro_until"] else 0
        # Stack from the later of now and the existing end: an active subscription keeps every
        # day it has left and the gift adds six whole calendar months after that.
        base = datetime.fromtimestamp(max(running_until, db.now()), timezone.utc)
        until = int(plus_months(gift.pro_months, base).timestamp())
        await db.execute(
            "UPDATE accounts SET pro_until = %s WHERE user_id = %s", (until, user_id)
        )
    # Revives are credited by the gifts row inserted above; the wallet sums that table.
    return Redemption("ok", gift.revives, until)

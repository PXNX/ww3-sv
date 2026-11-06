"""
Invite links: every player gets https://t.me/<bot>?start=r<id in base 36>. When someone who never
used the bot starts it through that link, the inviter gets a revival token, up to a cap. The check
(new player, not yourself, under the cap, invited only once) is one INSERT … SELECT under the
inviter's advisory lock, and must run before the new player's account row is written.
"""
import re
from typing import Final

from ww3bot import db
from ww3bot.ledger import _base36

BOT_USERNAME: Final[str] = "game_ww3_bot"
REFERRAL_REVIVES: Final[int] = 1
# Friends that earn a reward; more can still join through the link, they just earn nothing
REFERRAL_CAP: Final[int] = 10

PREFIX: Final[str] = "r"
MAX_ID: Final[int] = 2**53 - 1


def invite_code(user_id: int) -> str:
    return f"{PREFIX}{_base36(user_id)}"


def invite_link(user_id: int) -> str:
    return f"https://t.me/{BOT_USERNAME}?start={invite_code(user_id)}"


def parse_invite(param) -> int | None:
    """The inviter's user id from a /start parameter, or None when it is not an invite."""
    if not isinstance(param, str) or not re.fullmatch(r"r[0-9a-z]{1,13}", param):
        return None
    user_id = int(param[len(PREFIX):], 36)
    return user_id if 0 < user_id <= MAX_ID else None


async def record_referral(referrer_id: int | None, invitee) -> bool:
    """Credits the inviter when `invitee` is new to the bot; True when a reward was booked."""
    if not referrer_id or getattr(invitee, "is_bot", False) or referrer_id == invitee.id:
        return False
    async with db.transaction(lock=referrer_id) as conn:
        booked = await db.execute(
            """
            INSERT INTO referrals (invitee_id, referrer_id, revives, created_at)
            SELECT %(invitee)s, %(referrer)s, %(revives)s, %(now)s
            WHERE EXISTS (SELECT 1 FROM accounts WHERE user_id = %(referrer)s)
              AND NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = %(invitee)s)
              AND (SELECT COUNT(*) FROM referrals WHERE referrer_id = %(referrer)s) < %(cap)s
            ON CONFLICT (invitee_id) DO NOTHING
            """,
            {"invitee": invitee.id, "referrer": referrer_id, "revives": REFERRAL_REVIVES, "now": db.now(), "cap": REFERRAL_CAP},
            conn,
        )
    return booked > 0


async def invite_stats(user_id: int) -> dict:
    """How many friends joined through the player's link and what it earned them."""
    row = await db.fetchone(
        "SELECT COUNT(*) AS friends, COALESCE(SUM(revives), 0) AS revives FROM referrals WHERE referrer_id = %s",
        (user_id,),
    )
    return {
        "link": invite_link(user_id),
        "friends": int(row["friends"]),
        "revives": int(row["revives"]),
        "cap": REFERRAL_CAP,
        "per_friend": REFERRAL_REVIVES,
    }

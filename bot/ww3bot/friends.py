"""
Friends for the Mini App's friends list (see docs/squad-api.md): a symmetric relation, made when
someone starts the bot through a player's invite link, and who of them has the app open. Presence
is kept only in memory: a player is online for a minute after their last heartbeat.
"""
import time
from typing import Final

from ww3bot import db

ONLINE_WINDOW: Final[int] = 60
# Stale heartbeats are dropped once this many players have reported one
PRUNE_AT: Final[int] = 1000

# user id → (time of the last heartbeat, in a raid)
_presence: dict[int, tuple[float, bool]] = {}


def report_presence(user_id: int, in_raid: bool, now: float | None = None) -> None:
    now = time.time() if now is None else now
    _presence[user_id] = (now, in_raid)
    if len(_presence) > PRUNE_AT:
        for stale in [key for key, (seen, _) in _presence.items() if now - seen > ONLINE_WINDOW]:
            del _presence[stale]


def presence_of(user_id: int, now: float | None = None) -> tuple[bool, bool]:
    """(online, in a raid) of a player; in a raid only counts while online."""
    entry = _presence.get(user_id)
    now = time.time() if now is None else now
    if not entry or now - entry[0] > ONLINE_WINDOW:
        return False, False
    return True, entry[1]


async def befriend(inviter_id: int | None, invitee) -> bool:
    """Makes the inviter and `invitee` friends both ways; True when they were not friends yet."""
    if not inviter_id or getattr(invitee, "is_bot", False) or inviter_id == invitee.id:
        return False
    added = await db.execute(
        """
        INSERT INTO friendships (user_id, friend_id, created_at)
        SELECT pair.a, pair.b, %(now)s
        FROM (VALUES (%(inviter)s::bigint, %(invitee)s::bigint), (%(invitee)s::bigint, %(inviter)s::bigint)) AS pair (a, b)
        WHERE EXISTS (SELECT 1 FROM accounts WHERE user_id = %(inviter)s)
        ON CONFLICT DO NOTHING
        """,
        {"inviter": inviter_id, "invitee": invitee.id, "now": db.now()},
    )
    return added > 0


def friend_entry(row: dict, now: float | None = None) -> dict:
    """A friend in the shape the game expects: id as a string, a name that is never empty."""
    online, in_raid = presence_of(row["friend_id"], now)
    name = (row.get("first_name") or "").strip() or (row.get("username") or "").strip() or "Player"
    return {"id": str(row["friend_id"]), "name": name, "online": online, "in_raid": in_raid}


async def friends_of(user_id: int) -> list[dict]:
    rows = await db.fetchall(
        """
        SELECT f.friend_id, a.first_name, a.username
        FROM friendships f LEFT JOIN accounts a ON a.user_id = f.friend_id
        WHERE f.user_id = %s
        ORDER BY f.created_at
        """,
        (user_id,),
    )
    return [friend_entry(row) for row in rows]

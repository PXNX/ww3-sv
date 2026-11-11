"""
Player versus player (see docs/rivals-api.md): Beachhead raids on published bases and Hermit
Hackers hacks on published rigs. The game keeps its saves; the server keeps each player's latest
published snapshot, settles attacks against it, and keeps the logs the victims' clients apply.

The pure helpers (input checks, shares, caps) come first and need no database; the queries follow.
An attack or hack is one row: opened by `*_attack`/`*_hack`, settled once by `*_result`, which
claims the open row with a single conditional UPDATE so a repeated result can never pay twice.
"""
import json
import math
import re
import secrets
from typing import Any, Final

from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from ww3bot import db

# How long an opened attack or hack may be settled, in seconds
OPEN_FOR: Final[int] = 10 * 60
# The same attacker may not hit the same target again before this
COOLDOWN: Final[int] = 3600
# A target nobody may hit after a successful raid or hack
SHIELD: Final[int] = 4 * 3600
# Who hit the caller within this is listed first, and hitting back takes more
REVENGE_WINDOW: Final[int] = 24 * 3600
# Settled lines older than this are deleted now and then
KEEP_FOR: Final[int] = 30 * 86400

RAID_SHARE: Final[float] = 0.20
RAID_REVENGE_SHARE: Final[float] = 0.30
HACK_SHARE: Final[float] = 0.10
HACK_REVENGE_SHARE: Final[float] = 0.15
HACK_CAP: Final[int] = 5000

MAX_RIVALS: Final[int] = 6
MAX_TARGETS: Final[int] = 8
MAX_LOG: Final[int] = 50

# Base layout limits, as the client's src/lib/services/rivals.ts checks them
COLUMNS: Final[int] = 12
ROWS: Final[int] = 8
MAX_BUILDINGS: Final[int] = 120
MAX_BASE_BYTES: Final[int] = 64 * 1024
MAX_LOOK_BYTES: Final[int] = 4 * 1024
MAX_RESOURCE: Final[int] = 10_000_000
MAX_LEVEL: Final[int] = 99
MAX_BANK: Final[int] = 1_000_000_000
MAX_HACKS: Final[int] = 1_000_000

RESOURCES: Final[tuple[str, ...]] = ("wood", "stone", "iron", "gold")
# Building and crystal kinds change with the game, so only their form is checked here
KIND: Final = re.compile(r"[a-z][a-z0-9-]{0,31}")
LOOK_KEY: Final = re.compile(r"(hq|training|dojo|radar|bunker|warehouse-(wood|stone|iron|gold)-\d|house-\d)")
IP: Final = re.compile(r"(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}")


class RivalError(Exception):
    """A refusal with one of the contract's codes (or INVALID_INPUT for malformed input)."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------------------------------------
# Pure helpers


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return value


def whole(value: Any, low: int, high: int, clamp: bool = False) -> int | None:
    """A whole number in [low, high] (fractions are floored); with `clamp`, out of range is pulled in."""
    number = _number(value)
    if number is None:
        return None
    amount = math.floor(number)
    if clamp:
        return max(low, min(high, amount))
    return amount if low <= amount <= high else None


def parse_ip(value: Any) -> str | None:
    return value if isinstance(value, str) and IP.fullmatch(value) else None


def parse_resources(value: Any) -> dict[str, int] | None:
    """Whole amounts >= 0 for the four resources; missing ones are 0, huge ones are capped."""
    if not isinstance(value, dict):
        return None
    out = {}
    for kind in RESOURCES:
        amount = _number(value.get(kind, 0))
        if amount is None or amount < 0:
            return None
        out[kind] = min(MAX_RESOURCE, math.floor(amount))
    return out


def _scale(value: Any) -> float | None:
    number = _number(value)
    return number if number is not None and 0 < number <= 20 else None


def parse_building(value: Any) -> dict | None:
    """One building with only the keys the contract knows, or None when anything is off."""
    if not isinstance(value, dict):
        return None
    kind, x, y = value.get("kind"), value.get("x"), value.get("y")
    if not isinstance(kind, str) or not KIND.fullmatch(kind):
        return None
    if not all(isinstance(c, int) and not isinstance(c, bool) for c in (x, y)) or not (0 <= x < COLUMNS and 0 <= y < ROWS):
        return None
    building: dict[str, Any] = {"kind": kind, "x": x, "y": y}
    for key in ("hp_scale", "damage_scale"):
        if key in value:
            scale = _scale(value[key])
            if scale is None:
                return None
            building[key] = scale
    if "crystal" in value:
        crystal = value["crystal"]
        if not isinstance(crystal, dict) or not isinstance(crystal.get("type"), str) or not KIND.fullmatch(crystal["type"]):
            return None
        level = whole(crystal.get("level"), 1, 20)
        if level is None or _number(crystal.get("level")) != level:
            return None
        building["crystal"] = {"type": crystal["type"], "level": level}
    # How the building looks in its owner's base: optional, so a wrong one is left out
    look = value.get("look")
    if (
        isinstance(look, dict)
        and isinstance(look.get("key"), str)
        and LOOK_KEY.fullmatch(look["key"])
        and isinstance(look.get("level"), int)
        and not isinstance(look.get("level"), bool)
        and 1 <= look["level"] <= 50
    ):
        building["look"] = {"key": look["key"], "level": look["level"]}
    return building


def parse_base(value: Any) -> dict | None:
    """A base reduced to the contract's keys: <= 120 valid buildings, exactly one "hq", small enough to store."""
    if not isinstance(value, dict):
        return None
    raw = value.get("buildings")
    if not isinstance(raw, list) or not raw or len(raw) > MAX_BUILDINGS:
        return None
    buildings = [parse_building(entry) for entry in raw]
    if any(building is None for building in buildings):
        return None
    if sum(building["kind"] == "hq" for building in buildings) != 1:
        return None
    defense = _scale(value.get("defense_scale", 1))
    if defense is None:
        return None
    base = {"buildings": buildings, "defense_scale": defense}
    return base if len(json.dumps(base, separators=(",", ":"))) <= MAX_BASE_BYTES else None


def parse_look(value: Any) -> dict | None:
    """The avatar as an opaque small object; the clients parse it themselves."""
    if not isinstance(value, dict):
        return None
    try:
        size = len(json.dumps(value, separators=(",", ":")))
    except (TypeError, ValueError):
        return None
    return value if size <= MAX_LOOK_BYTES else None


def parse_rig(data: dict) -> dict:
    """`hackers_publish` input → {ip, bank, firewall, hacks, look}; raises RivalError on bad input."""
    ip = parse_ip(data.get("ip"))
    bank = whole(data.get("bank"), 0, MAX_BANK)
    firewall = whole(data.get("firewall", 1), 1, 10)
    hacks = whole(data.get("hacks", 0), 0, MAX_HACKS)
    look = None
    if data.get("look") is not None:
        look = parse_look(data["look"])
        if look is None:
            raise RivalError("Invalid look", "INVALID_INPUT")
    if ip is None or bank is None or firewall is None or hacks is None:
        raise RivalError("Invalid rig", "INVALID_INPUT")
    return {"ip": ip, "bank": bank, "firewall": firewall, "hacks": hacks, "look": look}


def parse_publish(data: dict) -> dict:
    """`beachhead_publish` input → {base, exposed, level}; raises RivalError on bad input."""
    base = parse_base(data.get("base"))
    exposed = parse_resources(data.get("exposed"))
    level = whole(data.get("level", 1), 1, MAX_LEVEL, clamp=True)
    if base is None or exposed is None or level is None:
        raise RivalError("Invalid base", "INVALID_INPUT")
    return {"base": base, "exposed": exposed, "level": level}


def parse_id(value: Any) -> str | None:
    return value if isinstance(value, str) and 0 < len(value) <= 64 else None


def parse_user_id(value: Any) -> int | None:
    """A player id as the client sends it back: the decimal string the server gave out."""
    if isinstance(value, str) and re.fullmatch(r"[1-9]\d{0,18}", value):
        number = int(value)
        return number if number < 2**63 else None
    return None


def raid_loot(exposed: dict[str, int], revenge: bool) -> dict[str, int]:
    share = RAID_REVENGE_SHARE if revenge else RAID_SHARE
    return {kind: math.floor(max(0, exposed.get(kind, 0)) * share) for kind in RESOURCES}


def capped_loot(quoted: dict[str, int], exposed: dict[str, int]) -> dict[str, int]:
    """What a won raid takes: the quoted loot, but never more than the target still has exposed."""
    return {kind: max(0, min(quoted.get(kind, 0), exposed.get(kind, 0))) for kind in RESOURCES}


def steal_amount(bank: int, revenge: bool) -> int:
    share = HACK_REVENGE_SHARE if revenge else HACK_SHARE
    return min(HACK_CAP, math.floor(max(0, bank) * share))


def new_id() -> str:
    return secrets.token_urlsafe(12)


def player_entry(user_id: int, first_name: str | None, username: str | None) -> dict:
    """A player as the logs and lists name them: id as a string, a name that is never empty."""
    name = (first_name or "").strip() or (username or "").strip() or "Player"
    return {"id": str(user_id), "name": name[:64]}


def rival_entry(row: dict, revenge: bool) -> dict:
    exposed = {kind: row[kind] for kind in RESOURCES}
    return {
        **player_entry(row["user_id"], row.get("first_name"), row.get("username")),
        "level": row["level"],
        "base": row["base"],
        "loot": raid_loot(exposed, revenge),
        "revenge": revenge,
    }


def hacker_entry(row: dict, revenge: bool) -> dict:
    entry = {
        **player_entry(row["user_id"], row.get("first_name"), row.get("username")),
        "ip": row["ip"],
        "bank": row["bank"],
        "firewall": row["firewall"],
        "hacks": row["hacks"],
        "revenge": revenge,
    }
    if row.get("look") is not None:
        entry["look"] = row["look"]
    return entry


# ---------------------------------------------------------------------------------------------
# Beachhead

BASE_COLUMNS: Final[str] = "b.user_id, b.base, b.level, b.wood, b.stone, b.iron, b.gold, a.first_name, a.username"

# Players who raided %(me)s in the revenge window and were not raided back by them since
RAID_REVENGE: Final[str] = """
    SELECT r.attacker_id FROM beachhead_attacks r
    WHERE r.target_id = %(me)s AND r.outcome = 'won' AND r.settled_at > %(since)s
      AND NOT EXISTS (
        SELECT 1 FROM beachhead_attacks back
        WHERE back.attacker_id = %(me)s AND back.target_id = r.attacker_id AND back.outcome = 'won'
          AND back.settled_at > r.settled_at
      )
"""


async def publish_base(user_id: int, data: dict) -> None:
    entry = parse_publish(data)
    await db.execute(
        """
        INSERT INTO beachhead_bases (user_id, base, level, wood, stone, iron, gold, updated_at)
        VALUES (%(user)s, %(base)s, %(level)s, %(wood)s, %(stone)s, %(iron)s, %(gold)s, %(now)s)
        ON CONFLICT (user_id) DO UPDATE SET
            base = excluded.base, level = excluded.level, wood = excluded.wood, stone = excluded.stone,
            iron = excluded.iron, gold = excluded.gold, updated_at = excluded.updated_at
        """,
        {"user": user_id, "base": Jsonb(entry["base"]), "level": entry["level"], **entry["exposed"], "now": db.now()},
    )


async def _raid_revenge(me: int, target: int, now: int, conn=None) -> bool:
    row = await db.fetchone(
        f"SELECT EXISTS ({RAID_REVENGE} AND r.attacker_id = %(target)s) AS revenge",
        {"me": me, "target": target, "since": now - REVENGE_WINDOW},
        conn,
    )
    return bool(row and row["revenge"])


async def list_rivals(user_id: int) -> list[dict]:
    """Up to six bases: who raided the caller lately first, then players of a similar level."""
    now = db.now()
    params = {"me": user_id, "now": now, "since": now - REVENGE_WINDOW, "cooldown": now - COOLDOWN, "limit": MAX_RIVALS}
    open_to_me = f"""
        b.user_id <> %(me)s AND b.shielded_until <= %(now)s
        AND NOT EXISTS (
            SELECT 1 FROM beachhead_attacks c
            WHERE c.attacker_id = %(me)s AND c.target_id = b.user_id
              AND c.outcome IN ('won', 'lost') AND c.settled_at > %(cooldown)s
        )
    """
    revenge = await db.fetchall(
        f"""
        SELECT {BASE_COLUMNS} FROM beachhead_bases b LEFT JOIN accounts a ON a.user_id = b.user_id
        WHERE {open_to_me} AND b.user_id IN ({RAID_REVENGE})
        ORDER BY b.updated_at DESC LIMIT %(limit)s
        """,
        params,
    )
    rivals = [rival_entry(row, True) for row in revenge]
    if len(rivals) < MAX_RIVALS:
        mine = await db.fetchone("SELECT level FROM beachhead_bases WHERE user_id = %s", (user_id,))
        others = await db.fetchall(
            f"""
            SELECT {BASE_COLUMNS} FROM beachhead_bases b LEFT JOIN accounts a ON a.user_id = b.user_id
            WHERE {open_to_me} AND b.user_id <> ALL(%(skip)s::bigint[])
            ORDER BY abs(b.level - %(level)s), random() LIMIT %(rest)s
            """,
            {**params, "level": mine["level"] if mine else 1, "skip": [row["user_id"] for row in revenge], "rest": MAX_RIVALS - len(rivals)},
        )
        rivals += [rival_entry(row, False) for row in others]
    return rivals


async def _check_target(table: str, attacker: int, target: int, now: int, conn) -> None:
    recent = await db.fetchone(
        f"""
        SELECT 1 FROM {table}
        WHERE attacker_id = %s AND target_id = %s AND outcome IN ('won', 'lost') AND settled_at > %s LIMIT 1
        """,
        (attacker, target, now - COOLDOWN),
        conn,
    )
    if recent:
        raise RivalError("Attacked too recently", "COOLDOWN")


async def _prune(table: str, now: int, conn) -> None:
    await db.execute(f"DELETE FROM {table} WHERE created_at < %s", (now - KEEP_FOR,), conn)


async def open_attack(user_id: int, rival_id: Any) -> dict:
    """Locks a rival's base for one attack; the caller's other open attacks are given up."""
    target = parse_user_id(rival_id)
    if target is None:
        raise RivalError("No such base", "NOT_FOUND")
    if target == user_id:
        raise RivalError("That is your own base", "SELF")
    now = db.now()
    async with db.transaction(lock=user_id) as conn:
        row = await db.fetchone(
            f"SELECT {BASE_COLUMNS}, b.shielded_until FROM beachhead_bases b LEFT JOIN accounts a ON a.user_id = b.user_id WHERE b.user_id = %s",
            (target,),
            conn,
        )
        if not row:
            raise RivalError("No such base", "NOT_FOUND")
        await db.execute(
            "UPDATE beachhead_attacks SET outcome = 'abandoned', settled_at = %s WHERE attacker_id = %s AND outcome IS NULL",
            (now, user_id),
            conn,
        )
        await _check_target("beachhead_attacks", user_id, target, now, conn)
        if row["shielded_until"] > now:
            raise RivalError("This base is shielded", "SHIELDED")
        revenge = await _raid_revenge(user_id, target, now, conn)
        rival = rival_entry(row, revenge)
        attack_id = new_id()
        await db.execute(
            """
            INSERT INTO beachhead_attacks (id, attacker_id, target_id, base, loot, revenge, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (attack_id, user_id, target, Jsonb(row["base"]), Jsonb(rival["loot"]), revenge, now),
            conn,
        )
        await _prune("beachhead_attacks", now, conn)
    return {"attack_id": attack_id, "rival": rival}


async def settle_attack(user_id: int, attack_id: Any, won: bool) -> dict[str, int]:
    """Ends an open attack once; a win takes the quoted loot, capped by what the target still has exposed."""
    attack_id = parse_id(attack_id)
    if attack_id is None:
        raise RivalError("No such attack", "EXPIRED")
    now = db.now()
    async with db.transaction() as conn:
        # The claim: only one result ever finds the row still open
        attack = await db.fetchone(
            """
            UPDATE beachhead_attacks SET outcome = %s, settled_at = %s
            WHERE id = %s AND attacker_id = %s AND outcome IS NULL AND created_at > %s
            RETURNING target_id, loot
            """,
            ("won" if won else "lost", now, attack_id, user_id, now - OPEN_FOR),
            conn,
        )
        if not attack:
            raise RivalError("This attack is over", "EXPIRED")
        if not won:
            return {kind: 0 for kind in RESOURCES}
        target = await db.fetchone(
            "SELECT wood, stone, iron, gold FROM beachhead_bases WHERE user_id = %s FOR UPDATE", (attack["target_id"],), conn
        )
        loot = capped_loot(attack["loot"], target or {})
        await db.execute(
            """
            UPDATE beachhead_bases SET wood = wood - %(wood)s, stone = stone - %(stone)s, iron = iron - %(iron)s,
                gold = gold - %(gold)s, shielded_until = %(shield)s
            WHERE user_id = %(target)s
            """,
            {**loot, "shield": now + SHIELD, "target": attack["target_id"]},
            conn,
        )
        await db.execute("UPDATE beachhead_attacks SET loot = %s WHERE id = %s", (Jsonb(loot), attack_id), conn)
    return loot


async def raid_log(user_id: int) -> list[dict]:
    """The caller's raid history, newest first: plundered (they won), raided and defended (they were hit)."""
    rows = await db.fetchall(
        """
        SELECT r.id, r.attacker_id, r.target_id, r.outcome, r.loot, r.settled_at, a.first_name, a.username
        FROM beachhead_attacks r
        LEFT JOIN accounts a ON a.user_id = CASE WHEN r.attacker_id = %(me)s THEN r.target_id ELSE r.attacker_id END
        WHERE (r.attacker_id = %(me)s AND r.outcome = 'won') OR (r.target_id = %(me)s AND r.outcome IN ('won', 'lost'))
        ORDER BY r.settled_at DESC, r.id LIMIT %(limit)s
        """,
        {"me": user_id, "limit": MAX_LOG},
    )
    events = []
    for row in rows:
        mine = row["attacker_id"] == user_id
        kind = "plundered" if mine else ("raided" if row["outcome"] == "won" else "defended")
        other = row["target_id"] if mine else row["attacker_id"]
        loot = {kind_: int(row["loot"].get(kind_, 0)) for kind_ in RESOURCES} if kind != "defended" else {k: 0 for k in RESOURCES}
        events.append(
            {"id": row["id"], "kind": kind, "player": player_entry(other, row["first_name"], row["username"]), "loot": loot, "at": row["settled_at"] * 1000}
        )
    return events


# ---------------------------------------------------------------------------------------------
# Hermit Hackers

RIG_COLUMNS: Final[str] = "g.user_id, g.ip, g.bank, g.firewall, g.hacks, g.look, a.first_name, a.username"

# Players who hacked %(me)s in the revenge window and were not hacked back by them since
HACK_REVENGE: Final[str] = """
    SELECT h.attacker_id FROM hacker_hacks h
    WHERE h.target_id = %(me)s AND h.outcome = 'won' AND h.settled_at > %(since)s
      AND NOT EXISTS (
        SELECT 1 FROM hacker_hacks back
        WHERE back.attacker_id = %(me)s AND back.target_id = h.attacker_id AND back.outcome = 'won'
          AND back.settled_at > h.settled_at
      )
"""


async def publish_rig(user_id: int, data: dict) -> None:
    rig = parse_rig(data)
    try:
        await db.execute(
            """
            INSERT INTO hacker_rigs (user_id, ip, bank, firewall, hacks, look, updated_at)
            VALUES (%(user)s, %(ip)s, %(bank)s, %(firewall)s, %(hacks)s, %(look)s, %(now)s)
            ON CONFLICT (user_id) DO UPDATE SET
                ip = excluded.ip, bank = excluded.bank, firewall = excluded.firewall, hacks = excluded.hacks,
                look = excluded.look, updated_at = excluded.updated_at
            """,
            {"user": user_id, **rig, "look": Jsonb(rig["look"]) if rig["look"] is not None else None, "now": db.now()},
        )
    except UniqueViolation as error:
        raise RivalError("This address belongs to another player", "IP_TAKEN") from error


async def _hack_revenge(me: int, target: int, now: int, conn=None) -> bool:
    row = await db.fetchone(
        f"SELECT EXISTS ({HACK_REVENGE} AND h.attacker_id = %(target)s) AS revenge",
        {"me": me, "target": target, "since": now - REVENGE_WINDOW},
        conn,
    )
    return bool(row and row["revenge"])


async def list_targets(user_id: int) -> list[dict]:
    """Up to eight rigs: who hacked the caller lately first, then recently active players."""
    now = db.now()
    params = {"me": user_id, "now": now, "since": now - REVENGE_WINDOW, "cooldown": now - COOLDOWN, "limit": MAX_TARGETS}
    open_to_me = """
        g.user_id <> %(me)s AND g.shielded_until <= %(now)s
        AND NOT EXISTS (
            SELECT 1 FROM hacker_hacks c
            WHERE c.attacker_id = %(me)s AND c.target_id = g.user_id
              AND c.outcome IN ('won', 'lost') AND c.settled_at > %(cooldown)s
        )
    """
    revenge = await db.fetchall(
        f"""
        SELECT {RIG_COLUMNS} FROM hacker_rigs g LEFT JOIN accounts a ON a.user_id = g.user_id
        WHERE {open_to_me} AND g.user_id IN ({HACK_REVENGE})
        ORDER BY g.updated_at DESC LIMIT %(limit)s
        """,
        params,
    )
    targets = [hacker_entry(row, True) for row in revenge]
    if len(targets) < MAX_TARGETS:
        # A random few of the most recently active rigs, so the list changes but stays alive
        others = await db.fetchall(
            f"""
            SELECT * FROM (
                SELECT {RIG_COLUMNS} FROM hacker_rigs g LEFT JOIN accounts a ON a.user_id = g.user_id
                WHERE {open_to_me} AND g.user_id <> ALL(%(skip)s::bigint[])
                ORDER BY g.updated_at DESC LIMIT 50
            ) recent ORDER BY random() LIMIT %(rest)s
            """,
            {**params, "skip": [row["user_id"] for row in revenge], "rest": MAX_TARGETS - len(targets)},
        )
        targets += [hacker_entry(row, False) for row in others]
    return targets


async def lookup_rig(user_id: int, ip: Any) -> dict:
    address = parse_ip(ip)
    if address is None:
        raise RivalError("No rig answers on that address", "NOT_FOUND")
    row = await db.fetchone(
        f"SELECT {RIG_COLUMNS} FROM hacker_rigs g LEFT JOIN accounts a ON a.user_id = g.user_id WHERE g.ip = %s", (address,)
    )
    if not row:
        raise RivalError("No rig answers on that address", "NOT_FOUND")
    if row["user_id"] == user_id:
        raise RivalError("That is your own rig", "SELF")
    return hacker_entry(row, await _hack_revenge(user_id, row["user_id"], db.now()))


async def open_hack(user_id: int, target_id: Any) -> dict:
    """Opens a hack on a rig; the caller needs a published rig, whose address the trace will show."""
    target = parse_user_id(target_id)
    if target is None:
        raise RivalError("No such rig", "NOT_FOUND")
    if target == user_id:
        raise RivalError("That is your own rig", "SELF")
    now = db.now()
    async with db.transaction(lock=user_id) as conn:
        own = await db.fetchone("SELECT ip FROM hacker_rigs WHERE user_id = %s", (user_id,), conn)
        if not own:
            raise RivalError("Publish your own rig first", "NOT_FOUND")
        row = await db.fetchone(
            f"SELECT {RIG_COLUMNS}, g.shielded_until FROM hacker_rigs g LEFT JOIN accounts a ON a.user_id = g.user_id WHERE g.user_id = %s",
            (target,),
            conn,
        )
        if not row:
            raise RivalError("No such rig", "NOT_FOUND")
        await db.execute(
            "UPDATE hacker_hacks SET outcome = 'abandoned', settled_at = %s WHERE attacker_id = %s AND outcome IS NULL",
            (now, user_id),
            conn,
        )
        await _check_target("hacker_hacks", user_id, target, now, conn)
        if row["shielded_until"] > now:
            raise RivalError("This rig is shielded", "SHIELDED")
        revenge = await _hack_revenge(user_id, target, now, conn)
        hack_id = new_id()
        await db.execute(
            """
            INSERT INTO hacker_hacks (id, attacker_id, target_id, attacker_ip, revenge, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (hack_id, user_id, target, own["ip"], revenge, now),
            conn,
        )
        await _prune("hacker_hacks", now, conn)
    return {"hack_id": hack_id, "target": hacker_entry(row, revenge)}


async def settle_hack(user_id: int, hack_id: Any, won: bool) -> int:
    """Ends an open hack once; a win steals a share of the target's stored bank and shields them."""
    hack_id = parse_id(hack_id)
    if hack_id is None:
        raise RivalError("No such hack", "EXPIRED")
    now = db.now()
    async with db.transaction() as conn:
        hack = await db.fetchone(
            """
            UPDATE hacker_hacks SET outcome = %s, settled_at = %s
            WHERE id = %s AND attacker_id = %s AND outcome IS NULL AND created_at > %s
            RETURNING target_id, revenge
            """,
            ("won" if won else "lost", now, hack_id, user_id, now - OPEN_FOR),
            conn,
        )
        if not hack:
            raise RivalError("This hack is over", "EXPIRED")
        if not won:
            return 0
        target = await db.fetchone("SELECT bank FROM hacker_rigs WHERE user_id = %s FOR UPDATE", (hack["target_id"],), conn)
        stolen = steal_amount(target["bank"], hack["revenge"]) if target else 0
        await db.execute(
            "UPDATE hacker_rigs SET bank = bank - %s, shielded_until = %s WHERE user_id = %s",
            (stolen, now + SHIELD, hack["target_id"]),
            conn,
        )
        await db.execute("UPDATE hacker_hacks SET stolen = %s WHERE id = %s", (stolen, hack_id), conn)
    return stolen


async def firewall_log(user_id: int) -> list[dict]:
    """Every settled attempt on the caller's rig, newest first, with the address it came from."""
    rows = await db.fetchall(
        """
        SELECT h.id, h.attacker_id, h.attacker_ip, h.stolen, h.settled_at, a.first_name, a.username
        FROM hacker_hacks h LEFT JOIN accounts a ON a.user_id = h.attacker_id
        WHERE h.target_id = %s AND h.outcome IN ('won', 'lost')
        ORDER BY h.settled_at DESC, h.id LIMIT %s
        """,
        (user_id, MAX_LOG),
    )
    return [
        {
            "id": row["id"],
            "ip": row["attacker_ip"],
            "player": player_entry(row["attacker_id"], row["first_name"], row["username"]),
            "stolen": row["stolen"],
            "blocked": row["stolen"] == 0,
            "at": row["settled_at"] * 1000,
        }
        for row in rows
    ]

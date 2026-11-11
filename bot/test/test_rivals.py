"""Player versus player: input checks, shares and caps without a database, then raids and hacks on one."""
import asyncio
from types import SimpleNamespace

import pytest

from ww3bot import db, ledger, rivals
from ww3bot.endpoints import ENDPOINTS, EndpointError
from ww3bot.rivals import RivalError

HQ = {"kind": "hq", "x": 9, "y": 3}


def base(*extra: dict, **fields) -> dict:
    return {"buildings": [HQ, *extra], **fields}


# ---------------------------------------------------------------------------------------------
# Pure


def test_every_rival_call_is_served():
    names = ["beachhead_publish", "beachhead_rivals", "beachhead_attack", "beachhead_result", "beachhead_log",
             "hackers_publish", "hackers_targets", "hackers_lookup", "hackers_hack", "hackers_result", "hackers_firewall"]
    assert all(name in ENDPOINTS for name in names)


@pytest.mark.parametrize("ip", ["0.0.0.0", "10.20.30.40", "255.255.255.255", "1.2.3.4"])
def test_addresses_of_four_numbers_up_to_255_pass(ip):
    assert rivals.parse_ip(ip) == ip


@pytest.mark.parametrize("ip", ["256.1.1.1", "1.2.3", "1.2.3.4.5", "01.2.3.4", "a.b.c.d", " 1.2.3.4", "1.2.3.4\n", 1234, None])
def test_anything_else_is_no_address(ip):
    assert rivals.parse_ip(ip) is None


def test_a_base_is_reduced_to_the_contract_keys():
    parsed = rivals.parse_base(base(
        {"kind": "mortar", "x": 0, "y": 7, "hp_scale": 1.5, "damage_scale": 2, "crystal": {"type": "aegis", "level": 2},
         "look": {"key": "house-2", "level": 3}, "secret": "x" * 1000},
        {"kind": "mg", "x": 1, "y": 1, "look": {"key": "<script>", "level": 1}},
        defense_scale=1.2, extra=True,
    ))
    assert parsed == {
        "buildings": [
            HQ,
            {"kind": "mortar", "x": 0, "y": 7, "hp_scale": 1.5, "damage_scale": 2, "crystal": {"type": "aegis", "level": 2},
             "look": {"key": "house-2", "level": 3}},
            {"kind": "mg", "x": 1, "y": 1},
        ],
        "defense_scale": 1.2,
    }
    assert rivals.parse_base(base())["defense_scale"] == 1


@pytest.mark.parametrize("value", [
    None, [], {}, {"buildings": []},
    {"buildings": [{"kind": "mortar", "x": 0, "y": 0}]},  # no hq
    base(HQ),  # two hqs
    base({"kind": "mg", "x": 12, "y": 0}), base({"kind": "mg", "x": 0, "y": 8}), base({"kind": "mg", "x": -1, "y": 0}),
    base({"kind": "mg", "x": 1.5, "y": 0}), base({"kind": "mg", "x": True, "y": 0}),
    base({"kind": "Mortar!", "x": 0, "y": 0}), base({"kind": "x" * 40, "x": 0, "y": 0}),
    base({"kind": "mg", "x": 0, "y": 0, "hp_scale": 0}), base({"kind": "mg", "x": 0, "y": 0, "damage_scale": 21}),
    base({"kind": "mg", "x": 0, "y": 0, "hp_scale": float("nan")}),
    base({"kind": "mg", "x": 0, "y": 0, "crystal": {"type": "aegis", "level": 0}}),
    base({"kind": "mg", "x": 0, "y": 0, "crystal": {"type": "aegis", "level": 1.5}}),
    base({"kind": "mg", "x": 0, "y": 0, "crystal": "aegis"}),
    base(defense_scale=0), base(defense_scale="1"),
    {"buildings": [HQ] + [{"kind": "mg", "x": 0, "y": 0}] * 120},  # 121 buildings
])
def test_broken_bases_are_refused(value):
    assert rivals.parse_base(value) is None


def test_the_stored_base_and_look_stay_small(monkeypatch):
    full = {"buildings": [HQ] + [{"kind": "scorpion-nest", "x": 11, "y": 7, "hp_scale": 1.123456789, "damage_scale": 1.123456789,
                                   "crystal": {"type": "fortify", "level": 20}, "look": {"key": "warehouse-stone-3", "level": 50}}] * 119}
    assert rivals.parse_base(full) is not None  # the largest real base fits
    monkeypatch.setattr(rivals, "MAX_BASE_BYTES", 1000)
    assert rivals.parse_base(full) is None
    assert rivals.parse_look({"hat": "cap"}) == {"hat": "cap"}
    assert rivals.parse_look({"hat": "x" * 5000}) is None
    assert rivals.parse_look("cap") is None


def test_rig_and_publish_input():
    rig = rivals.parse_rig({"ip": "1.2.3.4", "bank": 120.7, "firewall": 3, "hacks": 2})
    assert rig == {"ip": "1.2.3.4", "bank": 120, "firewall": 3, "hacks": 2, "look": None}
    assert rivals.parse_rig({"ip": "1.2.3.4", "bank": 0})["firewall"] == 1
    for bad in [{"ip": "1.2.3", "bank": 1}, {"ip": "1.2.3.4", "bank": -1}, {"ip": "1.2.3.4", "bank": 1, "firewall": 11},
                {"ip": "1.2.3.4", "bank": 1, "firewall": 0}, {"ip": "1.2.3.4", "bank": True}, {"ip": "1.2.3.4", "bank": 2e9},
                {"ip": "1.2.3.4", "bank": 1, "hacks": -1}, {"ip": "1.2.3.4", "bank": 1, "look": "cap"}]:
        with pytest.raises(RivalError) as error:
            rivals.parse_rig(bad)
        assert error.value.code == "INVALID_INPUT"

    entry = rivals.parse_publish({"base": base(), "exposed": {"wood": 10.9, "gold": 1e12}, "level": 500})
    assert entry["exposed"] == {"wood": 10, "stone": 0, "iron": 0, "gold": rivals.MAX_RESOURCE}
    assert entry["level"] == rivals.MAX_LEVEL
    for bad in [{"base": base(), "exposed": {"wood": -1}}, {"base": base(), "exposed": None}, {"base": {}, "exposed": {}},
                {"base": base(), "exposed": {"wood": "5"}}]:
        with pytest.raises(RivalError):
            rivals.parse_publish(bad)


def test_ids_from_the_client():
    assert rivals.parse_user_id("42") == 42
    for bad in ["0", "-1", "01", "4.2", 42, "", "9" * 20, None]:
        assert rivals.parse_user_id(bad) is None
    assert rivals.parse_id("abc") == "abc" and rivals.parse_id("x" * 65) is None and rivals.parse_id(5) is None
    assert len({rivals.new_id() for _ in range(100)}) == 100


def test_shares_and_caps():
    exposed = {"wood": 1000, "stone": 15, "iron": 0, "gold": 7}
    assert rivals.raid_loot(exposed, False) == {"wood": 200, "stone": 3, "iron": 0, "gold": 1}
    assert rivals.raid_loot(exposed, True) == {"wood": 300, "stone": 4, "iron": 0, "gold": 2}
    assert rivals.capped_loot({"wood": 300, "stone": 4, "iron": 9, "gold": 2}, {"wood": 100, "stone": 50, "iron": 0}) == {
        "wood": 100, "stone": 4, "iron": 0, "gold": 0}
    assert rivals.steal_amount(1000, False) == 100
    assert rivals.steal_amount(1000, True) == 150
    assert rivals.steal_amount(10**6, True) == rivals.HACK_CAP
    assert rivals.steal_amount(9, False) == 0 and rivals.steal_amount(-5, False) == 0


def test_players_are_named_like_friends():
    assert rivals.player_entry(7, " Ada ", None) == {"id": "7", "name": "Ada"}
    assert rivals.player_entry(7, "", "nick")["name"] == "nick"
    assert rivals.player_entry(7, None, None)["name"] == "Player"
    assert len(rivals.player_entry(7, "x" * 100, None)["name"]) == 64


# ---------------------------------------------------------------------------------------------
# On a database


def person(user_id: int, name: str | None = None):
    return SimpleNamespace(id=user_id, first_name=name or f"P{user_id}", username=None, language_code=None, is_bot=False)


def init(user_id: int) -> dict:
    return {"user": {"id": user_id, "first_name": f"P{user_id}"}}


async def call(name: str, user_id: int, data: dict | None = None) -> dict:
    return await ENDPOINTS[name](None, data or {}, init(user_id))


async def refused(name: str, user_id: int, data: dict) -> str:
    with pytest.raises(EndpointError) as error:
        await call(name, user_id, data)
    return error.value.parameters["code"]


@pytest.fixture
def clock(monkeypatch):
    """A clock the test moves on by hand."""
    state = SimpleNamespace(now=1_800_000_000)
    monkeypatch.setattr(db, "now", lambda: state.now)
    return state


async def publish_base(user_id: int, level: int = 5, exposed: dict | None = None):
    await call("beachhead_publish", user_id, {"base": base(), "exposed": exposed or {"wood": 1000, "stone": 500, "iron": 100, "gold": 10}, "level": level})


@pytest.mark.usefixtures("database")
async def test_a_raid_takes_its_loot_once_shields_and_is_logged(clock):
    await publish_base(1, level=5)
    await publish_base(2, level=6)
    await publish_base(3, level=40)

    rivals_of_1 = (await call("beachhead_rivals", 1))["rivals"]
    assert [rival["id"] for rival in rivals_of_1] == ["2", "3"]  # similar level first, never yourself
    assert rivals_of_1[0]["loot"] == {"wood": 200, "stone": 100, "iron": 20, "gold": 2}
    assert rivals_of_1[0]["name"] == "P2" and rivals_of_1[0]["revenge"] is False

    assert await refused("beachhead_attack", 1, {"rival_id": "1"}) == "SELF"
    assert await refused("beachhead_attack", 1, {"rival_id": "99"}) == "NOT_FOUND"
    assert await refused("beachhead_attack", 1, {"rival_id": 2}) == "NOT_FOUND"
    opened = await call("beachhead_attack", 1, {"rival_id": "2"})
    assert opened["rival"]["base"] == {"buildings": [HQ], "defense_scale": 1}

    # The target spends some exposed stock meanwhile: the win is capped by what is left
    await publish_base(2, level=6, exposed={"wood": 50, "stone": 500, "iron": 100, "gold": 10})
    assert await refused("beachhead_result", 3, {"attack_id": opened["attack_id"], "won": True}) == "EXPIRED"  # not theirs
    results = await asyncio.gather(*(call("beachhead_result", 1, {"attack_id": opened["attack_id"], "won": True}) for _ in range(2)),
                                   return_exceptions=True)
    paid = [result for result in results if isinstance(result, dict)]
    assert paid == [{"loot": {"wood": 50, "stone": 100, "iron": 20, "gold": 2}}]
    assert await refused("beachhead_result", 1, {"attack_id": opened["attack_id"], "won": True}) == "EXPIRED"

    stored = await db.fetchone("SELECT wood, stone, shielded_until FROM beachhead_bases WHERE user_id = 2")
    assert (stored["wood"], stored["stone"]) == (0, 400) and stored["shielded_until"] == clock.now + rivals.SHIELD

    # Shielded for everyone, and on cooldown for the raider
    assert await refused("beachhead_attack", 3, {"rival_id": "2"}) == "SHIELDED"
    assert "2" not in [rival["id"] for rival in (await call("beachhead_rivals", 3))["rivals"]]
    clock.now += rivals.SHIELD + 1
    assert (await call("beachhead_attack", 3, {"rival_id": "2"}))["attack_id"]

    attacker_log = (await call("beachhead_log", 1))["events"]
    assert [(event["kind"], event["player"]["id"]) for event in attacker_log] == [("plundered", "2")]
    victim_log = (await call("beachhead_log", 2))["events"]
    assert [(event["kind"], event["player"]["id"], event["loot"]["wood"]) for event in victim_log] == [("raided", "1", 50)]
    assert victim_log[0]["id"] == opened["attack_id"] and victim_log[0]["at"] == (clock.now - rivals.SHIELD - 1) * 1000


@pytest.mark.usefixtures("database")
async def test_cooldown_revenge_failed_and_expired_attacks(clock):
    await publish_base(1)
    await publish_base(2)
    first = await call("beachhead_attack", 1, {"rival_id": "2"})
    assert (await call("beachhead_result", 1, {"attack_id": first["attack_id"], "won": False}))["loot"] == {
        "wood": 0, "stone": 0, "iron": 0, "gold": 0}
    assert await refused("beachhead_attack", 1, {"rival_id": "2"}) == "COOLDOWN"
    assert [event["kind"] for event in (await call("beachhead_log", 2))["events"]] == ["defended"]
    assert (await call("beachhead_log", 1))["events"] == []

    # 2 raids 1 successfully: 1 sees 2 first with revenge and the bigger share
    raid = await call("beachhead_attack", 2, {"rival_id": "1"})
    await call("beachhead_result", 2, {"attack_id": raid["attack_id"], "won": True})
    await publish_base(3)
    clock.now += rivals.SHIELD + 1
    listed = (await call("beachhead_rivals", 1))["rivals"]
    assert listed[0]["id"] == "2" and listed[0]["revenge"] and listed[0]["loot"]["wood"] == 300
    assert listed[1]["revenge"] is False

    # An attack left open is given up when the next one opens, and a late result is refused
    stale = await call("beachhead_attack", 1, {"rival_id": "3"})
    clock.now += rivals.OPEN_FOR + 1
    assert await refused("beachhead_result", 1, {"attack_id": stale["attack_id"], "won": True}) == "EXPIRED"
    one = await call("beachhead_attack", 1, {"rival_id": "3"})
    two = await call("beachhead_attack", 1, {"rival_id": "2"})
    assert await refused("beachhead_result", 1, {"attack_id": one["attack_id"], "won": True}) == "EXPIRED"
    assert two["rival"]["revenge"]
    assert (await call("beachhead_result", 1, {"attack_id": two["attack_id"], "won": True}))["loot"]["wood"] == 300
    # Revenge taken: no longer listed as revenge
    clock.now += rivals.SHIELD + 1
    assert not any(rival["revenge"] for rival in (await call("beachhead_rivals", 1))["rivals"])


async def publish_rig(user_id: int, ip: str, bank: int = 10_000, **extra):
    return await call("hackers_publish", user_id, {"ip": ip, "bank": bank, "firewall": 4, "hacks": 1, **extra})


@pytest.mark.usefixtures("database")
async def test_addresses_belong_to_the_first_and_lookup_finds_them(clock):
    await publish_rig(1, "10.0.0.1", look={"hat": "cap"})
    assert await refused("hackers_publish", 2, {"ip": "10.0.0.1", "bank": 5}) == "IP_TAKEN"
    assert await refused("hackers_publish", 2, {"ip": "10.0.0.300", "bank": 5}) == "INVALID_INPUT"
    await publish_rig(2, "10.0.0.2")
    await publish_rig(1, "10.0.0.3", look={"hat": "cap"})  # a player may move to a new address; the old one is free again
    await publish_rig(3, "10.0.0.1")

    target = (await call("hackers_lookup", 2, {"ip": "10.0.0.3"}))["target"]
    assert target == {"id": "1", "name": "P1", "ip": "10.0.0.3", "bank": 10_000, "firewall": 4, "hacks": 1, "look": {"hat": "cap"},
                      "revenge": False}
    assert await refused("hackers_lookup", 1, {"ip": "10.0.0.3"}) == "SELF"
    assert await refused("hackers_lookup", 1, {"ip": "9.9.9.9"}) == "NOT_FOUND"
    assert await refused("hackers_lookup", 1, {"ip": None}) == "NOT_FOUND"
    targets = (await call("hackers_targets", 2))["targets"]
    assert sorted(entry["id"] for entry in targets) == ["1", "3"]
    assert "look" not in next(entry for entry in targets if entry["id"] == "3")


@pytest.mark.usefixtures("database")
async def test_a_hack_steals_once_and_leaves_a_trace_for_the_hack_back(clock):
    await ledger.upsert_account(person(9))
    assert await refused("hackers_hack", 9, {"target_id": "1"}) == "NOT_FOUND"  # no rig of one's own yet
    await publish_rig(1, "10.0.0.1", bank=100_000)
    await publish_rig(2, "10.0.0.2", bank=1000)
    await publish_rig(3, "10.0.0.3", bank=1000)
    assert await refused("hackers_hack", 2, {"target_id": "2"}) == "SELF"

    hack = await call("hackers_hack", 2, {"target_id": "1"})
    assert hack["target"]["bank"] == 100_000
    results = await asyncio.gather(*(call("hackers_result", 2, {"hack_id": hack["hack_id"], "won": True}) for _ in range(3)),
                                   return_exceptions=True)
    assert [result for result in results if isinstance(result, dict)] == [{"stolen": rivals.HACK_CAP}]
    assert (await db.fetchone("SELECT bank FROM hacker_rigs WHERE user_id = 1"))["bank"] == 100_000 - rivals.HACK_CAP
    assert await refused("hackers_hack", 3, {"target_id": "1"}) == "SHIELDED"

    # A failed try still leaves its trace
    tried = await call("hackers_hack", 3, {"target_id": "2"})
    assert (await call("hackers_result", 3, {"hack_id": tried["hack_id"], "won": False})) == {"stolen": 0}
    assert await refused("hackers_hack", 3, {"target_id": "2"}) == "COOLDOWN"
    entries = (await call("hackers_firewall", 2))["entries"]
    assert [(e["ip"], e["player"]["id"], e["stolen"], e["blocked"]) for e in entries] == [("10.0.0.3", "3", 0, True)]

    entries = (await call("hackers_firewall", 1))["entries"]
    assert [(e["ip"], e["player"]["id"], e["stolen"], e["blocked"]) for e in entries] == [("10.0.0.2", "2", rivals.HACK_CAP, False)]
    assert entries[0]["id"] == hack["hack_id"] and entries[0]["at"] == clock.now * 1000

    # Hacking back: the trace's address finds the attacker, listed first with revenge and the bigger share
    clock.now += 60
    back = (await call("hackers_lookup", 1, {"ip": entries[0]["ip"]}))["target"]
    assert back["id"] == "2" and back["revenge"]
    assert (await call("hackers_targets", 1))["targets"][0] == back
    opened = await call("hackers_hack", 1, {"target_id": "2"})
    assert (await call("hackers_result", 1, {"hack_id": opened["hack_id"], "won": True})) == {"stolen": 150}

    clock.now += rivals.OPEN_FOR + 1
    late = await call("hackers_hack", 1, {"target_id": "3"})
    clock.now += rivals.OPEN_FOR + 1
    assert await refused("hackers_result", 1, {"hack_id": late["hack_id"], "won": True}) == "EXPIRED"

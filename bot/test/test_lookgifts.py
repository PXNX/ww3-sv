"""Cosmetic gifts: one code, one claim, only for the intended friend."""
import pytest

from conftest import blocked
from ww3bot import db, lookgifts

pytestmark = pytest.mark.usefixtures("database")


def test_giftable_whitelist():
    assert lookgifts.is_giftable("shirt", "flamingo")
    assert lookgifts.is_giftable("shirtColor", "#00a8ff")
    assert not lookgifts.is_giftable("shirt", "trump-suit")
    assert not lookgifts.is_giftable("hat", "flamingo")
    assert not lookgifts.is_giftable(None, None)


def test_start_parameter_round_trip():
    assert lookgifts.code_from_param("gift_Ab12Cd34") == "Ab12Cd34"
    assert lookgifts.code_from_param("MN5") is None
    assert lookgifts.code_from_param("gift_!") is None
    assert lookgifts.code_from_param(lookgifts.start_param("Ab12Cd34")) == "Ab12Cd34"


async def test_gift_is_claimed_once_by_the_right_friend():
    code = await lookgifts.create(1, 2, "shirt", "flamingo")
    assert await lookgifts.claim(code, 3) is None
    claimed = await lookgifts.claim(code, 2)
    assert claimed == {"part": "shirt", "value": "flamingo", "from": 1}
    assert await lookgifts.claim(code, 2) is None
    assert await lookgifts.pending(2) == []


async def test_anyone_gift_can_be_claimed_by_one_player():
    code = await lookgifts.create(4, None, "shirtColor", "#00a8ff")
    gifts = await lookgifts.pending(9)
    assert [gift["code"] for gift in gifts] == [code]
    assert await lookgifts.claim(code, 9) is not None
    assert await lookgifts.claim(code, 10) is None

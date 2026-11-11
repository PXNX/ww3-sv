"""Texts, legal pages, invite codes, friends presence, the games list and the initData check: no database needed."""
import hashlib
import hmac
import json
import re
import time
from urllib.parse import urlencode

import pytest

from ww3bot import friends, games, legal, referrals
from ww3bot.endpoints import ENDPOINTS
from ww3bot.api import verify_init_data
from ww3bot.handlers import parse_command
from ww3bot.texts import LANGUAGES, TEXTS, lang_of, t

CONFIG = {
    "operator": {"name": "Erika Muster", "street": "Weg 1", "city": "12345 Ort", "country": "Deutschland", "email": "a@b.de", "phone": "", "vat_id": ""},
    "legalUpdated": "27.10.2026",
}


def test_german_and_english_have_the_same_keys_and_placeholders():
    assert sorted(TEXTS["de"]) == sorted(TEXTS["en"])
    for key in TEXTS["en"]:
        placeholders = [sorted(re.findall(r"\{(\w+)\}", t(lang, key))) for lang in ("de", "en")]
        assert placeholders[0] == placeholders[1], key
    assert LANGUAGES == ["de", "en"]


@pytest.mark.parametrize("code, lang", [("de", "de"), ("de-AT", "de"), ("en", "en"), ("uk", "en"), (None, "en")])
def test_language_follows_telegram(code, lang):
    assert lang_of(code) == lang


def test_placeholders_are_filled_and_the_legal_footer_is_added():
    text = t("de", "start", name="Ada")
    assert "Ada" in text and "/impressum" in text
    assert not re.search(r"\{\w+\}", text)


def test_every_legal_page_fills_all_its_placeholders():
    for page in legal.PAGES:
        text = legal.fill_text((legal.config.LEGAL_DIR / f"{page}.txt").read_text(encoding="utf-8"), CONFIG)
        assert not re.search(r"\{\w+\}", text), page
        assert "Stand: 27.10.2026" in text, page


def test_the_impressum_names_the_operator_and_omits_empty_optional_lines():
    text = legal.fill_text((legal.config.LEGAL_DIR / "impressum.txt").read_text(encoding="utf-8"), CONFIG)
    assert "Erika Muster\nWeg 1\n12345 Ort" in text
    assert "Telefon" not in text and "Umsatzsteuer" not in text


def test_missing_operator_data_and_unknown_placeholders_are_refused():
    with pytest.raises(ValueError, match="operator.street"):
        legal.fill_text("{name}", {"operator": {"name": "x"}})
    with pytest.raises(ValueError, match="unknown placeholder"):
        legal.fill_text("{nope}", CONFIG)


def test_rendering_escapes_html_and_links_urls():
    html = legal.render_html("datenschutz", "# Titel\n\n## A <b>\n\nSiehe https://telegram.org/privacy.\n\n- eins\n- zwei")
    assert "<h1>Titel</h1>" in html
    assert "<h2>A &lt;b&gt;</h2>" in html
    assert '<a href="https://telegram.org/privacy">https://telegram.org/privacy</a>.' in html
    assert "<ul><li>eins</li><li>zwei</li></ul>" in html


def test_legal_messages_stay_under_the_telegram_limit():
    for page in legal.PAGES:
        messages = legal.legal_messages(page)
        assert messages and all(len(message) <= legal.TELEGRAM_LIMIT for message in messages)


def test_invite_codes_round_trip_and_reject_anything_else():
    assert referrals.parse_invite(referrals.invite_code(123456789)) == 123456789
    assert referrals.invite_link(5) == "https://t.me/game_ww3_bot?start=r5"
    for param in [None, "", "shop", "r", "R5", "r-5", "r0", "rzzzzzzzzzzzzzz"]:
        assert referrals.parse_invite(param) is None


def test_every_game_has_a_unique_id_that_works_as_a_short_name_and_a_route():
    ids = [entry["id"] for entry in games.GAMES]
    assert len(set(ids)) == len(ids)
    for entry in games.GAMES:
        assert re.fullmatch(r"[a-z]+", entry["id"]) and entry["en"] and entry["de"]
    assert {"blocks", "convoy", "flamingo", "whack", "veto", "grain"} <= set(ids)
    # Modes with levels or variants would mix them on one board
    assert not {"minefield", "pipeline", "fury", "wordle"} & set(ids)


def test_the_game_list_matches_the_game():
    """GROUP_GAME_ROUTES in the game's src/lib/services/telegram.ts lists the same modes."""
    source = (legal.config.BOT_DIR.parent / "src" / "lib" / "services" / "telegram.ts").read_text(encoding="utf-8")
    block = re.search(r"const GROUP_GAME_ROUTES = \{(.*?)\} as const", source, re.S).group(1)
    assert sorted(re.findall(r"(\w+): '/play/\1'", block)) == sorted(entry["id"] for entry in games.GAMES)


def test_commands_addressed_to_another_bot_are_not_ours():
    assert parse_command("/top") == ("top", [])
    assert parse_command("/Top@Game_WW3_bot convoy") == ("top", ["convoy"])
    assert parse_command("/top@other_bot") is None
    assert parse_command("hello") is None
    assert parse_command(None) is None


def signed(token: str, fields: dict) -> str:
    check = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    return urlencode({**fields, "hash": hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()})


def test_init_data_is_checked_like_telegram_does():
    now = int(time.time())
    raw = signed("tok", {"auth_date": str(now), "user": json.dumps({"id": 5, "first_name": "A"}), "query_id": "q"})
    assert verify_init_data(raw, "tok")["user"]["id"] == 5
    assert verify_init_data(raw, "other") is None
    assert verify_init_data(raw.replace("%22id%22%3A+5", "%22id%22%3A+6"), "tok") is None
    old = signed("tok", {"auth_date": str(now - 2 * 86400), "user": json.dumps({"id": 5})})
    assert verify_init_data(old, "tok") is None
    assert verify_init_data("", "tok") is None


def test_friends_are_served_to_the_game_with_presence():
    assert "friends" in ENDPOINTS and "presence" in ENDPOINTS
    friends.report_presence(7, True, now=1000)
    friends.report_presence(8, False, now=1000)
    assert friends.presence_of(7, now=1030) == (True, True)
    assert friends.presence_of(8, now=1030) == (True, False)
    assert friends.presence_of(7, now=1000 + friends.ONLINE_WINDOW + 1) == (False, False)
    assert friends.presence_of(9, now=1000) == (False, False)
    entry = friends.friend_entry({"friend_id": 7, "first_name": " Ada ", "username": None}, now=1010)
    assert entry == {"id": "7", "name": "Ada", "online": True, "in_raid": True}
    assert friends.friend_entry({"friend_id": 9, "first_name": "", "username": "nick"})["name"] == "nick"
    assert friends.friend_entry({"friend_id": 9, "first_name": None, "username": None})["name"] == "Player"

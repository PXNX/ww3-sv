"""Group leaderboards, the group-only rule, and the HTTP endpoints, on a real database."""
import json
import time
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from aiohttp.test_utils import TestClient, TestServer
from telegram import CallbackQuery, Chat, Message, User

from conftest import not_modified
from test_pure import signed
from ww3bot import config, db, games
from ww3bot.api import create_app
from ww3bot.endpoints import ENDPOINTS, OPEN_ENDPOINTS, EndpointError, gamescore
from ww3bot.handlers import on_callback, on_message

pytestmark = pytest.mark.usefixtures("database")

GROUP = -1001234567890
ADA = User(1, "Ada", False)
BOB = User(2, "Bob", False)


def message(chat: Chat, text: str | None = None, message_id: int = 77, user: User = ADA) -> Message:
    return Message(message_id, datetime.now(timezone.utc), chat, from_user=user, text=text)


async def test_a_session_only_takes_scores_for_its_game_and_only_while_it_is_fresh(bot):
    session = await games.open_session(ADA, "blocks", GROUP, 77)
    assert len(session) == 32
    assert await games.open_session(ADA, "blocks", GROUP, 77) != session
    for data, code in [
        ({"session": "0" * 32, "game": "blocks", "score": 5}, "SESSION_UNKNOWN"),
        ({"session": session, "game": "minefield", "score": 5}, "INVALID_INPUT"),
        ({"session": "nope", "game": "blocks", "score": 5}, "INVALID_INPUT"),
        *[({"session": session, "game": "blocks", "score": score}, "INVALID_INPUT") for score in (-1, 1.5, "9", True, games.MAX_SCORE + 1)],
    ]:
        with pytest.raises(games.GameScoreError) as error:
            await games.report_score(bot, data)
        assert error.value.code == code
    await db.execute("UPDATE game_sessions SET created_at = created_at - %s WHERE id = %s", (games.SESSION_TTL + 1, session))
    with pytest.raises(games.GameScoreError, match="again"):
        await games.report_score(bot, {"session": session, "game": "blocks", "score": 5})
    assert bot.calls == []


async def test_a_better_run_goes_onto_the_chat_scoreboard_a_worse_one_does_not(bot):
    session = await games.open_session(ADA, "convoy", GROUP, 77)
    first = await games.report_score(bot, {"session": session, "game": "convoy", "score": 100})
    assert (first["new_best"], first["best"], first["rank"], first["overtook"]) == (True, 100, 1, None)
    assert bot.calls[0] == ("set_game_score", (1, 100), {"chat_id": GROUP, "message_id": 77})

    bot.calls.clear()
    worse = await games.report_score(bot, {"session": session, "game": "convoy", "score": 80})
    assert (worse["new_best"], worse["best"]) == (False, 100)
    assert bot.methods() == ["get_game_high_scores"]

    # Telegram already holds a better score (set before the bot kept a copy): nothing changes
    bot.refuse = lambda method, *_: not_modified() if method == "set_game_score" else None
    assert not (await games.report_score(bot, {"session": session, "game": "convoy", "score": 120}))["new_best"]
    assert (await games.top_scores(GROUP, "convoy"))[0]["score"] == 100


async def test_taking_the_record_from_someone_else_is_announced_in_the_chat(bot):
    ada = await games.open_session(ADA, "blocks", GROUP, 77)
    bob = await games.open_session(BOB, "blocks", GROUP, 77)
    await gamescore(bot, {"session": ada, "game": "blocks", "score": 300}, None)

    bot.calls.clear()
    second = await gamescore(bot, {"session": bob, "game": "blocks", "score": 200}, None)
    assert (second["new_best"], second["best"], second["rank"], second["overtaken"]) == (True, 200, 2, None)
    assert bot.methods() == ["set_game_score", "get_game_high_scores"]

    bot.calls.clear()
    first = await gamescore(bot, {"session": bob, "game": "blocks", "score": 400}, None)
    assert (first["rank"], first["overtaken"]) == (1, {"name": "Ada", "score": 300})
    assert bot.methods() == ["set_game_score", "get_game_high_scores", "send_message"]
    _, args, _ = bot.calls[2]
    assert args[0] == GROUP and "Bob" in args[1] and "Ada (300)" in args[1]

    # Beating your own record is left to Telegram's own message, and overtakes nobody
    bot.calls.clear()
    assert (await gamescore(bot, {"session": bob, "game": "blocks", "score": 500}, None))["overtaken"] is None
    assert bot.methods() == ["set_game_score", "get_game_high_scores"]

    # Passing two players at once shows the stronger one
    cleo = await games.open_session(User(3, "Cleo", False), "blocks", GROUP, 77)
    await gamescore(bot, {"session": cleo, "game": "blocks", "score": 100}, None)
    assert (await gamescore(bot, {"session": cleo, "game": "blocks", "score": 450}, None))["overtaken"] == {"name": "Ada", "score": 300}

    assert await games.top_scores(GROUP, "blocks") == [{"name": "Bob", "score": 500}, {"name": "Cleo", "score": 450}, {"name": "Ada", "score": 300}]
    assert await games.top_scores(-1, "blocks") == []
    record = next(row for row in await games.chat_records(GROUP) if row["game"] == "blocks")
    assert (record["score"], record["name"], record["players"]) == (500, "Bob", 3)


async def test_the_endpoint_refuses_a_bad_session_with_a_code_the_game_can_read(bot):
    with pytest.raises(EndpointError) as error:
        await gamescore(bot, {"session": "x", "game": "blocks", "score": 1}, None)
    assert error.value.parameters == {"code": "INVALID_INPUT"}


async def test_the_result_screen_gets_the_chats_leaderboard_as_telegram_keeps_it(bot):
    session = await games.open_session(ADA, "whack", -1002, 9)
    bot.high_scores = [
        SimpleNamespace(position=1, user=SimpleNamespace(id=7, first_name="Cleo", last_name="Top"), score=900),
        SimpleNamespace(position=2, user=SimpleNamespace(id=1, first_name="Ada", last_name=None), score=40),
    ]
    result = await gamescore(bot, {"session": session, "game": "whack", "score": 40}, None)
    call = next(call for call in bot.calls if call[0] == "get_game_high_scores")
    assert call[1:] == ((1,), {"chat_id": -1002, "message_id": 9})
    assert result["leaderboard"] == [
        {"position": 1, "name": "Cleo Top", "score": 900, "me": False},
        {"position": 2, "name": "Ada", "score": 40, "me": True},
    ]

    # Telegram cannot answer: the bot's own copy of the chat's bests stands in
    bot.refuse = lambda method, *_: not_modified() if method == "get_game_high_scores" else None
    fallback = await gamescore(bot, {"session": session, "game": "whack", "score": 10}, None)
    assert fallback["leaderboard"] == [{"position": 1, "name": "Ada", "score": 40, "me": True}]


async def test_games_are_played_in_groups_only(bot, monkeypatch):
    monkeypatch.setattr(config, "APP_URL", "https://game.test")
    private = Chat(ADA.id, Chat.PRIVATE)
    group = Chat(GROUP, Chat.SUPERGROUP, title="Test")

    await on_message(bot, message(group, "/games@game_ww3_bot"))
    assert bot.methods() == ["send_message"]
    keyboard = bot.calls[0][2]["reply_markup"].inline_keyboard
    assert keyboard[0][0].callback_data == "game:blocks"
    assert sum(len(row) for row in keyboard) == len(games.GAMES)

    # The private chat points to a group, with a button that adds the bot to one
    bot.calls.clear()
    await on_message(bot, message(private, "/games"))
    assert bot.calls[-1][2]["reply_markup"].inline_keyboard[0][0].url == "https://t.me/game_ww3_bot?startgroup=games"

    # A channel is ignored
    bot.calls.clear()
    await on_message(bot, message(Chat(-100999, Chat.CHANNEL), "/games"))
    assert bot.calls == []

    count = lambda: db.fetchone("SELECT COUNT(*) AS n FROM game_sessions")  # noqa: E731
    before = (await count())["n"]
    for query in [
        CallbackQuery("q1", ADA, "c", data="game:blocks", message=message(private, message_id=5)),
        CallbackQuery("q2", ADA, "c", data="top:blocks", message=message(private, message_id=5)),
        CallbackQuery("q3", ADA, "c", game_short_name="blocks", message=message(private, message_id=5)),
    ]:
        bot.calls.clear()
        await on_callback(bot, query)
        assert bot.methods() == ["answer_callback_query"]
        assert bot.calls[0][2].get("show_alert") is True and "url" not in bot.calls[0][2]
    assert (await count())["n"] == before

    # In the group, Play opens the game with a fresh session
    bot.calls.clear()
    await on_callback(bot, CallbackQuery("q4", ADA, "c", game_short_name="flamingo", message=message(group, message_id=6)))
    assert bot.calls[0][2]["url"].startswith("https://game.test/play/flamingo?game_session=")
    assert (await count())["n"] == before + 1


async def test_a_game_is_posted_with_telegrams_own_play_button(bot):
    await on_callback(bot, CallbackQuery("q5", ADA, "c", data="game:veto", message=message(Chat(GROUP, Chat.GROUP), message_id=3)))
    assert bot.methods() == ["answer_callback_query", "send_game"]
    assert bot.calls[1][1] == (GROUP, "veto")


async def test_the_api_answers_like_before(bot):
    app = create_app(bot, "tok", ENDPOINTS, OPEN_ENDPOINTS, ["https://game.test"], {"agb": "<p>AGB</p>"})
    async with TestClient(TestServer(app)) as client:
        init = signed("tok", {"auth_date": str(int(time.time())), "user": json.dumps({"id": 5, "first_name": "Eve"})})
        post = lambda name, headers: client.post(f"/api/{name}", json={"mode": "convoy"}, headers={"origin": "https://game.test", **headers})  # noqa: E731

        ok = await post("me", {"x-telegram-init-data": init})
        assert ok.headers["access-control-allow-origin"] == "https://game.test"
        body = await ok.json()
        assert body["ok"] and body["result"]["user"]["id"] == 5 and body["result"]["wallet"] == {"revives": 0}

        assert (await post("me", {})).status == 401
        refused = await post("spend", {"x-telegram-init-data": init})
        assert refused.status == 400 and (await refused.json())["parameters"]["code"] == "NO_REVIVES"
        assert (await post("missing", {"x-telegram-init-data": init})).status == 404
        # gamescore runs without initData and checks its session instead
        score = await post("gamescore", {})
        assert score.status == 400 and (await score.json())["parameters"]["code"] == "INVALID_INPUT"

        assert (await client.options("/api/me", headers={"origin": "https://game.test"})).status == 204
        page = await client.get("/legal/agb.html")
        assert page.status == 200 and await page.text() == "<p>AGB</p>"
        assert (await client.get("/legal/nope.html")).status == 404

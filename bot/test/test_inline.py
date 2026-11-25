"""Inline game search: matching by name and the results offered inside and outside groups."""
from types import SimpleNamespace

from telegram import Chat, InlineQueryResultArticle, InlineQueryResultGame

from ww3bot import config, games, inline


def query(text: str, chat_type: str = Chat.SENDER, language: str | None = "en"):
    return SimpleNamespace(id="q1", query=text, chat_type=chat_type, from_user=SimpleNamespace(language_code=language))


def test_search_matches_names_ids_and_both_languages():
    assert games.search_games("games Flamingo")[0]["id"] == "flamingo"
    assert games.search_games("Flamingo-Flug")[0]["id"] == "flamingo"
    assert games.search_games("getreide")[0]["id"] == "grain"
    assert games.search_games("BLOCK")[0]["id"] == "blocks"
    assert games.search_games("Flamingo Flight")[0]["id"] == "flamingo"
    assert games.search_games("there is no such game") == []


def test_empty_or_command_only_query_lists_every_game():
    assert games.search_games("") == games.GAMES
    assert games.search_games("  games  ") == games.GAMES


def test_results_limit():
    assert len(games.search_games("", 5)) == 5


async def test_group_inline_query_posts_a_telegram_game(bot):
    await inline.answer(bot, query("games flamingo", Chat.SUPERGROUP))

    method, args, kwargs = bot.calls[0]
    assert method == "answer_inline_query"
    assert args[0] == "q1" and kwargs["cache_time"] == 0
    assert len(args[1]) == 1
    result = args[1][0]
    assert isinstance(result, InlineQueryResultGame)
    assert result.game_short_name == "flamingo"


async def test_private_inline_query_opens_the_game_as_a_mini_app(bot):
    await inline.answer(bot, query("flamingo", Chat.SENDER, "de"))

    method, args, _ = bot.calls[0]
    assert method == "answer_inline_query"
    result = args[1][0]
    assert isinstance(result, InlineQueryResultArticle)
    assert result.title == "Flamingo-Flug"
    button = result.reply_markup.inline_keyboard[0][0]
    assert button.web_app.url == f"{config.APP_URL}/play/flamingo"


async def test_empty_query_offers_the_whole_collection(bot):
    await inline.answer(bot, query("games"))
    assert len(bot.calls[0][1][1]) == len(games.GAMES)


async def test_no_match_offers_no_results(bot):
    await inline.answer(bot, query("not a game"))
    assert bot.calls[0][1][1] == []

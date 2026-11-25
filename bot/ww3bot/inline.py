"""
Inline mode: typing "@game_ww3_bot games Flamingo" in any chat searches the games and offers the
matches without leaving the chat. In a group a result posts a Telegram game with that chat's
scoreboard, just like /games; elsewhere it posts a message with a Mini App button that opens the
game with the player's Telegram account. Inline mode itself is switched on for the bot at @BotFather.
"""
from typing import Final

from telegram import (
    Bot,
    Chat,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InlineQuery,
    InlineQueryResultArticle,
    InlineQueryResultGame,
    InlineQueryResult,
    InputTextMessageContent,
    WebAppInfo,
)

from ww3bot import config, games
from ww3bot.texts import lang_of_user, t

# Telegram accepts at most 50 inline results
MAX_RESULTS: Final[int] = 50

GROUP_CHATS: Final[tuple[str, ...]] = (Chat.GROUP, Chat.SUPERGROUP)


def _group_game_result(entry: dict[str, str]) -> InlineQueryResultGame:
    """A Telegram game; pressing Play goes through the same session flow as a /games message."""
    return InlineQueryResultGame(id=entry["id"], game_short_name=entry["id"])


def _play_result(entry: dict[str, str], lang: str) -> InlineQueryResult:
    """A message with a button that opens the game as a Mini App, for chats without game boards."""
    name = games.game_name(entry["id"], lang)
    url = f"{config.APP_URL}/play/{entry['id']}"
    button = InlineKeyboardButton(t(lang, "inline_play"), web_app=WebAppInfo(url))
    return InlineQueryResultArticle(
        id=entry["id"],
        title=name,
        description=t(lang, "inline_description"),
        input_message_content=InputTextMessageContent(t(lang, "inline_message", game=name)),
        reply_markup=InlineKeyboardMarkup([[button]]),
    )


async def answer(bot: Bot, query: InlineQuery) -> None:
    """Answers one inline query with the matching games, best matches first."""
    lang = lang_of_user(query.from_user)
    entries = games.search_games(query.query, MAX_RESULTS)
    if query.chat_type in GROUP_CHATS:
        results = [_group_game_result(entry) for entry in entries]
    elif config.APP_URL:
        results = [_play_result(entry, lang) for entry in entries]
    else:
        # No Mini App to open: a Telegram game still works in a group, and nowhere else
        results = [_group_game_result(entry) for entry in entries]
    await bot.answer_inline_query(query.id, results, cache_time=0)

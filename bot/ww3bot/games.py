"""
Group leaderboards through Telegram's gaming platform (https://core.telegram.org/bots/games). Each
mode is a game registered with @BotFather under its mode id; /games in a group posts one with
sendGame. Pressing Play stores a session (player, chat, message, game) and opens the game page with
the session id in its URL; Telegram opens a game's URL in its own browser, without the Mini App's
initData, so the id (128 random bits, given only to the player who pressed Play, valid for a day) is
what proves who plays. At the end of a run the game sends the score back with it, and setGameScore
puts it on that chat's scoreboard: Telegram keeps one table per chat and posts its own message on
every new personal best. The bot keeps a copy of the bests for /top and announces when someone takes
the record.
"""
import logging
import re
import secrets
from typing import Final

from telegram import Bot
from telegram.error import BadRequest, TelegramError

from ww3bot import config, db

logger = logging.getLogger(__name__)

# The modes offered as Telegram games: quick arcade runs that end on the game's shared result sheet
# with one score where higher is better (the only order Telegram ranks by), and no levels or
# variants that would mix on one board. The id is both the game's short name at @BotFather and its
# route in the game (/play/<id>); GROUP_GAME_ROUTES in the game's src/lib/services/telegram.ts must
# list the same ids.
GAMES: Final[list[dict[str, str]]] = [
    {"id": "blocks", "en": "Block Puzzle", "de": "Block-Puzzle"},
    {"id": "convoy", "en": "Convoy Runner", "de": "Konvoi-Runner"},
    {"id": "merge", "en": "Merge Tankers", "de": "Tanker-Fusion"},
    {"id": "shootdown", "en": "Shahed Shootdown", "de": "Shahed-Abwehr"},
    {"id": "flamingo", "en": "Flamingo Flight", "de": "Flamingo-Flug"},
    {"id": "slice", "en": "Radar Slice", "de": "Radar-Slice"},
    {"id": "whack", "en": "Whack-a-Spokesperson", "de": "Hau den Sprecher"},
    {"id": "runcomrade", "en": "Run Comrade", "de": "Lauf, Genosse"},
    {"id": "dome", "en": "Iron Dome Juggler", "de": "Iron Dome Juggler"},
    {"id": "leakpatrol", "en": "Leak Patrol", "de": "Leck-Patrouille"},
    {"id": "killswitch", "en": "Starlink Kill Switch", "de": "Starlink-Notaus"},
    {"id": "veto", "en": "Security Council Veto", "de": "Sicherheitsrat-Veto"},
    {"id": "shuffle", "en": "Shadow Fleet Shuffle", "de": "Schattenflotten-Hütchenspiel"},
    {"id": "centrifuge", "en": "Centrifuge Spin", "de": "Zentrifugen-Spin"},
    {"id": "rareearth", "en": "Rare Earth Squeeze", "de": "Seltene-Erden-Engpass"},
    {"id": "balloon", "en": "Wandering Balloon", "de": "Wanderballon"},
    {"id": "grain", "en": "Grain Corridor", "de": "Getreidekorridor"},
]

# A session is good for a day of rounds
SESSION_TTL: Final[int] = 24 * 3600
# Telegram's scores are 32-bit integers; anything above this is not a real run
MAX_SCORE: Final[int] = 2**31 - 1
# Lines in /top
TOP_LIMIT: Final[int] = 10


class GameScoreError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def find_game(game_id) -> dict | None:
    return next((entry for entry in GAMES if entry["id"] == game_id), None)


def game_name(game_id: str, lang: str) -> str:
    entry = find_game(game_id)
    return (entry.get(lang) or entry["en"]) if entry else game_id


def session_link(game: str, session: str) -> str | None:
    """The game page a Play press opens, with the session its scores are reported with."""
    return f"{config.APP_URL}/play/{game}?game_session={session}" if config.APP_URL else None


async def open_session(user, game: str, chat_id: int, message_id: int) -> str:
    """Remembers who pressed Play on which game message; returns the session id."""
    session = secrets.token_hex(16)
    now = db.now()
    await db.execute("DELETE FROM game_sessions WHERE created_at < %s", (now - SESSION_TTL,))
    await db.execute(
        """
        INSERT INTO game_sessions (id, user_id, first_name, language, game, chat_id, message_id, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (session, user.id, user.first_name or "", getattr(user, "language_code", None), game, chat_id, message_id, now),
    )
    return session


async def _live_session(data: dict) -> dict:
    session, game = data.get("session"), data.get("game")
    if not isinstance(session, str) or not re.fullmatch(r"[0-9a-f]{32}", session) or not find_game(game):
        raise GameScoreError("INVALID_INPUT", "Unknown game or session.")
    row = await db.fetchone("SELECT * FROM game_sessions WHERE id = %s", (session,))
    if not row or row["game"] != game:
        raise GameScoreError("SESSION_UNKNOWN", "This game was not opened from a chat.")
    if db.now() - row["created_at"] > SESSION_TTL:
        raise GameScoreError("SESSION_EXPIRED", "Open the game from the chat again.")
    return {
        "user_id": row["user_id"],
        "first_name": row["first_name"] or "",
        "language": row["language"],
        "game": game,
        "chat_id": row["chat_id"],
        "message_id": row["message_id"],
    }


def _not_modified(error: Exception) -> bool:
    return isinstance(error, BadRequest) and "bot_score_not_modified" in str(error).lower()


async def report_score(bot: Bot, data: dict) -> dict:
    """
    Puts a finished run on the scoreboard of the chat the game was opened from. Returns whether it
    was a new personal best there, the best, the rank in that chat, the chat's leaderboard around the
    player for the result screen, the strongest other player the run overtook (for the result
    screen's animation), and, when the run took the chat's record from someone else, who held it
    before (the caller announces that).
    """
    session = await _live_session(data)
    score = data.get("score")
    if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= MAX_SCORE:
        raise GameScoreError("INVALID_INPUT", "The score must be a whole number.")
    result = await _set_score(bot, session, score)
    return {**result, "session": session, "leaderboard": await _leaderboard(bot, session)}


async def _set_score(bot: Bot, session: dict, score: int) -> dict:
    chat_id, game, user_id = session["chat_id"], session["game"], session["user_id"]
    mine = await db.fetchone(
        "SELECT score FROM group_scores WHERE chat_id = %s AND game = %s AND user_id = %s", (chat_id, game, user_id)
    )
    if mine and score <= mine["score"]:
        return {"new_best": False, "best": mine["score"], "rank": await _rank(chat_id, game, mine["score"]), "overtook": None, "overtaken": None}

    try:
        await bot.set_game_score(user_id, score, chat_id=chat_id, message_id=session["message_id"])
    except TelegramError as error:
        # Telegram already holds a better score for this player (one we never saw); keep ours as it is
        if _not_modified(error):
            return {"new_best": False, "best": mine["score"] if mine else None, "rank": None, "overtook": None, "overtaken": None}
        raise

    record = await db.fetchone(
        """
        SELECT user_id, first_name, score FROM group_scores WHERE chat_id = %s AND game = %s
        ORDER BY score DESC, updated_at ASC LIMIT 1
        """,
        (chat_id, game),
    )
    # The strongest other player whose best this run beat and who was not already behind the
    # player's previous best: the one the result sheet shows the player rushing past
    passed = await db.fetchone(
        """
        SELECT first_name, score FROM group_scores
        WHERE chat_id = %s AND game = %s AND user_id <> %s AND score < %s AND score >= %s
        ORDER BY score DESC, updated_at ASC LIMIT 1
        """,
        (chat_id, game, user_id, score, mine["score"] if mine else -1),
    )
    await db.execute(
        """
        INSERT INTO group_scores (chat_id, game, user_id, first_name, score, updated_at) VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (chat_id, game, user_id) DO UPDATE SET
            score = excluded.score, first_name = excluded.first_name, updated_at = excluded.updated_at
        WHERE excluded.score > group_scores.score
        """,
        (chat_id, game, user_id, session["first_name"], score, db.now()),
    )
    overtook = None
    if record and record["user_id"] != user_id and score > record["score"]:
        overtook = {"name": record["first_name"], "score": record["score"]}
    return {
        "new_best": True,
        "best": score,
        "rank": await _rank(chat_id, game, score),
        "overtook": overtook,
        "overtaken": {"name": passed["first_name"], "score": passed["score"]} if passed else None,
    }


async def _leaderboard(bot: Bot, session: dict) -> list[dict]:
    """
    The chat's leaderboard as Telegram keeps it (getGameHighScores: the player, two neighbours on
    each side, and the top three), with the player marked; the bot's own copy when Telegram cannot
    answer.
    """
    user_id = session["user_id"]
    try:
        rows = await bot.get_game_high_scores(user_id, chat_id=session["chat_id"], message_id=session["message_id"])
        return [
            {
                "position": row.position,
                "name": " ".join(part for part in (row.user.first_name, row.user.last_name) if part),
                "score": row.score,
                "me": row.user.id == user_id,
            }
            for row in rows
        ]
    except TelegramError as error:
        logger.warning("getGameHighScores failed in %s: %s", session["chat_id"], error)
        rows = await db.fetchall(
            """
            SELECT user_id, first_name, score FROM group_scores WHERE chat_id = %s AND game = %s
            ORDER BY score DESC, updated_at ASC LIMIT %s
            """,
            (session["chat_id"], session["game"], TOP_LIMIT),
        )
        return [
            {"position": i + 1, "name": row["first_name"], "score": row["score"], "me": row["user_id"] == user_id}
            for i, row in enumerate(rows)
        ]


async def _rank(chat_id: int, game: str, score: int) -> int:
    row = await db.fetchone(
        "SELECT COUNT(*) AS better FROM group_scores WHERE chat_id = %s AND game = %s AND score > %s", (chat_id, game, score)
    )
    return int(row["better"]) + 1


async def top_scores(chat_id: int, game: str, limit: int = TOP_LIMIT) -> list[dict]:
    """The chat's best players in one game, best first."""
    return await db.fetchall(
        """
        SELECT first_name AS name, score FROM group_scores WHERE chat_id = %s AND game = %s
        ORDER BY score DESC, updated_at ASC LIMIT %s
        """,
        (chat_id, game, limit),
    )


async def chat_records(chat_id: int) -> list[dict]:
    """The record of every game played in the chat, with its holder, most played first."""
    return await db.fetchall(
        """
        SELECT game, COUNT(*) AS players, MAX(score) AS score,
            (SELECT first_name FROM group_scores AS best WHERE best.chat_id = scores.chat_id AND best.game = scores.game
             ORDER BY best.score DESC, best.updated_at ASC LIMIT 1) AS name
        FROM group_scores AS scores WHERE chat_id = %s
        GROUP BY chat_id, game ORDER BY players DESC, game ASC
        """,
        (chat_id,),
    )

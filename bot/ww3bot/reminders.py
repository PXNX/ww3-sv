"""
Streak reminders: the game reports when the player's daily-reward streak breaks, and two hours
before that the bot sends one message, unless the player muted reminders. Claiming a deadline is a
single conditional UPDATE, so two runs of the job never send the same reminder twice.
"""
import logging
from typing import Final

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.error import Forbidden, TelegramError

from ww3bot import config, db
from ww3bot.texts import lang_of, t

logger = logging.getLogger(__name__)

REMIND_BEFORE: Final[int] = 2 * 3600
# A reminder this close to the deadline is skipped (the job was down); it would only annoy
TOO_LATE: Final[int] = 10 * 60
# The game reports deadlines at most this far ahead (tomorrow's midnight plus time zones)
MAX_AHEAD: Final[int] = 3 * 24 * 3600


class StreakInputError(ValueError):
    pass


def _whole(value) -> int | None:
    """An integer from JSON (not a bool, not a fraction), or None."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


async def report_streak(user, data: dict) -> dict:
    """Stores what the game reported; a streak of 0 or no deadline clears the reminder."""
    streak = _whole(data.get("streak"))
    raw_expiry = data.get("expires_at")
    expires_at = None if raw_expiry is None else _whole(raw_expiry)
    if streak is None or not 0 <= streak <= 100000:
        raise StreakInputError("Invalid streak")
    if raw_expiry is not None and (expires_at is None or expires_at > db.now() + MAX_AHEAD):
        raise StreakInputError("Invalid deadline")
    deadline = expires_at if streak > 0 else None
    await db.execute(
        """
        INSERT INTO streaks (user_id, streak, expires_at, language, updated_at) VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE SET
            streak = excluded.streak, expires_at = excluded.expires_at,
            language = excluded.language, updated_at = excluded.updated_at
        """,
        (user.id, streak, deadline, lang_of(getattr(user, "language_code", None)), db.now()),
    )
    # write_access: the Mini App just got the player's permission to message them
    if data.get("write_access") is True:
        await unblock(user.id)
    remind_at = deadline - REMIND_BEFORE if deadline is not None else None
    return {"reminder": remind_at if remind_at is not None and remind_at > db.now() else None}


async def set_muted(user_id: int, muted: bool) -> None:
    await db.execute(
        """
        INSERT INTO streaks (user_id, streak, expires_at, muted, updated_at) VALUES (%s, 0, NULL, %s, %s)
        ON CONFLICT (user_id) DO UPDATE SET muted = excluded.muted
        """,
        (user_id, muted, db.now()),
    )


async def unblock(user_id: int) -> None:
    """The player can be messaged again: they wrote to the bot or allowed messages in the Mini App."""
    await db.execute("UPDATE streaks SET blocked = false WHERE user_id = %s AND blocked", (user_id,))


async def is_muted(user_id: int) -> bool:
    row = await db.fetchone("SELECT muted FROM streaks WHERE user_id = %s", (user_id,))
    return bool(row and row["muted"])


async def send_due_reminders(bot: Bot) -> int:
    """Sends every reminder that is due now; returns how many went out."""
    now = db.now()
    due = await db.fetchall(
        """
        SELECT user_id, streak, expires_at, language FROM streaks
        WHERE NOT muted AND NOT blocked AND expires_at IS NOT NULL
          AND expires_at - %(before)s <= %(now)s AND expires_at - %(late)s > %(now)s
          AND reminded_for <> expires_at
        """,
        {"before": REMIND_BEFORE, "late": TOO_LATE, "now": now},
    )
    sent = 0
    for row in due:
        claimed = await db.execute(
            """
            UPDATE streaks SET reminded_for = expires_at
            WHERE user_id = %s AND expires_at = %s AND reminded_for <> expires_at
            """,
            (row["user_id"], row["expires_at"]),
        )
        if claimed == 0:
            continue
        lang = row["language"]
        keyboard = [[InlineKeyboardButton(t(lang, "reminder_mute"), callback_data="reminders:off")]]
        if config.APP_URL:
            keyboard.insert(0, [InlineKeyboardButton(t(lang, "reminder_play"), web_app=WebAppInfo(config.APP_URL))])
        try:
            await bot.send_message(
                row["user_id"], t(lang, "reminder", streak=row["streak"]), reply_markup=InlineKeyboardMarkup(keyboard)
            )
            sent += 1
        except Forbidden as error:
            # The player never started the bot or blocked it; stop until they are reachable again
            logger.warning("streak reminder refused for %s: %s", row["user_id"], error)
            await db.execute("UPDATE streaks SET blocked = true WHERE user_id = %s", (row["user_id"],))
        except TelegramError as error:
            logger.warning("streak reminder failed for %s: %s", row["user_id"], error)
    return sent

"""
What the game calls: `me`, `invoice`, `spend`, `streak`, `friends` and `presence` from the Mini App
(with verified initData), and `gamescore` from a game page opened by a group's Play button (with its session id
instead, since Telegram's game browser has no initData).
"""
import logging
import re
from datetime import datetime, timezone
from types import SimpleNamespace

from telegram import Bot

from ww3bot import chat, friends as friendships, games, ledger, reminders
from ww3bot.catalogue import PRODUCTS, localized, product
from ww3bot.legal import CONSENT_TEXT, CONSENT_VERSION, page_url
from ww3bot.referrals import invite_stats
from ww3bot.texts import lang_of_user

logger = logging.getLogger(__name__)


class EndpointError(Exception):
    """A refusal the game can act on: answered with 400 and `parameters.code`."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.parameters = {"code": code}


def player(init_data: dict) -> SimpleNamespace:
    """The verified Telegram user of a Mini App launch, shaped like a telegram.User."""
    raw = init_data["user"]
    return SimpleNamespace(
        id=raw["id"],
        username=raw.get("username"),
        first_name=raw.get("first_name") or "",
        language_code=raw.get("language_code"),
        is_bot=bool(raw.get("is_bot")),
    )


async def me(bot: Bot, data: dict, init_data: dict) -> dict:
    """The signed-in player, the wallet, Pro, consent and the catalogue; this is also 'restore purchase'."""
    user = player(init_data)
    await ledger.upsert_account(user)
    current = await ledger.wallet(user.id)
    invite = await invite_stats(user.id)
    pro_until = current["pro_until"]
    return {
        "user": {"id": user.id, "username": user.username, "first_name": user.first_name},
        "wallet": {"revives": current["revives"]},
        "pro": current["pro"],
        "pro_until": datetime.fromtimestamp(pro_until, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z") if pro_until else None,
        "consented": await ledger.has_consent(user.id),
        "invite": {"link": invite["link"], "friends": invite["friends"], "cap": invite["cap"], "revives_per_friend": invite["per_friend"]},
        "consent": {"version": CONSENT_VERSION, "text": CONSENT_TEXT, "terms": page_url("agb"), "withdrawal": page_url("widerruf")},
        "catalogue": [
            {key: item[key] for key in ("sku", "title", "description", "stars", "revives", "subscription")} for item in PRODUCTS
        ],
    }


async def invoice(bot: Bot, data: dict, init_data: dict) -> dict:
    """`{ sku, consent }` → `{ url }` for Telegram.WebApp.openInvoice; goods come only with successful_payment."""
    user = player(init_data)
    entry = product(str(data.get("sku") or ""))
    if not entry:
        raise EndpointError("Unknown item", "UNKNOWN_SKU")
    item = localized(entry, lang_of_user(user))
    await ledger.upsert_account(user)
    if not await ledger.has_consent(user.id):
        if data.get("consent") is not True:
            raise EndpointError("Consent to immediate delivery is required", "CONSENT_REQUIRED")
        await ledger.record_consent(user.id, "mini_app")
    try:
        created = await ledger.create_invoice(bot, user.id, item)
    except ledger.LedgerError as error:
        raise EndpointError(str(error), error.code) from error
    return {"url": created["url"]}


async def spend(bot: Bot, data: dict, init_data: dict) -> dict:
    """`{ mode }` → the wallet after taking one bought revival token, so one purchase cannot be used twice."""
    user = player(init_data)
    mode = re.sub(r"[^a-z0-9_-]", "", str(data.get("mode") or "unknown"), flags=re.IGNORECASE)[:32] or "unknown"
    await ledger.upsert_account(user)
    after = await ledger.spend_revive(user.id, f"revive:{mode}")
    if not after:
        raise EndpointError("No revival tokens left", "NO_REVIVES")
    return {"wallet": {"revives": after["revives"]}, "pro": after["pro"]}


async def streak(bot: Bot, data: dict, init_data: dict) -> dict:
    """`{ streak, expires_at, write_access? }` → `{ reminder }`; the bot reminds two hours before the deadline."""
    user = player(init_data)
    await ledger.upsert_account(user)
    try:
        return await reminders.report_streak(user, data)
    except reminders.StreakInputError as error:
        raise EndpointError(str(error), "INVALID_INPUT") from error


async def friends(bot: Bot, data: dict, init_data: dict) -> dict:
    """`{}` → `{ friends }`: the players this one is friends with, and who of them is online."""
    user = player(init_data)
    return {"friends": await friendships.friends_of(user.id)}


async def presence(bot: Bot, data: dict, init_data: dict) -> dict:
    """`{ in_raid }` → `{}`: the app is open; friends see the player online for the next minute."""
    user = player(init_data)
    friendships.report_presence(user.id, data.get("in_raid") is True)
    return {}


async def gamescore(bot: Bot, data: dict, init_data: None) -> dict:
    """`{ session, game, score }` → `{ new_best, best, rank, overtaken, leaderboard }`; the session is the credential."""
    try:
        result = await games.report_score(bot, data)
    except games.GameScoreError as error:
        raise EndpointError(str(error), error.code) from error
    if result["overtook"]:
        try:
            await chat.announce_record(bot, result)
        except Exception as error:
            # The score is on the scoreboard either way; the bot may have been removed from the chat
            logger.warning("could not announce record in %s: %s", result["session"]["chat_id"], error)
    return {key: result[key] for key in ("new_best", "best", "rank", "overtaken", "leaderboard")}


ENDPOINTS = {"me": me, "invoice": invoice, "spend": spend, "streak": streak, "friends": friends, "presence": presence}
# Called by the game page of a Telegram game, which has a session id instead of initData
OPEN_ENDPOINTS = {"gamescore": gamescore}

"""
The updates the bot handles: messages (commands; in groups only the game commands; and
successful_payment, the only place goods are granted), callback queries (shop buttons, consent,
games and Play), pre-checkout queries, and the bot's own membership in a group.

Each on_* function takes the bot and the update's object, so tests can call them with a stand-in bot.
"""
import logging

from telegram import Bot, CallbackQuery, ChatMember, ChatMemberUpdated, Message, PreCheckoutQuery, Update
from telegram.ext import Application, CallbackQueryHandler, ChatMemberHandler, ContextTypes, MessageHandler, PreCheckoutQueryHandler, filters

from ww3bot import chat, config, ledger, reminders
from ww3bot.catalogue import CURRENCY, product
from ww3bot.legal import escape_html
from ww3bot.profile import BOT_NAME, apply_profile
from ww3bot.referrals import BOT_USERNAME
from ww3bot.texts import lang_of_user, t

logger = logging.getLogger(__name__)

LEGAL_COMMANDS = {
    "impressum": "impressum", "imprint": "impressum",
    "datenschutz": "datenschutz", "privacy": "datenschutz",
    "agb": "agb", "terms": "agb",
    "widerruf": "widerruf", "withdrawal": "widerruf",
}
GAME_COMMANDS = ("games", "game", "top", "leaderboard")

# An unpaid invoice older than this is refused at checkout
INVOICE_TTL = 24 * 3600


def parse_command(text: str | None) -> tuple[str, list[str]] | None:
    """`/top@game_ww3_bot convoy` → ("top", ["convoy"]); None for plain text or another bot's command."""
    if not text or not text.startswith("/"):
        return None
    head, *args = text.strip().split()
    command, _, target = head[1:].partition("@")
    if target and target.lower() != BOT_USERNAME.lower():
        return None
    return command.lower(), args


async def _paid(bot: Bot, message: Message) -> None:
    payment = message.successful_payment
    user = message.from_user
    # Renewals of a subscription carry the first invoice's payload, so the invoice row still matches
    invoice = await ledger.find_invoice(payment.invoice_payload)
    item = product(invoice["sku"]) if invoice else None
    if not invoice or not item or invoice["user_id"] != user.id or payment.currency != CURRENCY or payment.total_amount != item["stars"]:
        logger.error("unmatched payment %s from %s (%s)", payment.telegram_payment_charge_id, user.id, payment.invoice_payload)
        await chat.send(bot, message.chat.id, t(lang_of_user(user), "unmatched_payment"))
        await chat.notify_admins(bot, f"⚠️ Unmatched payment {escape_html(payment.telegram_payment_charge_id)} from {user.id}")
        return

    await ledger.upsert_account(user)
    booked = await ledger.book_payment(user.id, item, payment)
    if not booked["granted"]:
        logger.info("duplicate payment ignored: %s", payment.telegram_payment_charge_id)
        return
    logger.info("granted %s to %s (%s)", item["sku"], user.id, payment.telegram_payment_charge_id)
    await chat.confirm_purchase(bot, message.chat.id, user, item, payment, booked["pro_until"])
    username = f"@{escape_html(user.username)}, " if user.username else ""
    renewal = " – renewal" if payment.is_recurring and not payment.is_first_recurring else ""
    await chat.notify_admins(
        bot, f"⭐ {payment.total_amount} Stars: {escape_html(item['title'])} from {escape_html(user.first_name or '')} ({username}ID {user.id}){renewal}"
    )


async def _group_message(bot: Bot, message: Message) -> None:
    """In a group the bot only plays: /games, /game <id> and /top; /start there opens the games menu."""
    if not chat.is_group(message.chat):
        return
    parsed = parse_command(message.text)
    if not parsed:
        return
    command, args = parsed
    chat_id, user = message.chat.id, message.from_user
    game_id = args[0].lower() if args else None
    if command in ("start", "games"):
        await chat.games_menu(bot, chat_id, user)
    elif command == "game":
        await (chat.post_game(bot, chat_id, user, game_id) if game_id else chat.games_menu(bot, chat_id, user))
    elif command in ("top", "leaderboard"):
        await chat.show_top(bot, chat_id, user, game_id)


async def on_message(bot: Bot, message: Message) -> None:
    if message.successful_payment:
        return await _paid(bot, message)
    if message.chat.type != "private":
        return await _group_message(bot, message)
    user = message.from_user
    if user is None:
        return
    # Writing to the bot means it may message the player again
    await reminders.unblock(user.id)
    parsed = parse_command(message.text)
    if not parsed:
        return
    command, args = parsed
    chat_id = message.chat.id

    if command in LEGAL_COMMANDS:
        return await chat.send_legal(bot, chat_id, LEGAL_COMMANDS[command])
    # Games are played together, so the private chat only points to a group
    if command in GAME_COMMANDS:
        return await chat.group_only(bot, chat_id, user)
    if command == "start":
        await chat.start(bot, chat_id, user, args[0] if args else None)
    elif command == "login":
        await chat.login(bot, chat_id, user)
    elif command == "shop":
        await chat.shop(bot, chat_id, user)
    elif command == "buy":
        await (chat.offer(bot, chat_id, user, args[0]) if args else chat.shop(bot, chat_id, user))
    elif command == "wallet":
        await chat.show_wallet(bot, chat_id, user)
    elif command == "invite":
        await chat.invite(bot, chat_id, user)
    elif command == "paysupport":
        await chat.paysupport(bot, chat_id, user)
    elif command == "reminders":
        await chat.reminder_settings(bot, chat_id, user)
    elif command == "set_cmd" and user.id in config.ADMIN_IDS:
        # Admins only: it changes the bot's public profile
        errors = await apply_profile(bot)
        if errors:
            await chat.send(bot, chat_id, "⚠️ Not everything could be set:\n" + "\n".join(escape_html(e) for e in errors))
        else:
            await chat.send(bot, chat_id, f"✅ Profile photo, name (“{BOT_NAME}”), description, info, commands and menu button updated.")
    elif command == "stats" and user.id in config.ADMIN_IDS:
        numbers = await ledger.stats()
        await chat.send(
            bot, chat_id, f"Accounts: {numbers['accounts']}\nPurchases: {numbers['purchases']}\nStars: {numbers['stars']}\nPro active: {numbers['pro']}"
        )


async def on_callback(bot: Bot, query: CallbackQuery) -> None:
    # A Play button: answered with the game's link instead of the plain acknowledgement
    if query.game_short_name:
        return await chat.open_game(bot, query)

    data = query.data or ""
    message = query.message
    chat_id = message.chat.id if message else query.from_user.id
    action, _, value = data.partition(":")
    user = query.from_user
    # Games and leaderboards only in groups, even for a menu that was forwarded elsewhere
    if action in ("game", "top") and not chat.is_group(message.chat if message else None):
        return await bot.answer_callback_query(query.id, t(lang_of_user(user), "group_only_alert"), show_alert=True)
    await bot.answer_callback_query(query.id)

    if data == "shop":
        await chat.shop(bot, chat_id, user)
    elif data == "cancel" and message:
        await bot.edit_message_reply_markup(chat_id=chat_id, message_id=message.message_id)
    elif action == "buy":
        await chat.offer(bot, chat_id, user, value)
    elif action == "legal":
        await chat.send_legal(bot, chat_id, value)
    elif action == "reminders":
        await chat.toggle_reminders(bot, chat_id, user, value == "on", message.message_id if message else None)
    elif action == "game":
        await chat.post_game(bot, chat_id, user, value)
    elif action == "top":
        await chat.show_top(bot, chat_id, user, value)
    elif action == "consent":
        if message:
            await bot.edit_message_reply_markup(chat_id=chat_id, message_id=message.message_id)
        await chat.consent(bot, chat_id, user, value)


async def _refusal(query: PreCheckoutQuery) -> str | None:
    """The text key of the reason to refuse, or None to accept."""
    invoice = await ledger.find_invoice(query.invoice_payload)
    if not invoice:
        return "checkout_unknown"
    item = product(invoice["sku"])
    if not item or invoice["user_id"] != query.from_user.id or query.currency != CURRENCY or query.total_amount != item["stars"]:
        return "checkout_foreign"
    if ledger.db.now() - invoice["created_at"] > INVOICE_TTL:
        return "checkout_expired"
    if not await ledger.has_consent(query.from_user.id):
        return "checkout_consent"
    return None


async def on_pre_checkout(bot: Bot, query: PreCheckoutQuery) -> None:
    """Telegram cancels the order unless this answers within 10 seconds, so it only checks our own invoice row."""
    try:
        error = await _refusal(query)
    except Exception:
        logger.exception("pre-checkout check failed")
        error = "checkout_error"
    if error:
        await bot.answer_pre_checkout_query(query.id, ok=False, error_message=t(lang_of_user(query.from_user), error))
    else:
        await bot.answer_pre_checkout_query(query.id, ok=True)


PRESENT = (ChatMember.MEMBER, ChatMember.ADMINISTRATOR)


async def on_my_chat_member(bot: Bot, update: ChatMemberUpdated) -> None:
    """The bot's own membership changed; when it joins a group it explains /games and /top there."""
    if not chat.is_group(update.chat):
        return
    joined = update.new_chat_member.status in PRESENT and update.old_chat_member.status not in PRESENT
    if not joined:
        return
    try:
        await chat.welcome_group(bot, update.chat, update.from_user)
    except Exception as error:
        # A group where only admins may post; /games still works for them
        logger.warning("could not greet group %s: %s", update.chat.id, error)


async def _message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message:
        await on_message(context.bot, update.message)


async def _callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await on_callback(context.bot, update.callback_query)


async def _pre_checkout(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await on_pre_checkout(context.bot, update.pre_checkout_query)


async def _my_chat_member(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await on_my_chat_member(context.bot, update.my_chat_member)


async def _error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error("update failed: %s", update, exc_info=context.error)


def register_handlers(app: Application) -> None:
    app.add_handler(MessageHandler(filters.ALL & ~filters.UpdateType.EDITED, _message))
    app.add_handler(CallbackQueryHandler(_callback))
    app.add_handler(PreCheckoutQueryHandler(_pre_checkout))
    app.add_handler(ChatMemberHandler(_my_chat_member, ChatMemberHandler.MY_CHAT_MEMBER))
    app.add_error_handler(_error)


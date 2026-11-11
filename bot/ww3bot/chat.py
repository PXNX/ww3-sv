"""
The chat side of the bot: opening the game (which is the login: a Mini App session carries the
player's verified Telegram identity), the shop, the wallet, invites, streak reminders, the legal
pages, the purchase confirmation, and the games and leaderboards of a group. Every text comes from
texts.py, in German or English after the player's Telegram language.
"""
import logging
from datetime import datetime, timezone
from urllib.parse import quote

from telegram import Bot, CallbackQuery, Chat, InlineKeyboardButton, InlineKeyboardMarkup, LinkPreviewOptions, WebAppInfo
from telegram.constants import ParseMode
from telegram.error import TelegramError

from ww3bot import config, friends, games, ledger, referrals, reminders
from ww3bot.catalogue import PRODUCTS, localized, product
from ww3bot.legal import CONSENT_TEXT, CONSENT_VERSION, PAGES, escape_html, legal_messages, page_url
from ww3bot.texts import lang_of_user, t

logger = logging.getLogger(__name__)

MEDALS = ["🥇", "🥈", "🥉"]


async def send(bot: Bot, chat_id: int, text: str, keyboard: list[list[InlineKeyboardButton]] | None = None):
    rows = [row for row in keyboard or [] if row]
    return await bot.send_message(
        chat_id,
        text,
        parse_mode=ParseMode.HTML,
        link_preview_options=LinkPreviewOptions(is_disabled=True),
        reply_markup=InlineKeyboardMarkup(rows) if rows else None,
    )


def play_button(label: str, path: str = "") -> list[InlineKeyboardButton]:
    return [InlineKeyboardButton(label, web_app=WebAppInfo(f"{config.APP_URL}/{path}"))] if config.APP_URL else []


def format_date(seconds: int) -> str:
    return datetime.fromtimestamp(seconds, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def is_group(chat: Chat | None) -> bool:
    """Games and leaderboards are played together, so only in groups; never in private chats or channels."""
    return chat is not None and chat.type in (Chat.GROUP, Chat.SUPERGROUP)


async def start(bot: Bot, chat_id: int, user, param: str | None) -> None:
    lang = lang_of_user(user)
    # Before the account is written: only a player new to the bot earns the inviter a reward
    referrer = referrals.parse_invite(param)
    invited = await referrals.record_referral(referrer, user) if referrer else False
    if invited:
        await thank_referrer(bot, referrer)
    await ledger.upsert_account(user)
    # Friends either way, also when the invitee played before or the inviter is past the reward cap
    await friends.befriend(referrer, user)
    if invited:
        await send(bot, chat_id, t(lang, "invited"))
    if param == "shop":
        return await shop(bot, chat_id, user)
    await send(
        bot,
        chat_id,
        t(lang, "start", name=escape_html(user.first_name or "")),
        [play_button(t(lang, "open_app")), [InlineKeyboardButton(t(lang, "shop_button"), callback_data="shop")]],
    )


async def login(bot: Bot, chat_id: int, user) -> None:
    lang = lang_of_user(user)
    await ledger.upsert_account(user)
    if not config.APP_URL:
        return await send(bot, chat_id, t(lang, "not_deployed"))
    await send(bot, chat_id, t(lang, "login"), [play_button(t(lang, "open_profile"), "profile")])


async def shop(bot: Bot, chat_id: int, user) -> None:
    lang = lang_of_user(user)
    buttons = []
    for entry in PRODUCTS:
        item = localized(entry, lang)
        buttons.append([InlineKeyboardButton(f"{item['title']} · {item['stars']} ⭐", callback_data=f"buy:{item['sku']}")])
    await send(bot, chat_id, t(lang, "shop"), buttons)


async def show_wallet(bot: Bot, chat_id: int, user) -> None:
    lang = lang_of_user(user)
    await ledger.upsert_account(user)
    current = await ledger.wallet(user.id)
    pro = t(lang, "pro_active", date=format_date(current["pro_until"])) if current["pro"] else t(lang, "pro_none")
    await send(bot, chat_id, t(lang, "wallet", revives=current["revives"], pro=pro))


def _legal_buttons() -> list[InlineKeyboardButton]:
    return [
        InlineKeyboardButton(PAGES[page], url=page_url(page)) if page_url(page) else InlineKeyboardButton(PAGES[page], callback_data=f"legal:{page}")
        for page in ("agb", "widerruf")
    ]


async def offer(bot: Bot, chat_id: int, user, sku: str) -> None:
    """Sends the invoice, after asking for consent if the current terms were not agreed to yet."""
    lang = lang_of_user(user)
    entry = product(sku)
    if not entry:
        return await shop(bot, chat_id, user)
    item = localized(entry, lang)
    await ledger.upsert_account(user)
    if not config.SALES_OPEN:
        return await send(bot, chat_id, t(lang, "sales_closed"))

    if not await ledger.has_consent(user.id):
        return await send(
            bot,
            chat_id,
            f"<b>{escape_html(item['title'])} · {item['stars']} ⭐</b>\n{escape_html(item['description'])}\n\n<i>{escape_html(CONSENT_TEXT)}</i>",
            [
                [InlineKeyboardButton(t(lang, "agree"), callback_data=f"consent:{item['sku']}")],
                _legal_buttons(),
                [InlineKeyboardButton(t(lang, "cancel"), callback_data="cancel")],
            ],
        )

    invoice = await ledger.create_invoice(bot, user.id, item)
    label = t(lang, "subscribe" if item["subscription"] else "pay", stars=item["stars"])
    text = f"<b>{escape_html(item['title'])}</b>\n{escape_html(item['description'])}"
    if item["subscription"]:
        text += f"\n{t(lang, 'cancel_hint')}"
    await send(bot, chat_id, text, [[InlineKeyboardButton(label, url=invoice["url"])]])


async def consent(bot: Bot, chat_id: int, user, sku: str) -> None:
    await ledger.upsert_account(user)
    await ledger.record_consent(user.id, "bot")
    await offer(bot, chat_id, user, sku)


async def send_legal(bot: Bot, chat_id: int, page: str) -> None:
    if page not in PAGES:
        return
    for text in legal_messages(page):
        await send(bot, chat_id, text)


async def confirm_purchase(bot: Bot, chat_id: int, user, entry: dict, payment, pro_until: int | None) -> None:
    """The confirmation on a durable medium (§ 312f Abs. 3 BGB), including the consent given."""
    lang = lang_of_user(user)
    item = localized(entry, lang)
    grants = [t(lang, "grant_revives", count=item["revives"])]
    if pro_until:
        grants.append(t(lang, "grant_pro", date=format_date(pro_until)))
    operator = config.OPERATOR
    await send(
        bot,
        chat_id,
        t(
            lang,
            "confirmation",
            title=escape_html(item["title"]),
            stars=payment.total_amount,
            period=t(lang, "every_30_days") if item["subscription"] else "",
            date=format_date(int(datetime.now(timezone.utc).timestamp())),
            charge=escape_html(payment.telegram_payment_charge_id),
            operator=f"{escape_html(operator.get('name', ''))}, {escape_html(operator.get('email', ''))}",
            grants=", ".join(grants),
            version=CONSENT_VERSION,
            consent=escape_html(CONSENT_TEXT),
        ),
        [play_button(t(lang, "back_to_game"))],
    )


async def paysupport(bot: Bot, chat_id: int, user) -> None:
    await send(bot, chat_id, t(lang_of_user(user), "paysupport", email=escape_html(config.OPERATOR.get("email", ""))))


async def notify_admins(bot: Bot, text: str) -> None:
    for admin in config.ADMIN_IDS:
        try:
            await send(bot, admin, text)
        except TelegramError as error:
            logger.warning("could not notify admin %s: %s", admin, error)


def _reminder_keyboard(lang: str, muted: bool) -> InlineKeyboardMarkup:
    button = (
        InlineKeyboardButton(t(lang, "reminder_unmute"), callback_data="reminders:on")
        if muted
        else InlineKeyboardButton(t(lang, "reminder_mute"), callback_data="reminders:off")
    )
    return InlineKeyboardMarkup([[button]])


async def reminder_settings(bot: Bot, chat_id: int, user) -> None:
    """/reminders: whether streak reminders are on, with a button to switch."""
    lang = lang_of_user(user)
    muted = await reminders.is_muted(user.id)
    await bot.send_message(chat_id, t(lang, "reminders_off" if muted else "reminders_on"), reply_markup=_reminder_keyboard(lang, muted))


async def toggle_reminders(bot: Bot, chat_id: int, user, on: bool, message_id: int | None) -> None:
    """The reminder's and /reminders' button; edits the message in place so the button flips."""
    await reminders.set_muted(user.id, not on)
    lang = lang_of_user(user)
    text = t(lang, "reminders_on" if on else "reminders_off")
    if message_id is not None:
        try:
            await bot.edit_message_text(text, chat_id=chat_id, message_id=message_id, reply_markup=_reminder_keyboard(lang, not on))
            return
        except TelegramError:
            # The reminder itself may be too old to edit; answer with a new message instead
            pass
    await bot.send_message(chat_id, text, reply_markup=_reminder_keyboard(lang, not on))


async def invite(bot: Bot, chat_id: int, user) -> None:
    """/invite: the player's link, what it earned so far, and a button to share it."""
    lang = lang_of_user(user)
    await ledger.upsert_account(user)
    stats = await referrals.invite_stats(user.id)
    left = max(0, stats["cap"] - stats["friends"])
    share = f"https://t.me/share/url?url={quote(stats['link'], safe='')}&text={quote(t(lang, 'invite_share_text'), safe='')}"
    await send(
        bot,
        chat_id,
        t(
            lang,
            "invite",
            perFriend=stats["per_friend"],
            cap=stats["cap"],
            link=escape_html(stats["link"]),
            friends=stats["friends"],
            left=t(lang, "invite_all") if left == 0 else t(lang, "invite_left", left=left),
        ),
        [[InlineKeyboardButton(t(lang, "invite_share"), url=share)]],
    )


async def thank_referrer(bot: Bot, referrer_id: int) -> None:
    stats = await referrals.invite_stats(referrer_id)
    lang = await ledger.account_language(referrer_id)
    try:
        await send(bot, referrer_id, t(lang, "referral_thanks", perFriend=stats["per_friend"], friends=stats["friends"], cap=stats["cap"]))
    except TelegramError as error:
        # The inviter may have blocked the bot; the token is booked either way
        logger.warning("could not thank referrer %s: %s", referrer_id, error)


async def group_only(bot: Bot, chat_id: int, user) -> None:
    """A game command in the private chat: points to a group, with a button that adds the bot to one."""
    lang = lang_of_user(user)
    await send(
        bot,
        chat_id,
        t(lang, "group_only"),
        [[InlineKeyboardButton(t(lang, "add_to_group"), url=f"https://t.me/{referrals.BOT_USERNAME}?startgroup=games")]],
    )


def _game_keyboard(lang: str) -> list[list[InlineKeyboardButton]]:
    # Two games per row keeps the menu short enough to scroll
    buttons = [InlineKeyboardButton(games.game_name(entry["id"], lang), callback_data=f"game:{entry['id']}") for entry in games.GAMES]
    return [buttons[i : i + 2] for i in range(0, len(buttons), 2)]


async def games_menu(bot: Bot, chat_id: int, user) -> None:
    """/games: a button per game; pressing one posts that game to the chat."""
    lang = lang_of_user(user)
    await send(bot, chat_id, t(lang, "games_menu"), _game_keyboard(lang))


async def post_game(bot: Bot, chat_id: int, user, game_id: str) -> None:
    """Posts a game message; Telegram shows the chat's scoreboard on it and posts each new best."""
    lang = lang_of_user(user)
    if not games.find_game(game_id):
        return await games_menu(bot, chat_id, user)
    try:
        # Telegram adds its own Play button, and the message shows the chat's scoreboard itself
        await bot.send_game(chat_id, game_id)
    except TelegramError as error:
        # Not registered with @BotFather under this short name (yet)
        logger.warning("sendGame failed for %s: %s", game_id, error)
        await send(bot, chat_id, t(lang, "game_missing", game=escape_html(games.game_name(game_id, lang))))


async def open_game(bot: Bot, query: CallbackQuery) -> None:
    """
    A press on a game message's Play button. The answer opens the game page in Telegram's game
    browser, with a session that ties the scores to the chat and the message the button belongs to.
    (A t.me startapp link here only flashes the browser open and shut instead of starting the Mini App.)
    """
    game_id = query.game_short_name
    lang = lang_of_user(query.from_user)
    message = query.message
    if not games.find_game(game_id) or message is None:
        return await bot.answer_callback_query(query.id, t(lang, "game_unavailable"), show_alert=True)
    # A game message forwarded into a private chat: its scores would have no group to count for
    if not is_group(message.chat):
        return await bot.answer_callback_query(query.id, t(lang, "group_only_alert"), show_alert=True)
    if not config.APP_URL:
        return await bot.answer_callback_query(query.id, t(lang, "not_deployed"), show_alert=True)
    session = await games.open_session(query.from_user, game_id, message.chat.id, message.message_id)
    await bot.answer_callback_query(query.id, url=games.session_link(game_id, session))


async def show_top(bot: Bot, chat_id: int, user, game_id: str | None) -> None:
    """/top <game>: the chat's leaderboard of one game; /top alone: the record of every game played."""
    lang = lang_of_user(user)
    if games.find_game(game_id):
        name = escape_html(games.game_name(game_id, lang))
        rows = await games.top_scores(chat_id, game_id)
        if not rows:
            return await send(bot, chat_id, t(lang, "top_empty", game=name))
        lines = [f"{MEDALS[i] if i < len(MEDALS) else f'{i + 1}.'} {escape_html(row['name'])} – {row['score']}" for i, row in enumerate(rows)]
        return await send(bot, chat_id, t(lang, "top", game=name, lines="\n".join(lines)))
    records = await games.chat_records(chat_id)
    if not records:
        return await send(bot, chat_id, t(lang, "records_none"))
    lines = [f"{escape_html(games.game_name(row['game'], lang))}: {row['score']} – {escape_html(row['name'])}" for row in records]
    await send(bot, chat_id, t(lang, "records", lines="\n".join(lines), example=records[0]["game"]))


async def welcome_group(bot: Bot, chat: Chat, user) -> None:
    """The bot was added to a group: say what it does there."""
    lang = lang_of_user(user)
    await send(bot, chat.id, t(lang, "group_welcome", title=escape_html(chat.title or "")), _game_keyboard(lang))


async def announce_record(bot: Bot, result: dict) -> None:
    """Tells the chat that a player took its record in a game from someone else."""
    session = result["session"]
    lang = "de" if str(session["language"] or "").lower().startswith("de") else "en"
    await send(
        bot,
        session["chat_id"],
        t(
            lang,
            "record",
            game=escape_html(games.game_name(session["game"], lang)),
            name=escape_html(session["first_name"]),
            score=result["best"],
            previous=escape_html(result["overtook"]["name"]),
            previousScore=result["overtook"]["score"],
        ),
    )

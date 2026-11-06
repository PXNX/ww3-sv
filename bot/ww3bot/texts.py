"""
Every text the bot sends: German for German Telegram users, English for everyone else. {name}
placeholders are filled by t(); values are inserted as given, so callers escape anything that comes
from a user. The legal texts themselves (AGB, Widerrufsbelehrung, consent wording) stay German only,
as the binding versions.
"""
import re
from typing import Final

from ww3bot.legal import page_url

TEXTS: Final[dict[str, dict[str, str]]] = {
    "de": {
        "start": (
            "👋 <b>Willkommen bei World War 3, {name}!</b>\n\n"
            "Satirische Cartoon-Spiele über Öl, Schifffahrt und Geopolitik, direkt hier in Telegram. "
            "In Telegram bist du automatisch mit deinem Konto angemeldet, gekaufte Revival-Token und Pro gelten auf jedem Gerät.\n\n"
            "🛒 /shop – Revival-Token und Pro\n"
            "❤️ /wallet – deine Käufe\n"
            "📨 /invite – Freunde einladen, Revival-Token verdienen\n"
            "🔔 /reminders – Serien-Erinnerungen an oder aus\n"
            "🧾 /paysupport – Hilfe zu Käufen\n"
            "👥 Füge mich einer Gruppe hinzu und sende dort /games: jedes Spiel bekommt eine eigene Bestenliste nur für eure Gruppe.\n\n"
            "{footer}"
        ),
        "invited": "🎉 Ein Freund hat dich eingeladen – schön, dass du da bist!",
        "open_app": "🎮 World War 3 spielen",
        "open_profile": "🎮 Anmelden und spielen",
        "back_to_game": "🎮 Zurück zum Spiel",
        "shop_button": "🛒 Nachschublager",
        "not_deployed": "Das Spiel ist noch nicht online.",
        "login": "Tippe unten, um World War 3 mit deinem Telegram-Konto zu öffnen. Auf deiner Profilseite siehst du, als wer du angemeldet bist.",
        "shop": (
            "🛒 <b>Nachschublager</b>\n\n"
            "Preise in Telegram Stars. Gekaufte Revival-Token werden sofort deinem Telegram-Konto gutgeschrieben "
            "und gelten im Spiel in Telegram.\n\n{footer}"
        ),
        "wallet": "❤️ <b>Deine Käufe</b>\n{revives} Revival-Token\n⭐ Pro: {pro}",
        "pro_active": "aktiv bis {date}",
        "pro_none": "nicht aktiv",
        "sales_closed": "Käufe sind bald möglich. Bis dahin ist jedes Spiel kostenlos spielbar.",
        "agree": "✅ Zustimmen und weiter",
        "cancel": "Abbrechen",
        "pay": "{stars} ⭐ bezahlen",
        "subscribe": "Abonnieren · {stars} ⭐ / 30 Tage",
        "cancel_hint": "Kündigen jederzeit in Telegram: Einstellungen › Meine Stars › Abonnements.",
        "paysupport": (
            "🧾 <b>Hilfe zu Käufen</b>\n\n"
            "Schreib uns an {email} mit der Zahlungs-ID aus deiner Kaufbestätigung. Telegram selbst kann bei Käufen in diesem Bot nicht helfen.\n\n"
            "Gekaufte Inhalte werden <b>nicht erstattet</b>; deine gesetzlichen Rechte (Widerruf, Gewährleistung) bleiben unberührt.\n\n{footer}"
        ),
        "unmatched_payment": "Deine Zahlung ist angekommen, konnte aber keinem Artikel zugeordnet werden. Wir kümmern uns darum: /paysupport",
        "checkout_unknown": "Diese Rechnung ist unbekannt. Bitte starte den Kauf neu.",
        "checkout_foreign": "Diese Rechnung gehört nicht zu deinem Konto.",
        "checkout_expired": "Diese Rechnung ist abgelaufen. Bitte starte den Kauf neu.",
        "checkout_consent": "Bitte stimme zuerst den Bedingungen zu: /shop",
        "checkout_error": "Etwas ist schiefgelaufen. Bitte versuch es gleich noch einmal.",
        "confirmation": (
            "<b>Kaufbestätigung</b>\n"
            "Artikel: {title}\n"
            "Preis: {stars} Telegram Stars{period}\n"
            "Datum: {date}\n"
            "Zahlungs-ID: <code>{charge}</code>\n"
            "Anbieter: {operator} (/impressum)\n\n"
            "Gutgeschrieben: {grants}\n\n"
            "Deine Zustimmung (Version {version}): <i>{consent}</i>\n\n{footer}"
        ),
        "every_30_days": " alle 30 Tage",
        "grant_revives": "❤️ {count} Revival-Token",
        "grant_pro": "⭐ Pro bis {date}",
        "invite": (
            "📨 <b>Freunde einladen</b>\n\n"
            "Für jeden Freund, der den Bot zum ersten Mal über deinen Link startet, bekommst du ❤️ {perFriend} Revival-Token (bis zu {cap} Freunde).\n\n"
            "Dein Link: {link}\n"
            "Bisher eingeladen: {friends}{left}"
        ),
        "invite_left": ", noch {left} Belohnungen offen",
        "invite_all": " (alle Belohnungen eingesammelt)",
        "invite_share": "📨 Link teilen",
        "invite_share_text": "Spiel mit mir World War 3: satirische Cartoon-Arcade-Spiele direkt in Telegram.",
        "referral_thanks": "🎉 Ein Freund hat World War 3 über deinen Einladungslink gestartet: +{perFriend} Revival-Token ❤️ ({friends} von {cap} Freunden). /wallet",
        "reminder": "🔥 Deine Serie von {streak} Tagen endet in etwa 2 Stunden. Schließe die heutige Herausforderung ab, um deine tägliche Belohnung zu holen und die Serie zu halten.",
        "reminder_play": "🎮 Herausforderung spielen",
        "reminder_mute": "🔕 Keine Serien-Erinnerungen",
        "reminder_unmute": "🔔 Erinnerungen einschalten",
        "reminders_off": "🔕 Serien-Erinnerungen sind aus. Mit /reminders schaltest du sie wieder ein.",
        "reminders_on": "🔔 Serien-Erinnerungen sind an: 2 Stunden bevor deine Serie endet, bekommst du eine Nachricht.",
        "group_welcome": (
            "👋 <b>World War 3 ist jetzt in {title}!</b>\n\n"
            "Mit /games postet ihr ein Spiel in die Gruppe. Jedes Spiel hat eine Bestenliste nur für diese Gruppe, und "
            "Telegram meldet hier jede neue Bestleistung. /top zeigt, wer vorne liegt."
        ),
        "games_menu": "🎮 <b>Welches Spiel?</b>\nJedes Spiel hat eine eigene Bestenliste für diesen Chat.",
        "game_missing": "{game} ist noch nicht als Telegram-Spiel eingerichtet.",
        "game_unavailable": "Dieses Spiel gibt es hier nicht. Hol dir mit /games ein neues.",
        "group_only": "👥 Gespielt wird zusammen: Spiele und Bestenlisten gibt es nur in Gruppen. Füge mich einer Gruppe hinzu und sende dort /games.",
        "group_only_alert": "Spiele und Bestenlisten gibt es nur in Gruppen. Füge mich einer Gruppe hinzu und sende dort /games.",
        "add_to_group": "👥 Zu einer Gruppe hinzufügen",
        "top": "🏆 <b>{game}</b> – Bestenliste dieses Chats\n\n{lines}",
        "top_empty": "In {game} hat in diesem Chat noch niemand gepunktet. /games",
        "records": "🏆 <b>Rekorde in diesem Chat</b>\n\n{lines}\n\nDie ganze Liste eines Spiels: /top {example}",
        "records_none": "In diesem Chat hat noch niemand gespielt. Los geht’s mit /games.",
        "record": "👑 <b>Neuer Rekord in {game}!</b> {name} holt {score} Punkte und überholt {previous} ({previousScore}).",
        "legal_footer": '<a href="{agb}">AGB</a> · <a href="{widerruf}">Widerruf</a> · <a href="{datenschutz}">Datenschutz</a> · <a href="{impressum}">Impressum</a>',
        "legal_footer_commands": "/agb · /widerruf · /datenschutz · /impressum",
    },
    "en": {
        "start": (
            "👋 <b>Welcome to World War 3, {name}!</b>\n\n"
            "Satirical cartoon games about oil, shipping and geopolitics, right here in Telegram. "
            "Inside Telegram you are signed in with your account, so bought revival tokens and Pro follow you to every device.\n\n"
            "🛒 /shop – revival tokens and Pro\n"
            "❤️ /wallet – what you bought\n"
            "📨 /invite – invite friends, earn revival tokens\n"
            "🔔 /reminders – streak reminders on or off\n"
            "🧾 /paysupport – help with purchases\n"
            "👥 Add me to a group and send /games there: every game gets a leaderboard of its own, just for your group.\n\n"
            "{footer}"
        ),
        "invited": "🎉 A friend invited you – great to have you here!",
        "open_app": "🎮 Play World War 3",
        "open_profile": "🎮 Log in and play",
        "back_to_game": "🎮 Back to the game",
        "shop_button": "🛒 Supply depot",
        "not_deployed": "The game is not online yet.",
        "login": "Tap below to open World War 3 signed in as your Telegram account. Your profile page shows who you are signed in as.",
        "shop": (
            "🛒 <b>Supply depot</b>\n\n"
            "Prices in Telegram Stars. Bought revival tokens are credited to your Telegram account right away "
            "and can be used in the game inside Telegram.\n\n{footer}"
        ),
        "wallet": "❤️ <b>What you bought</b>\n{revives} revival tokens\n⭐ Pro: {pro}",
        "pro_active": "active until {date}",
        "pro_none": "not active",
        "sales_closed": "Purchases open soon. Until then every game is free to play.",
        "agree": "✅ Agree and continue",
        "cancel": "Cancel",
        "pay": "Pay {stars} ⭐",
        "subscribe": "Subscribe · {stars} ⭐ / 30 days",
        "cancel_hint": "Cancel any time in Telegram: Settings › My Stars › Subscriptions.",
        "paysupport": (
            "🧾 <b>Help with purchases</b>\n\n"
            "Write to {email} with the payment ID from your purchase confirmation. Telegram itself cannot help with purchases in this bot.\n\n"
            "Bought items are <b>not refunded</b>; your statutory rights (withdrawal, warranty) are not affected.\n\n{footer}"
        ),
        "unmatched_payment": "Your payment arrived but could not be matched to an item. We will sort it out: /paysupport",
        "checkout_unknown": "This invoice is unknown. Please start the purchase again.",
        "checkout_foreign": "This invoice does not belong to your account.",
        "checkout_expired": "This invoice has expired. Please start the purchase again.",
        "checkout_consent": "Please agree to the terms first: /shop",
        "checkout_error": "Something went wrong. Please try again in a moment.",
        "confirmation": (
            "<b>Purchase confirmation</b>\n"
            "Item: {title}\n"
            "Price: {stars} Telegram Stars{period}\n"
            "Date: {date}\n"
            "Payment ID: <code>{charge}</code>\n"
            "Seller: {operator} (/impressum)\n\n"
            "Credited: {grants}\n\n"
            "Your consent (version {version}, German): <i>{consent}</i>\n\n{footer}"
        ),
        "every_30_days": " every 30 days",
        "grant_revives": "❤️ {count} revival tokens",
        "grant_pro": "⭐ Pro until {date}",
        "invite": (
            "📨 <b>Invite friends</b>\n\n"
            "For every friend who starts the bot for the first time with your link you get ❤️ {perFriend} revival token (up to {cap} friends).\n\n"
            "Your link: {link}\n"
            "Friends so far: {friends}{left}"
        ),
        "invite_left": ", {left} rewards left",
        "invite_all": " (all rewards collected)",
        "invite_share": "📨 Share your link",
        "invite_share_text": "Play World War 3 with me: satirical cartoon arcade games right inside Telegram.",
        "referral_thanks": "🎉 A friend started World War 3 with your invite link: +{perFriend} revival token ❤️ ({friends} of {cap} friends). /wallet",
        "reminder": "🔥 Your {streak}-day streak ends in about 2 hours. Finish today's challenge to collect your daily reward and keep it alive.",
        "reminder_play": "🎮 Play the challenge",
        "reminder_mute": "🔕 Stop streak reminders",
        "reminder_unmute": "🔔 Turn reminders on",
        "reminders_off": "🔕 Streak reminders are off. Turn them back on with /reminders.",
        "reminders_on": "🔔 Streak reminders are on: you get a message 2 hours before your streak ends.",
        "group_welcome": (
            "👋 <b>World War 3 is now in {title}!</b>\n\n"
            "Send /games to post a game to the group. Every game has a leaderboard for this group only, and "
            "Telegram posts every new high score here. /top shows who is ahead."
        ),
        "games_menu": "🎮 <b>Which game?</b>\nEvery game has a leaderboard of its own for this chat.",
        "game_missing": "{game} is not set up as a Telegram game yet.",
        "game_unavailable": "This game is not available here. Get a new one with /games.",
        "group_only": "👥 Games are played together: games and leaderboards are only available in groups. Add me to a group and send /games there.",
        "group_only_alert": "Games and leaderboards are only available in groups. Add me to a group and send /games there.",
        "add_to_group": "👥 Add to a group",
        "top": "🏆 <b>{game}</b> – leaderboard of this chat\n\n{lines}",
        "top_empty": "Nobody in this chat has scored in {game} yet. /games",
        "records": "🏆 <b>Records in this chat</b>\n\n{lines}\n\nThe full list of one game: /top {example}",
        "records_none": "Nobody has played in this chat yet. Start with /games.",
        "record": "👑 <b>New record in {game}!</b> {name} scores {score} and overtakes {previous} ({previousScore}).",
        "legal_footer": '<a href="{agb}">Terms</a> · <a href="{widerruf}">Withdrawal</a> · <a href="{datenschutz}">Privacy</a> · <a href="{impressum}">Legal notice</a> (German)',
        "legal_footer_commands": "/agb · /widerruf · /datenschutz · /impressum (German)",
    },
}

LANGUAGES: Final[list[str]] = list(TEXTS)


def lang_of(language_code: str | None) -> str:
    """German for German Telegram users, English for everyone else."""
    return "de" if str(language_code or "").lower().startswith("de") else "en"


def lang_of_user(user) -> str:
    return lang_of(getattr(user, "language_code", None))


def _fill(template: str, values: dict) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: str(values[m.group(1)]) if m.group(1) in values else m.group(0), template)


def legal_footer(lang: str) -> str:
    """The legal links under a message: web pages where they are hosted, otherwise the commands."""
    links = {page: page_url(page) for page in ("agb", "widerruf", "datenschutz", "impressum")}
    if not all(links.values()):
        return TEXTS[lang]["legal_footer_commands"]
    return _fill(TEXTS[lang]["legal_footer"], links)


def t(lang: str, key: str, **values) -> str:
    table = TEXTS.get(lang, TEXTS["en"])
    template = table.get(key, TEXTS["en"].get(key))
    if template is None:
        raise KeyError(f"unknown text {key}")
    return _fill(template, {"footer": legal_footer(lang if lang in TEXTS else "en"), **values})

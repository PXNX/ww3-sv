"""
The bot's public face: name, description (the empty chat before Start), short description (the
"info" on the profile and in link previews), the command menus, the menu button that opens the game
as a Mini App (so it launches with the player's Telegram account) and the profile photo. Photo, name
and descriptions rarely change, so an admin applies them on demand with /set_cmd, in English and
German; the command menus and the menu button are refreshed on every start.
"""
import logging
from typing import Final

from telegram import (
    Bot,
    BotCommand,
    BotCommandScopeAllGroupChats,
    BotCommandScopeChat,
    InputProfilePhotoStatic,
    MenuButtonWebApp,
    WebAppInfo,
)
from telegram.error import TelegramError

from ww3bot import config

logger = logging.getLogger(__name__)

BOT_NAME: Final[str] = "World War 3"

# At most 512 characters
DESCRIPTION: Final[dict[str, str]] = {
    "en": (
        "World War 3 is a satirical cartoon puzzle and arcade collection about oil, shipping and geopolitics 🌍\n\n"
        "Over 30 quick games: steer tankers past mines, shoot down drones, keep the oil flowing, free a stuck ship and more. "
        "Daily rewards, a career with ranks and your own customisable agent.\n\n"
        "Press Start and open the game. Free to play; revival tokens and Pro are available for Telegram Stars."
    ),
    "de": (
        "World War 3 ist eine satirische Cartoon-Sammlung aus Puzzle- und Arcade-Spielen über Öl, Schifffahrt und Geopolitik 🌍\n\n"
        "Über 30 schnelle Spiele: Tanker an Minen vorbeisteuern, Drohnen abschießen, das Öl am Fließen halten, ein festgefahrenes Schiff befreien und mehr. "
        "Tägliche Belohnungen, eine Karriere mit Rängen und dein eigener Agent zum Gestalten.\n\n"
        "Tippe auf Start und öffne das Spiel. Kostenlos spielbar; Revival-Token und Pro gibt es für Telegram Stars."
    ),
}

# At most 120 characters
SHORT_DESCRIPTION: Final[dict[str, str]] = {
    "en": "Satirical cartoon puzzle & arcade games about oil, shipping and geopolitics. Play right here in Telegram.",
    "de": "Satirische Cartoon-Puzzle- und Arcade-Spiele über Öl, Schifffahrt und Geopolitik. Direkt in Telegram spielen.",
}

COMMANDS: Final[dict[str, list[tuple[str, str]]]] = {
    "en": [
        ("start", "Open the game"),
        ("shop", "Revival tokens and Pro"),
        ("wallet", "What you bought"),
        ("invite", "Invite friends, earn revival tokens"),
        ("login", "Open your profile"),
        ("reminders", "Streak reminders on or off"),
        ("paysupport", "Help with purchases"),
        ("agb", "Terms (AGB)"),
        ("widerruf", "Right of withdrawal"),
        ("datenschutz", "Privacy policy"),
        ("impressum", "Legal notice"),
    ],
    "de": [
        ("start", "Spiel öffnen"),
        ("shop", "Revival-Token und Pro"),
        ("wallet", "Deine Käufe"),
        ("invite", "Freunde einladen, Revival-Token verdienen"),
        ("login", "Dein Profil öffnen"),
        ("reminders", "Serien-Erinnerungen an oder aus"),
        ("paysupport", "Hilfe zu Käufen"),
        ("agb", "Allgemeine Geschäftsbedingungen"),
        ("widerruf", "Widerrufsbelehrung"),
        ("datenschutz", "Datenschutzerklärung"),
        ("impressum", "Impressum"),
    ],
}

# The menu in groups, where the bot only posts games and their leaderboards
GROUP_COMMANDS: Final[dict[str, list[tuple[str, str]]]] = {
    "en": [("games", "Post a game to this group"), ("top", "This group's leaderboards")],
    "de": [("games", "Ein Spiel in die Gruppe posten"), ("top", "Bestenlisten dieser Gruppe")],
}

# Admins also see these in their own chat's menu; they are never advertised publicly
ADMIN_COMMANDS: Final[list[tuple[str, str]]] = [
    ("set_cmd", "Profilbild, Name und Beschreibung setzen"),
    ("stats", "Konten, Käufe und Stars"),
]


def _commands(entries: list[tuple[str, str]]) -> list[BotCommand]:
    return [BotCommand(command, description) for command, description in entries]


async def _attempt(errors: list[str], label: str, step) -> None:
    try:
        await step()
    except (TelegramError, OSError) as error:
        errors.append(f"{label}: {error}")


async def apply_commands(bot: Bot) -> list[str]:
    """The command menus and the menu button; cheap, so it runs on every start. One line per failed step."""
    errors: list[str] = []
    await _attempt(errors, "Commands (en)", lambda: bot.set_my_commands(_commands(COMMANDS["en"])))
    await _attempt(errors, "Commands (de)", lambda: bot.set_my_commands(_commands(COMMANDS["de"]), language_code="de"))
    groups = BotCommandScopeAllGroupChats()
    await _attempt(errors, "Group commands (en)", lambda: bot.set_my_commands(_commands(GROUP_COMMANDS["en"]), scope=groups))
    await _attempt(
        errors,
        "Group commands (de)",
        lambda: bot.set_my_commands(_commands(GROUP_COMMANDS["de"]), scope=groups, language_code="de"),
    )
    for admin in config.ADMIN_IDS:
        await _attempt(
            errors,
            f"Admin commands ({admin})",
            lambda admin=admin: bot.set_my_commands(_commands(COMMANDS["de"] + ADMIN_COMMANDS), scope=BotCommandScopeChat(admin)),
        )
    if config.APP_URL:
        await _attempt(
            errors,
            "Menu button",
            lambda: bot.set_chat_menu_button(menu_button=MenuButtonWebApp(BOT_NAME, WebAppInfo(config.APP_URL))),
        )
    for error in errors:
        logger.warning("[profile] %s", error)
    return errors


async def apply_profile(bot: Bot) -> list[str]:
    """Everything /set_cmd sets: photo, name and descriptions in English and German, then the menus."""
    errors: list[str] = []

    async def photo():
        with open(config.PROFILE_PHOTO, "rb") as file:
            await bot.set_my_profile_photo(InputProfilePhotoStatic(file))

    await _attempt(errors, "Profile photo", photo)
    for language, code in (("en", None), ("de", "de")):

        async def texts(language=language, code=code):
            await bot.set_my_name(BOT_NAME, language_code=code)
            await bot.set_my_description(DESCRIPTION[language], language_code=code)
            await bot.set_my_short_description(SHORT_DESCRIPTION[language], language_code=code)

        await _attempt(errors, f"Texts ({language})", texts)
    for error in errors:
        logger.warning("[profile] %s", error)
    return errors + await apply_commands(bot)

"""
The legal texts German law requires for selling digital goods: Legal notice, Privacy policy,
Terms and conditions, and Right of withdrawal. Their sources are legal/*.txt with {placeholders}
for the operator data from config.local.json; this module fills them in and renders them as
Telegram messages. The links sent out point to the same documents on the game website (English only).
"""
import re
from functools import cache
from typing import Final

from ww3bot import config

PAGES: Final[dict[str, str]] = {
    "impressum": "Legal notice",
    "datenschutz": "Privacy policy",
    "agb": "Terms and conditions",
    "widerruf": "Right of withdrawal",
}

# What a link to each page is called: English for every reader, whatever language the page is in
PAGE_LINKS: Final[dict[str, str]] = {
    "impressum": "Legal notice",
    "datenschutz": "Privacy policy",
    "agb": "Terms of sale",
    "widerruf": "Right of withdrawal",
}


def page_link_name(page: str, lang: str = "en") -> str:
    return PAGE_LINKS.get(page, PAGES.get(page, page))

# Stored with each consent to record which wording was agreed to; buyers are asked only once per account
CONSENT_VERSION: Final[str] = "2026-11-28"

# The wording § 356 Abs. 4 and 5 BGB asks for, shown before the first purchase of a version
CONSENT_TEXT: Final[str] = (
    "I expressly consent to the contract being performed before the withdrawal period expires. "
    "I am aware that for revival tokens and looks for the agent I lose my right of withdrawal when "
    "performance begins, and for World War 3 Pro when the service is fully performed. "
    "I accept the terms and conditions."
)

TELEGRAM_LIMIT: Final[int] = 4000
REQUIRED: Final[tuple[str, ...]] = ("name", "street", "city", "country", "email")


def escape_html(text) -> str:
    """For Telegram's HTML: only &, < and > need escaping."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# The bot's German page names and the routes of the same documents on the game website
WEB_PAGES: Final[dict[str, str]] = {
    "impressum": "/legal/imprint",
    "datenschutz": "/legal/privacy",
    "agb": "/legal/terms",
    "widerruf": "/legal/withdrawal",
}


def page_url(page: str) -> str:
    """The document on the game website; empty when the site is not deployed, so the text goes into the chat."""
    path = WEB_PAGES.get(page)
    return f"{config.APP_URL}{path}" if config.APP_URL and path else ""


def telegram_contact(operator: dict) -> str:
    """The operator's Telegram contact as a t.me link, or empty when none is configured."""
    handle = str(operator.get("telegram") or "").strip().removeprefix("https://").removeprefix("t.me/").lstrip("@")
    return f"https://t.me/{handle}" if handle else ""


def fill_text(source: str, settings: dict) -> str:
    operator = settings.get("operator") or {}
    for key in REQUIRED:
        if not operator.get(key):
            raise ValueError(f"config.local.json: operator.{key} is missing")
    values = {
        **operator,
        "updated": settings.get("legalUpdated") or "",
        "phone_line": f"Phone: {operator['phone']}" if operator.get("phone") else "",
        "telegram_line": f"Telegram: {telegram_contact(operator)}" if telegram_contact(operator) else "",
        "vat_line": (
            f"VAT identification number pursuant to § 27a UStG: {operator['vat_id']}" if operator.get("vat_id") else ""
        ),
    }

    def replace(match: re.Match) -> str:
        if match.group(1) not in values:
            raise ValueError(f"legal text: unknown placeholder {match.group(0)}")
        return str(values[match.group(1)])

    return re.sub(r"\{(\w+)\}", replace, source)


@cache
def text(page: str) -> str:
    """A legal page filled with the operator data."""
    source = (config.LEGAL_DIR / f"{page}.txt").read_text(encoding="utf-8")
    return fill_text(source, config.CONFIG)


def _blocks(source: str) -> list[list[str]]:
    blocks = [[line for line in block.split("\n") if line.strip()] for block in re.split(r"\n\s*\n", source)]
    return [block for block in blocks if block]


def legal_messages(page: str) -> list[str]:
    """A legal page as Telegram HTML messages, each under the message length limit."""
    parts = []
    for block in _blocks(text(page)):
        if block[0].startswith("#"):
            parts.append(f"<b>{escape_html(re.sub(r'^#+\s*', '', block[0]))}</b>")
            block = block[1:]
        if block:
            parts.append("\n".join(f"• {escape_html(line[2:])}" if line.startswith("- ") else escape_html(line) for line in block))
    messages, current = [], ""
    for part in parts:
        candidate = f"{current}\n\n{part}" if current else part
        if len(candidate) > TELEGRAM_LIMIT and current:
            messages.append(current)
            current = part
        else:
            current = candidate
    if current:
        messages.append(current)
    return messages

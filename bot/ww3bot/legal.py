"""
The legal texts German law asks for when selling digital goods: Impressum, Datenschutzerklärung, AGB
and Widerrufsbelehrung. Their sources are legal/*.txt with {placeholders} for the operator data from
config.local.json; this module fills them in and renders them as Telegram messages and as small web
pages.
"""
import re
from functools import cache
from html import escape
from typing import Final

from ww3bot import config

PAGES: Final[dict[str, str]] = {
    "impressum": "Impressum",
    "datenschutz": "Datenschutz",
    "agb": "AGB",
    "widerruf": "Widerruf",
}

# Bump when the AGB or the Widerrufsbelehrung change; buyers consent again on their next purchase
CONSENT_VERSION: Final[str] = "2026-10-27"

# The wording § 356 Abs. 4 and 5 BGB asks for, shown before the first purchase of a version
CONSENT_TEXT: Final[str] = (
    "Ich stimme ausdrücklich zu, dass mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist "
    "begonnen wird. Mir ist bekannt, dass ich bei Revival-Token mit Beginn der Ausführung und bei "
    "World War 3 Pro mit vollständiger Erbringung mein Widerrufsrecht verliere. Ich akzeptiere die AGB."
)

TELEGRAM_LIMIT: Final[int] = 4000
REQUIRED: Final[tuple[str, ...]] = ("name", "street", "city", "country", "email")


def escape_html(text) -> str:
    """For Telegram's HTML: only &, < and > need escaping."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def page_url(page: str) -> str:
    return f"{config.LEGAL_URL}/{page}.html" if config.LEGAL_URL else ""


def fill_text(source: str, settings: dict) -> str:
    operator = settings.get("operator") or {}
    for key in REQUIRED:
        if not operator.get(key):
            raise ValueError(f"config.local.json: operator.{key} is missing")
    values = {
        **operator,
        "updated": settings.get("legalUpdated") or "",
        "phone_line": f"Telefon: {operator['phone']}" if operator.get("phone") else "",
        "vat_line": (
            f"Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {operator['vat_id']}" if operator.get("vat_id") else ""
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


def _linkify(escaped: str) -> str:
    """Plain https URLs in the texts become links."""
    return re.sub(r"https://[^\s<]+[^\s<.,)]", lambda m: f'<a href="{m.group(0)}">{m.group(0)}</a>', escaped)


def render_html(page: str, source: str) -> str:
    body = []
    title = PAGES[page]
    for raw in re.split(r"\n\s*\n", source):
        block = [line for line in raw.split("\n") if line.strip()]
        if not block:
            continue
        if block[0].startswith("# "):
            title = block[0][2:]
            body.append(f"<h1>{escape(title)}</h1>")
            block = block[1:]
        elif block[0].startswith("## "):
            body.append(f"<h2>{escape(block[0][3:])}</h2>")
            block = block[1:]
        if not block:
            continue
        if all(line.startswith("- ") for line in block):
            body.append("<ul>" + "".join(f"<li>{_linkify(escape(line[2:]))}</li>" for line in block) + "</ul>")
        else:
            body.append("<p>" + "<br>".join(_linkify(escape(line)) for line in block) + "</p>")
    nav = " · ".join(f'<a href="/legal/{key}.html">{label}</a>' for key, label in PAGES.items())
    newline = "\n"
    return f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} · World War 3</title>
<style>
body {{ font: 16px/1.55 system-ui, sans-serif; max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; color: #1d1a16; background: #f6efe0; }}
h1 {{ font-size: 1.7rem; }} h2 {{ font-size: 1.15rem; margin-top: 1.8rem; }}
nav {{ font-size: .9rem; margin-bottom: 1rem; }} a {{ color: #7a4b12; overflow-wrap: anywhere; }}
</style>
</head>
<body>
<nav><a href="/">World War 3</a> · {nav}</nav>
{newline.join(body)}
</body>
</html>
"""


def html_pages() -> dict[str, str]:
    """Every legal page as a web page, served at /legal/<page>.html."""
    return {page: render_html(page, text(page)) for page in PAGES}

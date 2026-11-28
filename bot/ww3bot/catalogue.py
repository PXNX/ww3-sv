"""
The server-owned catalogue. Prices are whole Telegram Stars (currency XTR); the Mini App only shows
what `me` returns, so a price never comes from a request.
"""
from datetime import datetime, timezone
from typing import Final

CURRENCY: Final[str] = "XTR"

# The only period Telegram Stars subscriptions support: 30 days
SUBSCRIPTION_PERIOD: Final[int] = 30 * 24 * 3600
WEEKLY_DISCOUNT: Final[float] = 0.3
LOOK_SKUS: Final[tuple[str, ...]] = (
    "look_tinfoil", "look_laser", "look_gold", "look_neon", "look_cowboy", "look_beard", "look_clown"
)


def weekly_sku(now: datetime | None = None) -> str:
    """One cosmetic per calendar week, chosen by the week number so everyone sees the same deal."""
    day = now or datetime.now(timezone.utc)
    year, week, _ = day.isocalendar()
    return LOOK_SKUS[(year * 53 + week) % len(LOOK_SKUS)]


def effective_price(item: dict, now: datetime | None = None) -> int:
    """The fixed weekly discount, applied server-side so a client cannot invent a price."""
    if item.get("sku") == weekly_sku(now):
        return max(1, round(item["stars"] * (1 - WEEKLY_DISCOUNT)))
    return item["stars"]

PRODUCTS: Final[list[dict]] = [
    {
        "sku": "revive_1",
        "title": "Revival token",
        "description": "Continue one crashed run in World War 3.",
        "de": {"title": "Revival-Token", "description": "Setze einen gescheiterten Lauf in World War 3 fort."},
        "stars": 25,
        "revives": 1,
        "subscription": False,
    },
    {
        "sku": "revive_5",
        "title": "Revival token pack",
        "description": "Five revival tokens for World War 3 at a bundle price.",
        "de": {"title": "Revival-Token-Paket", "description": "Fünf Revival-Token für World War 3 zum Paketpreis."},
        "stars": 100,
        "revives": 5,
        "subscription": False,
    },
    {
        "sku": "pro_30d",
        "title": "World War 3 Pro",
        "description": "10 revival tokens every 30 days, and no adverts once the game shows them. Renews monthly until cancelled in Telegram.",
        "de": {
            "title": "World War 3 Pro",
            "description": "10 Revival-Token alle 30 Tage und keine Werbung, sobald das Spiel welche zeigt. Verlängert sich monatlich, bis du es in Telegram kündigst.",
        },
        "stars": 250,
        "revives": 10,
        "subscription": True,
    },
    # Cosmetics: one look for the player's agent, bought once and kept for good. `look` names the
    # avatar part and value the game unlocks for the owner; they grant no revivals.
    {
        "sku": "look_tinfoil",
        "title": "Tinfoil hat",
        "description": "A hat for your agent that keeps the mind-control rays out. Yours for good.",
        "de": {"title": "Aluhut", "description": "Ein Hut für deinen Agenten, der die Gedankenkontroll-Strahlen abhält. Gehört dir dauerhaft."},
        "stars": 50,
        "revives": 0,
        "subscription": False,
        "look": {"part": "hat", "value": "tinfoil"},
    },
    {
        "sku": "look_laser",
        "title": "Laser eyes",
        "description": "Glowing red laser eyes for your agent. Yours for good.",
        "de": {"title": "Laseraugen", "description": "Rot glühende Laseraugen für deinen Agenten. Gehören dir dauerhaft."},
        "stars": 50,
        "revives": 0,
        "subscription": False,
        "look": {"part": "eyes", "value": "laser"},
    },
    {
        "sku": "look_gold",
        "title": "Gold shirt",
        "description": "A solid gold colour for your agent's shirt. Yours for good.",
        "de": {"title": "Goldenes Shirt", "description": "Pures Gold als Farbe für das Shirt deines Agenten. Gehört dir dauerhaft."},
        "stars": 30,
        "revives": 0,
        "subscription": False,
        "look": {"part": "shirtColor", "value": "#d4a017"},
    },
    {
        "sku": "look_neon",
        "title": "Neon pink hair",
        "description": "Neon pink hair colour for your agent. Yours for good.",
        "de": {"title": "Neonpinke Haare", "description": "Neonpinke Haarfarbe für deinen Agenten. Gehört dir dauerhaft."},
        "stars": 30,
        "revives": 0,
        "subscription": False,
        "look": {"part": "hairColor", "value": "#ff4fa3"},
    },
    {
        "sku": "look_cowboy",
        "title": "Cowboy hat",
        "description": "A wide-brimmed cowboy hat for your agent. Yours for good.",
        "de": {"title": "Cowboyhut", "description": "Ein Cowboyhut mit breiter Krempe für deinen Agenten. Gehört dir dauerhaft."},
        "stars": 60,
        "revives": 0,
        "subscription": False,
        "look": {"part": "hat", "value": "cowboy"},
    },
    {
        "sku": "look_beard",
        "title": "Full beard",
        "description": "A magnificent full beard for your agent. Yours for good.",
        "de": {"title": "Vollbart", "description": "Ein prächtiger Vollbart für deinen Agenten. Gehört dir dauerhaft."},
        "stars": 40,
        "revives": 0,
        "subscription": False,
        "look": {"part": "facial", "value": "beard"},
    },
    {
        "sku": "look_clown",
        "title": "Clown nose",
        "description": "A bright red clown nose for your agent. Yours for good.",
        "de": {"title": "Clown-Nase", "description": "Eine knallrote Clown-Nase für deinen Agenten. Gehört dir dauerhaft."},
        "stars": 30,
        "revives": 0,
        "subscription": False,
        "look": {"part": "nose", "value": "clown"},
    },
    {
        "sku": "starter_pack",
        "title": "Starter Pack",
        "description": "Five revival tokens, seven days of Pro and no ads for a week. One time only.",
        "de": {"title": "Starter-Paket", "description": "Fünf Revival-Token, sieben Tage Pro und eine Woche ohne Werbung. Nur einmalig."},
        "stars": 60,
        "revives": 5,
        "pro_days": 7,
        "one_time": True,
        "subscription": False,
    },
    {
        "sku": "pro_gift",
        "title": "Gift a month of Pro",
        "description": "Send 30 days of Pro to a friend. You get a gift link to share after paying.",
        "de": {"title": "Ein Monat Pro verschenken", "description": "Schicke einem Freund 30 Tage Pro. Nach der Zahlung erhältst du einen Geschenklink."},
        "stars": 250,
        "revives": 0,
        "pro_days": 30,
        "gift": True,
        "subscription": False,
    },
]


def product(sku: str) -> dict | None:
    return next((item for item in PRODUCTS if item["sku"] == sku), None)


def is_cosmetic(item: dict) -> bool:
    """A look bought once and owned for good, rather than a consumable or a subscription."""
    return bool(item.get("look"))


def localized(item: dict, lang: str) -> dict:
    """Title and description in the buyer's language (German or English); the price is the same."""
    if lang == "de" and item.get("de"):
        return {**item, **item["de"]}
    return item

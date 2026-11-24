"""
The server-owned catalogue. Prices are whole Telegram Stars (currency XTR); the Mini App only shows
what `me` returns, so a price never comes from a request.
"""
from typing import Final

CURRENCY: Final[str] = "XTR"

# The only period Telegram Stars subscriptions support: 30 days
SUBSCRIPTION_PERIOD: Final[int] = 30 * 24 * 3600

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

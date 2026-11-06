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
]


def product(sku: str) -> dict | None:
    return next((item for item in PRODUCTS if item["sku"] == sku), None)


def localized(item: dict, lang: str) -> dict:
    """Title and description in the buyer's language (German or English); the price is the same."""
    if lang == "de" and item.get("de"):
        return {**item, **item["de"]}
    return item

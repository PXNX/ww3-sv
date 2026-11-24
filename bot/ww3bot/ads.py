"""
House adverts from a litfass server. The bot fetches the feed and forwards the counts, so a player's
browser never contacts the advert server. Images are dropped from the feed for the same reason.
"""
import logging
import re
import time

import aiohttp
from telegram import Bot

from ww3bot import config

logger = logging.getLogger(__name__)

# How long a fetched feed is served before it is fetched again
FEED_TTL = 300
EVENTS = ("view", "click", "reward")
MAX_EVENTS = 20
EMPTY = {"version": 1, "ads": []}

_cache: dict = {"at": 0.0, "feed": EMPTY}


def event_url(feed_url: str) -> str:
    return re.sub(r"/v1/feed/([^/?#]+).*$", r"/v1/event/\1", feed_url)


def strip_feed(data: object) -> dict:
    """Keeps the adverts as the advert server sent them, minus images (they would load from it)."""
    ads = data.get("ads") if isinstance(data, dict) else None
    if not isinstance(ads, list):
        return EMPTY
    return {"version": 1, "ads": [{k: v for k, v in ad.items() if k != "image"} for ad in ads if isinstance(ad, dict)]}


async def _get_json(url: str, headers: dict | None = None) -> dict | None:
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get(url, headers=headers or {}) as response:
                return await response.json() if response.ok else None
    except (aiohttp.ClientError, TimeoutError, ValueError) as error:
        logger.warning("advert statistics unavailable: %s", error)
        return None


async def stats() -> dict:
    """The game's own placement numbers and, with the token, the whole litfass network."""
    if not config.LITFASS_FEED_URL:
        return {"placement": None, "network": None}
    base = re.sub(r"/v1/feed/[^/?#]+.*$", "", config.LITFASS_FEED_URL)
    placement = await _get_json(re.sub(r"/v1/feed/", "/v1/stats/", config.LITFASS_FEED_URL))
    network = (
        await _get_json(f"{base}/v1/admin/stats", {"Authorization": f"Bearer {config.LITFASS_STATS_TOKEN}"})
        if config.LITFASS_STATS_TOKEN
        else None
    )
    return {"placement": placement, "network": network}


async def feed(bot: Bot, data: dict, init_data: None) -> dict:
    """The current house adverts; the last good feed (or none) while the advert server is unreachable."""
    if not config.LITFASS_FEED_URL:
        return EMPTY
    if time.monotonic() - _cache["at"] < FEED_TTL:
        return _cache["feed"]
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get(config.LITFASS_FEED_URL) as response:
                response.raise_for_status()
                _cache["feed"] = strip_feed(await response.json())
    except (aiohttp.ClientError, TimeoutError, ValueError) as error:
        logger.warning("advert feed unavailable: %s", error)
    _cache["at"] = time.monotonic()
    return _cache["feed"]


async def event(bot: Bot, data: dict, init_data: None) -> dict:
    """`{ events: [{ ad, event }] }` from the game, forwarded as daily counts (nothing about the player)."""
    items = data.get("events")
    if not config.LITFASS_FEED_URL or not isinstance(items, list):
        return {"counted": 0}
    events = [
        {"ad": str(item["ad"])[:32], "event": item["event"]}
        for item in items[:MAX_EVENTS]
        if isinstance(item, dict) and item.get("event") in EVENTS and item.get("ad")
    ]
    if not events:
        return {"counted": 0}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.post(event_url(config.LITFASS_FEED_URL), json={"events": events}) as response:
                return {"counted": (await response.json()).get("counted", 0) if response.ok else 0}
    except (aiohttp.ClientError, TimeoutError, ValueError) as error:
        logger.warning("advert events not sent: %s", error)
        return {"counted": 0}

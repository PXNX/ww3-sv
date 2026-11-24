"""House adverts proxied from litfass, without a network."""
from ww3bot import ads


def test_event_url():
    assert ads.event_url("https://x.example/litfass/v1/feed/key?x=1") == "https://x.example/litfass/v1/event/key"


def test_strip_feed_drops_images_and_junk():
    feed = ads.strip_feed({"version": 1, "ads": [{"id": "a", "image": "https://ads/x.jpg", "url": "https://t.me/a"}, "junk"]})
    assert feed == {"version": 1, "ads": [{"id": "a", "url": "https://t.me/a"}]}
    assert ads.strip_feed(None) == ads.EMPTY


async def test_without_server_nothing_is_sent(monkeypatch):
    monkeypatch.setattr(ads.config, "LITFASS_FEED_URL", "")
    assert await ads.feed(None, {}, None) == ads.EMPTY
    assert await ads.event(None, {"events": [{"ad": "a", "event": "view"}]}, None) == {"counted": 0}

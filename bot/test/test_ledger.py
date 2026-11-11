"""The ledger, invites and streak reminders on a real database."""
import asyncio
from types import SimpleNamespace

import pytest

from conftest import blocked
from ww3bot import db, friends, ledger, referrals, reminders
from ww3bot.catalogue import product

pytestmark = pytest.mark.usefixtures("database")


def person(user_id: int, **extra):
    return SimpleNamespace(id=user_id, first_name=extra.pop("first_name", f"P{user_id}"), username=None, language_code=None, is_bot=False, **extra)


async def test_booking_wallet_and_spending():
    await ledger.upsert_account(person(42, first_name="Test"))
    await ledger.upsert_account(SimpleNamespace(id=42, first_name="Test", username="renamed", language_code="de"))
    assert await ledger.account_language(42) == "de"
    assert not await ledger.has_consent(42)
    await ledger.record_consent(42, "bot")
    await ledger.record_consent(42, "bot")
    assert await ledger.has_consent(42)

    await db.execute("INSERT INTO invoices (id, user_id, sku, stars, created_at) VALUES ('inv1', 42, 'pro_30d', 250, %s)", (db.now(),))
    assert (await ledger.find_invoice("inv1"))["user_id"] == 42

    payment = SimpleNamespace(
        telegram_payment_charge_id="c1", provider_payment_charge_id="", total_amount=250, invoice_payload="inv1",
        is_recurring=True, subscription_expiration_date=None,
    )
    assert (await ledger.book_payment(42, product("pro_30d"), payment))["granted"]
    assert not (await ledger.book_payment(42, product("pro_30d"), payment))["granted"]

    wallet = await ledger.wallet(42)
    assert wallet["revives"] == 10 and wallet["pro"]

    for _ in range(10):
        assert await ledger.spend_revive(42, "test") is not None
    assert await ledger.spend_revive(42, "test") is None
    assert (await ledger.stats())["purchases"] == 1


async def test_concurrent_spends_never_overdraw():
    await ledger.upsert_account(person(7))
    await db.execute("INSERT INTO referrals (invitee_id, referrer_id, revives, created_at) VALUES (8, 7, 3, 0)")
    results = await asyncio.gather(*(ledger.spend_revive(7, "race") for _ in range(10)))
    assert sum(result is not None for result in results) == 3
    assert (await ledger.wallet(7))["revives"] == 0


async def test_no_invoices_while_the_operator_data_is_missing(bot):
    with pytest.raises(ledger.LedgerError, match="not open"):
        await ledger.create_invoice(bot, 42, product("revive_1"))
    assert bot.calls == []


async def test_only_a_new_player_earns_the_inviter_a_token_once_up_to_the_cap():
    assert not await referrals.record_referral(100, person(200))  # inviter unknown
    await ledger.upsert_account(person(100))
    assert not await referrals.record_referral(100, person(100))  # yourself
    assert not await referrals.record_referral(100, SimpleNamespace(id=201, is_bot=True))
    await ledger.upsert_account(person(202))
    assert not await referrals.record_referral(100, person(202))  # already played

    assert await referrals.record_referral(100, person(203))
    assert not await referrals.record_referral(100, person(203))  # the same friend again
    assert not await referrals.record_referral(101, person(203))  # invited by someone else too

    for friend in range(300, 320):
        await referrals.record_referral(100, person(friend))
    stats = await referrals.invite_stats(100)
    assert stats["friends"] == referrals.REFERRAL_CAP
    assert stats["revives"] == referrals.REFERRAL_CAP * referrals.REFERRAL_REVIVES
    wallet = await ledger.wallet(100)
    assert wallet["revives"] == stats["revives"]
    assert await ledger.spend_revive(100, "test") is not None
    assert (await ledger.wallet(100))["revives"] == wallet["revives"] - 1


async def test_one_reminder_per_deadline_inside_the_two_hour_window(bot):
    user = SimpleNamespace(id=7, language_code="de")
    await reminders.report_streak(user, {"streak": 4, "expires_at": db.now() + reminders.REMIND_BEFORE + 600})
    assert await reminders.send_due_reminders(bot) == 0

    await reminders.report_streak(user, {"streak": 4, "expires_at": db.now() + reminders.REMIND_BEFORE - 60})
    assert await reminders.send_due_reminders(bot) == 1
    assert await reminders.send_due_reminders(bot) == 0
    method, args, _ = bot.calls[0]
    assert method == "send_message" and args[0] == 7 and "4 Tagen" in args[1]

    # Claimed today: the deadline moves a day on and gets its own reminder later
    await reminders.report_streak(user, {"streak": 5, "expires_at": db.now() + reminders.REMIND_BEFORE + 86400})
    assert await reminders.send_due_reminders(bot) == 0


async def test_muted_too_late_no_streak_and_refused_input(bot):
    await reminders.report_streak(SimpleNamespace(id=1), {"streak": 2, "expires_at": db.now() + 3600})
    await reminders.set_muted(1, True)
    await reminders.report_streak(SimpleNamespace(id=2), {"streak": 2, "expires_at": db.now() + 300})
    await reminders.report_streak(SimpleNamespace(id=3), {"streak": 0, "expires_at": db.now() + 3600})
    assert await reminders.send_due_reminders(bot) == 0
    with pytest.raises(reminders.StreakInputError):
        await reminders.report_streak(SimpleNamespace(id=4), {"streak": 1, "expires_at": db.now() + 10 * 86400})
    with pytest.raises(reminders.StreakInputError):
        await reminders.report_streak(SimpleNamespace(id=4), {"streak": -1, "expires_at": db.now()})


async def test_a_refused_message_blocks_until_the_player_is_reachable_again(bot):
    bot.refuse = blocked
    await reminders.report_streak(SimpleNamespace(id=9), {"streak": 3, "expires_at": db.now() + 3600})
    assert await reminders.send_due_reminders(bot) == 0

    bot.refuse = None
    await reminders.report_streak(SimpleNamespace(id=9), {"streak": 3, "expires_at": db.now() + 3000})
    assert await reminders.send_due_reminders(bot) == 0
    await reminders.unblock(9)
    assert await reminders.send_due_reminders(bot) == 1


async def test_an_invite_makes_friends_on_both_sides_even_without_a_reward():
    assert not await friends.befriend(100, person(200))  # inviter unknown
    await ledger.upsert_account(person(100, first_name="Host"))
    assert not await friends.befriend(100, person(100))  # yourself
    assert not await friends.befriend(100, SimpleNamespace(id=201, is_bot=True))

    await ledger.upsert_account(person(202, first_name="Old"))  # played before: no reward, still a friend
    assert not await referrals.record_referral(100, person(202))
    assert await friends.befriend(100, person(202))
    assert not await friends.befriend(100, person(202))  # already friends

    assert [entry["id"] for entry in await friends.friends_of(100)] == ["202"]
    assert [(entry["id"], entry["name"]) for entry in await friends.friends_of(202)] == [("100", "Host")]


async def test_earlier_invites_become_friendships():
    await db.execute("INSERT INTO referrals (invitee_id, referrer_id, revives, created_at) VALUES (8, 7, 1, 0)")
    async with db.connection() as conn:
        await conn.execute(db.SCHEMA)
    assert [entry["id"] for entry in await friends.friends_of(7)] == ["8"]
    assert [entry["id"] for entry in await friends.friends_of(8)] == ["7"]

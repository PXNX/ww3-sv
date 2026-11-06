"""
Accounts, consent, invoices, purchases and the revival wallet (bought revivals, plus those earned by
inviting friends, minus those spent). A purchase books its grant in the same insert, keyed by the
unique charge id; a spend holds the user's advisory lock, so two spends never both pass the balance
check.
"""
import logging
import random
import string
import time

from telegram import Bot, LabeledPrice

from ww3bot import config, db
from ww3bot.catalogue import CURRENCY, SUBSCRIPTION_PERIOD
from ww3bot.legal import CONSENT_VERSION
from ww3bot.texts import lang_of_user

logger = logging.getLogger(__name__)

# Invoice creations a user may make per minute
INVOICES_PER_MINUTE = 5

BALANCE = """
    COALESCE((SELECT SUM(revives) FROM purchases WHERE user_id = %(user)s), 0)
    + COALESCE((SELECT SUM(revives) FROM referrals WHERE referrer_id = %(user)s), 0)
    - COALESCE((SELECT SUM(revives) FROM spends WHERE user_id = %(user)s), 0)
"""


class LedgerError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


async def upsert_account(user) -> None:
    await db.execute(
        """
        INSERT INTO accounts (user_id, username, first_name, language) VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE SET
            username = excluded.username, first_name = excluded.first_name, language = excluded.language
        """,
        (user.id, getattr(user, "username", None), getattr(user, "first_name", None), lang_of_user(user)),
    )


async def account_language(user_id: int) -> str:
    """The language stored with the account ('de' or 'en'), for messages sent without an update."""
    row = await db.fetchone("SELECT language FROM accounts WHERE user_id = %s", (user_id,))
    return "de" if row and row["language"] == "de" else "en"


async def has_consent(user_id: int) -> bool:
    row = await db.fetchone("SELECT 1 FROM consents WHERE user_id = %s AND version = %s", (user_id, CONSENT_VERSION))
    return row is not None


async def record_consent(user_id: int, source: str) -> None:
    await db.execute(
        """
        INSERT INTO consents (user_id, version, source, created_at) VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, version) DO NOTHING
        """,
        (user_id, CONSENT_VERSION, source, db.now()),
    )
    logger.info("consent user=%s version=%s source=%s", user_id, CONSENT_VERSION, source)


async def wallet(user_id: int, conn=None) -> dict:
    row = await db.fetchone(
        f"SELECT {BALANCE} AS revives, (SELECT pro_until FROM accounts WHERE user_id = %(user)s) AS pro_until",
        {"user": user_id},
        conn,
    )
    pro_until = row["pro_until"] if row else None
    return {
        "revives": int(row["revives"] or 0) if row else 0,
        "pro_until": pro_until,
        "pro": pro_until is not None and pro_until > db.now(),
    }


def _base36(number: int) -> str:
    digits = string.digits + string.ascii_lowercase
    out = ""
    while True:
        number, rest = divmod(number, 36)
        out = digits[rest] + out
        if number == 0:
            return out


def invoice_id() -> str:
    # Unique enough with the timestamp; the id is a lookup key, never a secret on its own
    return _base36(int(time.time() * 1000)) + "".join(random.choices(string.digits + string.ascii_lowercase, k=8))


async def create_invoice(bot: Bot, user_id: int, item: dict) -> dict:
    """An invoice link bound to this user and sku; refuses when the user asks for too many."""
    if not config.SALES_OPEN:
        raise LedgerError("SALES_CLOSED", "Purchases are not open yet.")
    recent = await db.fetchone(
        "SELECT COUNT(*) AS n FROM invoices WHERE user_id = %s AND created_at > %s", (user_id, db.now() - 60)
    )
    if recent["n"] >= INVOICES_PER_MINUTE:
        raise LedgerError("RATE_LIMITED", "Too many invoices, please wait a minute.")
    new_id = invoice_id()
    await db.execute(
        "INSERT INTO invoices (id, user_id, sku, stars, created_at) VALUES (%s, %s, %s, %s, %s)",
        (new_id, user_id, item["sku"], item["stars"], db.now()),
    )
    url = await bot.create_invoice_link(
        title=item["title"],
        description=item["description"],
        payload=new_id,
        currency=CURRENCY,
        prices=[LabeledPrice(item["title"], item["stars"])],
        subscription_period=SUBSCRIPTION_PERIOD if item["subscription"] else None,
    )
    return {"id": new_id, "url": url}


async def find_invoice(invoice: str) -> dict | None:
    return await db.fetchone("SELECT * FROM invoices WHERE id = %s", (invoice,))


async def book_payment(user_id: int, item: dict, payment) -> dict:
    """
    Books a successful payment and its revivals in one insert; granted is False when this charge was
    already booked (Telegram can deliver an update twice). A Pro payment also moves pro_until forward.
    """
    booked = await db.execute(
        """
        INSERT INTO purchases (charge_id, provider_charge_id, user_id, sku, stars, invoice_id, revives, recurring, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (charge_id) DO NOTHING
        """,
        (
            payment.telegram_payment_charge_id,
            payment.provider_payment_charge_id or None,
            user_id,
            item["sku"],
            payment.total_amount,
            payment.invoice_payload,
            item["revives"],
            bool(payment.is_recurring),
            db.now(),
        ),
    )
    if booked == 0:
        return {"granted": False, "pro_until": None}
    pro_until = None
    if item["subscription"]:
        expiration = payment.subscription_expiration_date
        pro_until = int(expiration.timestamp()) if expiration else db.now() + SUBSCRIPTION_PERIOD
        await db.execute(
            "UPDATE accounts SET pro_until = GREATEST(COALESCE(pro_until, 0), %s) WHERE user_id = %s", (pro_until, user_id)
        )
    return {"granted": True, "pro_until": pro_until}


async def spend_revive(user_id: int, reason: str) -> dict | None:
    """Takes one revival token; None when the wallet is empty."""
    async with db.transaction(lock=user_id) as conn:
        taken = await db.execute(
            f"""
            INSERT INTO spends (user_id, revives, reason, created_at)
            SELECT %(user)s, 1, %(reason)s, %(now)s WHERE {BALANCE} >= 1
            """,
            {"user": user_id, "reason": reason, "now": db.now()},
            conn,
        )
        if taken == 0:
            return None
        return await wallet(user_id, conn)


async def stats() -> dict:
    return await db.fetchone(
        """
        SELECT
            (SELECT COUNT(*) FROM accounts) AS accounts,
            (SELECT COUNT(*) FROM purchases) AS purchases,
            (SELECT COALESCE(SUM(stars), 0) FROM purchases) AS stars,
            (SELECT COUNT(*) FROM accounts WHERE pro_until > %s) AS pro
        """,
        (db.now(),),
    )

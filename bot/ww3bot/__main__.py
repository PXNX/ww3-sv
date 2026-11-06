"""
The World War 3 bot (@game_ww3_bot): python-telegram-bot with long polling, PostgreSQL, the game's
HTTP endpoints on API_PORT, and the streak reminders as a job every minute. Start with
`python -m ww3bot` from the bot folder.
"""
import logging
import sys

from aiohttp import web
from telegram import Update
from telegram.ext import Application, ApplicationBuilder, ContextTypes

from ww3bot import config, db
from ww3bot.api import create_app
from ww3bot.endpoints import ENDPOINTS, OPEN_ENDPOINTS
from ww3bot.handlers import register_handlers
from ww3bot.legal import html_pages
from ww3bot.profile import apply_commands
from ww3bot.reminders import send_due_reminders

logger = logging.getLogger("ww3bot")

REMINDER_INTERVAL = 60


async def remind(context: ContextTypes.DEFAULT_TYPE) -> None:
    sent = await send_due_reminders(context.bot)
    if sent:
        logger.info("streak reminders sent: %s", sent)


async def post_init(app: Application) -> None:
    await db.open_pool(config.DATABASE_URL)
    # Polling and a webhook exclude each other
    await app.bot.delete_webhook(drop_pending_updates=False)
    await apply_commands(app.bot)

    runner = web.AppRunner(create_app(app.bot, config.TOKEN, ENDPOINTS, OPEN_ENDPOINTS, config.API_ORIGINS, html_pages()))
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", config.API_PORT).start()
    app.bot_data["api"] = runner
    logger.info("endpoints on :%s for %s", config.API_PORT, ", ".join(config.API_ORIGINS))

    app.job_queue.run_repeating(remind, interval=REMINDER_INTERVAL, first=10)
    logger.info("polling as @%s", app.bot.username)


async def post_shutdown(app: Application) -> None:
    runner = app.bot_data.get("api")
    if runner:
        await runner.cleanup()
    await db.close_pool()


def main() -> None:
    logging.basicConfig(
        format="%(asctime)s %(levelname)-5s %(name)s: %(message)s", level=logging.INFO, datefmt="%Y-%m-%d %H:%M:%S", stream=sys.stdout
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if not config.TOKEN:
        sys.exit("TELEGRAM (the bot token) is not set")
    if not config.DATABASE_URL:
        sys.exit("DATABASE_URL is not set")
    if config.CONFIG_MISSING:
        logger.warning("config.local.json is missing: legal pages show the example operator and sales stay closed")
    elif not config.SALES_OPEN:
        logger.warning("sales closed: the operator data in config.local.json is still the example")

    app = (
        ApplicationBuilder()
        .token(config.TOKEN)
        # pre_checkout_query must be answered within 10 seconds, so updates are not queued behind each other
        .concurrent_updates(True)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )
    register_handlers(app)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()

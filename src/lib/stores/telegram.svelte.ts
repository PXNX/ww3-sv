/*
 * The Telegram account store: whether the game runs as a Mini App and, if so, who the player is
 * and what they bought, as reported by the Serverless `me` endpoint. Outside Telegram it stays
 * empty and the game keeps running on the local profile alone.
 */
import {
	call,
	endpointCode,
	loadTelegram,
	openInvoice,
	parseMe,
	toCallError,
	type CatalogueItem,
	type PurchaseConsent,
	type TelegramUser
} from '#lib/services/telegram.js';

/** How a purchase ended, from the player's point of view */
export type PurchaseResult =
	/** The bot booked it and the wallet shows it */
	| 'done'
	/** Paid, but the bot has not booked it yet; it will show up shortly */
	| 'processing'
	| 'cancelled'
	| 'failed'
	/** The player has to tick the consent box first */
	| 'consent'
	/** Too many invoices in a minute */
	| 'busy';

/** Tries after a paid invoice before saying the purchase is still being processed */
const BOOKING_POLLS = 6;
const BOOKING_POLL_MS = 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type TelegramStatus =
	/** A normal browser visit, or the Telegram script could not be loaded */
	| 'browser'
	| 'checking'
	| 'verified'
	/** Telegram refused the identity; reopening the Mini App from the bot fixes it */
	| 'rejected'
	/** The endpoint failed or returned something unexpected */
	| 'error';

class TelegramStore {
	status = $state<TelegramStatus>('browser');
	user = $state<TelegramUser | null>(null);
	/** Revival tokens bought with Stars, as the server counts them */
	wallet = $state({ revives: 0 });
	pro = $state(false);
	proUntil = $state<string | null>(null);
	/** Whether the player already agreed to immediate delivery, which a purchase needs */
	consented = $state(false);
	/** The wording the player agrees to before the first purchase, and the legal links */
	consent = $state<PurchaseConsent | null>(null);
	/** What the bot sells, as the server prices it */
	catalogue = $state<CatalogueItem[]>([]);
	/** True while an invoice is open or a payment is being booked */
	busy = $state(false);

	#started = false;

	get inTelegram(): boolean {
		return this.status !== 'browser';
	}

	/** Loads Telegram only for a Mini App launch, then asks who the player is */
	async start(): Promise<void> {
		if (this.#started) return;
		this.#started = true;
		const app = await loadTelegram();
		if (!app) return;
		await this.refresh();
	}

	item(sku: string): CatalogueItem | undefined {
		return this.catalogue.find((entry) => entry.sku === sku);
	}

	/** The single bought revival, for the one-tap offer on the result sheet */
	get reviveItem(): CatalogueItem | undefined {
		return this.catalogue.find((entry) => !entry.subscription && entry.revives === 1);
	}

	get proItem(): CatalogueItem | undefined {
		return this.catalogue.find((entry) => entry.subscription);
	}

	/**
	 * Buys an item with Stars: asks the bot for an invoice, opens it, and after a `paid` sheet
	 * waits for the bot to book the payment. `agreed` carries the consent checkbox for a player who
	 * has not agreed to the current terms yet.
	 */
	async buy(sku: string, agreed = false): Promise<PurchaseResult> {
		if (this.busy) return 'busy';
		this.busy = true;
		try {
			const before = { revives: this.wallet.revives, proUntil: this.proUntil };
			let url: string;
			try {
				({ url } = await call<{ url: string }>('invoice', { sku, consent: agreed }));
			} catch (error) {
				const code = endpointCode(error);
				if (code === 'CONSENT_REQUIRED') return 'consent';
				if (code === 'RATE_LIMITED') return 'busy';
				return 'failed';
			}
			if (agreed) this.consented = true;

			const status = await openInvoice(url);
			if (status === 'cancelled') return 'cancelled';
			if (status === 'failed') return 'failed';

			for (let attempt = 0; attempt < BOOKING_POLLS; attempt += 1) {
				await wait(BOOKING_POLL_MS);
				await this.#load();
				if (this.wallet.revives > before.revives || this.proUntil !== before.proUntil) {
					return 'done';
				}
			}
			return 'processing';
		} catch {
			return 'failed';
		} finally {
			this.busy = false;
		}
	}

	/** Uses one revival bought with Stars; false when there is none or the bot cannot be reached */
	async spendRevive(mode: string): Promise<boolean> {
		if (this.wallet.revives <= 0) return false;
		try {
			const result = await call<{ wallet?: { revives?: unknown } }>('spend', { mode });
			const revives = result?.wallet?.revives;
			this.wallet = {
				revives: typeof revives === 'number' ? revives : Math.max(0, this.wallet.revives - 1)
			};
			return true;
		} catch (error) {
			// The server says the wallet is empty: show that rather than a stale count
			if (endpointCode(error) === 'NO_REVIVES') this.wallet = { revives: 0 };
			return false;
		}
	}

	async refresh(): Promise<void> {
		if (!(await loadTelegram())) return;
		this.status = 'checking';
		await this.#load();
	}

	async #load(): Promise<void> {
		try {
			const me = parseMe(await call('me'));
			if (!me) {
				this.status = 'error';
				return;
			}
			this.user = me.user;
			this.wallet = { revives: me.revives };
			this.pro = me.pro;
			this.proUntil = me.proUntil;
			this.consented = me.consented;
			this.consent = me.consent;
			this.catalogue = me.catalogue;
			this.status = 'verified';
		} catch (error) {
			this.status = toCallError(error).type === 'UNAUTHORIZED' ? 'rejected' : 'error';
		}
	}
}

let shared: TelegramStore | undefined;

/** The app-wide Telegram store (created on first use) */
export function telegram(): TelegramStore {
	shared ??= new TelegramStore();
	return shared;
}

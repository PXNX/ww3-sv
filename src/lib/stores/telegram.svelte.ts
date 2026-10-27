/*
 * The Telegram account store: whether the game runs as a Mini App and, if so, who the player is
 * and what they bought, as reported by the Serverless `me` endpoint. Outside Telegram it stays
 * empty and the game keeps running on the local profile alone.
 */
import {
	call,
	loadTelegram,
	parseMe,
	toCallError,
	type CatalogueItem,
	type TelegramUser
} from '#lib/services/telegram.js';

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
	/** What the bot sells, as the server prices it */
	catalogue = $state<CatalogueItem[]>([]);

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

	async refresh(): Promise<void> {
		if (!(await loadTelegram())) return;
		this.status = 'checking';
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

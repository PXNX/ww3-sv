/*
 * The Telegram Mini App bridge. The backend runs on Telegram Serverless: the game calls named
 * endpoints through `Telegram.WebApp.Serverless.call`, and Telegram verifies the player's initData
 * itself, so the game never handles the token. Telegram's script is injected only when the page
 * was opened as a Mini App (the launch puts `tgWebAppData` in the URL hash); a browser visit loads
 * nothing extra. The initData is never read into storage or logs here.
 */

const SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js';

export type TelegramErrorType = 'UNAUTHORIZED' | 'ENDPOINT_ERROR' | 'UNAVAILABLE' | 'UNKNOWN';

/** A failed endpoint call: refused identity, an error in the endpoint, or no Telegram at all */
export class TelegramCallError extends Error {
	constructor(
		readonly type: TelegramErrorType,
		message: string = type
	) {
		super(message);
		this.name = 'TelegramCallError';
	}
}

interface ServerlessApi {
	call(name: string, input: unknown, callback: (error: unknown, result: unknown) => void): void;
}

interface TelegramWebApp {
	initData?: string;
	ready?: () => void;
	Serverless?: ServerlessApi;
}

type TelegramWindow = Window & { Telegram?: { WebApp?: TelegramWebApp } };

/** True when the URL hash carries a Mini App launch */
export function isTelegramLaunch(hash: string): boolean {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash;
	if (!raw.includes('tgWebAppData=')) return false;
	return Boolean(new URLSearchParams(raw).get('tgWebAppData'));
}

function webApp(): TelegramWebApp | undefined {
	return typeof window === 'undefined' ? undefined : (window as TelegramWindow).Telegram?.WebApp;
}

let loading: Promise<TelegramWebApp | null> | null = null;

/**
 * Loads Telegram's script once, only inside a Mini App launch; resolves to the WebApp object, or
 * null in a normal browser or when the script cannot be loaded.
 */
export function loadTelegram(): Promise<TelegramWebApp | null> {
	if (loading) return loading;
	if (typeof window === 'undefined') return Promise.resolve(null);
	const existing = webApp();
	if (existing?.initData) return (loading = Promise.resolve(existing));
	if (!isTelegramLaunch(window.location.hash)) return Promise.resolve(null);

	loading = new Promise((resolve) => {
		const script = document.createElement('script');
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			const app = webApp();
			app?.ready?.();
			resolve(app?.initData ? app : null);
		};
		script.onerror = () => resolve(null);
		document.head.append(script);
	});
	return loading;
}

/** Maps whatever the platform threw onto one of the known error types */
export function toCallError(error: unknown): TelegramCallError {
	if (error instanceof TelegramCallError) return error;
	const type =
		typeof error === 'object' && error !== null && 'type' in error ? String(error.type) : '';
	const message =
		typeof error === 'object' && error !== null && 'message' in error
			? String(error.message)
			: undefined;
	if (type === 'UNAUTHORIZED' || type === 'ENDPOINT_ERROR') {
		return new TelegramCallError(type, message);
	}
	return new TelegramCallError('UNKNOWN', message);
}

/** Calls a Serverless endpoint; rejects with a TelegramCallError when it fails */
export async function call<T>(name: string, input: unknown = {}): Promise<T> {
	const app = await loadTelegram();
	const serverless = app?.Serverless;
	if (!serverless) throw new TelegramCallError('UNAVAILABLE');
	return new Promise<T>((resolve, reject) => {
		try {
			serverless.call(name, input, (error, result) => {
				if (error) reject(toCallError(error));
				else resolve(result as T);
			});
		} catch (error) {
			reject(toCallError(error));
		}
	});
}

// ---------------------------------------------------------------------------------------------
// The `me` endpoint

export interface TelegramUser {
	id: number;
	username: string | null;
	firstName: string;
}

/** One thing the bot sells, priced and described by the server */
export interface CatalogueItem {
	sku: string;
	title: string;
	/** Price in whole Telegram Stars */
	stars: number;
	/** Revival tokens the purchase grants */
	revives: number;
	/** True for the monthly Pro subscription */
	subscription: boolean;
}

export interface TelegramMe {
	user: TelegramUser;
	/** Revival tokens bought with Stars and not spent yet */
	revives: number;
	pro: boolean;
	/** ISO timestamp, or null without Pro */
	proUntil: string | null;
	/** Whether the player already agreed to immediate delivery (needed before a purchase) */
	consented: boolean;
	catalogue: CatalogueItem[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0;

function toCatalogueItem(value: unknown): CatalogueItem | null {
	if (!isRecord(value)) return null;
	const { sku, title, stars, revives, subscription } = value;
	if (typeof sku !== 'string' || sku === '' || typeof title !== 'string') return null;
	if (!isCount(stars) || stars === 0 || !isCount(revives) || typeof subscription !== 'boolean') {
		return null;
	}
	return { sku, title, stars, revives, subscription };
}

/** Validates what `me` returned; null when it is not the expected shape */
export function parseMe(value: unknown): TelegramMe | null {
	if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.wallet)) return null;
	const { id, username, first_name: firstName } = value.user;
	const { revives } = value.wallet;
	const { pro, pro_until: proUntil, consented, catalogue } = value;
	if (typeof id !== 'number' || !Number.isSafeInteger(id) || typeof firstName !== 'string') {
		return null;
	}
	if (!isCount(revives) || typeof pro !== 'boolean') return null;
	if (proUntil !== null && proUntil !== undefined && typeof proUntil !== 'string') return null;
	if (consented !== undefined && typeof consented !== 'boolean') return null;
	if (catalogue !== undefined && !Array.isArray(catalogue)) return null;
	const items = (catalogue ?? []).map(toCatalogueItem);
	if (items.some((item) => item === null)) return null;
	return {
		user: {
			id,
			username: typeof username === 'string' && username !== '' ? username : null,
			firstName
		},
		revives,
		pro,
		proUntil: proUntil ?? null,
		consented: consented ?? false,
		catalogue: items as CatalogueItem[]
	};
}

// ---------------------------------------------------------------------------------------------
// Opening the game in Telegram

export const TELEGRAM_BOT = 'game_ww3_bot';

/** A link that opens the game as a Mini App, landing on the given start parameter */
export function telegramAppLink(startParam?: string): string {
	const base = `https://t.me/${TELEGRAM_BOT}`;
	return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}

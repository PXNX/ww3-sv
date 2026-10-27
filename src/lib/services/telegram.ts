/*
 * The Telegram Mini App bridge. The backend runs on Telegram Serverless: the game calls named
 * endpoints through `Telegram.WebApp.Serverless.call`, and Telegram verifies the player's initData
 * itself, so the game never handles the token. Telegram's script is injected only when the page
 * was opened as a Mini App (the launch puts `tgWebAppData` in the URL hash); a browser visit loads
 * nothing extra. The initData is never read into storage or logs here.
 */

const SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export type TelegramErrorType = 'UNAUTHORIZED' | 'ENDPOINT_ERROR' | 'UNAVAILABLE' | 'UNKNOWN';

/** A failed endpoint call: refused identity, an error in the endpoint, or no Telegram at all */
export class TelegramCallError extends Error {
	constructor(
		readonly type: TelegramErrorType,
		message: string = type,
		/** The code an endpoint refused with, from its error parameters */
		readonly code: string | null = null
	) {
		super(message);
		this.name = 'TelegramCallError';
	}
}

interface ServerlessApi {
	call(name: string, input: unknown, callback: (error: unknown, result: unknown) => void): void;
}

/** What Telegram reports when the invoice sheet closes; only `paid` means money moved */
export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

interface TelegramWebApp {
	initData?: string;
	initDataUnsafe?: { start_param?: string };
	ready?: () => void;
	Serverless?: ServerlessApi;
	openInvoice?: (url: string, callback: (status: string) => void) => void;
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

/** Pages a `startapp` link may open; anything else lands on the start screen */
const START_ROUTES = { profile: '/profile', shop: '/shop' } as const;

export type StartRoute = (typeof START_ROUTES)[keyof typeof START_ROUTES];

/** The page a Mini App launch asked for, such as `?startapp=shop`, or null */
export function startRoute(startParam: string | undefined | null): StartRoute | null {
	if (!startParam || !Object.hasOwn(START_ROUTES, startParam)) return null;
	return START_ROUTES[startParam as keyof typeof START_ROUTES];
}

/** The start parameter of the current Mini App launch, once Telegram is loaded */
export async function launchStartParam(): Promise<string | null> {
	const app = await loadTelegram();
	return app?.initDataUnsafe?.start_param ?? null;
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
	const parameters =
		typeof error === 'object' && error !== null && 'parameters' in error ? error.parameters : null;
	const code = isRecord(parameters) && typeof parameters.code === 'string' ? parameters.code : null;
	if (type === 'UNAUTHORIZED' || type === 'ENDPOINT_ERROR') {
		return new TelegramCallError(type, message, code);
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

/**
 * Opens a Stars invoice inside Telegram. The status only says what the sheet did: the purchase is
 * granted by the bot on `successful_payment`, so a `paid` result is followed by asking `me` again.
 */
export async function openInvoice(url: string): Promise<InvoiceStatus> {
	const app = await loadTelegram();
	if (!app?.openInvoice) throw new TelegramCallError('UNAVAILABLE');
	const open = app.openInvoice;
	return new Promise((resolve) => {
		open(url, (status) => {
			resolve(
				status === 'paid' || status === 'cancelled' || status === 'pending' ? status : 'failed'
			);
		});
	});
}

/** The machine-readable code an endpoint refused with, such as `CONSENT_REQUIRED` */
export function endpointCode(error: unknown): string | null {
	if (!(error instanceof TelegramCallError) || error.type !== 'ENDPOINT_ERROR') return null;
	return error.code ?? null;
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

/**
 * The consent German law asks for before digital goods are delivered at once (§ 356 BGB). The
 * wording is the server's, in German, because that is the text the player agrees to and the bot
 * stores; the links lead to the AGB and the Widerrufsbelehrung.
 */
export interface PurchaseConsent {
	version: string;
	text: string;
	terms: string;
	withdrawal: string;
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
	consent: PurchaseConsent | null;
	catalogue: CatalogueItem[];
}

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

function toConsent(value: unknown): PurchaseConsent | null {
	if (!isRecord(value)) return null;
	const { version, text, terms, withdrawal } = value;
	if (typeof version !== 'string' || typeof text !== 'string' || text === '') return null;
	const link = (url: unknown) => (typeof url === 'string' && url.startsWith('https://') ? url : '');
	return { version, text, terms: link(terms), withdrawal: link(withdrawal) };
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
		consent: toConsent(value.consent),
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

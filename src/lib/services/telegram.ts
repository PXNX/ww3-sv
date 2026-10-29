/*
 * The Telegram Mini App bridge. The game calls the bot's named endpoints on the bot's own server
 * (VITE_TELEGRAM_API_URL, set at build time), posting with the initData in a header; that server
 * checks the signature. Telegram's own Serverless bridge is used only when no such server is
 * configured, for a game hosted on Telegram Serverless. Either way the game never handles the bot
 * token. Telegram's script is injected only when the page was opened as a Mini App (the launch puts
 * `tgWebAppData` in the URL hash); a browser visit loads nothing extra. The initData is never read
 * into storage or logs here.
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
	initDataUnsafe?: { start_param?: string; user?: unknown };
	ready?: () => void;
	expand?: () => void;
	isVersionAtLeast?: (version: string) => boolean;
	disableVerticalSwipes?: () => void;
	Serverless?: ServerlessApi;
	openInvoice?: (url: string, callback: (status: string) => void) => void;
	requestWriteAccess?: (callback: (allowed: boolean) => void) => void;
	openTelegramLink?: (url: string) => void;
	DeviceOrientation?: TelegramMotion;
	lockOrientation?: () => void;
	unlockOrientation?: () => void;
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

const prepared = new WeakSet<object>();

/**
 * Gets the Mini App ready once: tells Telegram it is up, opens it to full height and turns off the
 * swipe down that closes it. The games are full of swipes, and on Android a downward one would
 * otherwise drag the whole app shut. Older clients lack the swipe setting; a refusal is harmless.
 */
function prepare(app: TelegramWebApp): void {
	if (prepared.has(app)) return;
	prepared.add(app);
	try {
		app.ready?.();
		app.expand?.();
		if (!app.isVersionAtLeast || app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.();
	} catch {
		// Best-effort: the game works without it
	}
}

/**
 * Loads Telegram's script once, only inside a Mini App launch; resolves to the WebApp object, or
 * null in a normal browser or when the script cannot be loaded.
 */
export function loadTelegram(): Promise<TelegramWebApp | null> {
	if (loading) return loading;
	if (typeof window === 'undefined') return Promise.resolve(null);
	const existing = webApp();
	if (existing?.initData) {
		prepare(existing);
		return (loading = Promise.resolve(existing));
	}
	if (!isTelegramLaunch(window.location.hash)) return Promise.resolve(null);

	loading = new Promise((resolve) => {
		const script = document.createElement('script');
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			const app = webApp();
			if (app) prepare(app);
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

/**
 * A game opened from a chat's game message. Telegram opens the page the bot answers the Play button
 * with, `/play/<mode>?game_session=<id>`, in its own browser and not as the Mini App, so there is no
 * initData: the session id alone ties the run's score to the player and that chat's scoreboard.
 */
export interface GroupGame {
	/** The mode id, which is also the game's short name at @BotFather */
	mode: GroupGameMode;
	session: string;
}

/** The modes offered as Telegram games in groups, for now only Block Puzzle (see todo.md) */
const GROUP_GAME_ROUTES = { blocks: '/play/blocks' } as const;

export type GroupGameMode = keyof typeof GROUP_GAME_ROUTES;

/** The game a page opened from a chat's game message belongs to, or null for any other visit */
export function groupGameFromUrl(url: {
	pathname: string;
	searchParams: Pick<URLSearchParams, 'get'>;
}): GroupGame | null {
	const session = url.searchParams.get('game_session') ?? '';
	if (!/^[0-9a-f]{32}$/.test(session)) return null;
	const path = url.pathname.replace(/\/+$/, '');
	const entry = Object.entries(GROUP_GAME_ROUTES).find(([, route]) => route === path);
	return entry ? { mode: entry[0] as GroupGameMode, session } : null;
}

/** One line of a chat's leaderboard, as Telegram ranks it (getGameHighScores) */
export interface GroupBoardRow {
	position: number;
	name: string;
	score: number;
	/** The player of this run */
	me: boolean;
}

/** Validates the leaderboard the bot sent back; null when it is not the expected shape */
export function parseGroupBoard(value: unknown): GroupBoardRow[] | null {
	if (!isRecord(value) || !Array.isArray(value.leaderboard)) return null;
	const rows: GroupBoardRow[] = [];
	for (const row of value.leaderboard) {
		if (!isRecord(row)) return null;
		const { position, name, score, me } = row;
		if (!isCount(position) || position === 0 || !isCount(score) || typeof me !== 'boolean') {
			return null;
		}
		rows.push({ position, name: typeof name === 'string' ? name : '', score, me });
	}
	return rows;
}

/**
 * Sends a finished run of a group game to the bot's server and returns the chat's leaderboard
 * around the player. The session is the credential, so no initData goes along; without the server
 * (VITE_TELEGRAM_API_URL) the run is not reported.
 */
export async function postGroupScore(game: GroupGame, score: number): Promise<GroupBoardRow[]> {
	const url = apiUrl();
	if (!url) throw new TelegramCallError('UNAVAILABLE');
	let response: Response;
	try {
		response = await fetch(`${url}/api/gamescore`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ session: game.session, game: game.mode, score })
		});
	} catch (error) {
		throw toCallError(error);
	}
	const board = parseGroupBoard(
		fromApiReply(response.status, await response.json().catch(() => null))
	);
	if (!board) throw new TelegramCallError('UNKNOWN', 'Unexpected leaderboard');
	return board;
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

/** The bot's own server, used when the bot does not run on Telegram Serverless */
function apiUrl(): string {
	const url: string = import.meta.env.VITE_TELEGRAM_API_URL ?? '';
	return url.startsWith('https://') ? url.replace(/\/+$/, '') : '';
}

/**
 * Unwraps what the bot's server answered (`{ ok: true, result }`), or throws the TelegramCallError
 * the Serverless bridge would report: 401 is a refused identity, 400 an endpoint's refusal.
 */
export function fromApiReply(status: number, body: unknown): unknown {
	if (isRecord(body) && body.ok === true && status === 200) return body.result;
	const reply = isRecord(body) ? body : {};
	if (status === 401) throw toCallError({ ...reply, type: 'UNAUTHORIZED' });
	if (status === 400) throw toCallError({ ...reply, type: 'ENDPOINT_ERROR' });
	throw new TelegramCallError(
		'UNKNOWN',
		typeof reply.description === 'string' ? reply.description : undefined
	);
}

async function postToApi<T>(
	url: string,
	initData: string,
	name: string,
	input: unknown
): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${url}/api/${name}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
			body: JSON.stringify(input)
		});
	} catch (error) {
		throw toCallError(error);
	}
	const body: unknown = await response.json().catch(() => null);
	return fromApiReply(response.status, body) as T;
}

/**
 * Calls one of the bot's endpoints; rejects with a TelegramCallError when it fails. The bot's own
 * server is used whenever one is configured: Telegram's script always has a Serverless bridge, but
 * that bridge only posts to /api/<name> on the page's own origin, which is the game's host and has
 * no such endpoints. The bridge is for a game hosted on Telegram Serverless, where none is set.
 */
export async function call<T>(name: string, input: unknown = {}): Promise<T> {
	const app = await loadTelegram();
	if (!app?.initData) throw new TelegramCallError('UNAVAILABLE');
	const url = apiUrl();
	if (url) return postToApi<T>(url, app.initData, name, input);
	const serverless = app.Serverless;
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
// Motion detection (Bot API 8.0)

/** How Telegram's motion sensor is started, with its refresh rate in milliseconds (20 to 1000) */
export interface TelegramMotionParams {
	refresh_rate?: number;
	need_absolute?: boolean;
}

/**
 * The Mini App's motion sensor, added in Bot API 8.0. The angles are in radians. Telegram keeps the
 * latest values on the object, so the game reads them once per frame instead of handling an event
 * for every change, and it reports `UNSUPPORTED` when the device has no sensor.
 */
export interface TelegramMotion {
	isStarted?: boolean;
	absolute?: boolean;
	alpha?: number | null;
	beta?: number | null;
	gamma?: number | null;
	start?: (params?: TelegramMotionParams, callback?: (started: boolean) => void) => unknown;
	stop?: (callback?: (stopped: boolean) => void) => unknown;
}

/** Clients older than Bot API 8.0 never answer a start request, so the game does not wait forever */
const MOTION_TIMEOUT_MS = 1500;

/**
 * Starts the Mini App's motion sensor and locks the screen to its current orientation, so rolling
 * the phone to steer cannot also turn the page and mix up the axes. Resolves null outside a Mini
 * App, on clients without Bot API 8.0 and on devices without a sensor, so the caller can fall back.
 */
export async function startMotion(refreshRateMs = 20): Promise<TelegramMotion | null> {
	const app = await loadTelegram();
	const sensor = app?.DeviceOrientation;
	if (!sensor?.start) return null;
	const started = await new Promise<boolean>((resolve) => {
		const timeout = setTimeout(() => resolve(false), MOTION_TIMEOUT_MS);
		try {
			sensor.start?.({ refresh_rate: refreshRateMs, need_absolute: false }, (result) => {
				clearTimeout(timeout);
				resolve(result === true);
			});
		} catch {
			clearTimeout(timeout);
			resolve(false);
		}
	});
	if (!started) return null;
	app?.lockOrientation?.();
	return sensor;
}

/** Stops the motion sensor and releases the orientation lock again */
export function stopMotion(sensor: TelegramMotion): void {
	try {
		sensor.stop?.();
	} finally {
		webApp()?.unlockOrientation?.();
	}
}

// ---------------------------------------------------------------------------------------------
// The `me` endpoint

export interface TelegramUser {
	id: number;
	username: string | null;
	firstName: string;
	/** Telegram's profile photo, when the launch carries one (an https URL) */
	photoUrl: string | null;
}

/**
 * The Telegram account the Mini App was opened with, read from the launch data without waiting
 * for the bot: good for showing who is playing, never for trusting (the bot checks that itself).
 */
export function toLaunchUser(value: unknown): TelegramUser | null {
	if (!isRecord(value)) return null;
	const { id, username, first_name: firstName, photo_url: photoUrl } = value;
	if (typeof id !== 'number' || !Number.isSafeInteger(id) || typeof firstName !== 'string') {
		return null;
	}
	return {
		id,
		username: typeof username === 'string' && username !== '' ? username : null,
		firstName,
		photoUrl: typeof photoUrl === 'string' && photoUrl.startsWith('https://') ? photoUrl : null
	};
}

/** The launch's Telegram account, once Telegram is loaded; null outside a Mini App */
export async function launchUser(): Promise<TelegramUser | null> {
	const app = await loadTelegram();
	return toLaunchUser(app?.initDataUnsafe?.user);
}

/**
 * Asks Telegram's own dialog whether the bot may message the player (for streak reminders);
 * resolves true when it may. Players who already started the bot are not asked again by Telegram.
 */
export async function requestWriteAccess(): Promise<boolean> {
	const app = await loadTelegram();
	const request = app?.requestWriteAccess;
	if (!request) return false;
	return new Promise((resolve) => {
		try {
			request((allowed) => resolve(allowed === true));
		} catch {
			resolve(false);
		}
	});
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

/** The player's invite link and what it earned, as the bot counts it */
export interface TelegramInvite {
	/** A t.me link that starts the bot with the player's invite code */
	link: string;
	friends: number;
	/** Friends that earn a reward */
	cap: number;
	/** Revival tokens per friend */
	revivesPerFriend: number;
}

/** A Telegram share sheet for a link, with a line of text to go with it */
export function telegramShareUrl(link: string, text: string): string {
	return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

/** A Telegram share sheet for the invite link, with a line of text to go with it */
export function inviteShareUrl(invite: TelegramInvite, text: string): string {
	return telegramShareUrl(invite.link, text);
}

/** Opens a t.me link inside Telegram (a share sheet, a chat); false outside a Mini App */
export async function openTelegramLink(url: string): Promise<boolean> {
	const app = await loadTelegram();
	if (!app?.openTelegramLink) return false;
	app.openTelegramLink(url);
	return true;
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
	invite: TelegramInvite | null;
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

function toInvite(value: unknown): TelegramInvite | null {
	if (!isRecord(value)) return null;
	const { link, friends, cap, revives_per_friend: revivesPerFriend } = value;
	if (typeof link !== 'string' || !link.startsWith('https://t.me/')) return null;
	if (!isCount(friends) || !isCount(cap) || !isCount(revivesPerFriend)) return null;
	return { link, friends, cap, revivesPerFriend };
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
			firstName,
			photoUrl: null
		},
		revives,
		pro,
		proUntil: proUntil ?? null,
		consented: consented ?? false,
		consent: toConsent(value.consent),
		catalogue: items as CatalogueItem[],
		invite: toInvite(value.invite)
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

/*
 * A stand-in for the Telegram Mini App and the bot's server, for development and demos. The URL
 * flag `?telegram=mock` (kept for the session like `?squad=dev`) stands in for the real launch:
 * loadTelegram resolves a WebApp carrying a made-up player, and call/openInvoice/postGroupScore
 * answer from a fake account database that lives in localStorage, so purchases, streaks and group
 * scores survive a reload. Nothing here reaches the network, and the flag is always opt-in.
 */
import { localStore } from '#lib/services/storage.js';
import type {
	GroupBoardRow,
	GroupGame,
	GroupScoreResult,
	InvoiceStatus,
	TelegramUser,
	TelegramWebApp
} from '#lib/services/telegram.js';

/** The URL parameter that turns the mock on, and the session storage key that remembers it */
const MOCK_FLAG_KEY = 'ww3-telegram-mock';

/** The made-up player the mock logs in as */
const MOCK_USER: TelegramUser = {
	id: 1337,
	username: 'mock_player',
	firstName: 'Mock',
	photoUrl: null
};

/** What the bot sells in the mock, priced in whole Stars like the real catalogue */
const CATALOGUE: {
	sku: string;
	title: string;
	stars: number;
	revives: number;
	subscription: boolean;
	look?: { part: string; value: string };
}[] = [
	{ sku: 'revive-1', title: 'One revival', stars: 100, revives: 1, subscription: false },
	{ sku: 'revive-5', title: 'Five revivals', stars: 400, revives: 5, subscription: false },
	{ sku: 'pro-month', title: 'Pro for a month', stars: 500, revives: 0, subscription: true },
	// The same looks and skus the real bot sells
	{
		sku: 'look_tinfoil',
		title: 'Tinfoil hat',
		stars: 50,
		revives: 0,
		subscription: false,
		look: { part: 'hat', value: 'tinfoil' }
	},
	{
		sku: 'look_laser',
		title: 'Laser eyes',
		stars: 50,
		revives: 0,
		subscription: false,
		look: { part: 'eyes', value: 'laser' }
	},
	{
		sku: 'look_gold',
		title: 'Gold shirt',
		stars: 30,
		revives: 0,
		subscription: false,
		look: { part: 'shirtColor', value: '#d4a017' }
	},
	{
		sku: 'look_neon',
		title: 'Neon pink hair',
		stars: 30,
		revives: 0,
		subscription: false,
		look: { part: 'hairColor', value: '#ff4fa3' }
	}
];

/** The § 356 BGB wording the server would send, shortened for the mock */
const CONSENT = {
	version: 'mock-1',
	text: 'Ich stimme zu, dass die gekauften Erweckungen sofort nach dem Kauf gutgeschrieben werden.',
	terms: 'https://mock.example/agb',
	withdrawal: 'https://mock.example/widerruf'
};

const INVITE = {
	link: 'https://t.me/game_ww3_bot?start=mock1337',
	friends: 2,
	cap: 5,
	revives_per_friend: 1
};

/** The rivals that stand on a chat's board before the mock player posts a run */
const RIVALS = [
	{ name: 'Anna', score: 120 },
	{ name: 'Boris', score: 90 },
	{ name: 'Chen', score: 60 }
];

/** The fake account database, as the bot's `me` endpoint would describe it */
interface MockDb {
	revives: number;
	pro: boolean;
	proUntil: string | null;
	consented: boolean;
	/** Skus of the looks bought */
	owned: string[];
	streak: { streak: number; expires_at: number | null };
	boards: Record<string, { name: string; score: number; me: boolean }[]>;
}

const DB_KEY = 'telegram:mock:db';

function seedDb(): MockDb {
	return {
		revives: 3,
		pro: false,
		proUntil: null,
		consented: false,
		owned: [],
		streak: { streak: 0, expires_at: null },
		boards: {}
	};
}

/** The database of this visit, loaded once from storage and kept in memory from then on */
let db: MockDb | undefined;

function loadDb(): MockDb {
	if (db) return db;
	const stored = localStore().read<MockDb>(DB_KEY, seedDb());
	db = {
		...seedDb(),
		...stored,
		streak: { ...seedDb().streak, ...(stored.streak ?? {}) },
		boards: (stored.boards ?? {}) as MockDb['boards'],
		owned: Array.isArray(stored.owned) ? stored.owned : []
	};
	return db;
}

function saveDb(): void {
	if (db) localStore().write(DB_KEY, db);
}

/** True when the current visit asked for the mock Telegram login */
export function useMockTelegram(): boolean {
	if (typeof window === 'undefined') return false;
	let flagged = new URLSearchParams(window.location.search).get('telegram') === 'mock';
	try {
		if (flagged) sessionStorage.setItem(MOCK_FLAG_KEY, '1');
		else flagged = sessionStorage.getItem(MOCK_FLAG_KEY) === '1';
	} catch {
		// Storage blocked: the URL alone decides
	}
	return flagged;
}

let webApp: TelegramWebApp | undefined;

/** The WebApp object the mock launch carries: the player and an initData-shaped string */
export function mockWebApp(): TelegramWebApp {
	if (webApp) return webApp;
	webApp = {
		initData: `user=${encodeURIComponent(JSON.stringify(MOCK_USER))}&hash=mock`,
		initDataUnsafe: { user: { ...MOCK_USER, first_name: MOCK_USER.firstName } },
		ready() {},
		expand() {},
		isVersionAtLeast: () => true,
		disableVerticalSwipes() {}
	};
	return webApp;
}

/** A refusal the way the bot's server would report it, with its endpoint code */
function endpointError(code: string): Error {
	return Object.assign(new Error(`Mock bot refused: ${code}`), {
		type: 'ENDPOINT_ERROR',
		parameters: { code }
	});
}

const isCount = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** The `me` answer for the current state of the fake database */
function mePayload(db: MockDb): Record<string, unknown> {
	return {
		user: {
			id: MOCK_USER.id,
			username: MOCK_USER.username,
			first_name: MOCK_USER.firstName,
			photo_url: MOCK_USER.photoUrl
		},
		wallet: { revives: db.revives },
		pro: db.pro,
		pro_until: db.proUntil,
		consented: db.consented,
		consent: CONSENT,
		catalogue: CATALOGUE,
		owned: db.owned,
		invite: INVITE
	};
}

/**
 * Answers one of the bot's endpoints from the fake database. Only the endpoints the game calls
 * exist here; anything else is a refusal, like an unknown route on the real server.
 */
export async function mockCall(name: string, input: unknown): Promise<unknown> {
	const db = loadDb();
	switch (name) {
		case 'me':
			return mePayload(db);
		case 'invoice': {
			const { sku, consent } = (input ?? {}) as { sku?: unknown; consent?: unknown };
			if (consent !== true && !db.consented) throw endpointError('CONSENT_REQUIRED');
			const item = CATALOGUE.find((entry) => entry.sku === sku);
			if (!item) throw endpointError('UNKNOWN_SKU');
			if (item.look) {
				if (db.owned.includes(item.sku)) throw endpointError('ALREADY_OWNED');
				db.owned.push(item.sku);
			} else if (item.subscription) {
				db.pro = true;
				db.proUntil = new Date(Date.now() + 30 * 86_400_000).toISOString();
			} else {
				db.revives += item.revives;
			}
			if (consent === true) db.consented = true;
			saveDb();
			return { url: `https://mock.example/invoice/${item.sku}` };
		}
		case 'spend': {
			if (db.revives <= 0) throw endpointError('NO_REVIVES');
			db.revives -= 1;
			saveDb();
			return { wallet: { revives: db.revives } };
		}
		case 'streak': {
			const { streak, expires_at } = (input ?? {}) as { streak?: unknown; expires_at?: unknown };
			db.streak = {
				streak: isCount(streak) ? streak : 0,
				expires_at: isCount(expires_at) ? expires_at : null
			};
			saveDb();
			return {};
		}
		default:
			throw endpointError('UNKNOWN_ENDPOINT');
	}
}

/** The invoice sheet always closes as paid in the mock, so the booking poll finds it */
export async function mockInvoice(): Promise<InvoiceStatus> {
	return 'paid';
}

/** The "may the bot message the player" dialog answers yes in the mock */
export async function mockWriteAccess(): Promise<boolean> {
	return true;
}

/**
 * Answers a group run: the chat's board with the mock player ranked in, and the strongest rival
 * whose best the run beat.
 */
export async function mockPostGroupScore(
	game: GroupGame,
	score: number
): Promise<GroupScoreResult> {
	const db = loadDb();
	const board = (db.boards[game.session] ??= RIVALS.map((rival) => ({ ...rival, me: false })));
	board.push({ name: MOCK_USER.firstName, score, me: true });
	board.sort((a, b) => b.score - a.score);
	const rows: GroupBoardRow[] = board.map((row, index) => ({
		position: index + 1,
		name: row.name,
		score: row.score,
		me: row.me
	}));
	db.boards[game.session] = board;
	saveDb();
	const overtaken = rows
		.filter((row) => !row.me && row.score < score)
		.sort((a, b) => b.score - a.score)[0];
	return { rows, overtaken: overtaken ? { name: overtaken.name, score: overtaken.score } : null };
}

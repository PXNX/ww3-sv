/*
 * Friends and raid squads, client side. The bot's server keeps the friend relations, presence and
 * squads (see docs/squad-api.md); the game lists them, sends invites and answers, and relays game
 * data between squad mates over a WebSocket. Every reply is validated here before the store sees
 * it. Without a server, a fake backend between browser tabs (squadDev.ts) stands in for it.
 */
import { call, endpointCode, isTelegramLaunch, loadTelegram } from '#lib/services/telegram.js';

/** Members per squad, the leader included */
export const SQUAD_SIZE = 3;
/** How long an invite can be answered */
export const INVITE_TTL_MS = 60_000;
/** A player counts as online this long after their last heartbeat */
export const ONLINE_WINDOW_MS = 60_000;
/** How often the open app reports that it is open */
export const PRESENCE_INTERVAL_MS = 30_000;
/** How long a shared squad link can be used to join */
export const SQUAD_LINK_TTL_MS = 60 * 60_000;
/** The start parameter of a shared squad link: `squad_` and the link's code */
const SQUAD_START_PREFIX = 'squad_';
/** A link code fits a Telegram start parameter: letters, digits, `_` and `-` */
const SQUAD_CODE = /^[A-Za-z0-9_-]{4,40}$/;

export interface Friend {
	id: string;
	name: string;
	photoUrl?: string;
	online: boolean;
	inRaid: boolean;
}

export interface SquadMember {
	id: string;
	name: string;
	photoUrl?: string;
}

export interface Squad {
	id: string;
	leaderId: string;
	/** In joining order, the leader included; 1 to SQUAD_SIZE entries */
	members: SquadMember[];
}

/** An invite the player received */
export interface SquadInvite {
	id: string;
	from: Friend;
	/** Milliseconds since the epoch */
	expiresAt: number;
}

/** An invite the player sent that is still open */
export interface OutgoingInvite {
	id: string;
	toId: string;
	expiresAt: number;
}

export interface SquadState {
	/** The player's own id, as the server knows it */
	you: string;
	squad: Squad | null;
	invites: SquadInvite[];
	outgoing: OutgoingInvite[];
}

/** The codes the squad endpoints refuse with */
export const SQUAD_ERROR_CODES = [
	'SQUAD_FULL',
	'NOT_ONLINE',
	'NOT_FRIENDS',
	'INVITE_EXPIRED',
	'NOT_LEADER',
	'NOT_IN_SQUAD',
	'ALREADY_IN_SQUAD'
] as const;

export type SquadErrorCode = (typeof SQUAD_ERROR_CODES)[number];

/** A squad error code from whatever a call threw, or null for any other failure */
export function squadErrorCode(error: unknown): SquadErrorCode | null {
	const code = endpointCode(error);
	return SQUAD_ERROR_CODES.find((known) => known === code) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Parsers: never trust a shape

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isId = (value: unknown): value is string =>
	typeof value === 'string' && value !== '' && value.length <= 64;

const isTime = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value > 0;

/** A display name, trimmed and capped; null when there is none */
function toName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const name = value.trim().slice(0, 64);
	return name === '' ? null : name;
}

function withPhoto<T extends object>(entry: T, photo: unknown): T & { photoUrl?: string } {
	return typeof photo === 'string' && photo.startsWith('https://')
		? { ...entry, photoUrl: photo }
		: entry;
}

/** Parses each entry of a list; null when it is not a list or any entry is malformed */
function parseList<T>(value: unknown, parse: (entry: unknown) => T | null): T[] | null {
	if (!Array.isArray(value)) return null;
	const items = value.map(parse);
	return items.every((item) => item !== null) ? (items as T[]) : null;
}

export function parseFriend(value: unknown): Friend | null {
	if (!isRecord(value)) return null;
	const { id, online, in_raid: inRaid } = value;
	const name = toName(value.name);
	if (!isId(id) || name === null || typeof online !== 'boolean') return null;
	if (inRaid !== undefined && typeof inRaid !== 'boolean') return null;
	return withPhoto({ id, name, online, inRaid: inRaid ?? false }, value.photo_url);
}

export function parseMember(value: unknown): SquadMember | null {
	if (!isRecord(value)) return null;
	const name = toName(value.name);
	if (!isId(value.id) || name === null) return null;
	return withPhoto({ id: value.id, name }, value.photo_url);
}

/** A squad, or null when malformed: 1 to 3 distinct members, the leader among them */
export function parseSquad(value: unknown): Squad | null {
	if (!isRecord(value)) return null;
	const { id, leader_id: leaderId } = value;
	const members = parseList(value.members, parseMember);
	if (!isId(id) || !isId(leaderId) || !members) return null;
	if (members.length < 1 || members.length > SQUAD_SIZE) return null;
	const ids = new Set(members.map((member) => member.id));
	if (ids.size !== members.length || !ids.has(leaderId)) return null;
	return { id, leaderId, members };
}

export function parseInvite(value: unknown): SquadInvite | null {
	if (!isRecord(value)) return null;
	const from = parseFriend(value.from);
	if (!isId(value.id) || !from || !isTime(value.expires_at)) return null;
	return { id: value.id, from, expiresAt: value.expires_at };
}

export function parseOutgoing(value: unknown): OutgoingInvite | null {
	if (!isRecord(value)) return null;
	const { id, to_id: toId, expires_at: expiresAt } = value;
	if (!isId(id) || !isId(toId) || !isTime(expiresAt)) return null;
	return { id, toId, expiresAt };
}

/** A link anyone can open to join the player's squad */
export interface SquadLink {
	code: string;
	expiresAt: number;
}

export function parseSquadLink(value: unknown): SquadLink | null {
	if (!isRecord(value)) return null;
	const { code, expires_at: expiresAt } = value;
	if (typeof code !== 'string' || !SQUAD_CODE.test(code) || !isTime(expiresAt)) return null;
	return { code, expiresAt };
}

/** The Mini App start parameter that joins the squad behind a link code */
export function squadStartParam(code: string): string {
	return SQUAD_START_PREFIX + code;
}

/** The link code in a start parameter such as `squad_ab12cd`, or null for any other */
export function squadCodeOf(startParam: string | null | undefined): string | null {
	if (!startParam?.startsWith(SQUAD_START_PREFIX)) return null;
	const code = startParam.slice(SQUAD_START_PREFIX.length);
	return SQUAD_CODE.test(code) ? code : null;
}

/** `squad` is either a squad or null; anything else is malformed */
function parseSquadOrNull(value: unknown): Squad | null | undefined {
	if (value === null) return null;
	return parseSquad(value) ?? undefined;
}

export function parseFriends(value: unknown): Friend[] | null {
	if (!isRecord(value)) return null;
	return parseList(value.friends, parseFriend);
}

export function parseSquadState(value: unknown): SquadState | null {
	if (!isRecord(value) || !isId(value.you)) return null;
	const squad = parseSquadOrNull(value.squad ?? null);
	const invites = parseList(value.invites ?? [], parseInvite);
	const outgoing = parseList(value.outgoing ?? [], parseOutgoing);
	if (squad === undefined || !invites || !outgoing) return null;
	return { you: value.you, squad, invites, outgoing };
}

/** The `{ squad }` reply of `squad_respond` and `squad_kick` */
export function parseSquadReply(value: unknown): { squad: Squad | null } | null {
	if (!isRecord(value)) return null;
	const squad = parseSquadOrNull(value.squad ?? null);
	return squad === undefined ? null : { squad };
}

// ---------------------------------------------------------------------------------------------
// Realtime messages

export type TransportStatus = 'connecting' | 'open' | 'closed';

export type InviteGoneReason = 'accepted' | 'declined' | 'expired' | 'cancelled';

/** What arrives over a transport */
export type SquadEvent =
	| { type: 'welcome'; you: string }
	| { type: 'squad'; squad: Squad | null }
	| { type: 'invite'; invite: SquadInvite }
	| { type: 'invite_gone'; inviteId: string; reason: InviteGoneReason }
	| { type: 'presence'; friendId: string; online: boolean; inRaid: boolean }
	| { type: 'relay'; from: string; payload: unknown }
	| { type: 'pong' }
	/** Not from the server: the transport reports its own connection state this way */
	| { type: 'connection'; status: TransportStatus };

/** What the client sends over a transport (`hello` is sent by the transport itself) */
export type SquadClientMessage =
	{ type: 'relay'; payload: unknown; to?: string } | { type: 'ping' };

const GONE_REASONS: readonly InviteGoneReason[] = ['accepted', 'declined', 'expired', 'cancelled'];

/** Validates one message from the server; null for anything unknown or malformed */
export function parseSquadEvent(value: unknown): SquadEvent | null {
	if (!isRecord(value)) return null;
	switch (value.type) {
		case 'welcome':
			return isId(value.you) ? { type: 'welcome', you: value.you } : null;
		case 'squad': {
			const squad = parseSquadOrNull(value.squad ?? null);
			return squad === undefined ? null : { type: 'squad', squad };
		}
		case 'invite': {
			const invite = parseInvite(value.invite);
			return invite ? { type: 'invite', invite } : null;
		}
		case 'invite_gone': {
			const reason = GONE_REASONS.find((known) => known === value.reason) ?? 'cancelled';
			return isId(value.invite_id)
				? { type: 'invite_gone', inviteId: value.invite_id, reason }
				: null;
		}
		case 'presence': {
			const { friend_id: friendId, online, in_raid: inRaid } = value;
			if (!isId(friendId) || typeof online !== 'boolean') return null;
			return { type: 'presence', friendId, online, inRaid: inRaid === true };
		}
		case 'relay':
			return isId(value.from) && 'payload' in value
				? { type: 'relay', from: value.from, payload: value.payload }
				: null;
		case 'pong':
			return { type: 'pong' };
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------------------------
// The endpoints

/** The squad endpoints; the bot's server or the dev fake behind one face */
export interface SquadApi {
	friends(): Promise<Friend[]>;
	state(): Promise<SquadState>;
	presence(inRaid: boolean): Promise<void>;
	invite(friendId: string): Promise<OutgoingInvite>;
	/** The joined squad on accept, null on decline */
	respond(inviteId: string, accept: boolean): Promise<Squad | null>;
	leave(): Promise<void>;
	kick(memberId: string): Promise<Squad | null>;
	/** A link to share that lets anyone join the player's squad (or the one they would lead) */
	link(): Promise<SquadLink>;
	/** Joins the squad behind a shared link */
	join(code: string): Promise<Squad>;
}

/** Thrown when a reply does not have the expected shape */
export class SquadReplyError extends Error {
	constructor(endpoint: string) {
		super(`Malformed reply from ${endpoint}`);
		this.name = 'SquadReplyError';
	}
}

function checked<T>(endpoint: string, value: T | null): T {
	if (value === null) throw new SquadReplyError(endpoint);
	return value;
}

/** The squad endpoints of the bot's server, through `call()` */
export const remoteSquadApi: SquadApi = {
	async friends() {
		return checked('friends', parseFriends(await call('friends')));
	},
	async state() {
		return checked('squad_state', parseSquadState(await call('squad_state')));
	},
	async presence(inRaid) {
		await call('presence', { in_raid: inRaid });
	},
	async invite(friendId) {
		return checked(
			'squad_invite',
			parseOutgoing(await call('squad_invite', { friend_id: friendId }))
		);
	},
	async respond(inviteId, accept) {
		const reply = parseSquadReply(await call('squad_respond', { invite_id: inviteId, accept }));
		return checked('squad_respond', reply).squad;
	},
	async leave() {
		await call('squad_leave');
	},
	async kick(memberId) {
		const reply = parseSquadReply(await call('squad_kick', { member_id: memberId }));
		return checked('squad_kick', reply).squad;
	},
	async link() {
		return checked('squad_link', parseSquadLink(await call('squad_link')));
	},
	async join(code) {
		const reply = parseSquadReply(await call('squad_join', { code }));
		return checked('squad_join', reply?.squad ?? null);
	}
};

// ---------------------------------------------------------------------------------------------
// Transports

export interface SquadTransport {
	send(message: SquadClientMessage): void;
	/** Calls the handler for every event; returns the unsubscribe function */
	subscribe(handler: (event: SquadEvent) => void): () => void;
	close(): void;
	readonly status: TransportStatus;
}

/** The squad socket on the bot's own server, or '' when there is none (e.g. on Serverless) */
export function squadSocketUrl(
	apiUrl: string = import.meta.env.VITE_TELEGRAM_API_URL ?? ''
): string {
	if (!apiUrl.startsWith('https://')) return '';
	return `wss://${apiUrl.slice('https://'.length).replace(/\/+$/, '')}/ws/squad`;
}

/** The raw initData of the Mini App launch, for the socket's hello; '' outside a Mini App */
export async function launchInitData(): Promise<string> {
	return (await loadTelegram())?.initData ?? '';
}

const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
const PING_MS = 25_000;
/** The close code the server uses for a refused hello: reconnecting cannot help */
const CLOSE_UNAUTHORIZED = 4001;

/** Delay before reconnect attempt `attempt` (0-based): doubling from 1 s up to 30 s, with jitter */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
	const base = Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** Math.min(attempt, 10));
	return Math.round(base * (0.75 + random() * 0.5));
}

/** A transport that fans its events out to subscribers; shared by both implementations */
export class EventHub {
	#handlers = new Set<(event: SquadEvent) => void>();

	subscribe(handler: (event: SquadEvent) => void): () => void {
		this.#handlers.add(handler);
		return () => this.#handlers.delete(handler);
	}

	emit(event: SquadEvent): void {
		for (const handler of [...this.#handlers]) {
			try {
				handler(event);
			} catch (error) {
				console.error(error);
			}
		}
	}
}

/**
 * The squad WebSocket: says hello with the initData, keeps the line alive with pings, and
 * reconnects with backoff until closed. Relay messages sent while disconnected are dropped (game
 * data goes stale within a frame or two anyway).
 */
export function webSocketTransport(url: string, initData: string): SquadTransport {
	const hub = new EventHub();
	let status: TransportStatus = 'connecting';
	let socket: WebSocket | null = null;
	let closed = false;
	let attempt = 0;
	let retry: ReturnType<typeof setTimeout> | undefined;
	let ping: ReturnType<typeof setInterval> | undefined;

	const setStatus = (next: TransportStatus) => {
		if (next === status) return;
		status = next;
		hub.emit({ type: 'connection', status });
	};

	const connect = () => {
		if (closed) return;
		setStatus('connecting');
		const ws = new WebSocket(url);
		socket = ws;
		ws.addEventListener('open', () => {
			ws.send(JSON.stringify({ type: 'hello', initData }));
		});
		ws.addEventListener('message', (message) => {
			if (typeof message.data !== 'string') return;
			let data: unknown;
			try {
				data = JSON.parse(message.data);
			} catch {
				return;
			}
			const event = parseSquadEvent(data);
			if (!event) return;
			if (event.type === 'welcome') {
				attempt = 0;
				setStatus('open');
				clearInterval(ping);
				ping = setInterval(() => send({ type: 'ping' }), PING_MS);
			}
			hub.emit(event);
		});
		ws.addEventListener('close', (event) => {
			clearInterval(ping);
			if (socket !== ws) return;
			socket = null;
			if (closed || event.code === CLOSE_UNAUTHORIZED) {
				closed = true;
				setStatus('closed');
				return;
			}
			setStatus('connecting');
			retry = setTimeout(connect, reconnectDelay(attempt));
			attempt += 1;
		});
	};

	const send = (message: SquadClientMessage) => {
		if (socket?.readyState === WebSocket.OPEN && status === 'open') {
			socket.send(JSON.stringify(message));
		}
	};

	connect();

	return {
		send,
		subscribe: (handler) => hub.subscribe(handler),
		close() {
			closed = true;
			clearTimeout(retry);
			clearInterval(ping);
			const ws = socket;
			socket = null;
			ws?.close(1000);
			setStatus('closed');
		},
		get status() {
			return status;
		}
	};
}

// ---------------------------------------------------------------------------------------------
// Choosing the backend

/** Remembers `?squad=dev` for the tab, so it survives navigating to another page */
const DEV_FLAG_KEY = 'ww3-squad-dev-mode';

/**
 * Whether to use the fake backend between browser tabs: under `vite dev` outside Telegram, or
 * whenever the URL asked for it with `?squad=dev` (remembered for the rest of the tab's life).
 */
export function useLocalSquad(): boolean {
	if (typeof window === 'undefined') return false;
	let flagged = new URLSearchParams(window.location.search).get('squad') === 'dev';
	try {
		if (flagged) sessionStorage.setItem(DEV_FLAG_KEY, '1');
		else flagged = sessionStorage.getItem(DEV_FLAG_KEY) === '1';
	} catch {
		// Storage blocked: the URL alone decides
	}
	if (flagged) return true;
	const inTelegram =
		isTelegramLaunch(window.location.hash) ||
		Boolean(
			(window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData
		);
	return import.meta.env.DEV && !inTelegram;
}

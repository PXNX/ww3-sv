/*
 * A stand-in for the bot's squad endpoints during development: the browser tabs of one machine
 * play each other's friends. The shared "server database" lives in localStorage, each tab keeps a
 * random identity in sessionStorage, and a BroadcastChannel tells the other tabs that something
 * changed or carries relayed game data. The rules follow docs/squad-api.md, so the client can be
 * tested end to end with two tabs open on `?squad=dev`.
 */
import { TelegramCallError } from '#lib/services/telegram.js';
import {
	EventHub,
	INVITE_TTL_MS,
	ONLINE_WINDOW_MS,
	SQUAD_LINK_TTL_MS,
	SQUAD_SIZE,
	type Friend,
	type OutgoingInvite,
	type Squad,
	type SquadApi,
	type SquadClientMessage,
	type SquadErrorCode,
	type SquadEvent,
	type SquadInvite,
	type SquadLink,
	type SquadState,
	type SquadTransport
} from '#lib/services/squad.js';

export const DEV_CHANNEL = 'ww3-squad-dev';
const DB_KEY = 'ww3-squad-dev-db';
const IDENTITY_KEY = 'ww3-squad-dev-identity';
/** Tabs not heard of for this long are forgotten altogether */
const FORGET_MS = 10 * 60_000;

export interface DevIdentity {
	id: string;
	name: string;
}

interface DevPlayer extends DevIdentity {
	lastSeen: number;
	inRaid: boolean;
}

interface DevSquad {
	id: string;
	leaderId: string;
	/** Player ids in joining order */
	members: string[];
}

interface DevInvite {
	id: string;
	from: string;
	to: string;
	expiresAt: number;
}

interface DevLink {
	code: string;
	from: string;
	expiresAt: number;
}

export interface DevDb {
	players: Record<string, DevPlayer>;
	squads: DevSquad[];
	invites: DevInvite[];
	/** Shared squad links; missing in databases written before links existed */
	links?: DevLink[];
}

/** Two friends who are never online, so the list also shows what offline looks like */
export const DEV_OFFLINE_FRIENDS: readonly DevIdentity[] = [
	{ id: 'dev-offline-1', name: 'Sgt. Pepper' },
	{ id: 'dev-offline-2', name: 'Major Tom' }
];

export type DevBusMessage =
	| { kind: 'changed' }
	| { kind: 'relay'; squadId: string; from: string; to?: string; payload: unknown };

/** The shared database; localStorage in the browser, a plain object in tests */
export interface DevStorage {
	read(): DevDb | null;
	write(db: DevDb): void;
}

/** A broadcast line between tabs that, like BroadcastChannel, does not echo to the sender */
export interface DevChannel {
	post(message: DevBusMessage): void;
	listen(handler: (message: DevBusMessage) => void): () => void;
	close(): void;
}

const emptyDb = (): DevDb => ({ players: {}, squads: [], invites: [], links: [] });

const refuse = (code: SquadErrorCode) => new TelegramCallError('ENDPOINT_ERROR', code, code);

const randomId = (prefix: string) =>
	`${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export interface LocalSquadOptions {
	storage: DevStorage;
	channel: DevChannel;
	now?: () => number;
	/** Re-checks invite expiry every second; off in tests, which drive time themselves */
	ticking?: boolean;
}

/** One tab's view of the fake server: the endpoints plus the realtime transport */
export class LocalSquadBackend implements SquadApi {
	readonly me: DevIdentity;
	readonly transport: SquadTransport;
	#storage: DevStorage;
	#channel: DevChannel;
	#now: () => number;
	#hub = new EventHub();
	#unlisten: () => void;
	#tick: ReturnType<typeof setInterval> | undefined;
	#closed = false;
	/** What this tab last told its subscribers, to turn database changes into events */
	#seen: {
		squad: string;
		invites: Set<string>;
		outgoing: Set<string>;
		friends: Map<string, string>;
	};

	constructor(me: DevIdentity, options: LocalSquadOptions) {
		this.me = me;
		this.#storage = options.storage;
		this.#channel = options.channel;
		this.#now = options.now ?? Date.now;
		this.#seen = { squad: 'null', invites: new Set(), outgoing: new Set(), friends: new Map() };
		this.#unlisten = this.#channel.listen((message) => this.#onBus(message));
		if (options.ticking ?? true) this.#tick = setInterval(() => this.#diff(), 1000);

		// Announce this tab right away
		this.#mutate((db) => this.#touch(db, false));
		this.#diff();

		const closed = () => this.#closed;
		this.transport = {
			send: (message) => this.#send(message),
			subscribe: (handler) => this.#hub.subscribe(handler),
			close: () => this.dispose(),
			get status() {
				return closed() ? 'closed' : 'open';
			}
		};
	}

	/** Takes this tab off the fake server, as if the app was closed */
	dispose(): void {
		if (this.#closed) return;
		this.#mutate((db) => {
			this.#leave(db, this.me.id);
			db.invites = db.invites.filter(
				(invite) => invite.from !== this.me.id && invite.to !== this.me.id
			);
			delete db.players[this.me.id];
		});
		this.#closed = true;
		clearInterval(this.#tick);
		this.#unlisten();
		this.#channel.close();
		this.#hub.emit({ type: 'connection', status: 'closed' });
	}

	// -- The endpoints ----------------------------------------------------------------------------

	async friends(): Promise<Friend[]> {
		return this.#friendsOf(this.#read());
	}

	async state(): Promise<SquadState> {
		return this.#stateOf(this.#read());
	}

	async presence(inRaid: boolean): Promise<void> {
		this.#mutate((db) => this.#touch(db, inRaid));
	}

	async invite(friendId: string): Promise<OutgoingInvite> {
		return this.#mutate((db) => {
			const now = this.#now();
			if (friendId === this.me.id) throw refuse('NOT_FRIENDS');
			const friend = db.players[friendId];
			if (!friend) {
				if (DEV_OFFLINE_FRIENDS.some((entry) => entry.id === friendId)) throw refuse('NOT_ONLINE');
				throw refuse('NOT_FRIENDS');
			}
			if (!this.#online(friend)) throw refuse('NOT_ONLINE');
			const squad = this.#squadOf(db, this.me.id);
			if (squad && squad.leaderId !== this.me.id) throw refuse('NOT_LEADER');
			if (squad?.members.includes(friendId)) throw refuse('ALREADY_IN_SQUAD');

			const existing = db.invites.find(
				(entry) => entry.from === this.me.id && entry.to === friendId
			);
			if (existing) {
				existing.expiresAt = now + INVITE_TTL_MS;
				return { id: existing.id, toId: friendId, expiresAt: existing.expiresAt };
			}
			const open = db.invites.filter((entry) => entry.from === this.me.id).length;
			if ((squad?.members.length ?? 1) + open >= SQUAD_SIZE) throw refuse('SQUAD_FULL');
			const invite = {
				id: randomId('inv'),
				from: this.me.id,
				to: friendId,
				expiresAt: now + INVITE_TTL_MS
			};
			db.invites.push(invite);
			return { id: invite.id, toId: friendId, expiresAt: invite.expiresAt };
		});
	}

	async respond(inviteId: string, accept: boolean): Promise<Squad | null> {
		return this.#mutate((db) => {
			const invite = db.invites.find((entry) => entry.id === inviteId && entry.to === this.me.id);
			if (!invite) throw refuse('INVITE_EXPIRED');
			db.invites = db.invites.filter((entry) => entry !== invite);
			if (!accept) return null;

			const leader = db.players[invite.from];
			if (!leader || !this.#online(leader)) throw refuse('INVITE_EXPIRED');
			let squad = this.#squadOf(db, invite.from);
			if (squad && squad.leaderId !== invite.from) throw refuse('INVITE_EXPIRED');
			if (squad?.members.includes(this.me.id)) return this.#toSquad(db, squad);
			if (squad && squad.members.length >= SQUAD_SIZE) throw refuse('SQUAD_FULL');

			this.#leave(db, this.me.id);
			if (!squad) {
				squad = { id: randomId('sq'), leaderId: invite.from, members: [invite.from] };
				db.squads.push(squad);
			}
			squad.members.push(this.me.id);
			return this.#toSquad(db, squad);
		});
	}

	async leave(): Promise<void> {
		this.#mutate((db) => {
			if (!this.#squadOf(db, this.me.id)) throw refuse('NOT_IN_SQUAD');
			this.#leave(db, this.me.id);
		});
	}

	async kick(memberId: string): Promise<Squad | null> {
		return this.#mutate((db) => {
			const squad = this.#squadOf(db, this.me.id);
			if (!squad) throw refuse('NOT_IN_SQUAD');
			if (squad.leaderId !== this.me.id) throw refuse('NOT_LEADER');
			if (memberId === this.me.id || !squad.members.includes(memberId)) {
				throw refuse('NOT_IN_SQUAD');
			}
			this.#leave(db, memberId);
			const left = this.#squadOf(db, this.me.id);
			return left ? this.#toSquad(db, left) : null;
		});
	}

	async link(): Promise<SquadLink> {
		return this.#mutate((db) => {
			const squad = this.#squadOf(db, this.me.id);
			if (squad && squad.leaderId !== this.me.id) throw refuse('NOT_LEADER');
			const links = (db.links ??= []);
			const expiresAt = this.#now() + SQUAD_LINK_TTL_MS;
			const existing = links.find((entry) => entry.from === this.me.id);
			if (existing) {
				existing.expiresAt = expiresAt;
				return { code: existing.code, expiresAt };
			}
			const code = randomId('sq').replace('sq-', '');
			links.push({ code, from: this.me.id, expiresAt });
			return { code, expiresAt };
		});
	}

	async join(code: string): Promise<Squad> {
		return this.#mutate((db) => {
			const link = db.links?.find((entry) => entry.code === code);
			if (!link) throw refuse('INVITE_EXPIRED');
			if (link.from === this.me.id) throw refuse('ALREADY_IN_SQUAD');
			const leader = db.players[link.from];
			if (!leader || !this.#online(leader)) throw refuse('INVITE_EXPIRED');
			let squad = this.#squadOf(db, link.from);
			if (squad && squad.leaderId !== link.from) throw refuse('INVITE_EXPIRED');
			if (squad?.members.includes(this.me.id)) return this.#toSquad(db, squad);
			const open = db.invites.filter((entry) => entry.from === link.from).length;
			if ((squad?.members.length ?? 1) + open >= SQUAD_SIZE) throw refuse('SQUAD_FULL');

			this.#leave(db, this.me.id);
			if (!squad) {
				squad = { id: randomId('sq'), leaderId: link.from, members: [link.from] };
				db.squads.push(squad);
			}
			squad.members.push(this.me.id);
			return this.#toSquad(db, squad);
		});
	}

	// -- The database -------------------------------------------------------------------------------

	#read(): DevDb {
		const db = this.#storage.read() ?? emptyDb();
		this.#prune(db);
		return db;
	}

	/** Read, change, write back and tell the other tabs; a refusal changes nothing */
	#mutate<T>(change: (db: DevDb) => T): T {
		const db = this.#read();
		const result = change(db);
		this.#storage.write(db);
		this.#broadcast({ kind: 'changed' });
		return result;
	}

	#touch(db: DevDb, inRaid: boolean): void {
		db.players[this.me.id] = { ...this.me, lastSeen: this.#now(), inRaid };
	}

	#online(player: DevPlayer): boolean {
		return this.#now() - player.lastSeen < ONLINE_WINDOW_MS;
	}

	/** Drops expired invites, players gone offline from their squads, and long-gone tabs */
	#prune(db: DevDb): void {
		const now = this.#now();
		db.invites = db.invites.filter((invite) => invite.expiresAt > now);
		db.links = (db.links ?? []).filter((link) => link.expiresAt > now);
		for (const player of Object.values(db.players)) {
			if (player.id === this.me.id) continue;
			if (!this.#online(player)) this.#leave(db, player.id);
			if (now - player.lastSeen > FORGET_MS) delete db.players[player.id];
		}
	}

	#squadOf(db: DevDb, playerId: string): DevSquad | undefined {
		return db.squads.find((squad) => squad.members.includes(playerId));
	}

	/** Takes a player out of their squad: the next member leads, a squad of one dissolves */
	#leave(db: DevDb, playerId: string): void {
		const squad = this.#squadOf(db, playerId);
		if (!squad) return;
		squad.members = squad.members.filter((id) => id !== playerId);
		if (squad.leaderId === playerId && squad.members[0]) squad.leaderId = squad.members[0];
		if (squad.members.length < 2) db.squads = db.squads.filter((entry) => entry !== squad);
	}

	#toFriend(db: DevDb, id: string): Friend {
		const player = db.players[id];
		const offline = DEV_OFFLINE_FRIENDS.find((entry) => entry.id === id);
		const online = Boolean(player && this.#online(player));
		return {
			id,
			name: player?.name ?? offline?.name ?? id,
			online,
			inRaid: online && Boolean(player?.inRaid)
		};
	}

	#toSquad(db: DevDb, squad: DevSquad): Squad {
		return {
			id: squad.id,
			leaderId: squad.leaderId,
			members: squad.members.map((id) => ({ id, name: db.players[id]?.name ?? id }))
		};
	}

	#friendsOf(db: DevDb): Friend[] {
		const ids = [
			...Object.keys(db.players).filter((id) => id !== this.me.id),
			...DEV_OFFLINE_FRIENDS.map((entry) => entry.id)
		];
		return ids.map((id) => this.#toFriend(db, id));
	}

	#stateOf(db: DevDb): SquadState {
		const squad = this.#squadOf(db, this.me.id);
		const invites: SquadInvite[] = db.invites
			.filter((invite) => invite.to === this.me.id)
			.map((invite) => ({
				id: invite.id,
				from: this.#toFriend(db, invite.from),
				expiresAt: invite.expiresAt
			}));
		const outgoing: OutgoingInvite[] = db.invites
			.filter((invite) => invite.from === this.me.id)
			.map((invite) => ({ id: invite.id, toId: invite.to, expiresAt: invite.expiresAt }));
		return { you: this.me.id, squad: squad ? this.#toSquad(db, squad) : null, invites, outgoing };
	}

	// -- Realtime -----------------------------------------------------------------------------------

	#broadcast(message: DevBusMessage): void {
		this.#channel.post(message);
		if (message.kind === 'changed') this.#diff();
	}

	#onBus(message: DevBusMessage): void {
		if (this.#closed) return;
		if (message.kind === 'changed') {
			this.#diff();
			return;
		}
		if (message.from === this.me.id) return;
		if (message.to !== undefined && message.to !== this.me.id) return;
		const squad = this.#squadOf(this.#read(), this.me.id);
		if (squad?.id !== message.squadId) return;
		this.#hub.emit({ type: 'relay', from: message.from, payload: message.payload });
	}

	#send(message: SquadClientMessage): void {
		if (this.#closed || message.type !== 'relay') return;
		const squad = this.#squadOf(this.#read(), this.me.id);
		if (!squad) return;
		this.#channel.post({
			kind: 'relay',
			squadId: squad.id,
			from: this.me.id,
			to: message.to,
			// Structured clone, as a real socket would serialise it
			payload: JSON.parse(JSON.stringify(message.payload ?? null))
		});
	}

	/** Turns what changed in the database since the last look into the server's push events */
	#diff(): void {
		if (this.#closed) return;
		const db = this.#read();
		const state = this.#stateOf(db);
		const events: SquadEvent[] = [];

		const squad = JSON.stringify(state.squad);
		if (squad !== this.#seen.squad) events.push({ type: 'squad', squad: state.squad });

		const invites = new Set(state.invites.map((invite) => invite.id));
		for (const invite of state.invites) {
			if (!this.#seen.invites.has(invite.id)) events.push({ type: 'invite', invite });
		}
		const outgoing = new Set(state.outgoing.map((invite) => invite.id));
		for (const id of [...this.#seen.invites, ...this.#seen.outgoing]) {
			if (!invites.has(id) && !outgoing.has(id)) {
				events.push({ type: 'invite_gone', inviteId: id, reason: 'cancelled' });
			}
		}

		const friends = new Map<string, string>();
		for (const friend of this.#friendsOf(db)) {
			const key = `${friend.online}:${friend.inRaid}`;
			friends.set(friend.id, key);
			if (this.#seen.friends.get(friend.id) !== key) {
				events.push({
					type: 'presence',
					friendId: friend.id,
					online: friend.online,
					inRaid: friend.inRaid
				});
			}
		}
		for (const id of this.#seen.friends.keys()) {
			if (!friends.has(id)) {
				events.push({ type: 'presence', friendId: id, online: false, inRaid: false });
			}
		}

		this.#seen = { squad, invites, outgoing, friends };
		for (const event of events) this.#hub.emit(event);
	}
}

// ---------------------------------------------------------------------------------------------
// The browser side

/** This tab's dev identity, made up once and kept in sessionStorage */
export function devIdentity(): DevIdentity {
	try {
		const saved: unknown = JSON.parse(sessionStorage.getItem(IDENTITY_KEY) ?? 'null');
		if (
			typeof saved === 'object' &&
			saved !== null &&
			'id' in saved &&
			'name' in saved &&
			typeof saved.id === 'string' &&
			typeof saved.name === 'string'
		) {
			return { id: saved.id, name: saved.name };
		}
	} catch {
		// Fall through to a new identity
	}
	const callsigns = ['Falcon', 'Viper', 'Badger', 'Lynx', 'Raven', 'Cobra', 'Wolf', 'Hawk'];
	const name = `${callsigns[Math.floor(Math.random() * callsigns.length)]} ${10 + Math.floor(Math.random() * 90)}`;
	const identity = { id: randomId('dev'), name };
	try {
		sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
	} catch {
		// A new identity on every load, then
	}
	return identity;
}

function isDevDb(value: unknown): value is DevDb {
	return (
		typeof value === 'object' &&
		value !== null &&
		'players' in value &&
		'squads' in value &&
		'invites' in value &&
		typeof value.players === 'object' &&
		value.players !== null &&
		Array.isArray(value.squads) &&
		Array.isArray(value.invites)
	);
}

/** The shared database in localStorage */
export const localDevStorage: DevStorage = {
	read() {
		try {
			const value: unknown = JSON.parse(localStorage.getItem(DB_KEY) ?? 'null');
			return isDevDb(value) ? value : null;
		} catch {
			return null;
		}
	},
	write(db) {
		try {
			localStorage.setItem(DB_KEY, JSON.stringify(db));
		} catch {
			// Storage full or blocked; the dev backend just forgets
		}
	}
};

/** A BroadcastChannel between the tabs of this origin */
export function broadcastDevChannel(name = DEV_CHANNEL): DevChannel {
	const channel = new BroadcastChannel(name);
	return {
		post: (message) => channel.postMessage(message),
		listen(handler) {
			const listener = (event: MessageEvent) => handler(event.data as DevBusMessage);
			channel.addEventListener('message', listener);
			return () => channel.removeEventListener('message', listener);
		},
		close: () => channel.close()
	};
}

/**
 * The local transport and fake backend for this tab, wired to the other tabs over
 * BroadcastChannel('ww3-squad-dev'). The tab leaves the fake server when the page goes away
 * (pagehide); a reload joins again under the same identity.
 */
export function localSquad(): { api: SquadApi; transport: SquadTransport } {
	const backend = new LocalSquadBackend(devIdentity(), {
		storage: localDevStorage,
		channel: broadcastDevChannel()
	});
	window.addEventListener('pagehide', () => backend.dispose(), { once: true });
	return { api: backend, transport: backend.transport };
}

/** Only the transport half, for callers that want the interface named in the docs */
export function localTransport(): SquadTransport {
	return localSquad().transport;
}

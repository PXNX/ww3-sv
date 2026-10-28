/*
 * The friends and squad store: who the player's friends are and who of them is online, the squad
 * they are in, invites in both directions, and a relay for game data between squad mates. It runs
 * against the bot's server inside Telegram, or against the fake backend between browser tabs in
 * development (see squadDev.ts). Panels call start() when they mount and stop() when they go;
 * while anyone holds it, the app reports its presence every 30 seconds.
 */
import { untrack } from 'svelte';
import { telegram, type TelegramStatus } from '#lib/stores/telegram.svelte.js';
import { toCallError } from '#lib/services/telegram.js';
import {
	PRESENCE_INTERVAL_MS,
	SQUAD_SIZE,
	launchInitData,
	remoteSquadApi,
	squadErrorCode,
	squadSocketUrl,
	useLocalSquad,
	webSocketTransport,
	type Friend,
	type OutgoingInvite,
	type Squad,
	type SquadApi,
	type SquadErrorCode,
	type SquadEvent,
	type SquadInvite,
	type SquadMember,
	type SquadTransport,
	type TransportStatus
} from '#lib/services/squad.js';

export type SquadAvailability =
	/** Outside Telegram (and not in dev mode), or the bot has no squad endpoints */
	| 'unavailable'
	/** In Telegram, but the bot could not confirm the account */
	| 'signed-out'
	| 'ready';

/** How an action ended: done, refused by the server with a reason, or failed otherwise */
export type SquadActionResult = 'ok' | SquadErrorCode | 'failed';

export type RelayHandler = (payload: unknown, from: string) => void;

/** Without a socket (Telegram Serverless), the squad state is polled this often instead */
const POLL_MS = 5000;
/** Stopping waits this long, so going from one page with a panel to the next keeps the line */
const STOP_GRACE_MS = 3000;

/** Online and free first, then online in a raid, then offline; by name within each group */
function friendOrder(a: Friend, b: Friend): number {
	const rank = (friend: Friend) => (friend.online ? (friend.inRaid ? 1 : 0) : 2);
	return rank(a) - rank(b) || a.name.localeCompare(b.name);
}

class SquadStore {
	availability = $state<SquadAvailability>('unavailable');
	/** True until it is known whether friends can be offered (Telegram may still be checking) */
	loading = $state(true);
	/** Which backend is in use: the bot's server, or the dev fake between browser tabs */
	mode = $state<'remote' | 'local' | null>(null);
	/** The player's own id, as the server knows it */
	you = $state<string | null>(null);
	/** The player's display name, for their own slot before they are in a squad */
	selfName = $state('');
	friends = $state<Friend[]>([]);
	squad = $state<Squad | null>(null);
	/** Invites the player sent that nobody answered yet */
	outgoing = $state<OutgoingInvite[]>([]);
	/** The realtime line; 'closed' without one (then the state is polled) */
	connection = $state<TransportStatus>('closed');
	/** The id of the friend or invite an action is running for, or 'leave' */
	busy = $state<string | null>(null);
	/** A clock for invite countdowns, ticking every second while started */
	now = $state(Date.now());
	/** How many mounted panels list incoming invites; the global toast stays quiet while any do */
	inviteSurfaces = $state(0);

	#invites = $state<SquadInvite[]>([]);
	#api: SquadApi | null = null;
	#transport: SquadTransport | null = null;
	#local: { api: SquadApi; transport: SquadTransport; name: string } | null = null;
	#unsubscribe: (() => void) | null = null;
	#relayHandlers = new Set<RelayHandler>();
	#holders = 0;
	#running = false;
	/** Bumped on every boot and teardown, so a slow boot does not outlive its stop */
	#generation = 0;
	#stopTimer: ReturnType<typeof setTimeout> | undefined;
	/** Heartbeat and polling of the current backend */
	#timers: ReturnType<typeof setInterval>[] = [];
	#clock: ReturnType<typeof setInterval> | undefined;
	/** Whether closing the transport is this store's job (the dev backend lives as long as the tab) */
	#ownsTransport = false;
	#effects: (() => void) | null = null;
	#inRaid = false;

	/** Invites the player received that can still be answered, newest first */
	get pendingInvites(): SquadInvite[] {
		return this.#invites
			.filter((invite) => invite.expiresAt > this.now)
			.sort((a, b) => b.expiresAt - a.expiresAt);
	}

	get onlineFriends(): Friend[] {
		return this.friends.filter((friend) => friend.online);
	}

	get inSquad(): boolean {
		return this.squad !== null;
	}

	/** True when the player leads their squad, or has none yet (then they would lead it) */
	get isLeader(): boolean {
		return this.squad === null || this.squad.leaderId === this.you;
	}

	/** The squad's members, leader first; just the player while there is no squad */
	get members(): SquadMember[] {
		if (this.squad) {
			const { leaderId, members } = this.squad;
			return [...members].sort((a, b) => Number(b.id === leaderId) - Number(a.id === leaderId));
		}
		return this.you ? [{ id: this.you, name: this.selfName }] : [];
	}

	/** Members plus open invites fill all slots: no more invites (the server counts the same) */
	get isFull(): boolean {
		const open = this.outgoing.filter((invite) => invite.expiresAt > this.now).length;
		return (this.squad?.members.length ?? 1) + open >= SQUAD_SIZE;
	}

	/** Whether the player has an open invite out to this friend */
	invited(friendId: string): boolean {
		return this.outgoing.some((invite) => invite.toId === friendId && invite.expiresAt > this.now);
	}

	isMember(id: string): boolean {
		return this.squad?.members.some((member) => member.id === id) ?? false;
	}

	/** Whether the invite button for this friend should be enabled */
	canInvite(friend: Friend): boolean {
		return (
			this.availability === 'ready' &&
			friend.online &&
			this.isLeader &&
			!this.isMember(friend.id) &&
			!this.invited(friend.id) &&
			!this.isFull &&
			this.busy === null
		);
	}

	/** Seconds until an invite expires, rounded up */
	secondsLeft(invite: { expiresAt: number }): number {
		return Math.max(0, Math.ceil((invite.expiresAt - this.now) / 1000));
	}

	// -- Actions --------------------------------------------------------------------------------------

	async invite(friendId: string): Promise<SquadActionResult> {
		const friend = this.friends.find((entry) => entry.id === friendId);
		if (friend && !friend.online) return 'NOT_ONLINE';
		if (this.isFull) return 'SQUAD_FULL';
		if (!this.isLeader) return 'NOT_LEADER';
		return this.#act(friendId, async (api) => {
			const invite = await api.invite(friendId);
			this.outgoing = [...this.outgoing.filter((entry) => entry.id !== invite.id), invite];
		});
	}

	async accept(inviteId: string): Promise<SquadActionResult> {
		return this.#act(inviteId, async (api) => {
			try {
				this.squad = await api.respond(inviteId, true);
			} finally {
				this.#dropInvite(inviteId);
			}
		});
	}

	async decline(inviteId: string): Promise<SquadActionResult> {
		this.#dropInvite(inviteId);
		return this.#act(inviteId, async (api) => {
			await api.respond(inviteId, false);
		});
	}

	async leave(): Promise<SquadActionResult> {
		if (!this.squad) return 'NOT_IN_SQUAD';
		return this.#act('leave', async (api) => {
			await api.leave();
			this.squad = null;
		});
	}

	/** Leader only: takes a member out of the squad */
	async kick(memberId: string): Promise<SquadActionResult> {
		return this.#act(memberId, async (api) => {
			this.squad = await api.kick(memberId);
		});
	}

	/** Tells friends whether the player is in a raid right now (shown as a tag in their list) */
	setInRaid(inRaid: boolean): void {
		if (inRaid === this.#inRaid) return;
		this.#inRaid = inRaid;
		void this.#api?.presence(inRaid).catch(() => undefined);
	}

	// -- The relay for game data ------------------------------------------------------------------

	/**
	 * Sends opaque game data to the other squad members, or only to member `to`. Returns false when
	 * it could not go out (no squad, no realtime line); the data is dropped then, not queued.
	 */
	relay(payload: unknown, to?: string): boolean {
		if (!this.squad || !this.#transport || this.#transport.status !== 'open') return false;
		this.#transport.send(
			to === undefined ? { type: 'relay', payload } : { type: 'relay', payload, to }
		);
		return true;
	}

	/** Calls the handler with every piece of game data a squad mate relays; returns the unsubscribe */
	onRelay(handler: RelayHandler): () => void {
		this.#relayHandlers.add(handler);
		return () => this.#relayHandlers.delete(handler);
	}

	// -- Lifecycle ----------------------------------------------------------------------------------

	/** Holds the store open: connects, and reports presence while anyone holds it */
	start(): void {
		if (typeof window === 'undefined') return;
		this.#holders += 1;
		clearTimeout(this.#stopTimer);
		if (this.#running) return;
		this.#running = true;
		void this.#boot(++this.#generation);
	}

	/** Releases one start(); the line closes shortly after the last holder lets go */
	stop(): void {
		if (this.#holders === 0) return;
		this.#holders -= 1;
		if (this.#holders > 0) return;
		clearTimeout(this.#stopTimer);
		this.#stopTimer = setTimeout(() => this.#teardown(), STOP_GRACE_MS);
	}

	async #boot(generation: number): Promise<void> {
		this.now = Date.now();
		this.#clock = setInterval(() => (this.now = Date.now()), 1000);
		if (useLocalSquad()) {
			if (!this.#local) {
				const { localSquad, devIdentity } = await import('#lib/services/squadDev.js');
				if (generation !== this.#generation) return;
				this.#local = { ...localSquad(), name: devIdentity().name };
			}
			this.mode = 'local';
			this.selfName = this.#local.name;
			this.#use(this.#local.api, this.#local.transport, false);
			return;
		}

		// Inside Telegram: follow the account, which may still be being checked
		this.mode = 'remote';
		void telegram().start();
		this.#effects = $effect.root(() => {
			$effect(() => {
				const status = telegram().status;
				const name = telegram().user?.firstName ?? '';
				this.selfName = name;
				untrack(() => void this.#follow(status, generation));
			});
		});
	}

	async #follow(status: TelegramStatus, generation: number): Promise<void> {
		if (status === 'checking') return;
		this.loading = false;
		if (status === 'browser') {
			this.#disconnect();
			this.availability = 'unavailable';
			return;
		}
		if (status !== 'verified') {
			this.#disconnect();
			this.availability = 'signed-out';
			return;
		}
		if (this.#api) return;
		const url = squadSocketUrl();
		const initData = url ? await launchInitData() : '';
		if (generation !== this.#generation) return;
		this.#use(remoteSquadApi, url && initData ? webSocketTransport(url, initData) : null, true);
	}

	/** Starts talking to a backend: subscribe, first load, heartbeat */
	#use(api: SquadApi, transport: SquadTransport | null, owned: boolean): void {
		this.#api = api;
		this.#transport = transport;
		this.#ownsTransport = owned;
		this.availability = 'ready';
		this.loading = false;
		if (transport) {
			this.connection = transport.status;
			this.#unsubscribe = transport.subscribe((event) => this.#onEvent(event));
		} else {
			this.connection = 'closed';
			this.#every(POLL_MS, () => void this.#loadState());
		}
		void this.refresh();
		void api.presence(this.#inRaid).catch(() => undefined);
		this.#every(PRESENCE_INTERVAL_MS, () => {
			void api.presence(this.#inRaid).catch(() => undefined);
			void this.#loadFriends();
		});
	}

	#disconnect(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = null;
		if (this.#ownsTransport) this.#transport?.close();
		this.#transport = null;
		this.#api = null;
		this.connection = 'closed';
		for (const timer of this.#timers.splice(0)) clearInterval(timer);
	}

	#teardown(): void {
		if (this.#holders > 0) return;
		this.#generation += 1;
		this.#running = false;
		this.#effects?.();
		this.#effects = null;
		this.#disconnect();
		clearInterval(this.#clock);
	}

	#every(ms: number, run: () => void): void {
		this.#timers.push(setInterval(run, ms));
	}

	/** Loads friends and squad state again */
	async refresh(): Promise<void> {
		await Promise.all([this.#loadFriends(), this.#loadState()]);
	}

	async #loadFriends(): Promise<void> {
		const api = this.#api;
		if (!api) return;
		try {
			const friends = await api.friends();
			if (api === this.#api) this.friends = friends.sort(friendOrder);
		} catch (error) {
			this.#onLoadError(error);
		}
	}

	async #loadState(): Promise<void> {
		const api = this.#api;
		if (!api) return;
		try {
			const state = await api.state();
			if (api !== this.#api) return;
			this.you = state.you;
			this.squad = state.squad;
			this.#invites = state.invites;
			this.outgoing = state.outgoing;
		} catch (error) {
			this.#onLoadError(error);
		}
	}

	/** The bot has no squad endpoints, or refused the account: say so instead of an empty list */
	#onLoadError(error: unknown): void {
		const type = toCallError(error).type;
		if (type === 'UNAVAILABLE') this.availability = 'unavailable';
		else if (type === 'UNAUTHORIZED') this.availability = 'signed-out';
		else if (type === 'ENDPOINT_ERROR' && squadErrorCode(error) === null) {
			// An unknown endpoint on an older bot: friends are not offered there
			this.availability = 'unavailable';
		}
	}

	async #act(key: string, run: (api: SquadApi) => Promise<void>): Promise<SquadActionResult> {
		const api = this.#api;
		if (!api || this.availability !== 'ready') return 'failed';
		this.busy = key;
		try {
			await run(api);
			return 'ok';
		} catch (error) {
			return squadErrorCode(error) ?? 'failed';
		} finally {
			this.busy = null;
			void this.#loadState();
		}
	}

	#dropInvite(inviteId: string): void {
		this.#invites = this.#invites.filter((invite) => invite.id !== inviteId);
	}

	#onEvent(event: SquadEvent): void {
		switch (event.type) {
			case 'connection':
				this.connection = event.status;
				// Events may have been missed while the line was down
				if (event.status === 'open') void this.refresh();
				break;
			case 'welcome':
				this.you = event.you;
				break;
			case 'squad':
				this.squad = event.squad;
				void this.#loadState();
				break;
			case 'invite':
				this.#invites = [
					...this.#invites.filter((entry) => entry.id !== event.invite.id),
					event.invite
				];
				break;
			case 'invite_gone':
				this.#dropInvite(event.inviteId);
				this.outgoing = this.outgoing.filter((invite) => invite.id !== event.inviteId);
				break;
			case 'presence': {
				const known = this.friends.some((friend) => friend.id === event.friendId);
				if (!known) {
					void this.#loadFriends();
					break;
				}
				this.friends = this.friends
					.map((friend) =>
						friend.id === event.friendId
							? { ...friend, online: event.online, inRaid: event.inRaid }
							: friend
					)
					.sort(friendOrder);
				break;
			}
			case 'relay':
				for (const handler of [...this.#relayHandlers]) {
					try {
						handler(event.payload, event.from);
					} catch (error) {
						console.error(error);
					}
				}
				break;
			case 'pong':
				break;
		}
	}
}

let shared: SquadStore | undefined;

/** The app-wide friends and squad store (created on first use) */
export function squad(): SquadStore {
	shared ??= new SquadStore();
	return shared;
}

import { describe, expect, it } from 'vitest';
import { TelegramCallError } from '#lib/services/telegram.js';
import {
	INVITE_TTL_MS,
	parseFriend,
	parseFriends,
	parseInvite,
	parseSquad,
	parseSquadEvent,
	parseSquadLink,
	parseSquadReply,
	parseSquadState,
	reconnectDelay,
	SQUAD_LINK_TTL_MS,
	squadCodeOf,
	squadErrorCode,
	squadSocketUrl,
	squadStartParam,
	type SquadEvent
} from '#lib/services/squad.js';
import {
	DEV_OFFLINE_FRIENDS,
	LocalSquadBackend,
	type DevBusMessage,
	type DevChannel,
	type DevDb,
	type DevStorage
} from '#lib/services/squadDev.js';

const friend = { id: '42', name: 'Anna', online: true, in_raid: false };
const squadWire = {
	id: 's1',
	leader_id: '1',
	members: [
		{ id: '1', name: 'Lead' },
		{ id: '2', name: 'Mate', photo_url: 'https://t.me/i/userpic/2.jpg' }
	]
};

describe('parsers', () => {
	it('reads a friend and ignores a photo that is not https', () => {
		expect(parseFriend({ ...friend, photo_url: 'http://x/y.jpg' })).toEqual({
			id: '42',
			name: 'Anna',
			online: true,
			inRaid: false
		});
		expect(parseFriend({ ...friend, photo_url: 'https://x/y.jpg' })?.photoUrl).toBe(
			'https://x/y.jpg'
		);
		expect(parseFriend({ id: '42', name: 'Anna', online: true })?.inRaid).toBe(false);
	});

	it('refuses malformed friends', () => {
		expect(parseFriend(null)).toBeNull();
		expect(parseFriend({ ...friend, id: 42 })).toBeNull();
		expect(parseFriend({ ...friend, id: '' })).toBeNull();
		expect(parseFriend({ ...friend, name: '   ' })).toBeNull();
		expect(parseFriend({ ...friend, online: 'yes' })).toBeNull();
		expect(parseFriend({ ...friend, in_raid: 1 })).toBeNull();
		// One bad entry spoils the list
		expect(parseFriends({ friends: [friend, { id: 'x' }] })).toBeNull();
		expect(parseFriends({ friends: [friend] })).toHaveLength(1);
		expect(parseFriends([friend])).toBeNull();
	});

	it('reads a squad and checks its members', () => {
		expect(parseSquad(squadWire)).toEqual({
			id: 's1',
			leaderId: '1',
			members: [
				{ id: '1', name: 'Lead' },
				{ id: '2', name: 'Mate', photoUrl: 'https://t.me/i/userpic/2.jpg' }
			]
		});
		expect(parseSquad({ ...squadWire, leader_id: '9' })).toBeNull();
		expect(parseSquad({ ...squadWire, members: [] })).toBeNull();
		expect(
			parseSquad({
				...squadWire,
				members: [...squadWire.members, { id: '3', name: 'c' }, { id: '4', name: 'd' }]
			})
		).toBeNull();
		expect(
			parseSquad({ ...squadWire, members: [squadWire.members[0], squadWire.members[0]] })
		).toBeNull();
	});

	it('reads invites and the squad state', () => {
		expect(parseInvite({ id: 'i1', from: friend, expires_at: 1000 })?.from.name).toBe('Anna');
		expect(parseInvite({ id: 'i1', from: friend, expires_at: '1000' })).toBeNull();
		expect(parseSquadState({ you: '1' })).toEqual({
			you: '1',
			squad: null,
			invites: [],
			outgoing: []
		});
		const state = parseSquadState({
			you: '1',
			squad: squadWire,
			invites: [{ id: 'i1', from: friend, expires_at: 5 }],
			outgoing: [{ id: 'o1', to_id: '42', expires_at: 5 }]
		});
		expect(state?.squad?.leaderId).toBe('1');
		expect(state?.outgoing[0]).toEqual({ id: 'o1', toId: '42', expiresAt: 5 });
		expect(parseSquadState({ you: '1', squad: 'nope' })).toBeNull();
		expect(parseSquadState({ squad: null })).toBeNull();
		expect(parseSquadReply({ squad: null })).toEqual({ squad: null });
		expect(parseSquadReply({ squad: { id: 'x' } })).toBeNull();
	});

	it('reads realtime events and drops unknown ones', () => {
		expect(parseSquadEvent({ type: 'relay', from: '2', payload: { kind: 'input' } })).toEqual({
			type: 'relay',
			from: '2',
			payload: { kind: 'input' }
		});
		expect(parseSquadEvent({ type: 'relay', from: '2' })).toBeNull();
		expect(parseSquadEvent({ type: 'squad', squad: null })).toEqual({ type: 'squad', squad: null });
		expect(parseSquadEvent({ type: 'invite_gone', invite_id: 'i1', reason: 'odd' })).toEqual({
			type: 'invite_gone',
			inviteId: 'i1',
			reason: 'cancelled'
		});
		expect(
			parseSquadEvent({ type: 'presence', friend_id: '2', online: true, in_raid: true })
		).toEqual({ type: 'presence', friendId: '2', online: true, inRaid: true });
		expect(parseSquadEvent({ type: 'connection', status: 'open' })).toBeNull();
		expect(parseSquadEvent({ type: 'whatever' })).toBeNull();
		expect(parseSquadEvent('relay')).toBeNull();
	});

	it('maps refusal codes', () => {
		expect(squadErrorCode(new TelegramCallError('ENDPOINT_ERROR', 'x', 'SQUAD_FULL'))).toBe(
			'SQUAD_FULL'
		);
		expect(squadErrorCode(new TelegramCallError('ENDPOINT_ERROR', 'x', 'OTHER'))).toBeNull();
		expect(squadErrorCode(new Error('boom'))).toBeNull();
	});

	it('builds the socket URL and backs off between reconnects', () => {
		expect(squadSocketUrl('https://bot.example.com/')).toBe('wss://bot.example.com/ws/squad');
		expect(squadSocketUrl('http://bot.example.com')).toBe('');
		expect(squadSocketUrl('')).toBe('');
		expect(reconnectDelay(0, () => 0.5)).toBe(1000);
		expect(reconnectDelay(3, () => 0.5)).toBe(8000);
		expect(reconnectDelay(20, () => 1)).toBe(37_500);
		expect(reconnectDelay(20, () => 0)).toBe(22_500);
	});
});

/** Tabs in one process: a shared database and a bus that, like BroadcastChannel, skips the sender */
function network() {
	let db: DevDb | null = null;
	const storage: DevStorage = {
		read: () => (db ? structuredClone(db) : null),
		write: (next) => {
			db = structuredClone(next);
		}
	};
	const listeners = new Set<(message: DevBusMessage) => void>();
	let clock = 1_000_000;
	const now = () => clock;

	const tab = (id: string) => {
		const own = new Set<(message: DevBusMessage) => void>();
		const channel: DevChannel = {
			post: (message) => {
				for (const listener of [...listeners]) if (!own.has(listener)) listener(message);
			},
			listen: (handler) => {
				listeners.add(handler);
				own.add(handler);
				return () => listeners.delete(handler);
			},
			close: () => undefined
		};
		const backend = new LocalSquadBackend(
			{ id, name: id.toUpperCase() },
			{ storage, channel, now, ticking: false }
		);
		const events: SquadEvent[] = [];
		backend.transport.subscribe((event) => events.push(event));
		return { backend, events };
	};

	return {
		tab,
		advance: (ms: number) => {
			clock += ms;
		}
	};
}

const refusal = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(error: unknown) => squadErrorCode(error)
	);

describe('local fake backend', () => {
	it('lists the other tabs and two offline friends', async () => {
		const net = network();
		const a = net.tab('a');
		net.tab('b');
		const friends = await a.backend.friends();
		expect(friends.map((entry) => entry.id)).toEqual([
			'b',
			...DEV_OFFLINE_FRIENDS.map((f) => f.id)
		]);
		expect(friends.find((entry) => entry.id === 'b')?.online).toBe(true);
		expect(friends.filter((entry) => !entry.online)).toHaveLength(2);
	});

	it('runs an invite through to a squad led by the inviter', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		const invite = await a.backend.invite('b');
		expect(invite.toId).toBe('b');

		const incoming = b.events.find((event) => event.type === 'invite');
		expect(incoming?.type === 'invite' && incoming.invite.from.id).toBe('a');
		expect((await b.backend.state()).invites).toHaveLength(1);

		const joined = await b.backend.respond(invite.id, true);
		expect(joined?.leaderId).toBe('a');
		expect(joined?.members.map((member) => member.id)).toEqual(['a', 'b']);
		expect((await a.backend.state()).squad?.id).toBe(joined?.id);
		expect(a.events.some((event) => event.type === 'squad' && event.squad?.id === joined?.id)).toBe(
			true
		);
		expect((await a.backend.state()).outgoing).toHaveLength(0);
	});

	it('declining removes the invite on both sides', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		const invite = await a.backend.invite('b');
		expect(await b.backend.respond(invite.id, false)).toBeNull();
		expect((await a.backend.state()).outgoing).toHaveLength(0);
		expect(
			a.events.some((event) => event.type === 'invite_gone' && event.inviteId === invite.id)
		).toBe(true);
		expect(await refusal(b.backend.respond(invite.id, true))).toBe('INVITE_EXPIRED');
	});

	it('holds a squad to three, open invites included', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		const c = net.tab('c');
		net.tab('d');
		const toB = await a.backend.invite('b');
		const toC = await a.backend.invite('c');
		expect(await refusal(a.backend.invite('d'))).toBe('SQUAD_FULL');
		// Inviting the same friend again renews the open invite
		expect((await a.backend.invite('b')).id).toBe(toB.id);

		await b.backend.respond(toB.id, true);
		await c.backend.respond(toC.id, true);
		expect((await a.backend.state()).squad?.members).toHaveLength(3);
		expect(await refusal(a.backend.invite('d'))).toBe('SQUAD_FULL');
		expect(await refusal(a.backend.invite('b'))).toBe('ALREADY_IN_SQUAD');
	});

	it('accepting another invite moves a player to that squad', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		const c = net.tab('c');
		const d = net.tab('d');
		const toB = await a.backend.invite('b');
		const toC = await a.backend.invite('c');
		await b.backend.respond(toB.id, true);
		// D leads a squad of its own and invites A's member C
		const toC2 = await d.backend.invite('c');
		await c.backend.respond(toC.id, true);
		expect((await a.backend.state()).squad?.members).toHaveLength(3);
		// C leaves A's squad for D's
		await c.backend.respond(toC2.id, true);
		expect((await a.backend.state()).squad?.members.map((member) => member.id)).toEqual(['a', 'b']);
		expect((await d.backend.state()).squad?.leaderId).toBe('d');
	});

	it('only the leader invites, and leadership passes on when the leader leaves', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		const c = net.tab('c');
		await b.backend.respond((await a.backend.invite('b')).id, true);
		expect(await refusal(b.backend.invite('c'))).toBe('NOT_LEADER');

		await a.backend.leave();
		// A squad of one dissolves
		expect((await b.backend.state()).squad).toBeNull();
		expect((await a.backend.state()).squad).toBeNull();
		expect(await refusal(a.backend.leave())).toBe('NOT_IN_SQUAD');

		await b.backend.respond((await a.backend.invite('b')).id, true);
		await c.backend.respond((await a.backend.invite('c')).id, true);
		await a.backend.leave();
		const left = (await b.backend.state()).squad;
		expect(left?.leaderId).toBe('b');
		expect(left?.members.map((member) => member.id)).toEqual(['b', 'c']);
		expect(await refusal(c.backend.kick('b'))).toBe('NOT_LEADER');
		expect((await b.backend.kick('c'))?.members ?? null).toBeNull();
	});

	it('refuses offline friends, strangers and expired invites', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		expect(await refusal(a.backend.invite(DEV_OFFLINE_FRIENDS[0].id))).toBe('NOT_ONLINE');
		expect(await refusal(a.backend.invite('nobody'))).toBe('NOT_FRIENDS');
		expect(await refusal(a.backend.invite('a'))).toBe('NOT_FRIENDS');

		const invite = await a.backend.invite('b');
		net.advance(INVITE_TTL_MS + 1);
		await a.backend.presence(false);
		await b.backend.presence(false);
		expect((await b.backend.state()).invites).toHaveLength(0);
		expect(await refusal(b.backend.respond(invite.id, true))).toBe('INVITE_EXPIRED');

		// A tab that stops reporting goes offline
		net.advance(61_000);
		await a.backend.presence(false);
		expect(await refusal(a.backend.invite('b'))).toBe('NOT_ONLINE');
	});

	it('relays game data to squad mates only', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		const c = net.tab('c');
		const outsider = net.tab('x');
		await b.backend.respond((await a.backend.invite('b')).id, true);
		await c.backend.respond((await a.backend.invite('c')).id, true);

		a.backend.transport.send({ type: 'relay', payload: { kind: 'snapshot', t: 1 } });
		b.backend.transport.send({ type: 'relay', payload: { kind: 'input' }, to: 'a' });

		const relays = (events: SquadEvent[]) => events.filter((event) => event.type === 'relay');
		expect(relays(b.events)).toEqual([
			{ type: 'relay', from: 'a', payload: { kind: 'snapshot', t: 1 } }
		]);
		expect(relays(c.events)).toEqual([
			{ type: 'relay', from: 'a', payload: { kind: 'snapshot', t: 1 } }
		]);
		expect(relays(a.events)).toEqual([{ type: 'relay', from: 'b', payload: { kind: 'input' } }]);
		expect(relays(outsider.events)).toEqual([]);
	});

	it('a closed tab leaves its squad and the friends list', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		await b.backend.respond((await a.backend.invite('b')).id, true);
		b.backend.transport.close();
		expect(b.backend.transport.status).toBe('closed');
		expect((await a.backend.state()).squad).toBeNull();
		expect((await a.backend.friends()).some((entry) => entry.id === 'b')).toBe(false);
		expect(
			a.events.some((event) => event.type === 'presence' && event.friendId === 'b' && !event.online)
		).toBe(true);
	});
});

describe('squad links', () => {
	it('reads only well-formed link codes from start parameters', () => {
		expect(squadCodeOf(squadStartParam('ab12-cd_9'))).toBe('ab12-cd_9');
		expect(squadCodeOf('squad_x')).toBeNull();
		expect(squadCodeOf('squad_has space')).toBeNull();
		expect(squadCodeOf('shop')).toBeNull();
		expect(squadCodeOf(null)).toBeNull();
	});

	it('parses a link reply and refuses malformed ones', () => {
		expect(parseSquadLink({ code: 'abcd1234', expires_at: 5 })).toEqual({
			code: 'abcd1234',
			expiresAt: 5
		});
		expect(parseSquadLink({ code: 'a b', expires_at: 5 })).toBeNull();
		expect(parseSquadLink({ code: 'abcd1234' })).toBeNull();
	});

	it('lets anyone join through a link, keeps it stable and holds the squad to three', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		const c = net.tab('c');
		const d = net.tab('d');
		const link = await a.backend.link();
		expect((await a.backend.link()).code).toBe(link.code);
		expect(await refusal(a.backend.join(link.code))).toBe('ALREADY_IN_SQUAD');

		const joined = await b.backend.join(link.code);
		expect(joined.leaderId).toBe('a');
		expect(joined.members.map((member) => member.id)).toEqual(['a', 'b']);
		// Only the leader shares links
		expect(await refusal(b.backend.link())).toBe('NOT_LEADER');

		await c.backend.join(link.code);
		expect(await refusal(d.backend.join(link.code))).toBe('SQUAD_FULL');
	});

	it('refuses unknown and expired links', async () => {
		const net = network();
		const a = net.tab('a');
		const b = net.tab('b');
		expect(await refusal(b.backend.join('nope1234'))).toBe('INVITE_EXPIRED');
		const link = await a.backend.link();
		net.advance(SQUAD_LINK_TTL_MS + 1);
		await a.backend.presence(false);
		await b.backend.presence(false);
		expect(await refusal(b.backend.join(link.code))).toBe('INVITE_EXPIRED');
	});
});

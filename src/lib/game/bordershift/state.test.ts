import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import {
	DESTABILISATION_MAX,
	DESTAB_RELIEF,
	DESTAB_SLIPPED,
	DESTAB_TUNNEL,
	DESTAB_TURNED_AWAY,
	GAME_OVER_FEEDBACK_MS,
	HITS_PER_WAVE,
	INSPECT_MS,
	PATIENCE_BASE_MS,
	POINTS_TUNNEL_BONUS,
	STARTING_REPUTATION,
	TUNNEL_MAX,
	VEHICLE_COUNT
} from './config.js';
import { clearChance, dealConvoy, patienceFor, psyopsShare, tunnelShare } from './convoys.js';
import {
	createGame,
	decide,
	destabilisationShare,
	inspect,
	pointsFor,
	step,
	type BorderShiftState
} from './state.js';
import { missingMessages } from '#lib/testing/messages.js';

/** A convoy that is always a family, with both clues fogged up */
const family = () => 0.99;
/** A convoy that is always psy-ops, with both clues clear (the roll sits above the tunnel share) */
const psyched = () => 0.2;
/** A convoy that is always a digging crew, with both clues clear */
const diggers = () => 0.05;

function advance(game: BorderShiftState, random: () => number, dtMs: number) {
	return step(game, dtMs, random);
}

function passAndAdvance(game: BorderShiftState, random: () => number) {
	const events = decide(game, 'pass');
	advance(game, random, 2000);
	return events;
}

describe('Border Shift convoys', () => {
	it('shortens the patience and raises the psy-op share with every shift', () => {
		expect(patienceFor(2)).toBeLessThan(patienceFor(1));
		expect(patienceFor(99)).toBe(patienceFor(100));
		expect(psyopsShare(2)).toBeGreaterThan(psyopsShare(1));
		expect(psyopsShare(99)).toBe(psyopsShare(100));
		expect(clearChance(2)).toBeLessThan(clearChance(1));
	});

	it('sends more digging crews the longer the night goes, up to a cap', () => {
		expect(tunnelShare(2)).toBeGreaterThan(tunnelShare(1));
		expect(tunnelShare(99)).toBe(tunnelShare(100));
		expect(tunnelShare(100)).toBeLessThanOrEqual(TUNNEL_MAX);
	});

	it('never sends the same vehicle twice in a row', () => {
		let previous: number | null = null;
		const random = createRandom(12);
		for (let i = 0; i < 30; i++) {
			const convoy = dealConvoy(random, 1, previous);
			expect(convoy.vehicle).toBeGreaterThanOrEqual(0);
			expect(convoy.vehicle).toBeLessThan(VEHICLE_COUNT);
			expect(convoy.vehicle).not.toBe(previous);
			previous = convoy.vehicle;
		}
	});

	it('only ever shows the truth or a blur, never the opposite', () => {
		const random = createRandom(3);
		for (let i = 0; i < 50; i++) {
			const convoy = dealConvoy(random, 2, null);
			for (const hint of [convoy.hints.documents, convoy.hints.camera]) {
				expect(hint === 'unclear' || hint === convoy.truth).toBe(true);
			}
			// The probe is one-sided: it either names a tunnel or stays silent
			expect(convoy.hints.ground === 'unclear' || convoy.truth === 'tunnel').toBe(true);
		}
	});

	it('lets the probe find a tunnel and nothing else', () => {
		const tunnel = dealConvoy(diggers, 1, null);
		expect(tunnel.truth).toBe('tunnel');
		expect(tunnel.hints.ground).toBe('tunnel');
		for (const generator of [family, psyched]) {
			const convoy = dealConvoy(generator, 1, null);
			expect(convoy.truth).not.toBe('tunnel');
			expect(convoy.hints.ground).toBe('unclear');
		}
	});

	it('deals tunnels often enough to matter, and never more than the psy-op share allows', () => {
		const random = createRandom(21);
		let tunnels = 0;
		for (let i = 0; i < 500; i++) {
			if (dealConvoy(random, 3, null).truth === 'tunnel') tunnels += 1;
		}
		expect(tunnels).toBeGreaterThan(20);
		expect(tunnels / 500).toBeLessThan(tunnelShare(3) + 0.08);
	});
});

describe('Border Shift state', () => {
	it('starts the first shift with a convoy at the barrier', () => {
		const game = createGame(family);
		expect(game.phase).toBe('watch');
		expect(game.wave).toBe(1);
		expect(game.convoyNumber).toBe(1);
		expect(game.reputation).toBe(STARTING_REPUTATION);
		expect(game.patienceLeftMs).toBe(patienceFor(1));
		expect(game.score).toBe(0);
		expect(game.revealed).toEqual({ documents: null, camera: null, ground: null });
	});

	it('spends patience on a tool and reveals its clue once', () => {
		const game = createGame(family);
		const events = inspect(game, 'documents');
		expect(events).toEqual([{ type: 'hint', tool: 'documents', hint: 'unclear' }]);
		expect(game.patienceLeftMs).toBe(patienceFor(1) - INSPECT_MS);
		expect(inspect(game, 'documents')).toEqual([]);
		expect(game.patienceLeftMs).toBe(patienceFor(1) - INSPECT_MS);
	});

	it('shows the truth through all three tools when the night is clear', () => {
		const game = createGame(psyched);
		expect(game.convoy.truth).toBe('psyops');
		inspect(game, 'documents');
		inspect(game, 'camera');
		inspect(game, 'ground');
		// The probe hears no tunnel on a psy-op, so it only ever adds the silent answer
		expect(game.revealed).toEqual({ documents: 'psyops', camera: 'psyops', ground: 'unclear' });
	});

	it('rewards a family waved through and counts it as admitted', () => {
		const game = createGame(family);
		const expected = pointsFor(game);
		const events = decide(game, 'pass');
		expect(events[0]).toMatchObject({ type: 'correct', truth: 'family', decision: 'pass' });
		expect(game.score).toBe(expected);
		expect(game.streak).toBe(1);
		expect(game.stats.admitted).toBe(1);
		expect(game.phase).toBe('verdict');
	});

	it('rewards a psy-op turned back and counts it as caught', () => {
		const game = createGame(psyched);
		decide(game, 'refuse');
		expect(game.stats.caught).toBe(1);
		expect(game.stats.admitted).toBe(0);
		expect(game.score).toBeGreaterThan(0);
	});

	it('costs a reputation point for a family turned away', () => {
		const game = createGame(family);
		decide(game, 'refuse');
		expect(game.reputation).toBe(STARTING_REPUTATION - 1);
		expect(game.streak).toBe(0);
		expect(game.stats.turnedAway).toBe(1);
		expect(game.last).toMatchObject({ kind: 'wrong', truth: 'family', decision: 'refuse' });
	});

	it('costs a reputation point for a psy-op waved through', () => {
		const game = createGame(psyched);
		decide(game, 'pass');
		expect(game.reputation).toBe(STARTING_REPUTATION - 1);
		expect(game.stats.slipped).toBe(1);
	});

	it('pays a tunnel bonus for turning a digging crew back', () => {
		const game = createGame(diggers);
		expect(game.convoy.truth).toBe('tunnel');
		const expected = pointsFor(game) + POINTS_TUNNEL_BONUS;
		const events = decide(game, 'refuse');
		expect(events[0]).toMatchObject({ type: 'correct', truth: 'tunnel', points: expected });
		expect(game.score).toBe(expected);
		expect(game.stats.tunnels).toBe(1);
		expect(game.stats.caught).toBe(0);
		expect(game.stats.smuggled).toBe(0);
	});

	it('pays no tunnel bonus for any other right call', () => {
		const game = createGame(family);
		const expected = pointsFor(game);
		decide(game, 'pass');
		expect(game.score).toBe(expected);
	});

	it('lets a tunnel through when the trucks are waved on', () => {
		const game = createGame(diggers);
		decide(game, 'pass');
		expect(game.reputation).toBe(STARTING_REPUTATION - 1);
		expect(game.stats.smuggled).toBe(1);
		expect(game.stats.slipped).toBe(0);
		expect(game.last).toMatchObject({ kind: 'wrong', truth: 'tunnel', decision: 'pass' });
	});

	it('charges the ground probe patience like the other tools', () => {
		const game = createGame(diggers);
		const events = inspect(game, 'ground');
		expect(events).toEqual([{ type: 'hint', tool: 'ground', hint: 'tunnel' }]);
		expect(game.patienceLeftMs).toBe(patienceFor(1) - INSPECT_MS);
		expect(inspect(game, 'ground')).toEqual([]);
	});

	it('opens the barrier by itself when the convoy runs out of patience', () => {
		const game = createGame(psyched);
		const events = advance(game, psyched, PATIENCE_BASE_MS + 10);
		expect(events[0]).toMatchObject({ type: 'wrong', reason: 'timeout', decision: 'pass' });
		expect(game.patienceLeftMs).toBe(0);
		expect(game.stats.slipped).toBe(1);
	});

	it('also times out when the second look eats the last of the patience', () => {
		const game = createGame(psyched);
		game.patienceLeftMs = INSPECT_MS - 100;
		const events = inspect(game, 'camera');
		expect(events[0]).toMatchObject({ type: 'hint', hint: 'psyops' });
		expect(events[1]).toMatchObject({ type: 'wrong', reason: 'timeout' });
		expect(game.phase).toBe('verdict');
	});

	it('announces the next shift after three correct calls', () => {
		const game = createGame(family);
		passAndAdvance(game, family);
		passAndAdvance(game, family);
		expect(game.wave).toBe(1);
		const events = passAndAdvance(game, family);
		expect(events.some((event) => event.type === 'wave')).toBe(true);
		expect(game.wave).toBe(2);
		expect(game.correct).toBe(HITS_PER_WAVE);
		expect(patienceFor(game.wave)).toBeLessThan(patienceFor(1));
	});

	it('ends the night after the last reputation point and then shows the sheet', () => {
		const game = createGame(psyched);
		for (let i = 0; i < STARTING_REPUTATION - 1; i++) {
			decide(game, 'pass');
			advance(game, psyched, 2000);
		}
		decide(game, 'pass');
		expect(game.reputation).toBe(0);
		expect(game.phase).toBe('verdict');
		const events = advance(game, psyched, GAME_OVER_FEEDBACK_MS + 10);
		expect(events).toEqual([{ type: 'game-over' }]);
		expect(game.phase).toBe('over');
		expect(step(game, 100, psyched)).toEqual([]);
	});

	it('scores a faster call better than a slow one, and a streak better than none', () => {
		const quick = createGame(family);
		const slow = createGame(family);
		slow.patienceLeftMs = 10;
		expect(pointsFor(quick)).toBeGreaterThan(pointsFor(slow));
		quick.streak = 3;
		expect(pointsFor(quick)).toBeGreaterThan(pointsFor(createGame(family)));
	});
});

describe('the destabilisation campaign', () => {
	it('rises with a wrong call, harder for a psy-op than for a family turned away', () => {
		const slipped = createGame(psyched);
		decide(slipped, 'pass');
		const turnedAway = createGame(family);
		decide(turnedAway, 'refuse');
		expect(slipped.destabilisation).toBe(DESTAB_SLIPPED);
		expect(turnedAway.destabilisation).toBe(DESTAB_TURNED_AWAY);
		expect(slipped.destabilisation).toBeGreaterThan(turnedAway.destabilisation);
	});

	it('counts a finished tunnel as the heaviest story of the night', () => {
		const tunnel = createGame(diggers);
		decide(tunnel, 'pass');
		const slipped = createGame(psyched);
		decide(slipped, 'pass');
		expect(tunnel.destabilisation).toBe(DESTAB_TUNNEL);
		expect(tunnel.destabilisation).toBeGreaterThan(slipped.destabilisation);
	});

	it('buys a little calm back with every right call, but never below zero', () => {
		const game = createGame(family);
		game.destabilisation = 10;
		passAndAdvance(game, family);
		expect(game.destabilisation).toBe(10 - DESTAB_RELIEF);
		game.destabilisation = 2;
		passAndAdvance(game, family);
		expect(game.destabilisation).toBe(0);
	});

	it('ends the night early once Europe stops believing in itself', () => {
		const game = createGame(psyched);
		game.destabilisation = DESTABILISATION_MAX - DESTAB_SLIPPED + 1;
		game.reputation = 3;
		decide(game, 'pass');
		expect(game.destabilisation).toBe(DESTABILISATION_MAX);
		expect(game.doomed).toBe(true);
		expect(game.outcome).toBe('destabilised');
		expect(game.reputation).toBe(2);
		const events = advance(game, psyched, GAME_OVER_FEEDBACK_MS + 10);
		expect(events).toEqual([{ type: 'game-over' }]);
		expect(game.phase).toBe('over');
	});

	it('keeps the reputation ending when the post runs out of credit first', () => {
		const game = createGame(psyched);
		game.destabilisation = 0;
		for (let i = 0; i < STARTING_REPUTATION; i++) {
			decide(game, 'pass');
			if (game.phase === 'verdict') advance(game, psyched, 2000);
		}
		expect(game.reputation).toBe(0);
		expect(game.outcome).toBe('reputation');
	});

	it('reports the share for the meter between 0 and 1', () => {
		const game = createGame(family);
		expect(destabilisationShare(game)).toBe(0);
		game.destabilisation = DESTABILISATION_MAX;
		expect(destabilisationShare(game)).toBe(1);
	});
});

describe('Border Shift messages', () => {
	it('has its own and its mode messages in every language', () => {
		expect(missingMessages(['bordershift_', 'mode_bordershift_'])).toEqual([]);
	});

	it('has a vehicle description for every generated vehicle', () => {
		expect(missingMessages(['bordershift_vehicle_'])).toEqual([]);
		for (let i = 0; i < VEHICLE_COUNT; i++) {
			expect(missingMessages([`bordershift_vehicle_${i}`]), `${i}`).toEqual([]);
		}
		expect(missingMessages(['bordershift_vehicle_9'])).not.toEqual([]);
	});
});

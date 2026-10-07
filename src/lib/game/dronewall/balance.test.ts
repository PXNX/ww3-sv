/*
 * Balance checks: a simple bot plays whole games against the step function, so tuning changes
 * that make the first waves unwinnable (or an idle player survive) fail a test.
 */
import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import type { DefenseKind } from './config';
import { build, collectHelmetAt, upgrade } from './economy';
import { createGame, type DroneWallState } from './state';
import { stepGame } from './step';
import { STEP_MS } from './testHelpers';

type Purchase = { slot: number; kind?: DefenseKind };

/** Build a defense (with a kind) or upgrade the one in the slot (without), in this order */
const OPENING: Purchase[] = [
	{ slot: 2, kind: 'squad' },
	{ slot: 4, kind: 'squad' },
	{ slot: 3, kind: 'mortar' },
	{ slot: 5, kind: 'nest' },
	{ slot: 2 },
	{ slot: 3 },
	{ slot: 6, kind: 'squad' },
	{ slot: 7, kind: 'mortar' },
	{ slot: 4 },
	{ slot: 5 },
	{ slot: 0, kind: 'trench' },
	{ slot: 1, kind: 'squad' },
	{ slot: 6 },
	{ slot: 7 },
	{ slot: 2 },
	{ slot: 3 },
	{ slot: 4 },
	{ slot: 5 }
];

interface BotResult {
	wave: number;
	lives: number;
	over: boolean;
	kills: number;
	/** Lives at the end of each wave */
	livesAfterWave: number[];
}

/** collectDelayMs: how long a helmet lies around before the player taps it */
function playBot(seed: number, collectDelayMs: number, maxWave: number, plan = OPENING): BotResult {
	const state: DroneWallState = createGame();
	const random = createRandom(seed);
	let next = 0;
	const livesAfterWave: number[] = [];
	for (let i = 0; i < 60 * 60 * 20 && !state.over && state.wave <= maxWave; i++) {
		const events = stepGame(state, random, STEP_MS);
		for (const event of events) if (event.type === 'wave-cleared') livesAfterWave.push(state.lives);
		for (const helmet of [...state.helmets]) {
			if (helmet.ageMs >= collectDelayMs) collectHelmetAt(state, helmet.x, helmet.y);
		}
		while (next < plan.length) {
			const purchase = plan[next];
			const result = purchase.kind
				? build(state, purchase.slot, purchase.kind)
				: upgrade(state, purchase.slot);
			if (!result.ok) break;
			next += 1;
		}
	}
	return {
		wave: state.wave,
		lives: state.lives,
		over: state.over,
		kills: state.kills,
		livesAfterWave
	};
}

const MODEST: Purchase[] = [
	{ slot: 2, kind: 'squad' },
	{ slot: 4, kind: 'squad' },
	{ slot: 3, kind: 'trench' },
	{ slot: 5, kind: 'squad' },
	{ slot: 2 },
	{ slot: 4 },
	{ slot: 5 }
];

describe('balance', () => {
	it('an idle player loses in the first wave', () => {
		const result = playBot(1, 1000, 5, []);
		expect(result.over).toBe(true);
		expect(result.wave).toBe(1);
	});

	it.each([1, 2, 3, 4])('the first waves are winnable without a scratch (seed %i)', (seed) => {
		// Two squads is all the starting helmets buy; helmets from the fallen pay for the rest
		const result = playBot(seed, 3000, 5, MODEST);
		expect(result.over).toBe(false);
		expect(result.lives).toBe(7);
		expect(result.livesAfterWave.length).toBeGreaterThanOrEqual(5);
	});

	it.each([1, 2, 3])('a well-built wall holds for a long time (seed %i)', (seed) => {
		const result = playBot(seed, 3000, 12, OPENING);
		expect(result.over).toBe(false);
		expect(result.livesAfterWave.length).toBeGreaterThanOrEqual(12);
	});

	it('the game stays an endless fight: a modest wall eventually breaks', () => {
		const result = playBot(1, 3000, 60, MODEST);
		expect(result.over).toBe(true);
		expect(result.wave).toBeLessThan(25);
	});
});

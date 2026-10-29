import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { ALLY_FIRST_MS, ALLY_LIFETIME_MS } from './config';
import { newProfile } from './profile';
import { createRaid, spawnEnemy, stepRaid } from './state';

const STEP = 1000 / 60;

function quietRaid(seed: number) {
	const random = createRandom(seed);
	const state = createRaid('sunflower', newProfile().loadout, 1);
	state.spawnMs = Infinity;
	state.nextBossMs = Infinity;
	state.timeMs = ALLY_FIRST_MS;
	return { random, state };
}

describe('assault squad', () => {
	it('sends no crate before its time, then one right by the player', () => {
		const random = createRandom(3);
		const early = createRaid('sunflower', newProfile().loadout, 1);
		early.spawnMs = Infinity;
		early.nextBossMs = Infinity;
		for (let t = 0; t < ALLY_FIRST_MS - 2000; t += STEP) stepRaid(early, random, STEP);
		expect(early.allies).toHaveLength(0);

		const { state } = quietRaid(3);
		for (let t = 0; t < 4000; t += STEP) stepRaid(state, random, STEP);
		expect(state.allies.length).toBe(1);
		const ally = state.allies[0];
		expect(Math.hypot(ally.x - state.player.x, ally.y - state.player.y)).toBeLessThan(200);
	});

	it('runs at the closest enemy and hits it', () => {
		const { random, state } = quietRaid(11);
		for (let t = 0; t < 4000; t += STEP) stepRaid(state, random, STEP);
		const ally = state.allies[0];
		expect(ally).toBeDefined();
		const enemy = spawnEnemy(state, random, 'grunt', 'normal', {
			x: ally.x + 150,
			y: ally.y
		});
		expect(enemy).not.toBeNull();
		const before = Math.hypot(enemy!.x - ally.x, enemy!.y - ally.y);
		for (let t = 0; t < 3000; t += STEP) stepRaid(state, random, STEP);
		expect(Math.hypot(enemy!.x - ally.x, enemy!.y - ally.y)).toBeLessThan(before);
		expect(enemy!.hp).toBeLessThan(enemy!.maxHp);
	});

	it('falls apart after its lifetime even with nothing to fight', () => {
		const { random, state } = quietRaid(19);
		for (let t = 0; t < 4000; t += STEP) stepRaid(state, random, STEP);
		expect(state.allies.length).toBe(1);
		// No replacement crate while the first one is still on its way out
		state.allySpawnMs = Infinity;
		for (let t = 0; t < ALLY_LIFETIME_MS + 1000; t += STEP) stepRaid(state, random, STEP);
		expect(state.allies).toHaveLength(0);
	});
});

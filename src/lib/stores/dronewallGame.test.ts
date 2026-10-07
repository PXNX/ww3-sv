import { describe, expect, it } from 'vitest';
import { STARTING_HELMETS, STARTING_LIVES, buildCost } from '#lib/game/dronewall/config.js';
import { dropHelmet } from '#lib/game/dronewall/economy.js';
import { ROAD } from '#lib/game/dronewall/path.js';
import { soldierAt } from '#lib/game/dronewall/testHelpers.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { DroneWallGame } from './dronewallGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const STEP = 1000 / 60;

function newGame() {
	const scores = createHighscores(createStore(memoryStorage()));
	return { game: new DroneWallGame({ scores: () => scores, seed: () => 7 }), scores };
}

describe('DroneWallGame', () => {
	it('only simulates while playing', () => {
		const { game } = newGame();
		game.update(STEP);
		expect(game.state.timeMs).toBe(0);
		game.start();
		expect(game.status).toBe('playing');
		game.update(STEP);
		expect(game.state.timeMs).toBeGreaterThan(0);
		game.pause();
		const time = game.state.timeMs;
		game.update(STEP);
		expect(game.state.timeMs).toBe(time);
		game.togglePause();
		expect(game.status).toBe('playing');
	});

	it('builds on the selected slot and pays with helmets', () => {
		const { game } = newGame();
		game.start();
		expect(game.helmets).toBe(STARTING_HELMETS);
		game.select(2);
		expect(game.build('squad')).toEqual({ ok: true, cost: buildCost('squad') });
		expect(game.helmets).toBe(STARTING_HELMETS - buildCost('squad'));
		expect(game.state.defenses[2]?.kind).toBe('squad');
		expect(game.upgrade().ok).toBe(true);
		expect(game.state.defenses[2]?.level).toBe(2);
		expect(game.sell().ok).toBe(true);
		expect(game.state.defenses[2]).toBeNull();
	});

	it('needs a selected slot, and a poor build counts a broke tap', () => {
		const { game } = newGame();
		game.start();
		expect(game.build('squad').ok).toBe(false);
		game.select(0);
		game.state.currency = 1;
		expect(game.build('mortar')).toEqual({ ok: false, reason: 'poor' });
		expect(game.brokeCount).toBe(1);
		expect(game.state.defenses[0]).toBeNull();
	});

	it('selecting a slot twice closes it, and unknown slots are ignored', () => {
		const { game } = newGame();
		game.select(3);
		expect(game.selectedSlot).toBe(3);
		game.select(3);
		expect(game.selectedSlot).toBeNull();
		game.select(99);
		expect(game.selectedSlot).toBeNull();
	});

	it('collects dropped helmets by itself when they land on the counter', () => {
		const { game } = newGame();
		game.start();
		dropHelmet(game.state, soldierAt(300), 1);
		dropHelmet(game.state, soldierAt(310, 'brute'), 3);
		game.update(STEP);
		// Still flying: not in the pocket yet
		expect(game.helmets).toBe(STARTING_HELMETS);
		for (let i = 0; i < 60; i++) game.update(STEP);
		expect(game.helmets).toBe(STARTING_HELMETS + 4);
		expect(game.collected).toBe(4);
		expect(game.collectPulse).toBe(2);
		expect(game.state.helmets).toHaveLength(0);
		// The "+n" pops up at the counter, not where the soldier fell
		expect(game.effects.some((effect) => effect.kind === 'popup')).toBe(true);
	});

	it('cycles the game speed with one button: x1, x2, x4 and around', () => {
		const { game } = newGame();
		expect(game.speed).toBe(1);
		expect(game.cycleSpeed()).toBe(2);
		expect(game.cycleSpeed()).toBe(4);
		expect(game.cycleSpeed()).toBe(1);
	});

	it('runs that many simulation steps per frame', () => {
		const { game } = newGame();
		game.start();
		game.update(STEP);
		const normal = game.state.timeMs;
		for (const speed of [2, 4]) {
			game.speed = speed as 2 | 4;
			const before = game.state.timeMs;
			game.update(STEP);
			expect(game.state.timeMs - before).toBeCloseTo(normal * speed);
		}
	});

	it('shows tumble and poof effects for a fallen soldier, never anything bloody', () => {
		const { game } = newGame();
		game.start();
		game.state.phase = 'wave';
		game.state.queue = [{ atMs: 1e9, kind: 'grunt', speedScale: 1, lane: 0 }];
		const soldier = soldierAt(300);
		soldier.hp = 0;
		game.state.soldiers.push(soldier);
		game.update(STEP);
		expect(game.effects.map((effect) => effect.kind).sort()).toEqual(['poof', 'tumble']);
		expect(game.kills).toBe(1);
		for (let i = 0; i < 120; i++) game.update(STEP);
		expect(game.effects).toHaveLength(0);
	});

	it('ends the game when the line is breached and keeps the best wave and score', () => {
		const { game, scores } = newGame();
		game.start();
		game.state.phase = 'wave';
		game.state.wave = 3;
		game.state.score = 120;
		game.state.queue = [{ atMs: 1e9, kind: 'grunt', speedScale: 1, lane: 0 }];
		game.state.lives = 1;
		game.state.soldiers.push(soldierAt(ROAD.length - 0.1));
		game.update(STEP);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(['dronewall', 'score'])).toBe(120);
		expect(scores.get(['dronewall', 'wave'])).toBe(3);
		game.loadBest();
		expect(game.best).toBe(120);
		expect(game.bestWave).toBe(3);

		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.score).toBe(0);
		expect(game.isNewBest).toBe(false);
	});
});

describe('Drone Wall messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['dronewall_', 'mode_dronewall_'])).toEqual([]);
	});
});

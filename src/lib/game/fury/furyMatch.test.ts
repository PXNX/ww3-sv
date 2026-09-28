import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import { FuryMatch, SETTLE_TIMEOUT_STEPS } from './furyMatch';
import type { Aim } from './launch';
import type { LevelData } from './levels/schema';
import { DOME_POINTS, UNUSED_BIRD_BONUS } from './rules';

/** One dome on the ground straight ahead, and one wooden block beside it */
const target: LevelData = {
	version: 1,
	id: 'level-99',
	width: 22,
	birds: ['pelican', 'flamingo', 'goose'],
	blocks: [{ material: 'wood', shape: 'box', x: 18, y: 0, w: 0.4, h: 1 }],
	domes: [{ x: 10, y: 0, size: 1 }]
};

/** Flat and hard, straight into the dome */
const hit: Aim = { angle: 0, power: 0.8 };
/** Steeply up with little power: lands next to the slingshot */
const miss: Aim = { angle: 1.4, power: 0.3 };

function playUntil(match: FuryMatch, done: (match: FuryMatch) => boolean, limit = 1200) {
	for (let i = 0; i < limit && !done(match); i++) match.step();
}

describe('FuryMatch', () => {
	it('starts aiming with the first bird of the squad in the slingshot', () => {
		const match = new FuryMatch(target, createRandom(1));
		expect(match.phase).toBe('aiming');
		expect(match.currentBird).toBe('pelican');
		expect(match.birdsLeft).toBe(3);
	});

	it('ignores a pull that is too weak', () => {
		const match = new FuryMatch(target, createRandom(1));
		expect(match.launch({ angle: 0.5, power: 0.05 })).toBe(false);
		expect(match.phase).toBe('aiming');
		expect(match.birdsLeft).toBe(3);
	});

	it('wins when the last dome breaks and pays the unused-bird bonus', () => {
		const match = new FuryMatch(target, createRandom(1));
		playUntil(match, (m) => m.stepsInPhase >= 30);
		expect(match.launch(hit)).toBe(true);
		expect(match.phase).toBe('flying');
		expect(match.currentBird).toBeNull();
		playUntil(match, (m) => m.isOver);
		expect(match.phase).toBe('won');
		expect(match.birdsLeft).toBe(2);
		expect(match.bonus).toBe(2 * UNUSED_BIRD_BONUS);
		expect(match.score).toBe(match.world.destructionPoints + 2 * UNUSED_BIRD_BONUS);
		expect(match.score).toBeGreaterThanOrEqual(DOME_POINTS);
		// Won with birds to spare but the lone block standing: two stars
		expect(match.stars).toBe(2);
	});

	it('loads the next bird after a miss, once everything has settled', () => {
		const match = new FuryMatch(target, createRandom(1));
		match.launch(miss);
		playUntil(match, (m) => m.phase === 'aiming');
		expect(match.phase).toBe('aiming');
		expect(match.currentBird).toBe('flamingo');
		expect(match.world.domesRemaining).toBe(1);
	});

	it('fails when out of birds with a dome still standing', () => {
		const match = new FuryMatch({ ...target, birds: ['pelican'] }, createRandom(1));
		match.launch(miss);
		playUntil(match, (m) => m.isOver);
		expect(match.phase).toBe('failed');
		expect(match.stars).toBe(0);
		expect(match.bonus).toBe(0);
		expect(match.launch(hit)).toBe(false);
	});

	it('ends a turn at the settle timeout even if something keeps moving', () => {
		expect(SETTLE_TIMEOUT_STEPS).toBeGreaterThan(0);
		const match = new FuryMatch({ ...target, birds: ['pelican'] }, createRandom(1));
		match.launch(miss);
		playUntil(match, (m) => m.phase === 'settling');
		expect(match.phase).toBe('settling');
		playUntil(match, (m) => m.isOver, SETTLE_TIMEOUT_STEPS + 1);
		expect(match.phase).toBe('failed');
	});

	it('plays out identically with the same inputs', () => {
		const play = () => {
			const match = new FuryMatch(target, createRandom(7));
			match.launch({ angle: 0.2, power: 0.9 });
			playUntil(match, (m) => m.phase !== 'flying');
			const bird = match.world.pieces.find((piece) => piece.kind === 'bird');
			return { phase: match.phase, score: match.score, x: bird?.body.getPosition().x };
		};
		expect(play()).toEqual(play());
	});
});

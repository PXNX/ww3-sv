import { describe, expect, it } from 'vitest';
import { MAP_IDS } from './config';
import { raidMap } from './maps';

describe('raid maps', () => {
	it.each(MAP_IDS)('%s has plenty of cover, all inside the map and clear of the start', (id) => {
		const map = raidMap(id);
		expect(map.obstacles.length).toBeGreaterThan(30);
		expect(map.decor.length).toBeGreaterThan(50);
		for (const obstacle of map.obstacles) {
			expect(obstacle.x - obstacle.r).toBeGreaterThanOrEqual(0);
			expect(obstacle.y - obstacle.r).toBeGreaterThanOrEqual(0);
			expect(obstacle.x + obstacle.r).toBeLessThanOrEqual(map.width);
			expect(obstacle.y + obstacle.r).toBeLessThanOrEqual(map.height);
			expect(Math.hypot(obstacle.x - map.spawn.x, obstacle.y - map.spawn.y)).toBeGreaterThan(
				obstacle.r + 100
			);
		}
	});

	it('never lets two pieces of cover touch, so there is always a way between them', () => {
		for (const id of MAP_IDS) {
			const { obstacles } = raidMap(id);
			for (let i = 0; i < obstacles.length; i++) {
				for (let j = i + 1; j < obstacles.length; j++) {
					const a = obstacles[i];
					const b = obstacles[j];
					expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r + 50);
				}
			}
		}
	});

	it('is the same layout every time and gets harder and richer map by map', () => {
		expect(raidMap('sunflower')).toBe(raidMap('sunflower'));
		const [first, second, third] = MAP_IDS.map(raidMap);
		expect(
			new Set([first.obstacles[5].kind, second.obstacles[5].kind, third.obstacles[5].kind]).size
		).toBe(3);
		expect(second.difficulty).toBeGreaterThan(first.difficulty);
		expect(third.difficulty).toBeGreaterThan(second.difficulty);
		expect(third.reward).toBeGreaterThan(second.reward);
	});
});

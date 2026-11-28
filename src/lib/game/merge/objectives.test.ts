import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	OBJECTIVES,
	drawObjectives,
	newlyCompleted,
	objectiveDone,
	objectiveProgress
} from './objectives.js';
import type { MergeRunStats } from './objectives.js';

const stats = (over: Partial<MergeRunStats> = {}): MergeRunStats => ({
	highestTier: 1,
	minesDestroyed: 0,
	triples: 0,
	score: 0,
	...over
});

describe('merge run objectives', () => {
	it('draws three different goals', () => {
		const drawn = drawObjectives(createRandom(4));
		expect(drawn).toHaveLength(3);
		expect(new Set(drawn.map((objective) => objective.id)).size).toBe(3);
	});

	it('tracks progress without overshooting the target', () => {
		const objective = OBJECTIVES.find((item) => item.id === 'clear_mines')!;
		expect(objectiveProgress(objective, stats({ minesDestroyed: 2 }))).toBe(2);
		expect(objectiveProgress(objective, stats({ minesDestroyed: 9 }))).toBe(3);
		expect(objectiveDone(objective, stats({ minesDestroyed: 2 }))).toBe(false);
		expect(objectiveDone(objective, stats({ minesDestroyed: 3 }))).toBe(true);
	});

	it('reports each finish only once', () => {
		const drawn = OBJECTIVES.slice(0, 2);
		const ready = stats({ highestTier: 6, minesDestroyed: 3 });
		expect(newlyCompleted(drawn, ready, [])).toHaveLength(2);
		expect(newlyCompleted(drawn, ready, ['ferry'])).toHaveLength(1);
		expect(newlyCompleted(drawn, ready, ['ferry', 'oil_tanker'])).toHaveLength(0);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	OBJECTIVES,
	OBJECTIVES_PER_RUN,
	advanceObjectives,
	completedCount,
	createObjectives,
	type ObjectiveEvent,
	type ObjectiveState
} from './objectives';

const quiet: ObjectiveEvent = {
	lines: 0,
	cascade: 0,
	streak: 0,
	piecesPlaced: 0,
	linesCleared: 0
};

function objective(id: ObjectiveState['id'], target: number, bonus = 100): ObjectiveState {
	return { id, target, bonus, progress: 0, done: false };
}

function event(overrides: Partial<ObjectiveEvent>): ObjectiveEvent {
	return { ...quiet, ...overrides };
}

describe('objective deck', () => {
	it('draws three distinct goals, reproducibly from a seed', () => {
		const first = createObjectives(createRandom(7));
		const second = createObjectives(createRandom(7));
		expect(first).toHaveLength(OBJECTIVES_PER_RUN);
		expect(new Set(first.map((goal) => goal.id)).size).toBe(OBJECTIVES_PER_RUN);
		expect(first).toEqual(second);
		expect(first.every((goal) => goal.progress === 0 && !goal.done)).toBe(true);
	});

	it('can draw every objective from the deck over many runs', () => {
		const seen = new Set<string>();
		const random = createRandom(11);
		for (let run = 0; run < 50; run++) {
			for (const goal of createObjectives(random)) seen.add(goal.id);
		}
		expect(seen.size).toBe(OBJECTIVES.length);
	});
});

describe('advanceObjectives', () => {
	it('completes a double clear once and pays its bonus once', () => {
		const goals = [objective('double', 1, 150), objective('lines', 10, 200)];
		const first = advanceObjectives(goals, event({ lines: 2, linesCleared: 2 }));
		expect(first.completed.map((goal) => goal.id)).toEqual(['double']);
		expect(first.bonus).toBe(150);
		expect(first.objectives[0]).toMatchObject({ progress: 1, done: true });

		const again = advanceObjectives(first.objectives, event({ lines: 2, linesCleared: 4 }));
		expect(again.completed).toEqual([]);
		expect(again.bonus).toBe(0);
	});

	it('does not complete a double objective on two separate clears', () => {
		const goals = [objective('double', 1)];
		const first = advanceObjectives(goals, event({ lines: 1, linesCleared: 1 }));
		const second = advanceObjectives(first.objectives, event({ lines: 1, linesCleared: 2 }));
		expect(first.completed).toEqual([]);
		expect(second.completed).toEqual([]);
		expect(second.objectives[0].progress).toBe(0);
	});

	it('reads total lines and pieces from run stats', () => {
		const goals = [objective('lines', 10), objective('pieces', 25)];
		const update = advanceObjectives(goals, event({ linesCleared: 10, piecesPlaced: 25 }));
		expect(update.completed.map((goal) => goal.id)).toEqual(['lines', 'pieces']);
		expect(update.bonus).toBe(200);
		expect(completedCount(update.objectives)).toBe(2);
	});

	it('tracks the best cascade and combo without ever lowering progress', () => {
		const goals = [objective('cascade', 3), objective('combo', 3)];
		const rising = advanceObjectives(goals, event({ cascade: 2, streak: 3 }));
		const falling = advanceObjectives(rising.objectives, event({ cascade: 1, streak: 1 }));
		expect(rising.completed.map((goal) => goal.id)).toEqual(['combo']);
		expect(falling.objectives[0].progress).toBe(2);
		expect(falling.objectives[0].done).toBe(false);
		expect(falling.completed).toEqual([]);
	});

	it('caps progress at the target and completes a cascade at three', () => {
		const goals = [objective('cascade', 3, 250)];
		const update = advanceObjectives(goals, event({ cascade: 5 }));
		expect(update.objectives[0]).toMatchObject({ progress: 3, done: true });
		expect(update.bonus).toBe(250);
	});

	it('leaves the input list untouched', () => {
		const goals = [objective('lines', 10)];
		const update = advanceObjectives(goals, event({ linesCleared: 4 }));
		expect(goals[0].progress).toBe(0);
		expect(update.objectives[0].progress).toBe(4);
		expect(update.objectives[0]).not.toBe(goals[0]);
	});
});

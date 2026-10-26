/*
 * Optional objectives for a Block Puzzle run. Three goals are drawn from a small deck and shown
 * above the board; each one pays a bonus the moment it is reached, so every run has a plan beyond
 * "keep clearing lines". The rules are pure and seeded, so a daily or a test can reproduce them.
 */
import { shuffle, type Random } from '#lib/game/random.js';

export type ObjectiveId = 'double' | 'triple' | 'lines' | 'cascade' | 'pieces' | 'combo';

export interface ObjectiveDef {
	id: ObjectiveId;
	/** Progress needed to complete it */
	target: number;
	/** Score paid once when it is completed */
	bonus: number;
}

/** The deck. Every entry has a fixed target, so the copy needs no parameters. */
export const OBJECTIVES: readonly ObjectiveDef[] = [
	{ id: 'double', target: 1, bonus: 150 },
	{ id: 'triple', target: 1, bonus: 300 },
	{ id: 'lines', target: 10, bonus: 200 },
	{ id: 'cascade', target: 3, bonus: 250 },
	{ id: 'pieces', target: 25, bonus: 150 },
	{ id: 'combo', target: 3, bonus: 200 }
];

export const OBJECTIVES_PER_RUN = 3;

export interface ObjectiveState extends ObjectiveDef {
	progress: number;
	done: boolean;
}

/** Draws a fresh set of distinct objectives for a run */
export function createObjectives(
	random: Random,
	deck: readonly ObjectiveDef[] = OBJECTIVES
): ObjectiveState[] {
	return shuffle(random, deck)
		.slice(0, OBJECTIVES_PER_RUN)
		.map((def) => ({ ...def, progress: 0, done: false }));
}

export interface ObjectiveEvent {
	/** Lines cleared by the placement just made */
	lines: number;
	/** Consecutive clearing placements, including this one (0 after a quiet placement) */
	cascade: number;
	/** Current combo streak */
	streak: number;
	piecesPlaced: number;
	linesCleared: number;
}

export interface ObjectiveUpdate {
	objectives: ObjectiveState[];
	/** Objectives that were completed by this event */
	completed: ObjectiveState[];
	/** Points to pay for those completions */
	bonus: number;
}

/** Progress of one objective after an event; targets never need more than the target itself. */
function progressOf(objective: ObjectiveState, event: ObjectiveEvent): number {
	switch (objective.id) {
		case 'double':
			return event.lines >= 2 ? objective.progress + 1 : objective.progress;
		case 'triple':
			return event.lines >= 3 ? objective.progress + 1 : objective.progress;
		case 'lines':
			return event.linesCleared;
		case 'cascade':
			return event.cascade;
		case 'pieces':
			return event.piecesPlaced;
		case 'combo':
			return event.streak;
	}
}

/**
 * Advances every unfinished objective and returns the new list, the goals this placement completed,
 * and the bonus they pay. The input is not mutated, so a failed test is easy to inspect.
 */
export function advanceObjectives(
	objectives: readonly ObjectiveState[],
	event: ObjectiveEvent
): ObjectiveUpdate {
	const completed: ObjectiveState[] = [];
	const next = objectives.map((objective) => {
		if (objective.done) return objective;
		const progress = Math.min(
			objective.target,
			Math.max(objective.progress, progressOf(objective, event))
		);
		if (progress >= objective.target) {
			const done = { ...objective, progress: objective.target, done: true };
			completed.push(done);
			return done;
		}
		return progress === objective.progress ? objective : { ...objective, progress };
	});
	return {
		objectives: next,
		completed,
		bonus: completed.reduce((sum, objective) => sum + objective.bonus, 0)
	};
}

/** Number of objectives that are done, for the result sheet */
export function completedCount(objectives: readonly ObjectiveState[]): number {
	return objectives.filter((objective) => objective.done).length;
}

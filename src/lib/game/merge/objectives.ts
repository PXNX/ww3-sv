/*
 * Run objectives for Merge: three optional goals drawn at the start of a run and scored on the
 * spot when completed. They give a score chase a plan without changing how a swipe works.
 */
import type { Random } from '#lib/game/random.js';

export type ObjectiveId = 'ferry' | 'oil_tanker' | 'clear_mines' | 'triple' | 'rich';

export interface MergeRunStats {
	highestTier: number;
	minesDestroyed: number;
	triples: number;
	score: number;
}

export interface ObjectiveDef {
	id: ObjectiveId;
	/** Message key under merge_objective_* */
	name: ObjectiveId;
	target: number;
	bonus: number;
	measure: (stats: MergeRunStats) => number;
}

export const OBJECTIVES: readonly ObjectiveDef[] = [
	{
		id: 'ferry',
		name: 'ferry',
		target: 4,
		bonus: 150,
		measure: (stats) => stats.highestTier
	},
	{
		id: 'oil_tanker',
		name: 'oil_tanker',
		target: 6,
		bonus: 400,
		measure: (stats) => stats.highestTier
	},
	{
		id: 'clear_mines',
		name: 'clear_mines',
		target: 3,
		bonus: 200,
		measure: (stats) => stats.minesDestroyed
	},
	{
		id: 'triple',
		name: 'triple',
		target: 1,
		bonus: 250,
		measure: (stats) => stats.triples
	},
	{
		id: 'rich',
		name: 'rich',
		target: 1000,
		bonus: 300,
		measure: (stats) => stats.score
	}
];

/** Three different goals per run, in a stable order */
export function drawObjectives(random: Random): ObjectiveDef[] {
	const pool = [...OBJECTIVES];
	const drawn: ObjectiveDef[] = [];
	for (let i = 0; i < 3 && pool.length > 0; i++) {
		drawn.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
	}
	return drawn;
}

export function objectiveProgress(objective: ObjectiveDef, stats: MergeRunStats): number {
	return Math.min(objective.target, Math.max(0, Math.floor(objective.measure(stats))));
}

export function objectiveDone(objective: ObjectiveDef, stats: MergeRunStats): boolean {
	return objectiveProgress(objective, stats) >= objective.target;
}

/** Goals finished since the previous stats, so the store can award each bonus exactly once */
export function newlyCompleted(
	objectives: readonly ObjectiveDef[],
	stats: MergeRunStats,
	awarded: readonly ObjectiveId[]
): ObjectiveDef[] {
	return objectives.filter(
		(objective) => objectiveDone(objective, stats) && !awarded.includes(objective.id)
	);
}

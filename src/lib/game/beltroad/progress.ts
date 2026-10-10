/*
 * Level progress, stored locally (no accounts): the best star rating per level. A level opens once
 * the one before it has been finished. Fewest moves per level live in the shared high score
 * service under ['beltroad', '<level id>', 'moves'] (lower is better).
 */

export const PROGRESS_KEY = 'beltroad:progress';

export interface BeltRoadProgress {
	version: 1;
	/** Best stars per level id (1 to 3); a level listed here has been finished */
	stars: Record<string, number>;
}

export const EMPTY_PROGRESS: BeltRoadProgress = { version: 1, stars: {} };

export function isBeltRoadProgress(value: unknown): value is BeltRoadProgress {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<BeltRoadProgress>;
	if (candidate.version !== 1) return false;
	const stars = candidate.stars;
	if (typeof stars !== 'object' || stars === null || Array.isArray(stars)) return false;
	return Object.values(stars).every(
		(count) => Number.isInteger(count) && (count as number) >= 1 && (count as number) <= 3
	);
}

/** Records a finished level, keeping the better star rating */
export function recordFinish(
	progress: BeltRoadProgress,
	levelId: string,
	stars: number
): BeltRoadProgress {
	const clamped = Math.min(3, Math.max(1, Math.round(stars)));
	if (clamped <= (progress.stars[levelId] ?? 0)) return progress;
	return { version: 1, stars: { ...progress.stars, [levelId]: clamped } };
}

/** The first level is always open; every other one needs the previous level finished */
export function isUnlocked(
	progress: BeltRoadProgress,
	levelIds: readonly string[],
	index: number
): boolean {
	if (index <= 0) return index === 0;
	return (progress.stars[levelIds[index - 1]] ?? 0) > 0;
}

export function totalStars(progress: BeltRoadProgress, levelIds: readonly string[]): number {
	return levelIds.reduce((sum, id) => sum + (progress.stars[id] ?? 0), 0);
}

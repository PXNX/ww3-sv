/*
 * Level progress, stored locally: the best star count per finished job (0 to 3). A job opens once
 * the one before it has been finished. The run high score lives in the shared high score service.
 */

export const PROGRESS_KEY = 'sabotage:progress';

export interface SabotageProgress {
	version: 1;
	/** Best stars per level id; a level listed here has been finished, even with 0 stars */
	stars: Record<string, number>;
}

export const EMPTY_PROGRESS: SabotageProgress = { version: 1, stars: {} };

export function isSabotageProgress(value: unknown): value is SabotageProgress {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<SabotageProgress>;
	if (candidate.version !== 1) return false;
	const stars = candidate.stars;
	if (typeof stars !== 'object' || stars === null || Array.isArray(stars)) return false;
	return Object.values(stars).every(
		(count) => Number.isInteger(count) && (count as number) >= 0 && (count as number) <= 3
	);
}

/** Records a finished level, keeping the better star count */
export function recordFinish(
	progress: SabotageProgress,
	levelId: string,
	stars: number
): SabotageProgress {
	const clamped = Math.min(3, Math.max(0, Math.round(stars)));
	const before = progress.stars[levelId];
	if (before !== undefined && clamped <= before) return progress;
	return { version: 1, stars: { ...progress.stars, [levelId]: clamped } };
}

export const isFinished = (progress: SabotageProgress, levelId: string): boolean =>
	progress.stars[levelId] !== undefined;

/** The first level is always open; every other one needs the previous level finished */
export function isUnlocked(
	progress: SabotageProgress,
	levelIds: readonly string[],
	index: number
): boolean {
	if (index < 0 || index >= levelIds.length) return false;
	return index === 0 || isFinished(progress, levelIds[index - 1]);
}

export function totalStars(progress: SabotageProgress, levelIds: readonly string[]): number {
	return levelIds.reduce((sum, id) => sum + (progress.stars[id] ?? 0), 0);
}

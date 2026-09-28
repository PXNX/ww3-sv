/*
 * Level progress and settings, stored locally (no accounts). Progress keeps the best star rating
 * per level; a level unlocks once the one before it has been won. Best scores live in the shared
 * high score service under ['fury', '<level id>', 'score'].
 */

export const PROGRESS_KEY = 'fury:progress';
export const SETTINGS_KEY = 'fury:settings';

export interface FuryProgress {
	version: 1;
	/** Best stars per level id (1 to 3); a level listed here has been won */
	stars: Record<string, number>;
}

export interface FurySettings {
	/** Accessibility: a longer dotted aiming line */
	longPreview: boolean;
}

export const EMPTY_PROGRESS: FuryProgress = { version: 1, stars: {} };
export const DEFAULT_SETTINGS: FurySettings = { longPreview: false };

export function isFuryProgress(value: unknown): value is FuryProgress {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<FuryProgress>;
	if (candidate.version !== 1) return false;
	const stars = candidate.stars;
	if (typeof stars !== 'object' || stars === null || Array.isArray(stars)) return false;
	return Object.values(stars).every(
		(count) => Number.isInteger(count) && (count as number) >= 1 && (count as number) <= 3
	);
}

export function isFurySettings(value: unknown): value is FurySettings {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Partial<FurySettings>).longPreview === 'boolean'
	);
}

/** Records a won level, keeping the better star rating */
export function recordWin(progress: FuryProgress, levelId: string, stars: number): FuryProgress {
	const clamped = Math.min(3, Math.max(1, Math.round(stars)));
	const previous = progress.stars[levelId] ?? 0;
	if (clamped <= previous) return progress;
	return { version: 1, stars: { ...progress.stars, [levelId]: clamped } };
}

/** The first level is always open; every other one needs the previous level won */
export function isUnlocked(
	progress: FuryProgress,
	levelIds: readonly string[],
	index: number
): boolean {
	if (index <= 0) return index === 0;
	const previous = levelIds[index - 1];
	return previous !== undefined && (progress.stars[previous] ?? 0) > 0;
}

export function totalStars(progress: FuryProgress, levelIds: readonly string[]): number {
	return levelIds.reduce((sum, id) => sum + (progress.stars[id] ?? 0), 0);
}

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

/**
 * The first level is always open; every other one needs the previous level won. Ids come from a
 * function of the index, because the generated levels after the prepared ones never end.
 */
export function isUnlocked(
	progress: FuryProgress,
	idAt: (index: number) => string,
	index: number
): boolean {
	if (index <= 0) return index === 0;
	return (progress.stars[idAt(index - 1)] ?? 0) > 0;
}

/**
 * How many level cards the level select shows: all prepared levels, and past them every level won
 * so far plus the next one to play. The generated levels never end, so none are shown ahead.
 */
export function visibleLevelCount(
	progress: FuryProgress,
	preparedCount: number,
	idAt: (index: number) => string
): number {
	let firstOpen = 0;
	while ((progress.stars[idAt(firstOpen)] ?? 0) > 0) firstOpen++;
	return Math.max(preparedCount, firstOpen + 1);
}

export function totalStars(progress: FuryProgress, levelIds: readonly string[]): number {
	return levelIds.reduce((sum, id) => sum + (progress.stars[id] ?? 0), 0);
}

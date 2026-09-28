/*
 * Block Puzzle scoring. Every placed cell is worth a point. Clearing lines is worth more, with two
 * multipliers: clearing several lines with one piece multiplies by the number of lines, and a
 * streak of clears (each within a few placements of the last) multiplies again.
 */

export const POINTS_PER_CELL = 1;
export const POINTS_PER_LINE = 10;
/** A streak survives this many placements in a row that clear nothing */
export const STREAK_GRACE_MOVES = 2;
export const MAX_STREAK_MULTIPLIER = 5;

export interface Combo {
	/** Number of clearing placements in the current streak */
	streak: number;
	/** Placements without a clear since the last clear */
	movesSinceClear: number;
}

export const NO_COMBO: Combo = { streak: 0, movesSinceClear: 0 };

export interface MoveScore {
	points: number;
	linePoints: number;
	/** Multiplier for clearing several lines at once (equals the number of lines) */
	lineMultiplier: number;
	/** Multiplier for the running streak of clears (1 when there is no streak) */
	streakMultiplier: number;
	combo: Combo;
}

export function scoreMove(cellsPlaced: number, linesCleared: number, combo: Combo): MoveScore {
	const placementPoints = cellsPlaced * POINTS_PER_CELL;

	if (linesCleared === 0) {
		const movesSinceClear = combo.movesSinceClear + 1;
		const streak = movesSinceClear > STREAK_GRACE_MOVES ? 0 : combo.streak;
		return {
			points: placementPoints,
			linePoints: 0,
			lineMultiplier: 0,
			streakMultiplier: 1,
			combo: { streak, movesSinceClear: streak === 0 ? 0 : movesSinceClear }
		};
	}

	const streak = combo.streak + 1;
	const streakMultiplier = Math.min(streak, MAX_STREAK_MULTIPLIER);
	const linePoints = POINTS_PER_LINE * linesCleared * linesCleared * streakMultiplier;
	return {
		points: placementPoints + linePoints,
		linePoints,
		lineMultiplier: linesCleared,
		streakMultiplier,
		combo: { streak, movesSinceClear: 0 }
	};
}

/** Board fill ratio from which the game counts as being in danger */
export const NEARLY_FULL = 0.6;

export type Mood = 'winning' | 'danger' | 'neutral';

/** A theme-agnostic read of how the game is going, used for mascot reactions */
export function performanceMood(state: {
	fillRatio: number;
	streak: number;
	lastLines: number;
}): Mood {
	if (state.fillRatio >= NEARLY_FULL) return 'danger';
	if (state.streak >= 2 || state.lastLines >= 2) return 'winning';
	return 'neutral';
}

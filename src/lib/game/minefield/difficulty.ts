/* Difficulty levels (requirements Section 3), kept as plain constants so they are easy to tune */

export const DIFFICULTY_IDS = ['easy', 'normal', 'hard'] as const;

export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export interface Difficulty {
	columns: number;
	rows: number;
	/** Share of all cells that hold a mine */
	mineDensity: number;
	submarines: number;
	/** Applied to the whole score, so harder boards are worth more */
	scoreMultiplier: number;
	/** Winning faster than this earns a speed bonus */
	parSeconds: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
	easy: {
		columns: 8,
		rows: 6,
		mineDensity: 0.12,
		submarines: 3,
		scoreMultiplier: 1,
		parSeconds: 90
	},
	normal: {
		columns: 10,
		rows: 8,
		mineDensity: 0.15,
		submarines: 2,
		scoreMultiplier: 1.5,
		parSeconds: 180
	},
	hard: {
		columns: 12,
		rows: 9,
		mineDensity: 0.19,
		submarines: 1,
		scoreMultiplier: 2,
		parSeconds: 300
	}
};

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

/** Tankers waiting at the western edge; each one is a life */
export const TANKER_COUNT = 3;

export function isDifficultyId(value: unknown): value is DifficultyId {
	return typeof value === 'string' && (DIFFICULTY_IDS as readonly string[]).includes(value);
}

/*
 * Wave definitions for Shahed Shootdown (requirements Section 6). Waves are endless: each one adds
 * formation size, speed and dive pressure until a cap, and every fifth wave is a boss wave with a
 * Mega-Shahed that takes several hits.
 */

export const BOSS_WAVE_INTERVAL = 5;

/** Difficulty stops growing after this many waves; later waves repeat the capped values */
export const DIFFICULTY_CAP_WAVE = 13;

export const MAX_COLUMNS = 9;
export const MAX_ROWS = 6;
export const MAX_DIVERS = 3;
export const MAX_BOSS_HIT_POINTS = 16;

export interface BossDefinition {
	hitPoints: number;
	/** Horizontal speed in world units per second at full hit points */
	speed: number;
	/** How far the boss drops each time it reverses at an edge */
	stepDown: number;
}

export interface WaveDefinition {
	wave: number;
	columns: number;
	rows: number;
	/** Horizontal formation speed in world units per second with every drone still alive */
	baseSpeed: number;
	/** How far the formation drops each time it reverses at an edge */
	stepDown: number;
	/** Random pause between two dive attempts, in milliseconds */
	diveIntervalMs: readonly [min: number, max: number];
	/** How many drones may be diving (or warning before a dive) at the same time */
	maxDivers: number;
	/** Dive speed in world units per second */
	diveSpeed: number;
	boss: BossDefinition | null;
}

export function isBossWave(wave: number): boolean {
	return wave > 0 && wave % BOSS_WAVE_INTERVAL === 0;
}

export function waveDefinition(wave: number): WaveDefinition {
	const safeWave = Math.max(1, Math.floor(wave));
	// 0 on wave one, growing by one per wave until the cap
	const level = Math.min(safeWave, DIFFICULTY_CAP_WAVE) - 1;

	const columns = Math.min(8 + Math.floor(level / 4), MAX_COLUMNS);
	const rows = Math.min(4 + Math.floor(level / 3), MAX_ROWS);
	const baseSpeed = 24 + level * 4;
	const diveMin = Math.max(1300, 3800 - level * 200);
	const common = {
		wave: safeWave,
		baseSpeed,
		stepDown: 12,
		diveIntervalMs: [diveMin, diveMin + 1800] as const,
		maxDivers: Math.min(1 + Math.floor(level / 4), MAX_DIVERS),
		diveSpeed: 150 + level * 8
	};

	if (!isBossWave(safeWave)) return { ...common, columns, rows, boss: null };

	// Boss waves trade formation size for the Mega-Shahed, a smaller escort flies below it
	const bossNumber = safeWave / BOSS_WAVE_INTERVAL;
	return {
		...common,
		columns: 6,
		rows: 2,
		boss: {
			hitPoints: Math.min(6 + (bossNumber - 1) * 2, MAX_BOSS_HIT_POINTS),
			speed: 40 + Math.min(bossNumber - 1, 5) * 8,
			stepDown: 18
		}
	};
}

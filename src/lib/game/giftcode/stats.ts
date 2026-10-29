/* Admin bot stats: active users, plays, highscores (stub for real DB) */
export interface GameStats {
	mode: string;
	users: number;
	plays: number;
	highScore: number;
	lastHour: number;
}

export const STATS: Record<string, GameStats> = {
	tycoon: { mode: 'tycoon', users: 42, plays: 312, highScore: 1.2e15, lastHour: 8 },
	dome: { mode: 'dome', users: 15, plays: 89, highScore: 450, lastHour: 3 },
	dronewall: { mode: 'dronewall', users: 7, plays: 23, highScore: 120, lastHour: 1 }
};

export function getStats(mode: string): GameStats | undefined {
	return STATS[mode];
}

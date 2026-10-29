import { describe, expect, it } from 'vitest';
import { PREPARED_LEVEL_COUNT, levelIdAt } from '#lib/game/fury/levels/index.js';
import { PROGRESS_KEY as FURY_KEY } from '#lib/game/fury/progress.js';
import { PURR_SOLVED_KEY } from '#lib/game/purrpentagram/config.js';
import { LEVEL_IDS } from '#lib/game/venezuela/levels.js';
import { PROGRESS_KEY as VENEZUELA_KEY } from '#lib/game/venezuela/progress.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { readGameProgress } from './gameProgress.js';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function setup() {
	const store = createStore(memoryStorage());
	return { store, scores: createHighscores(store) };
}

describe('game progress for the avatar', () => {
	it('is empty for a player who has done nothing', () => {
		const { store, scores } = setup();
		expect(readGameProgress(store, scores)).toEqual({
			furyWon: 0,
			furyTotal: PREPARED_LEVEL_COUNT,
			venezuelaWon: 0,
			venezuelaTotal: LEVEL_IDS.length,
			purrSolved: false,
			petrobrasStreak: 0,
			blocksBest: 0
		});
	});

	it('counts the levels won in Magyar and El Presidente', () => {
		const { store, scores } = setup();
		const fury = Object.fromEntries(
			Array.from({ length: PREPARED_LEVEL_COUNT }, (_, index) => [levelIdAt(index), 2])
		);
		store.write(FURY_KEY, { version: 1, stars: fury });
		store.write(VENEZUELA_KEY, { version: 1, stars: { [LEVEL_IDS[0]]: 3, [LEVEL_IDS[1]]: 1 } });
		const progress = readGameProgress(store, scores);
		expect(progress.furyWon).toBe(PREPARED_LEVEL_COUNT);
		expect(progress.venezuelaWon).toBe(2);
	});

	it('reads the ritual, the streak and the score', () => {
		const { store, scores } = setup();
		store.write(PURR_SOLVED_KEY, true);
		scores.submit(['petrobras', 'streak'], 12);
		scores.submit(['blocks', 'score'], 9500);
		const progress = readGameProgress(store, scores);
		expect(progress.purrSolved).toBe(true);
		expect(progress.petrobrasStreak).toBe(12);
		expect(progress.blocksBest).toBe(9500);
	});

	it('ignores a damaged save', () => {
		const { store, scores } = setup();
		store.write(FURY_KEY, { version: 9 });
		store.write(PURR_SOLVED_KEY, 'yes');
		const progress = readGameProgress(store, scores);
		expect(progress.furyWon).toBe(0);
		expect(progress.purrSolved).toBe(false);
	});
});

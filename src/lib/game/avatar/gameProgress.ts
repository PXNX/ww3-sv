/*
 * What the avatar's extra looks ask of the games: Magyar's Birds and El Presidente finished level by
 * level, the Purr Pentagram solved, a streak in Petrobras and a score in Block Puzzle. Each game
 * keeps its own record in local storage (its level progress or its high scores); this reads them
 * without starting any game, as plain numbers for the unlock rules.
 */
import { PREPARED_LEVEL_COUNT, levelIdAt } from '#lib/game/fury/levels/index.js';
import { PROGRESS_KEY as FURY_PROGRESS_KEY, isFuryProgress } from '#lib/game/fury/progress.js';
import { PURR_SOLVED_KEY } from '#lib/game/purrpentagram/config.js';
import { LEVEL_IDS as VENEZUELA_LEVEL_IDS } from '#lib/game/venezuela/levels.js';
import {
	PROGRESS_KEY as VENEZUELA_PROGRESS_KEY,
	isVenezuelaProgress
} from '#lib/game/venezuela/progress.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';

/** The same keys the games submit their best scores under */
const BLOCKS_BEST_KEY = ['blocks', 'score'] as const;
const PETROBRAS_STREAK_KEY = ['petrobras', 'streak'] as const;

export interface GameProgress {
	/** Magyar's Birds: prepared levels won, and how many there are */
	furyWon: number;
	furyTotal: number;
	/** El Presidente: levels finished, and how many there are */
	venezuelaWon: number;
	venezuelaTotal: number;
	/** The Purr Pentagram ritual was completed once */
	purrSolved: boolean;
	/** Petrobras: the longest streak ever */
	petrobrasStreak: number;
	/** Block Puzzle: the best score ever */
	blocksBest: number;
}

export function readGameProgress(
	store: Store = localStore(),
	scores: Highscores = highscores()
): GameProgress {
	const furyRaw = store.read<unknown>(FURY_PROGRESS_KEY, null);
	const venezuelaRaw = store.read<unknown>(VENEZUELA_PROGRESS_KEY, null);
	const fury = isFuryProgress(furyRaw) ? furyRaw : null;
	const venezuela = isVenezuelaProgress(venezuelaRaw) ? venezuelaRaw : null;
	let furyWon = 0;
	for (let index = 0; index < PREPARED_LEVEL_COUNT; index += 1) {
		if ((fury?.stars[levelIdAt(index)] ?? 0) > 0) furyWon += 1;
	}
	return {
		furyWon,
		furyTotal: PREPARED_LEVEL_COUNT,
		venezuelaWon: VENEZUELA_LEVEL_IDS.filter((id) => (venezuela?.stars[id] ?? 0) > 0).length,
		venezuelaTotal: VENEZUELA_LEVEL_IDS.length,
		purrSolved: store.read<unknown>(PURR_SOLVED_KEY, false) === true,
		petrobrasStreak: scores.get(PETROBRAS_STREAK_KEY) ?? 0,
		blocksBest: scores.get(BLOCKS_BEST_KEY) ?? 0
	};
}

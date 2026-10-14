/*
 * Levels and the deck generator. The grid grows with the level; a deck is a seeded shuffle of
 * pairs and always contains the gold bar and the cheese wheel, so the special pair is on every
 * level.
 */
import { shuffle, type Random } from '../random.js';
import { SPECIAL_PAIR, SYMBOLS, type SymbolId } from './symbols.js';

export type CardState = 'down' | 'up' | 'matched';

export interface Card {
	/** Stable identity for the card, which stays with its slot when a phone call moves the symbols */
	id: number;
	symbol: SymbolId;
	state: CardState;
}

export interface LevelConfig {
	level: number;
	cols: number;
	rows: number;
	pairs: number;
}

/** Grids by level; the last one repeats from then on */
const GRIDS: readonly (readonly [cols: number, rows: number])[] = [
	[4, 3],
	[4, 4],
	[5, 4],
	[6, 4],
	[6, 5]
];

export function levelConfig(level: number): LevelConfig {
	const safe = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
	const [cols, rows] = GRIDS[Math.min(safe, GRIDS.length) - 1];
	return { level: safe, cols, rows, pairs: (cols * rows) / 2 };
}

/**
 * The designs for a deck: the special pair first, then as many different designs as the level
 * needs, picked at random. A big grid with more pairs than designs repeats designs.
 */
export function pickDesigns(pairs: number, random: Random): SymbolId[] {
	const designs: SymbolId[] = pairs >= 2 ? [...SPECIAL_PAIR] : [SPECIAL_PAIR[0]];
	const rest = SYMBOLS.filter((symbol) => !designs.includes(symbol));
	let pool = shuffle(random, rest);
	while (designs.length < pairs) {
		if (pool.length === 0) pool = shuffle(random, SYMBOLS);
		designs.push(pool.pop()!);
	}
	return designs;
}

/** A fresh, shuffled deck for a level: every design twice, all cards face down */
export function buildDeck(level: number, random: Random): Card[] {
	const { pairs } = levelConfig(level);
	const symbols = pickDesigns(pairs, random).flatMap((symbol) => [symbol, symbol]);
	return shuffle(random, symbols).map((symbol, id) => ({ id, symbol, state: 'down' as const }));
}

/*
 * The treasures on the cards: four kinds with three designs each. Two cards match when they show
 * the same design. The one special pair is a gold bar together with a cheese wheel: it matches
 * too, and pays a bonus. All designs are invented, with no real brands.
 */

export type TreasureKind = 'gold' | 'cheese' | 'watch' | 'chocolate';

export type SymbolId =
	| 'gold-bar'
	| 'gold-coin'
	| 'gold-nuggets'
	| 'cheese-wheel'
	| 'cheese-wedge'
	| 'cheese-block'
	| 'watch-pocket'
	| 'watch-wrist'
	| 'watch-alarm'
	| 'choc-bar'
	| 'choc-truffle'
	| 'choc-bonbon';

export const SYMBOL_KINDS: Record<SymbolId, TreasureKind> = {
	'gold-bar': 'gold',
	'gold-coin': 'gold',
	'gold-nuggets': 'gold',
	'cheese-wheel': 'cheese',
	'cheese-wedge': 'cheese',
	'cheese-block': 'cheese',
	'watch-pocket': 'watch',
	'watch-wrist': 'watch',
	'watch-alarm': 'watch',
	'choc-bar': 'chocolate',
	'choc-truffle': 'chocolate',
	'choc-bonbon': 'chocolate'
};

export const SYMBOLS = Object.keys(SYMBOL_KINDS) as SymbolId[];

/** The two designs that form the special pair; every deck contains both */
export const SPECIAL_PAIR: readonly [SymbolId, SymbolId] = ['gold-bar', 'cheese-wheel'];

export type MatchResult = 'pair' | 'special' | null;

/** Whether two cards match: the same design is a pair, a gold bar with a cheese wheel is special */
export function matchResult(a: SymbolId, b: SymbolId): MatchResult {
	if (a === b) return 'pair';
	const [gold, cheese] = SPECIAL_PAIR;
	return (a === gold && b === cheese) || (a === cheese && b === gold) ? 'special' : null;
}

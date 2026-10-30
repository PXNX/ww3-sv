/* The breach stage: Mastermind with the marks shown slot by slot, like Wordle */
import { randomInt, type Random } from '#lib/game/random.js';

export type Mark = 'hit' | 'near' | 'miss';

export function makeCode(random: Random, length: number, symbols: number): number[] {
	return Array.from({ length }, () => randomInt(random, 0, symbols));
}

/**
 * Marks every slot of a guess: hit for the right glyph in the right slot, near for a glyph that
 * is in the code elsewhere (each glyph of the code counts once), miss otherwise.
 */
export function scoreGuess(guess: readonly number[], code: readonly number[]): Mark[] {
	const marks: Mark[] = guess.map(() => 'miss');
	const remaining = new Map<number, number>();
	guess.forEach((symbol, i) => {
		if (symbol === code[i]) marks[i] = 'hit';
		else remaining.set(code[i], (remaining.get(code[i]) ?? 0) + 1);
	});
	guess.forEach((symbol, i) => {
		if (marks[i] === 'hit') return;
		const left = remaining.get(symbol) ?? 0;
		if (left > 0) {
			marks[i] = 'near';
			remaining.set(symbol, left - 1);
		}
	});
	return marks;
}

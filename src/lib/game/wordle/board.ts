/*
 * The guess grid as data, in typing order (the first typed letter first). The component lays each
 * row out with arrangeRow, which mirrors it in Persian and Arabic.
 */
import { evaluateGuess, type Mark } from './evaluate';
import { MAX_GUESSES, WORD_LENGTH } from './locales';

export interface BoardCell {
	letter: string;
	/** Null until the guess is submitted */
	mark: Mark | null;
}

export type BoardRowKind = 'submitted' | 'current' | 'empty';

export interface BoardRow {
	kind: BoardRowKind;
	cells: BoardCell[];
}

export function boardRows(options: {
	guesses: readonly string[];
	solution: string;
	/** The letters typed so far for the next guess */
	current: string;
	/** Whether a next guess can still be typed (false once the puzzle is over) */
	typing: boolean;
	maxGuesses?: number;
	length?: number;
}): BoardRow[] {
	const { guesses, solution, current, typing } = options;
	const maxGuesses = options.maxGuesses ?? MAX_GUESSES;
	const length = options.length ?? WORD_LENGTH;

	return Array.from({ length: maxGuesses }, (_, row): BoardRow => {
		if (row < guesses.length) {
			const marks = evaluateGuess(guesses[row], solution);
			return {
				kind: 'submitted',
				cells: [...guesses[row]].map((letter, index) => ({ letter, mark: marks[index] }))
			};
		}
		const typed = row === guesses.length && typing ? [...current] : [];
		return {
			kind: typed.length > 0 ? 'current' : 'empty',
			cells: Array.from({ length }, (_, index) => ({ letter: typed[index] ?? '', mark: null }))
		};
	});
}

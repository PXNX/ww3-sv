/*
 * The text shared after a puzzle: a header with the puzzle and the result, then one row of coloured
 * squares per guess. It never contains a letter of any guess, so it spoils nothing.
 */
import type { Mark } from './evaluate';
import { isRtlLocale, MAX_GUESSES, type WordleLocale } from './locales';

export const MARK_EMOJI: Record<Mark, string> = {
	correct: '\u{1F7E9}', // green square
	present: '\u{1F7E8}', // yellow square
	absent: '\u{2B1B}' // black square
};

// Right-to-left mark: starts every grid line in the right-to-left direction, because a line of
// emoji alone has no strong letter and would otherwise show left-to-right
const RLM = '\u{200F}';

export interface ShareInput {
	/** Localised game title, for example "Sanctions Wordle" */
	title: string;
	locale: WordleLocale;
	/** The daily puzzle number, or null for a practice round */
	number: number | null;
	/** The marks of every submitted guess, in order */
	rows: readonly (readonly Mark[])[];
	won: boolean;
	maxGuesses?: number;
	url?: string;
}

export function shareText(input: ShareInput): string {
	const max = input.maxGuesses ?? MAX_GUESSES;
	const rtl = isRtlLocale(input.locale);
	const result = `${input.won ? input.rows.length : 'X'}/${max}`;
	const heading = [
		input.title,
		input.locale.toUpperCase(),
		input.number === null ? null : `#${input.number}`,
		result
	]
		.filter((part) => part !== null)
		.join(' ');
	const grid = input.rows.map(
		(row) => (rtl ? RLM : '') + row.map((mark) => MARK_EMOJI[mark]).join('')
	);
	return [heading, '', ...grid, ...(input.url ? ['', input.url] : [])].join('\n');
}

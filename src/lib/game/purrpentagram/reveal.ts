/*
 * The slow reveal of the riddle, one letter at a time. Scripts whose letters join to their
 * neighbours (Persian and Arabic) would be torn apart by showing single letters, so they reveal
 * word by word instead. Pure, so the timing can be tested.
 */

/** Characters revealed per second when letters appear one by one */
export const LETTERS_PER_SECOND = 34;
/** Words revealed per second for scripts that join */
export const WORDS_PER_SECOND = 5;

/** Whether a locale writes in a joining script, which must be revealed by whole words */
export function revealsByWord(locale: string): boolean {
	return locale === 'fa' || locale === 'ar';
}

/** The pieces a text is revealed in: letters, or words together with the space after them */
export function revealUnits(text: string, byWord: boolean): string[] {
	if (byWord) return text.match(/\S+\s*/g) ?? [];
	return Array.from(text);
}

/** How many pieces are showing `elapsedMs` after the text started revealing */
export function shownUnits(elapsedMs: number, total: number, byWord: boolean): number {
	const perSecond = byWord ? WORDS_PER_SECOND : LETTERS_PER_SECOND;
	return Math.min(total, Math.max(0, Math.floor((elapsedMs / 1000) * perSecond)));
}

/** How long a text takes to reveal completely */
export function revealDurationMs(text: string, byWord: boolean): number {
	const perSecond = byWord ? WORDS_PER_SECOND : LETTERS_PER_SECOND;
	return Math.ceil((revealUnits(text, byWord).length / perSecond) * 1000);
}

export interface RevealedLine {
	/** The part that is showing */
	shown: string;
	/** The part still to come; it is drawn invisibly so the line keeps its final shape from the start */
	hidden: string;
}

/**
 * Splits each line into its visible and its still hidden part. The lines reveal one after the
 * other, each starting when the previous one has finished.
 */
export function revealLines(
	lines: readonly string[],
	elapsedMs: number,
	byWord: boolean
): RevealedLine[] {
	let remaining = elapsedMs;
	return lines.map((line) => {
		const units = revealUnits(line, byWord);
		const count = shownUnits(remaining, units.length, byWord);
		remaining -= revealDurationMs(line, byWord);
		return {
			shown: units.slice(0, count).join(''),
			hidden: units.slice(count).join('')
		};
	});
}

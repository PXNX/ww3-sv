/* Translated texts of Red Square: the parade columns that cross the square, and the air targets */
import type { AirKind } from '#lib/game/redsquare/state.js';
import { COLUMN_COUNT } from '#lib/game/redsquare/config.js';
import { m } from '#lib/paraglide/messages.js';

const COLUMNS: readonly (() => string)[] = [
	m.redsquare_column_0,
	m.redsquare_column_1,
	m.redsquare_column_2,
	m.redsquare_column_3,
	m.redsquare_column_4,
	m.redsquare_column_5,
	m.redsquare_column_6,
	m.redsquare_column_7
];

if (COLUMNS.length !== COLUMN_COUNT) {
	throw new Error('redsquareText.ts and COLUMN_COUNT disagree about the number of columns');
}

export function columnText(index: number): string {
	return (COLUMNS[index] ?? COLUMNS[0])();
}

/** What is overhead: a long-range drone or a flamingo bird */
export function airName(kind: AirKind): string {
	return kind === 'drone' ? m.redsquare_air_drone() : m.redsquare_air_flamingo();
}

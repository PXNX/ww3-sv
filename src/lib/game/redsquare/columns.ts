/*
 * The parade order. One column crosses the square at a time; the generator never repeats the same
 * column twice in a row, so the parade reads as a queue instead of one tank driving in circles.
 */
import { randomInt, type Random } from '../random.js';
import { COLUMN_COUNT } from './config.js';

export type Column = number;

/** Picks a column index, skipping the one that just passed the tribune */
export function nextColumn(random: Random, previous: Column | null): Column {
	if (COLUMN_COUNT <= 1) return 0;
	let column = randomInt(random, 0, COLUMN_COUNT);
	if (column === previous)
		column = (column + 1 + randomInt(random, 0, COLUMN_COUNT - 1)) % COLUMN_COUNT;
	return column;
}

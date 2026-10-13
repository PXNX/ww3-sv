/*
 * Test helper: builds a level from just the interesting bottom rows. The rows are aligned to the
 * bottom of the level, padded with empty sky above and to the right, and a start and a flag are
 * added in the top corners when the rows do not have them.
 */
import { LEVEL_ROWS, VIEW_W } from './config';
import { parseLevel, type LevelData } from './level';

export function levelFrom(bottomRows: string[], id = 'test'): LevelData {
	const width = Math.max(VIEW_W, ...bottomRows.map((row) => row.length));
	const padded = bottomRows.map((row) => row.padEnd(width, '.'));
	const rows = [
		...Array.from({ length: LEVEL_ROWS - padded.length }, () => '.'.repeat(width)),
		...padded
	];
	const text = rows.join('');
	if (!text.includes('P')) rows[0] = `P${rows[0].slice(1)}`;
	if (!text.includes('G')) rows[0] = `${rows[0].slice(0, -1)}G`;
	return parseLevel({ id, rows });
}

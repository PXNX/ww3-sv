import { describe, expect, it } from 'vitest';
import { shareText, MARK_EMOJI } from './share';
import { evaluateGuess, type Mark } from './evaluate';

const rows: Mark[][] = [
	['absent', 'present', 'absent', 'absent', 'correct'],
	['correct', 'correct', 'present', 'absent', 'correct'],
	['correct', 'correct', 'correct', 'correct', 'correct']
];

describe('shareText', () => {
	it('builds a heading and one row of squares per guess', () => {
		const text = shareText({
			title: 'Sanctions Wordle',
			locale: 'en',
			number: 288,
			rows,
			won: true,
			url: 'https://example.test'
		});
		const lines = text.split('\n');
		expect(lines[0]).toBe('Sanctions Wordle EN #288 3/6');
		expect(lines[1]).toBe('');
		expect(lines.slice(2, 5)).toEqual([
			`${MARK_EMOJI.absent}${MARK_EMOJI.present}${MARK_EMOJI.absent}${MARK_EMOJI.absent}${MARK_EMOJI.correct}`,
			`${MARK_EMOJI.correct}${MARK_EMOJI.correct}${MARK_EMOJI.present}${MARK_EMOJI.absent}${MARK_EMOJI.correct}`,
			MARK_EMOJI.correct.repeat(5)
		]);
		expect(lines.slice(5)).toEqual(['', 'https://example.test']);
	});

	it('shows X/6 for a lost puzzle', () => {
		const lost = Array.from({ length: 6 }, () => rows[0]);
		const text = shareText({ title: 'T', locale: 'de', number: 3, rows: lost, won: false });
		expect(text.split('\n')[0]).toBe('T DE #3 X/6');
		expect(text.split('\n')).toHaveLength(2 + 6);
	});

	it('leaves out the number for a practice round and the link when there is none', () => {
		const text = shareText({ title: 'T', locale: 'en', number: null, rows: [rows[2]], won: true });
		expect(text.split('\n')[0]).toBe('T EN 1/6');
		expect(text).not.toContain('http');
	});

	it('contains no letter of any guess, so it spoils nothing', () => {
		const guess = 'CRUDE';
		const solution = 'QUOTA';
		const marks = evaluateGuess(guess, solution);
		const text = shareText({
			title: '',
			locale: 'en',
			number: null,
			rows: [marks, evaluateGuess(solution, solution)],
			won: true
		});
		const grid = text.split('\n').slice(2).join('\n');
		for (const letter of [...guess, ...solution]) expect(grid).not.toContain(letter);
		expect(grid.replace(/\n/g, '')).toMatch(/^[\u{1F7E9}\u{1F7E8}\u{2B1B}]+$/u);
	});

	it('starts every grid row with a right-to-left mark in Persian and Arabic', () => {
		for (const locale of ['fa', 'ar'] as const) {
			const text = shareText({ title: 'T', locale, number: 1, rows, won: true });
			const grid = text.split('\n').slice(2);
			expect(grid).toHaveLength(3);
			for (const row of grid) expect(row.startsWith('\u{200F}')).toBe(true);
		}
		const english = shareText({ title: 'T', locale: 'en', number: 1, rows, won: true });
		expect(english).not.toContain('\u{200F}');
	});

	it('keeps typing order in the grid (the first letter first), also in right-to-left text', () => {
		const text = shareText({ title: 'T', locale: 'ar', number: 1, rows: [rows[0]], won: true });
		const row = text.split('\n')[2].replace('\u{200F}', '');
		expect([...row][0]).toBe(MARK_EMOJI.absent);
		expect([...row][4]).toBe(MARK_EMOJI.correct);
	});
});

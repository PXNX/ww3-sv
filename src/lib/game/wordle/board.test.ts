import { describe, expect, it } from 'vitest';
import { boardRows } from './board';

describe('boardRows', () => {
	it('is six empty rows of five cells at the start', () => {
		const rows = boardRows({ guesses: [], solution: 'QUOTA', current: '', typing: true });
		expect(rows).toHaveLength(6);
		for (const row of rows) {
			expect(row.kind).toBe('empty');
			expect(row.cells).toHaveLength(5);
			expect(row.cells.every((cell) => cell.letter === '' && cell.mark === null)).toBe(true);
		}
	});

	it('puts the submitted guesses first, with their marks, then the row being typed', () => {
		const rows = boardRows({
			guesses: ['CRUDE', 'QUOTA'],
			solution: 'QUOTA',
			current: 'TR',
			typing: true
		});
		expect(rows[0].kind).toBe('submitted');
		expect(rows[0].cells.map((cell) => cell.letter).join('')).toBe('CRUDE');
		expect(rows[0].cells.map((cell) => cell.mark)).toEqual([
			'absent',
			'absent',
			'present',
			'absent',
			'absent'
		]);
		expect(rows[1].cells.every((cell) => cell.mark === 'correct')).toBe(true);
		expect(rows[2].kind).toBe('current');
		expect(rows[2].cells.map((cell) => cell.letter)).toEqual(['T', 'R', '', '', '']);
		expect(rows[2].cells.every((cell) => cell.mark === null)).toBe(true);
		expect(rows[3].kind).toBe('empty');
	});

	it('shows no typed row once the puzzle is over', () => {
		const rows = boardRows({
			guesses: ['QUOTA'],
			solution: 'QUOTA',
			current: 'AB',
			typing: false
		});
		expect(rows[1].kind).toBe('empty');
		expect(rows[1].cells.every((cell) => cell.letter === '')).toBe(true);
	});

	it('shows all six guesses on a lost board and no current row', () => {
		const guesses = ['CRUDE', 'TRADE', 'SHELL', 'AUDIT', 'BONDS', 'FUNDS'];
		const rows = boardRows({ guesses, solution: 'QUOTA', current: '', typing: false });
		expect(rows.every((row) => row.kind === 'submitted')).toBe(true);
	});

	it('keeps the cells in typing order, whatever the language', () => {
		const word = '\u{0645}\u{062F}\u{0631}\u{0633}\u{0647}';
		const rows = boardRows({ guesses: [word], solution: word, current: '', typing: false });
		expect(rows[0].cells.map((cell) => cell.letter)).toEqual([...word]);
	});
});

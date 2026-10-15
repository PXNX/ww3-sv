import { describe, expect, it } from 'vitest';
import { betterKeyState, evaluateGuess, isSolved, keyStates } from './evaluate';

describe('evaluateGuess', () => {
	it('marks a perfect guess as all correct', () => {
		expect(evaluateGuess('QUOTA', 'QUOTA')).toEqual([
			'correct',
			'correct',
			'correct',
			'correct',
			'correct'
		]);
	});

	it('marks letters that are not in the word as absent', () => {
		expect(evaluateGuess('FUZZY', 'QUOTA')).toEqual([
			'absent',
			'correct',
			'absent',
			'absent',
			'absent'
		]);
	});

	it('marks letters in the wrong place as present', () => {
		expect(evaluateGuess('TOQAU', 'QUOTA')).toEqual([
			'present',
			'present',
			'present',
			'present',
			'present'
		]);
	});

	it('marks a repeated letter present only as often as the solution has it', () => {
		// CRANE has one E, and the last E of EERIE sits in the right place
		expect(evaluateGuess('EERIE', 'CRANE')).toEqual([
			'absent',
			'absent',
			'present',
			'absent',
			'correct'
		]);
	});

	it('gives the right place priority over an earlier wrong place', () => {
		// ABBEY has two B: the guess B in position 3 is correct, and the B in position 1 takes the other
		expect(evaluateGuess('BABES', 'ABBEY')).toEqual([
			'present',
			'present',
			'correct',
			'correct',
			'absent'
		]);
	});

	it('does not mark a third copy when the solution has two', () => {
		// SPEED has two E and the guess has three; none is in the right place
		expect(evaluateGuess('ERASE', 'SPEED')).toEqual([
			'present',
			'absent',
			'absent',
			'present',
			'present'
		]);
		// EERIE against SPEED: the first two E take the two copies, the last E gets nothing
		expect(evaluateGuess('EERIE', 'SPEED')).toEqual([
			'present',
			'present',
			'absent',
			'absent',
			'absent'
		]);
	});

	it('marks only the unmatched copy of a letter that is partly correct', () => {
		// ALLOY has two L; the guess LLAMA has two L, one in the right place
		expect(evaluateGuess('LLAMA', 'ALLOY')).toEqual([
			'present',
			'correct',
			'present',
			'absent',
			'absent'
		]);
	});

	it('does not give a second mark to a letter that the solution has once', () => {
		expect(evaluateGuess('GEESE', 'GRAIN')).toEqual([
			'correct',
			'absent',
			'absent',
			'absent',
			'absent'
		]);
		expect(evaluateGuess('AAAAA', 'QUOTA')).toEqual([
			'absent',
			'absent',
			'absent',
			'absent',
			'correct'
		]);
	});

	it('works for Cyrillic and Arabic-script letters, one mark per letter', () => {
		expect(evaluateGuess('РУБЛЬ', 'РЫНОК')).toEqual([
			'correct',
			'absent',
			'absent',
			'absent',
			'absent'
		]);
		const word = '\u{0645}\u{062F}\u{0631}\u{0633}\u{0647}';
		expect(isSolved(evaluateGuess(word, word))).toBe(true);
	});

	it('never changes the length', () => {
		expect(evaluateGuess('ABCDE', 'EDCBA')).toHaveLength(5);
	});
});

describe('isSolved', () => {
	it('is true only for five correct marks', () => {
		expect(isSolved(['correct', 'correct', 'correct', 'correct', 'correct'])).toBe(true);
		expect(isSolved(['correct', 'correct', 'present', 'correct', 'correct'])).toBe(false);
		expect(isSolved([])).toBe(false);
	});
});

describe('keyStates', () => {
	it('keeps the best mark each letter has had', () => {
		// First guess: R is in the word but in the wrong place; second guess: R is in the right place
		const states = keyStates(['SPRAY', 'GRAIN'], 'GRAIN');
		expect(states.get('G')).toBe('correct');
		expect(states.get('R')).toBe('correct');
		expect(states.get('S')).toBe('absent');
		expect(states.get('P')).toBe('absent');
		expect(states.get('Y')).toBe('absent');
		expect(states.has('Z')).toBe(false);
	});

	it('never downgrades a correct key to present or absent', () => {
		// LEVER: the E of EXERT is only present, the E in position 4 of SHEER is correct
		expect(keyStates(['EXERT', 'SHEER'], 'LEVER').get('E')).toBe('correct');
		expect(keyStates(['SHEER', 'EXERT'], 'LEVER').get('E')).toBe('correct');
	});

	it('orders the states', () => {
		expect(betterKeyState('absent', 'present')).toBe('present');
		expect(betterKeyState('present', 'correct')).toBe('correct');
		expect(betterKeyState('correct', 'absent')).toBe('correct');
		expect(betterKeyState('unused', 'absent')).toBe('absent');
		expect(betterKeyState('absent', 'unused')).toBe('absent');
	});
});

/*
 * Guess evaluation. Two passes, so repeated letters are counted correctly: first the letters in
 * the right place are marked, then every other letter of the guess is marked "present" only while
 * the solution still has an unmatched copy of it. A guess with two E that meets a solution with
 * one E marks at most one of them.
 */

export type Mark = 'correct' | 'present' | 'absent';

/** What a keyboard key shows: the best mark of its letter over all guesses so far */
export type KeyState = Mark | 'unused';

export function evaluateGuess(guess: string, solution: string): Mark[] {
	const guessLetters = [...guess];
	const solutionLetters = [...solution];
	const marks: Mark[] = guessLetters.map(() => 'absent');
	const unmatched = new Map<string, number>();

	for (let i = 0; i < guessLetters.length; i++) {
		if (guessLetters[i] === solutionLetters[i]) {
			marks[i] = 'correct';
		} else if (solutionLetters[i] !== undefined) {
			unmatched.set(solutionLetters[i], (unmatched.get(solutionLetters[i]) ?? 0) + 1);
		}
	}

	for (let i = 0; i < guessLetters.length; i++) {
		if (marks[i] === 'correct') continue;
		const left = unmatched.get(guessLetters[i]) ?? 0;
		if (left > 0) {
			marks[i] = 'present';
			unmatched.set(guessLetters[i], left - 1);
		}
	}
	return marks;
}

export function isSolved(marks: readonly Mark[]): boolean {
	return marks.length > 0 && marks.every((mark) => mark === 'correct');
}

const RANK: Record<KeyState, number> = { unused: 0, absent: 1, present: 2, correct: 3 };

/** The better of two key states: correct beats present beats absent beats unused */
export function betterKeyState(a: KeyState, b: KeyState): KeyState {
	return RANK[a] >= RANK[b] ? a : b;
}

/** The state of every letter that appeared in a guess; letters never guessed are left out */
export function keyStates(guesses: readonly string[], solution: string): Map<string, KeyState> {
	const states = new Map<string, KeyState>();
	for (const guess of guesses) {
		const marks = evaluateGuess(guess, solution);
		[...guess].forEach((letter, index) => {
			states.set(letter, betterKeyState(states.get(letter) ?? 'unused', marks[index]));
		});
	}
	return states;
}

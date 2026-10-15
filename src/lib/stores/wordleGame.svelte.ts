/*
 * Sanctions Wordle game state: the daily puzzle (one word per day and language, kept in local
 * storage with its stats) and an unlimited practice mode. The rules live in $lib/game/wordle; this
 * store ties them to the typed letters, the saved day, the notices and the sounds. There are no
 * lives: a puzzle ends after six guesses or when the word is found.
 */
import { createRandom, dayKey, randomSeed, type Random } from '#lib/game/random.js';
import { boardRows, type BoardRow } from '#lib/game/wordle/board.js';
import {
	dailySolution,
	msUntilNextDay,
	practiceSolution,
	puzzleNumber
} from '#lib/game/wordle/daily.js';
import {
	evaluateGuess,
	isSolved,
	keyStates,
	type KeyState,
	type Mark
} from '#lib/game/wordle/evaluate.js';
import { MAX_GUESSES, WORD_LENGTH, type WordleLocale } from '#lib/game/wordle/locales.js';
import { shareText } from '#lib/game/wordle/share.js';
import {
	EMPTY_STATS,
	currentStreak,
	isWordleSave,
	recordResult,
	saveKey,
	winPercent,
	type DailyStatus,
	type WordleSave,
	type WordleStats
} from '#lib/game/wordle/stats.js';
import { isAllowedGuess, wordLists } from '#lib/game/wordle/words/index.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export type WordleMode = 'daily' | 'practice';
export type WordleStatus = DailyStatus;
export type WordleNoticeKind = 'short' | 'unknown' | 'newDay';

export interface WordleNotice {
	id: number;
	kind: WordleNoticeKind;
}

export interface WordleGameOptions {
	locale: WordleLocale;
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
	/** Injected for tests; the current time */
	now?: () => Date;
	/** Injected for tests; the random source for practice words */
	random?: () => Random;
}

export class WordleGame {
	readonly locale: WordleLocale;

	mode = $state<WordleMode>('daily');
	/** The local day of the daily puzzle */
	day = $state('');
	solution = $state('');
	guesses = $state.raw<string[]>([]);
	/** The letters typed for the next guess */
	current = $state('');
	status = $state<WordleStatus>('playing');
	stats = $state.raw<WordleStats>(EMPTY_STATS);
	notice = $state<WordleNotice | null>(null);
	/** Counts up on every rejected guess, so the shaking row can restart its animation */
	shakes = $state(0);
	/** The row that was typed into when the last guess was rejected */
	shakeRow = $state(-1);
	/** The row that was just revealed by a guess, or -1 when the board was only loaded */
	revealRow = $state(-1);
	/** Counts up each time a puzzle ends during play (not when a finished one is loaded) */
	finishes = $state(0);
	msLeft = $state(0);

	#store: () => Store;
	#now: () => Date;
	#random: () => Random;
	#noticeId = 0;
	#practiceRandom: Random | null = null;

	constructor(options: WordleGameOptions) {
		this.locale = options.locale;
		this.#store = options.store ?? localStore;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a clock reading, never reactive state
		this.#now = options.now ?? (() => new Date());
		this.#random = options.random ?? (() => createRandom(randomSeed()));
		this.#startDaily();
		this.msLeft = msUntilNextDay(this.#now());
	}

	get solutions(): readonly string[] {
		return wordLists(this.locale).solutions;
	}

	get typing(): boolean {
		return this.status === 'playing';
	}

	get finished(): boolean {
		return this.status !== 'playing';
	}

	get won(): boolean {
		return this.status === 'won';
	}

	get rows(): BoardRow[] {
		return boardRows({
			guesses: this.guesses,
			solution: this.solution,
			current: this.current,
			typing: this.typing
		});
	}

	get keys(): Map<string, KeyState> {
		return keyStates(this.guesses, this.solution);
	}

	/** The marks of every submitted guess */
	get marks(): Mark[][] {
		return this.guesses.map((guess) => evaluateGuess(guess, this.solution));
	}

	get streak(): number {
		return currentStreak(this.stats, dayKey(this.#now()));
	}

	get winPercent(): number {
		return winPercent(this.stats);
	}

	get puzzleNumber(): number {
		return puzzleNumber(this.#now());
	}

	/** Reads the saved day and stats (call in the browser) */
	load() {
		this.mode = 'daily';
		this.#startDaily();
		this.msLeft = msUntilNextDay(this.#now());
	}

	/** Goes back to the daily puzzle from practice */
	showDaily() {
		if (this.mode === 'daily') return;
		this.load();
	}

	/** Starts an unlimited practice round with a random word; it does not touch the stats */
	startPractice() {
		const previous = this.mode === 'practice' ? this.solution : undefined;
		this.#practiceRandom ??= this.#random();
		this.mode = 'practice';
		this.solution = practiceSolution(this.solutions, this.#practiceRandom, previous);
		this.guesses = [];
		this.current = '';
		this.status = 'playing';
		this.revealRow = -1;
		this.shakeRow = -1;
		this.notice = null;
	}

	/** Adds the letters of a key to the guess (an umlaut can be two letters) */
	type(letters: readonly string[]) {
		if (!this.typing) return;
		let added = false;
		for (const letter of letters) {
			if ([...this.current].length >= WORD_LENGTH) break;
			this.current += letter;
			added = true;
		}
		if (added) soundManager().play('click');
	}

	backspace() {
		if (!this.typing || this.current.length === 0) return;
		this.current = [...this.current].slice(0, -1).join('');
		soundManager().play('click');
	}

	/** Submits the typed word; returns whether it was accepted */
	submit(): boolean {
		if (!this.typing) return false;
		if ([...this.current].length < WORD_LENGTH) return this.#reject('short');
		if (!isAllowedGuess(this.locale, this.current)) return this.#reject('unknown');

		this.guesses = [...this.guesses, this.current];
		this.revealRow = this.guesses.length - 1;
		const solved = isSolved(evaluateGuess(this.current, this.solution));
		this.current = '';
		this.notice = null;

		if (solved || this.guesses.length >= MAX_GUESSES) {
			this.status = solved ? 'won' : 'lost';
			if (this.mode === 'daily') {
				this.stats = recordResult(this.stats, this.day, solved, this.guesses.length);
			}
			this.finishes += 1;
			soundManager().play(
				solved ? (this.guesses.length <= 3 ? 'chime-big' : 'chime') : 'game-over'
			);
		}
		this.#save();
		return true;
	}

	/** Updates the countdown and moves to the new puzzle once the local day has changed */
	tick() {
		const now = this.#now();
		this.msLeft = msUntilNextDay(now);
		if (this.mode === 'daily' && dayKey(now) !== this.day) {
			this.#startDaily();
			this.#notify('newDay');
		}
	}

	/** The share text of the finished puzzle: squares only, never the letters */
	share(title: string, url?: string): string {
		return shareText({
			title,
			locale: this.locale,
			number: this.mode === 'daily' ? puzzleNumber(this.#now()) : null,
			rows: this.marks,
			won: this.won,
			url
		});
	}

	/** Sets up today's puzzle, from the saved one when it belongs to today */
	#startDaily() {
		const store = this.#store();
		const today = dayKey(this.#now());
		const saved = store.read<WordleSave | null>(saveKey(this.locale), null, isWordleSave);
		this.stats = saved?.stats ?? EMPTY_STATS;
		this.day = today;
		this.current = '';
		this.notice = null;
		this.revealRow = -1;
		this.shakeRow = -1;
		if (saved && saved.day === today) {
			this.solution = saved.solution;
			this.guesses = saved.guesses;
			this.status = saved.status;
		} else {
			this.solution = dailySolution(this.locale, this.solutions, this.#now());
			this.guesses = [];
			this.status = 'playing';
			this.#save();
		}
	}

	#save() {
		if (this.mode !== 'daily') return;
		const save: WordleSave = {
			version: 1,
			day: this.day,
			solution: this.solution,
			guesses: this.guesses,
			status: this.status,
			stats: this.stats
		};
		this.#store().write(saveKey(this.locale), save);
	}

	#reject(kind: WordleNoticeKind): false {
		this.shakes += 1;
		this.shakeRow = this.guesses.length;
		this.#notify(kind);
		soundManager().play('ui-error');
		return false;
	}

	#notify(kind: WordleNoticeKind) {
		this.#noticeId += 1;
		this.notice = { id: this.#noticeId, kind };
	}
}

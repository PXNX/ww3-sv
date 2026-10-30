/*
 * Hermit Hackers: retro terminal hacking with Mastermind and Lights Out.
 */
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import { createHackers, checkCrack, toggleBreaker, allBreakersDark, installMalware, finishWallet, stepHack, type HackersState, type InstallType } from '#lib/game/hackers/state.js';
import { createRandom, randomSeed } from '#lib/game/random.js';

export const HACKERS_BEST_KEY = ['hackers', 'score'] as const;

export type HackersUIState = 'playing' | 'over';

export class HackersGame {
	state = $state<HackersState>(createHackers(createRandom(randomSeed())));
	uiState = $state<HackersUIState>('playing');
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	over = $state(false);
	guess = $state([1,1,1,1]);
	traceDisplay = $state(0);
	
	#scores: Highscores;
	#random = createRandom(randomSeed());
	#timer?: ReturnType<typeof setInterval>;

	constructor({ scores = highscores() }: { scores?: Highscores } = {}) {
		this.#scores = scores;
		this.best = this.#scores.get(HACKERS_BEST_KEY);
		this.start();
	}

	start() {
		if (this.#timer) clearInterval(this.#timer);
		this.#random = createRandom(randomSeed());
		this.state = createHackers(this.#random);
		this.uiState = 'playing';
		this.score = 0;
		this.over = false;
		this.isNewBest = false;
		this.guess = [1,1,1,1];
		this.traceDisplay = 0;
		this.#timer = setInterval(() => this.#update(), 100);
	}

	#update() {
		if (this.uiState !== 'playing') return;
		stepHack(this.state, 100);
		this.traceDisplay = this.state.trace;
		if (this.state.over) {
			this.#endGame();
		}
	}

	submitGuess() {
		if (this.uiState !== 'playing') return;
		const sys = this.state.systems[this.state.selectedIndex];
		if (!sys || sys.hacked) return;
		const exact = checkCrack(this.guess, sys.code);
		if (exact === 4) {
			sys.hacked = true;
			finishWallet(this.state);
			soundManager().play('sparkle');
			haptic().play(0.3);
			this.score += 500;
		} else {
			this.state.trace += 5;
			soundManager().play('click');
			haptic().play(0.15);
		}
	}

	selectSystem(idx: number) {
		if (this.uiState !== 'playing') return;
		this.state.selectedIndex = idx;
		this.guess = [1,1,1,1];
	}

	toggleBreaker(idx: number) {
		if (this.uiState !== 'playing') return;
		toggleBreaker(this.state, idx);
		soundManager().play('click');
		if (allBreakersDark(this.state)) {
			soundManager().play('sparkle');
		}
	}

	install(type: InstallType) {
		if (this.uiState !== 'playing') return;
		const sys = this.state.systems[this.state.selectedIndex];
		if (!sys || !sys.hacked) return;
		installMalware(this.state, type);
		soundManager().play('click');
		haptic().play(0.2);
		this.score += 100;
	}

	#endGame() {
		if (this.#timer) clearInterval(this.#timer);
		this.over = true;
		this.uiState = 'over';
		if (this.state.won) this.score += 1000;
		const result = this.#scores.submit(HACKERS_BEST_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		soundManager().play(this.state.won ? 'sparkle' : 'fake-news');
	}
}

/*
 * Gig Saboteur: top-down stealth on a timer.
 */
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import { createSabotage, stepSabotage, LEVELS, TIME_PER, type SabotageState } from '#lib/game/sabotage/state.js';

export const SABOTAGE_BEST_KEY = ['sabotage', 'score'] as const;

export type SabState = 'playing' | 'over';

export class SabotageGame {
	state = $state<SabotageState>(createSabotage());
	sbState = $state<SabState>('playing');
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	over = $state(false);
	timeLeft = $state(TIME_PER);
	playerX = $state(50);
	playerY = $state(80);
	
	#scores: Highscores;
	#timer?: ReturnType<typeof setInterval>;

	constructor({ scores = highscores() }: { scores?: Highscores } = {}) {
		this.#scores = scores;
		this.best = this.#scores.get(SABOTAGE_BEST_KEY);
		this.start();
	}

	start() {
		if (this.#timer) clearInterval(this.#timer);
		this.state = createSabotage();
		this.sbState = 'playing';
		this.score = 0;
		this.over = false;
		this.isNewBest = false;
		this.timeLeft = TIME_PER;
		this.playerX = 50;
		this.playerY = 80;
		this.#timer = setInterval(() => this.#update(), 100);
	}

	#update() {
		if (this.sbState !== 'playing') return;
		stepSabotage(this.state, 0.1);
		this.timeLeft = Math.max(0, this.state.timer);
		if (this.state.over) {
			this.#endGame();
		}
	}

	move(dx: number, dy: number) {
		if (this.sbState !== 'playing') return;
		this.playerX = Math.max(5, Math.min(95, this.playerX + dx));
		this.playerY = Math.max(5, Math.min(95, this.playerY + dy));
		soundManager().play('click');
	}

	sabotage() {
		if (this.sbState !== 'playing') return;
		this.state.missions++;
		this.score += 200;
		soundManager().play('sparkle');
		haptic().play(0.3);
		if (this.state.missions >= 3) {
			this.state.level = Math.min(LEVELS, this.state.level + 1);
			this.state.missions = 0;
			if (this.state.level >= LEVELS) {
				this.#endGame();
			}
		}
	}

	#endGame() {
		if (this.#timer) clearInterval(this.#timer);
		this.over = true;
		this.sbState = 'over';
		if (this.state.level >= LEVELS) this.score += 1000;
		const result = this.#scores.submit(SABOTAGE_BEST_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		soundManager().play(this.state.level >= LEVELS ? 'sparkle' : 'fake-news');
	}
}

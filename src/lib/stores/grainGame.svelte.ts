/*
 * Grain Corridor: Black Sea runner - steer grain ships through mine lanes to port.
 */
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const GRAIN_BEST_KEY = ['grain', 'score'] as const;

export type GrainState = 'playing' | 'over';

export interface Mine {
	x: number;
	y: number;
	speed: number;
}

export class GrainGame {
	state = $state<GrainState>('playing');
	shipX = $state(50);
	lane = $state(1); // 0,1,2
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	over = $state(false);
	distance = $state(0);
	mines = $state<Mine[]>([]);
	hearts = $state(3);
	
	#scores: Highscores;
	#timer?: ReturnType<typeof setInterval>;
	#mineId = 0;

	constructor({ scores = highscores() }: { scores?: Highscores } = {}) {
		this.#scores = scores;
		this.best = this.#scores.get(GRAIN_BEST_KEY);
		this.start();
	}

	start() {
		if (this.#timer) clearInterval(this.#timer);
		this.over = false;
		this.state = 'playing';
		this.shipX = 50;
		this.lane = 1;
		this.score = 0;
		this.distance = 0;
		this.mines = [];
		this.hearts = 3;
		this.isNewBest = false;
		this.#timer = setInterval(() => this.#update(), 50);
	}

	#update() {
		if (this.state !== 'playing') return;
		this.distance += 2;
		this.score += 1;
		// Spawn mines
		if (Math.random() < 0.15) {
			const lane = Math.floor(Math.random() * 3);
			this.mines.push({ x: 20 + lane * 30, y: -10, speed: 3 + Math.random() * 2 });
		}
		// Move mines
		for (const m of this.mines) {
			m.y += m.speed;
		}
		// Check collisions
		for (const m of this.mines) {
			if (Math.abs(m.x - (20 + this.lane * 30)) < 8 && m.y > 60 && m.y < 90) {
				this.#hit();
				m.y = 200; // remove
			}
		}
		this.mines = this.mines.filter(m => m.y < 110);
		if (this.distance > 2000) this.#endGame(true);
	}

	move(dir: number) {
		if (this.state !== 'playing') return;
		this.lane = Math.max(0, Math.min(2, this.lane + dir));
		soundManager().play('click');
	}

	#hit() {
		this.hearts--;
		soundManager().play('hit');
		haptic().play(0.3);
		if (this.hearts <= 0) this.#endGame(false);
	}

	#endGame(won: boolean) {
		if (this.#timer) clearInterval(this.#timer);
		this.over = true;
		this.state = 'over';
		if (won) this.score += 1000;
		const result = this.#scores.submit(GRAIN_BEST_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		soundManager().play(won ? 'sparkle' : 'fake-news');
	}
}

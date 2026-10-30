/*
 * Iceberg Curling: sweep stone against "For Sale" sign.
 */
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import { createCurl, stepCurl, ENDS_TOTAL, type CurlState } from '#lib/game/curling/state.js';
import { createRandom, randomSeed } from '#lib/game/random.js';

export const CURLING_BEST_KEY = ['curling', 'score'] as const;

export type CurlingState = 'aiming' | 'sliding' | 'between' | 'over';

export class CurlingGame {
	state = $state<CurlState>(createCurl(createRandom(randomSeed())));
	cState = $state<CurlingState>('aiming');
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	over = $state(false);
	power = $state(50);
	angle = $state(-45);
	sweeping = $state(false);
	
	#scores: Highscores;
	#random = createRandom(randomSeed());
	#timer?: ReturnType<typeof setInterval>;

	constructor({ scores = highscores() }: { scores?: Highscores } = {}) {
		this.#scores = scores;
		this.best = this.#scores.get(CURLING_BEST_KEY);
		this.start();
	}

	start() {
		if (this.#timer) clearInterval(this.#timer);
		this.#random = createRandom(randomSeed());
		this.state = createCurl(this.#random);
		this.cState = 'aiming';
		this.score = 0;
		this.over = false;
		this.isNewBest = false;
		this.power = 50;
		this.angle = -45;
		this.sweeping = false;
		this.#timer = setInterval(() => this.#update(), 50);
	}

	throwStone() {
		if (this.cState !== 'aiming') return;
		this.cState = 'sliding';
		const rad = (this.angle * Math.PI) / 180;
		this.state.stone.vx = Math.cos(rad) * (this.power / 1000);
		this.state.stone.vy = Math.sin(rad) * (this.power / 1000);
		soundManager().play('click');
		haptic().play(0.2);
	}

	sweep(on: boolean) {
		if (this.cState !== 'sliding') return;
		this.sweeping = on;
		if (on && this.state.sweeps > 0) {
			this.state.sweeps--;
			this.state.stone.vx *= 1.02;
			this.state.stone.vy *= 1.02;
			soundManager().play('click');
		}
	}

	#update() {
		if (this.cState !== 'sliding') return;
		stepCurl(this.state, 0.5, this.#random);
		this.score = this.state.score;
		if (Math.abs(this.state.stone.vx) < 0.0001 && Math.abs(this.state.stone.vy) < 0.0001) {
			if (this.state.over) {
				this.#endGame();
			} else {
				this.cState = 'aiming';
				this.power = 40 + Math.random() * 30;
				this.angle = -50 + Math.random() * 10;
			}
		}
	}

	#endGame() {
		if (this.#timer) clearInterval(this.#timer);
		this.over = true;
		this.cState = 'over';
		const result = this.#scores.submit(CURLING_BEST_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		soundManager().play('sparkle');
	}
}

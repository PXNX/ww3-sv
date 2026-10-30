/*
 * Starlink Kill Switch: cut satellite links before drones reach refinery.
 */
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import { createKillState, stepKill, type KillState, type Drone, type Link } from '#lib/game/killswitch/state.js';
import { createRandom, randomSeed } from '#lib/game/random.js';

export const KILLSWITCH_BEST_KEY = ['killswitch', 'score'] as const;

export type KSState = 'playing' | 'over';

export class KillswitchGame {
	state = $state<KillState>(createKillState(createRandom(randomSeed())));
	ksState = $state<KSState>('playing');
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	over = $state(false);
	timeLeft = $state(30);
	
	#scores: Highscores;
	#random = createRandom(randomSeed());
	#timer?: ReturnType<typeof setInterval>;
	#lastTime = 0;

	constructor({ scores = highscores() }: { scores?: Highscores } = {}) {
		this.#scores = scores;
		this.best = this.#scores.get(KILLSWITCH_BEST_KEY);
		this.start();
	}

	start() {
		if (this.#timer) clearInterval(this.#timer);
		this.#random = createRandom(randomSeed());
		this.state = createKillState(this.#random);
		this.ksState = 'playing';
		this.score = 0;
		this.over = false;
		this.isNewBest = false;
		this.timeLeft = 30;
		this.#lastTime = Date.now();
		this.#timer = setInterval(() => this.#update(), 50);
	}

	#update() {
		if (this.ksState !== 'playing') return;
		const now = Date.now();
		const dt = Math.min((now - this.#lastTime) / 1000, 0.1);
		this.#lastTime = now;
		stepKill(this.state, dt * 60, this.#random);
		this.score = this.state.score;
		this.timeLeft = Math.max(0, 30 - this.state.time);
		if (this.state.over) {
			this.#endGame();
		}
	}

	cutLink(droneIdx: number, linkId: number) {
		if (this.ksState !== 'playing') return;
		const drone = this.state.drones[droneIdx];
		if (!drone) return;
		const link = drone.links.find(l => l.id === linkId);
		if (link && !link.cut) {
			link.cut = true;
			this.state.score += 25;
			soundManager().play('click');
			haptic().play(0.15);
		}
	}

	#endGame() {
		if (this.#timer) clearInterval(this.#timer);
		this.over = true;
		this.ksState = 'over';
		if (this.state.won) this.state.score += 500;
		const result = this.#scores.submit(KILLSWITCH_BEST_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		soundManager().play(this.state.won ? 'sparkle' : 'fake-news');
	}
}

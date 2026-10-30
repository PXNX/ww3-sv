/*
 * Sondage Slider: push the wobbling poll line downward with correct icons.
 */
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const SLIDER_BEST_KEY = ['slider', 'score'] as const;

export type SliderState = 'playing' | 'over';

export class SliderGame {
	state = $state<SliderState>('playing');
	poll = $state(-24); // percent
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	over = $state(false);
	time = $state(30);
	round = $state(1);
	wobble = $state(0);
	message = $state('Tap correct icons to push poll down!');
	icons = $state<string[]>([]);

	#scores: Highscores;
	#timer?: ReturnType<typeof setInterval>;
	#animTimer?: ReturnType<typeof setInterval>;

	constructor({ scores = highscores() }: { scores?: Highscores } = {}) {
		this.#scores = scores;
		this.best = this.#scores.get(SLIDER_BEST_KEY);
		this.start();
	}

	start() {
		if (this.#timer) clearInterval(this.#timer);
		if (this.#animTimer) clearInterval(this.#animTimer);
		this.over = false;
		this.state = 'playing';
		this.poll = -24;
		this.score = 0;
		this.time = 30;
		this.round = 1;
		this.isNewBest = false;
		this.#nextRound();
		this.#timer = setInterval(() => {
			this.time--;
			if (this.time <= 0) this.#endGame();
		}, 1000);
		this.#animTimer = setInterval(() => {
			this.wobble = Math.sin(Date.now() / 200) * 4;
			this.poll += (Math.random() - 0.5) * 0.8;
			if (this.poll < -60) this.poll = -60;
			if (this.poll > 10) this.poll = 10;
		}, 50);
	}

	#nextRound() {
		const opts = ['?', '?', '??', '???', '??', '??', '??', '??'];
		this.icons = [];
		const correct = opts[Math.floor(Math.random() * opts.length)];
		// Mix in wrong ones
		for (let i = 0; i < 4; i++) {
			if (i === Math.floor(Math.random() * 4)) {
				this.icons.push(correct);
			} else {
				let w;
				do { w = opts[Math.floor(Math.random() * opts.length)]; } while (w === correct);
				this.icons.push(w);
			}
		}
		// Make sure correct is present
		if (!this.icons.includes(correct)) this.icons[Math.floor(Math.random() * 4)] = correct;
		(this as any)._correct = correct;
		this.message = 'Pick the right icon!';
	}

	pick(icon: string) {
		if (this.state !== 'playing') return;
		if (icon === (this as any)._correct) {
			this.poll -= 8 + Math.random() * 4;
			this.score += 50 + this.round * 10;
			this.round++;
			soundManager().play('sparkle');
			haptic().play(0.2);
			this.message = `Good! Poll down`;
			if (this.poll < -55) {
				this.#endGame();
				return;
			}
		} else {
			this.poll += 4;
			soundManager().play('hit');
			haptic().play(0.15);
			this.message = 'Wrong! Poll rises';
			if (this.poll > 0) {
				this.#endGame();
				return;
			}
		}
		setTimeout(() => this.#nextRound(), 600);
	}

	#endGame() {
		if (this.#timer) clearInterval(this.#timer);
		if (this.#animTimer) clearInterval(this.#animTimer);
		this.over = true;
		this.state = 'over';
		const result = this.#scores.submit(SLIDER_BEST_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		soundManager().play('fake-news');
	}
}

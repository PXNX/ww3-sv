/*
 * Shadow Fleet Shuffle (Musk): shell game - track the sanctioned tanker behind shifting cards.
 */
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const SHUFFLE_BEST_KEY = ['shuffle', 'score'] as const;

export type ShuffleState = 'intro' | 'showing' | 'shuffling' | 'guessing' | 'correct' | 'wrong' | 'over';

export interface Card {
	id: number;
	x: number;
	y: number;
	rotation: number;
	scale: number;
	hasTanker: boolean;
	flipped: boolean;
}

export class ShuffleGame {
	state = $state<ShuffleState>('intro');
	cards = $state<Card[]>([]);
	score = $state(0);
	level = $state(1);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	guesses = $state(0);
	correct = $state(0);
	over = $state(false);
	message = $state('Track the sanctioned tanker');

	#scores: Highscores;
	#tankerCard = 0;
	#shuffleCount = 0;
	#animTimer?: ReturnType<typeof setTimeout>;

	constructor({ scores = highscores() }: { scores?: Highscores } = {}) {
		this.#scores = scores;
		this.best = this.#scores.get(SHUFFLE_BEST_KEY);
		this.start();
	}

	start() {
		if (this.#animTimer) clearTimeout(this.#animTimer);
		this.over = false;
		this.score = 0;
		this.level = 1;
		this.guesses = 0;
		this.correct = 0;
		this.isNewBest = false;
		this.#startRound();
	}

	#startRound() {
		this.state = 'intro';
		this.message = `Round ${this.level} - Watch closely`;
		const count = Math.min(3 + Math.floor(this.level / 2), 5);
		this.#setupCards(count);
		this.#animTimer = setTimeout(() => this.#showTanker(), 700);
	}

	#setupCards(count: number) {
		this.cards = [];
		const spacing = 110;
		const startX = (count - 1) * (-spacing) / 2;
		for (let i = 0; i < count; i++) {
			this.cards.push({
				id: i,
				x: startX + i * spacing,
				y: 0,
				rotation: 0,
				scale: 1,
				hasTanker: false,
				flipped: false
			});
		}
		this.#tankerCard = Math.floor(Math.random() * count);
		this.cards[this.#tankerCard].hasTanker = true;
	}

	#showTanker() {
		this.state = 'showing';
		this.message = 'There it is!';
		for (const c of this.cards) c.flipped = c.hasTanker;
		this.#animTimer = setTimeout(() => this.#hideAndShuffle(), 1000);
	}

	#hideAndShuffle() {
		for (const c of this.cards) c.flipped = false;
		this.state = 'shuffling';
		this.message = 'Shuffling...';
		this.#shuffleCount = 3 + this.level;
		this.#doShuffle();
	}

	#doShuffle() {
		if (this.#shuffleCount <= 0) {
			this.#finishShuffling();
			return;
		}
		this.#shuffleCount--;
		const n = this.cards.length;
		for (let i = 0; i < n; i++) {
			const j = Math.floor(Math.random() * n);
			const cx = this.cards[i].x;
			const cy = this.cards[i].y;
			this.cards[i].x = this.cards[j].x;
			this.cards[i].y = this.cards[j].y;
			this.cards[j].x = cx;
			this.cards[j].y = cy;
			this.cards[i].rotation = (Math.random() - 0.5) * 20;
			this.cards[j].rotation = (Math.random() - 0.5) * 20;
		}
		soundManager().play('click');
		this.#animTimer = setTimeout(() => this.#doShuffle(), 350);
	}

	#finishShuffling() {
		for (const c of this.cards) {
			c.rotation = 0;
			c.y = 0;
		}
		this.state = 'guessing';
		this.message = 'Find the sanctioned tanker!';
	}

	pickCard(id: number) {
		if (this.state !== 'guessing') return;
		this.guesses++;
		const card = this.cards[id];
		card.flipped = true;
		if (card.hasTanker) {
			this.state = 'correct';
			this.correct++;
			this.score += 100 * this.level;
			soundManager().play('sparkle');
			haptic().play(0.3);
			this.message = `Caught! +${100 * this.level}`;
			this.#animTimer = setTimeout(() => {
				this.level++;
				if (this.level > 7) {
					this.#endGame();
				} else {
					this.#startRound();
				}
			}, 1400);
		} else {
			this.state = 'wrong';
			soundManager().play('hit');
			haptic().play(0.2);
			for (const c of this.cards) {
				if (c.hasTanker) c.flipped = true;
			}
			this.message = 'Miss!';
			this.#animTimer = setTimeout(() => this.#endGame(), 1800);
		}
	}

	#endGame() {
		this.over = true;
		this.state = 'over';
		const result = this.#scores.submit(SHUFFLE_BEST_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		soundManager().play('fake-news');
	}
}

/*
 * Sondage Slider store: wraps the pure game logic with the frame loop, pause, best score, sounds
 * and haptics. The page's effects (particles, popups, shake) listen through `onEvent`.
 */
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import {
	comboMultiplier,
	createSlider,
	pressConference,
	tap,
	tick,
	type SliderEvent,
	type SliderState
} from '#lib/game/slider/state.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const SLIDER_BEST_KEY = ['slider', 'score'] as const;

/** Longest step the simulation takes at once, so a stalled frame does not skip a whole week */
const MAX_STEP = 0.1;

export class SliderGame {
	state = $state<SliderState>(createSlider());
	paused = $state(false);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	/** Counts up with every scandal, so views can restart a shake animation */
	shakes = $state(0);

	#scores: () => Highscores;
	#random: Random;
	#seed: () => number;
	#onEvent?: (event: SliderEvent) => void;

	constructor({
		scores = () => highscores(),
		random,
		onEvent
	}: {
		scores?: () => Highscores;
		random?: Random;
		onEvent?: (event: SliderEvent) => void;
	} = {}) {
		this.#scores = scores;
		this.#seed = () => randomSeed();
		this.#random = random ?? createRandom(this.#seed());
		this.#onEvent = onEvent;
	}

	get over() {
		return this.state.over;
	}

	get multiplier() {
		return comboMultiplier(this.state.combo);
	}

	loadBest() {
		this.best = this.#scores().get(SLIDER_BEST_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createSlider();
		this.paused = false;
		this.isNewBest = false;
		this.loadBest();
	}

	pause() {
		if (!this.state.over) this.paused = true;
	}

	resume() {
		this.paused = false;
	}

	togglePause() {
		if (this.paused) this.resume();
		else this.pause();
	}

	/** Advances by dt seconds; the page calls this once per animation frame */
	frame(dt: number) {
		if (this.paused || this.state.over) return;
		this.#handle(tick(this.state, Math.min(dt, MAX_STEP), this.#random));
	}

	tapTarget(id: number) {
		if (this.paused) return;
		this.#handle(tap(this.state, id));
	}

	press() {
		if (this.paused) return;
		this.#handle(pressConference(this.state));
	}

	/** Gives up: counts as a lost run */
	forfeit() {
		if (this.state.over) return;
		this.state.approval = 0;
		this.#handle(tick(this.state, 0.001, this.#random));
	}

	#handle(events: SliderEvent[]) {
		for (const event of events) {
			this.#feedback(event);
			this.#onEvent?.(event);
			if (event.type === 'scandal') this.shakes++;
			if (event.type === 'end') this.#finish();
		}
	}

	#feedback(event: SliderEvent) {
		const sound = soundManager();
		const vibrate = haptic();
		switch (event.type) {
			case 'rally':
				sound.play('poll-rally', Math.min(1, event.combo / 20));
				vibrate.play(0.15 + Math.min(0.3, event.combo * 0.02));
				if (event.combo > 0 && event.combo % 5 === 0) sound.play('ding', 0.8);
				break;
			case 'counter':
				sound.play('click', 0.7);
				vibrate.play(0.25);
				break;
			case 'decoy':
				sound.play('ui-error');
				vibrate.play(0.5);
				break;
			case 'scandal':
				sound.play('poll-scandal', 0.8);
				vibrate.play(0.9);
				break;
			case 'missed':
				sound.play('energy-empty');
				break;
			case 'press':
				sound.play('chime', 0.8);
				vibrate.play(0.4);
				break;
			case 'press-not-ready':
				sound.play('energy-empty');
				vibrate.play(0.1);
				break;
			case 'week':
				sound.play('wave-horn');
				vibrate.play(0.3);
				break;
			case 'end':
				sound.play(event.won ? 'chime-big' : 'game-over');
				vibrate.play(event.won ? 0.6 : 0.8);
				break;
		}
	}

	#finish() {
		const result = this.#scores().submit(SLIDER_BEST_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
	}
}

/*
 * Falklands game store: a turn-based wrapper around the pure race rules. There is no game loop;
 * every action is one day, and the map, fuel gauge and notes update from the events.
 */
import {
	canDeal,
	createGame,
	deal,
	enemyLeft,
	move,
	talk,
	weatherNow,
	zonesLeft,
	type FalklandsEvent,
	type FalklandsOutcome,
	type FalklandsState,
	type Speed
} from '#lib/game/falklands/state.js';
import { DIPLOMACY_TARGET } from '#lib/game/falklands/config.js';
import type { Weather } from '#lib/game/falklands/weather.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type FalklandsStatus = 'ready' | 'playing' | 'over';

export const SCORE_KEY = ['falklands', 'score'] as const;

export interface FalklandsNote {
	id: number;
	text: string;
}

export interface FalklandsOptions {
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class FalklandsGame {
	status = $state<FalklandsStatus>('ready');
	day = $state(0);
	playerAt = $state(0);
	enemyAt = $state(0);
	fuel = $state(0);
	talks = $state(0);
	zonesLeft = $state(0);
	enemyLeft = $state(0);
	dealReady = $state(false);
	weather = $state.raw<Weather>('clear');
	outcome = $state.raw<FalklandsOutcome | null>(null);
	score = $state(0);
	note = $state.raw<FalklandsNote | null>(null);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: FalklandsState;

	#scores: () => Highscores;
	#seed: () => number;
	#random: Random = createRandom(1);
	#noteId = 0;

	constructor({ scores = highscores, seed = randomSeed }: FalklandsOptions = {}) {
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random);
		this.note = null;
		this.isNewBest = false;
		this.#sync();
		this.status = 'playing';
	}

	/** Sail one, two or three zones */
	move(speed: Speed) {
		if (this.status !== 'playing') return;
		this.#run(move(this.state, speed));
	}

	/** Spend the day in talks */
	talk() {
		if (this.status !== 'playing') return;
		this.#run(talk(this.state));
	}

	/** Sign the peace deal once the talks have gone on long enough */
	deal() {
		if (this.status !== 'playing') return;
		this.#run(deal(this.state));
	}

	#run(events: FalklandsEvent[]) {
		for (const event of events) this.#handle(event);
		if (events.length > 0) {
			this.#sync();
			if (this.state.phase === 'over') this.#finish();
		}
	}

	#handle(event: FalklandsEvent) {
		switch (event.type) {
			case 'move':
				this.#note(m.falklands_note_move({ zones: event.zones }));
				this.#play('whoosh', 0.5);
				break;
			case 'blocked':
				this.#note(event.weather === 'storm' ? m.falklands_note_storm() : m.falklands_note_fog());
				this.#play('ui-error', 0.8);
				break;
			case 'shortfuel':
				this.#note(m.falklands_note_shortfuel({ need: event.need }));
				this.#play('ui-error', 0.8);
				break;
			case 'talk':
				this.#note(
					event.talks >= DIPLOMACY_TARGET
						? m.falklands_note_deal_ready()
						: m.falklands_note_talk({ talks: event.talks, target: DIPLOMACY_TARGET })
				);
				this.#play('ui-tap', 0.6);
				break;
			case 'no-deal':
				this.#note(m.falklands_note_nodeal({ talks: event.talks, target: DIPLOMACY_TARGET }));
				this.#play('ui-error', 0.8);
				break;
			case 'win':
				this.#play('chime-big', 1);
				break;
			case 'peace':
				this.#play('chime', 0.9);
				break;
			case 'lose':
				this.#play('ui-error', 1);
				break;
		}
	}

	#note(text: string) {
		this.note = { id: ++this.#noteId, text };
	}

	#play(id: SoundId, intensity: number) {
		soundManager().play(id, intensity);
	}

	#sync() {
		const state = this.state;
		this.day = state.day;
		this.playerAt = state.playerAt;
		this.enemyAt = state.enemyAt;
		this.fuel = state.fuel;
		this.talks = state.talks;
		this.zonesLeft = zonesLeft(state);
		this.enemyLeft = enemyLeft(state);
		this.dealReady = canDeal(state);
		this.weather = weatherNow(state);
		this.outcome = state.outcome;
		this.score = state.score;
	}

	#finish() {
		const result = this.#scores().submit(SCORE_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.status = 'over';
	}

	/** Draws the South Atlantic onto the shared score card: route, island and two fleets */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const ink = '#111111';
		// Sea
		context.fillStyle = '#8fb4c9';
		context.fillRect(x, y, size, size);
		context.strokeStyle = ink;
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeRect(x, y, size, size);
		// Waves
		context.strokeStyle = '#6d97ad';
		context.lineWidth = Math.max(1, size * 0.008);
		for (let row = 0; row < 4; row++) {
			context.beginPath();
			context.moveTo(x + size * 0.08, y + size * (0.2 + row * 0.18));
			context.quadraticCurveTo(
				x + size * 0.2,
				y + size * (0.16 + row * 0.18),
				x + size * 0.32,
				y + size * (0.2 + row * 0.18)
			);
			context.stroke();
		}
		// The dotted route to the islands
		context.strokeStyle = ink;
		context.lineWidth = Math.max(2, size * 0.01);
		for (let dot = 0; dot < 6; dot++) {
			const progress = dot / 5;
			context.beginPath();
			context.arc(
				x + size * (0.14 + progress * 0.58),
				y + size * (0.74 - progress * 0.36),
				size * 0.014,
				0,
				Math.PI * 2
			);
			context.fillStyle = ink;
			context.fill();
		}
		// The islands
		context.fillStyle = '#7f9a5e';
		context.beginPath();
		context.ellipse(
			x + size * 0.82,
			y + size * 0.3,
			size * 0.12,
			size * 0.08,
			-0.4,
			0,
			Math.PI * 2
		);
		context.fill();
		context.stroke();
		// The task force
		context.fillStyle = '#2f5d8a';
		context.beginPath();
		context.moveTo(x + size * 0.2, y + size * 0.7);
		context.lineTo(x + size * 0.29, y + size * 0.76);
		context.lineTo(x + size * 0.2, y + size * 0.82);
		context.closePath();
		context.fill();
		context.stroke();
		// The other fleet, further along
		context.fillStyle = '#a34a3a';
		context.beginPath();
		context.moveTo(x + size * 0.6, y + size * 0.34);
		context.lineTo(x + size * 0.68, y + size * 0.4);
		context.lineTo(x + size * 0.6, y + size * 0.46);
		context.closePath();
		context.fill();
		context.stroke();
	};
}

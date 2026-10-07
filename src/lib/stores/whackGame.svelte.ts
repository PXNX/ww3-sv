/*
 * Spokesperson Whack game store: wraps the pure step logic with the player's taps, visual effects,
 * sounds and personal bests (kept per board). The simulation state is a plain object read by the
 * canvas every frame; only what the page chrome shows is reactive, synced after each step.
 */
import { STARTING_LIVES, type BoardId } from '#lib/game/whack/config.js';
import { drawScenePreview, type Effect, type SceneExtras } from '#lib/game/whack/render.js';
import { createGame, type WhackEvent, type WhackState } from '#lib/game/whack/state.js';
import { stepGame, tapAt, tapHole } from '#lib/game/whack/step.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type WhackStatus = 'ready' | 'playing' | 'paused' | 'over';

const scoreKey = (board: BoardId) => ['whack', board, 'score'] as const;
const streakKey = (board: BoardId) => ['whack', board, 'streak'] as const;

/** Shortest time between two plays of a frequent sound */
const SOUND_GAP_MS = 90;

export interface WhackOptions {
	reducedMotion?: boolean;
	board?: BoardId;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class WhackGame {
	status = $state<WhackStatus>('ready');
	board = $state<BoardId>('regime');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	hits = $state(0);
	escaped = $state(0);
	decoysHit = $state(0);
	bestStreak = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	/** Personal bests on the current board */
	best = $state<number | null>(null);
	bestStreakEver = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: WhackState;
	effects: Effect[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#soundClock = 0;
	#lastSound: Partial<Record<SoundId, number>> = {};

	constructor({
		reducedMotion = false,
		board = 'regime',
		scores = highscores,
		seed = randomSeed
	}: WhackOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.board = board;
		this.state = createGame(board);
		this.#syncChrome();
	}

	/** Reads the stored bests of the current board; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(scoreKey(this.board));
		this.bestStreakEver = this.#scores().get(streakKey(this.board));
	}

	/** Picks the board to play on, from the start screen */
	selectBoard(board: BoardId) {
		if (this.status === 'playing' || this.status === 'paused') return;
		this.board = board;
		this.state = createGame(board);
		this.effects = [];
		this.#syncChrome();
		this.loadBest();
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.board);
		this.effects = [];
		this.isNewBest = false;
		this.#soundClock = 0;
		this.#lastSound = {};
		this.#syncChrome();
		this.status = 'playing';
	}

	/** Back to the start screen (to pick another board) */
	backToStart() {
		this.state = createGame(this.board);
		this.effects = [];
		this.isNewBest = false;
		this.#syncChrome();
		this.loadBest();
		this.status = 'ready';
	}

	pause() {
		if (this.status === 'playing') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A press on the field at a world position */
	pointerDown(x: number, y: number) {
		if (this.status !== 'playing') return;
		this.#apply(tapAt(this.state, x, y));
	}

	/** A key press for one podium (digits 1 to 9) */
	pressHole(hole: number) {
		if (this.status !== 'playing') return;
		this.#apply(tapHole(this.state, hole));
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.#ageEffects(dtMs);
		if (this.status !== 'playing') return;
		this.#soundClock += dtMs;
		this.#apply(stepGame(this.state, this.#random, dtMs));
	}

	sceneExtras(): SceneExtras {
		return { effects: this.effects, reducedMotion: this.reducedMotion };
	}

	/** Draws the final field onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, x, y, size);
	};

	#apply(events: readonly WhackEvent[]) {
		for (const event of events) this.#handle(event);
		this.#syncChrome();
	}

	#handle(event: WhackEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		switch (event.type) {
			case 'hit':
				this.effects.push({
					kind: 'bonk',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 320 * short + 80
				});
				this.effects.push({
					kind: 'popup',
					x: event.x,
					y: event.y,
					text: `+${event.points}`,
					big: false,
					ageMs: 0,
					durationMs: 650 * short + 150
				});
				if (event.multiplier >= 2 && event.streak % 3 === 0) {
					this.effects.push({
						kind: 'popup',
						x: event.x,
						y: event.y - 24,
						text: `x${event.multiplier}`,
						big: true,
						ageMs: 0,
						durationMs: 800 * short + 150
					});
					this.#play('chime', 0);
				} else {
					this.#play('hit', SOUND_GAP_MS);
				}
				break;
			case 'decoy-hit':
				this.hurtCount += 1;
				this.effects.push({
					kind: 'ring',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 420 * short + 80
				});
				this.effects.push({
					kind: 'popup',
					x: event.x,
					y: event.y,
					text: '-1 ♥',
					big: true,
					ageMs: 0,
					durationMs: 900 * short + 150
				});
				this.#play('ui-error', 0);
				break;
			case 'statement-finished':
				this.hurtCount += 1;
				this.effects.push({
					kind: 'ring',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 500 * short + 100
				});
				this.effects.push({
					kind: 'popup',
					x: event.x,
					y: event.y,
					text: '-1 ♥',
					big: true,
					ageMs: 0,
					durationMs: 900 * short + 150
				});
				this.#play('fake-news', 600);
				break;
			case 'empty':
				if (event.broke) this.#play('click', SOUND_GAP_MS);
				break;
			case 'game-over':
				this.#finish();
				break;
			case 'spawned':
				break;
		}
	}

	/** Plays a sound unless the same one played within the gap */
	#play(id: SoundId, gapMs: number) {
		const last = this.#lastSound[id];
		if (last !== undefined && gapMs > 0 && this.#soundClock - last < gapMs) return;
		this.#lastSound[id] = this.#soundClock;
		soundManager().play(id);
	}

	#ageEffects(dtMs: number) {
		if (this.status !== 'playing') return;
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
	}

	#syncChrome() {
		this.score = this.state.score;
		this.lives = this.state.lives;
		this.hits = this.state.hits;
		this.escaped = this.state.escaped;
		this.decoysHit = this.state.decoysHit;
		this.bestStreak = this.state.bestStreak;
	}

	#finish() {
		this.#syncChrome();
		const scoreResult = this.#scores().submit(scoreKey(this.board), this.state.score);
		const streakResult = this.#scores().submit(streakKey(this.board), this.state.bestStreak);
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestStreakEver = streakResult.best;
		this.status = 'over';
	}
}

/*
 * Drone Wall game store: wraps the pure step logic with the player's input (selecting slots,
 * building, tapping helmets), the visual effects, banners, sounds and personal bests. The
 * simulation state is a plain object read by the canvas every frame; only what the page chrome
 * shows is reactive, synced after each step.
 */
import { SLOTS, STARTING_LIVES, type DefenseKind } from '#lib/game/dronewall/config.js';
import {
	build,
	collectHelmetAt,
	sell,
	upgrade,
	type EconomyResult
} from '#lib/game/dronewall/economy.js';
import { drawScenePreview, type Effect, type SceneExtras } from '#lib/game/dronewall/render.js';
import {
	createGame,
	type DroneWallEvent,
	type DroneWallState,
	type WavePhase
} from '#lib/game/dronewall/state.js';
import { stepGame } from '#lib/game/dronewall/step.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type DroneWallStatus = 'ready' | 'playing' | 'paused' | 'over';

export type DroneWallBanner =
	{ kind: 'incoming'; wave: number } | { kind: 'cleared'; bonus: number } | { kind: 'breach' };

const SCORE_KEY = ['dronewall', 'score'] as const;
const WAVE_KEY = ['dronewall', 'wave'] as const;

/** Shortest time between two plays of a frequent sound */
const SOUND_GAP_MS = 90;

export interface DroneWallOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class DroneWallGame {
	status = $state<DroneWallStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	/** Helmets in the pocket */
	helmets = $state(0);
	wave = $state(0);
	phase = $state<WavePhase>('prep');
	/** Whole seconds until the next wave (while building) */
	prepSeconds = $state(0);
	kills = $state(0);
	collected = $state(0);
	selectedSlot = $state<number | null>(null);
	/** Bumps whenever a defense changes, so the build panel re-reads the state */
	revision = $state(0);
	banner = $state<DroneWallBanner | null>(null);
	/** Counts up when an action fails for lack of helmets, so the counter can shake */
	brokeCount = $state(0);
	best = $state<number | null>(null);
	bestWave = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: DroneWallState = createGame();
	effects: Effect[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#flavor: Random = createRandom(2);
	#scores: () => Highscores;
	#seed: () => number;
	#bannerMs = 0;
	#soundClock = 0;
	#lastSound: Partial<Record<SoundId, number>> = {};

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: DroneWallOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.#syncChrome();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestWave = this.#scores().get(WAVE_KEY);
	}

	start() {
		const seed = this.#seed();
		this.#random = createRandom(seed);
		this.#flavor = createRandom(seed ^ 0x9e3779b9);
		this.state = createGame();
		this.effects = [];
		this.selectedSlot = null;
		this.banner = null;
		this.#bannerMs = 0;
		this.isNewBest = false;
		this.revision += 1;
		this.#syncChrome();
		this.status = 'playing';
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

	/** Selects a slot to build on or manage; selecting it again closes the panel */
	select(slot: number | null) {
		if (slot !== null && !SLOTS[slot]) return;
		this.selectedSlot = slot === this.selectedSlot ? null : slot;
	}

	build(kind: DefenseKind): EconomyResult {
		return this.#spend((slot) => build(this.state, slot, kind), 'click');
	}

	upgrade(): EconomyResult {
		return this.#spend((slot) => upgrade(this.state, slot), 'chime');
	}

	sell(): EconomyResult {
		return this.#spend((slot) => sell(this.state, slot), 'thud');
	}

	/** A tap or click on the field at a world position: picks up a helmet if one is there */
	tap(x: number, y: number): boolean {
		if (this.status !== 'playing') return false;
		const event = collectHelmetAt(this.state, x, y);
		if (!event) return false;
		this.#handle(event);
		this.#syncChrome();
		return true;
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.#ageEffects(dtMs);
		if (this.status !== 'playing') return;
		this.#soundClock += dtMs;
		const events = stepGame(this.state, this.#random, dtMs);
		for (const event of events) this.#handle(event);
		this.#syncChrome();
	}

	sceneExtras(): SceneExtras {
		return {
			effects: this.effects,
			selectedSlot: this.selectedSlot,
			showEmptySlots: this.status === 'playing' || this.status === 'paused'
		};
	}

	/** Draws the final field onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, x, y, size);
	};

	#spend(action: (slot: number) => EconomyResult, sound: SoundId): EconomyResult {
		const slot = this.selectedSlot;
		if (slot === null || this.status !== 'playing') return { ok: false, reason: 'bad-slot' };
		const result = action(slot);
		if (result.ok) {
			this.#play(sound, 0);
			this.revision += 1;
			this.#syncChrome();
		} else {
			if (result.reason === 'poor') this.brokeCount += 1;
			this.#play('ui-error', 0);
		}
		return result;
	}

	#handle(event: DroneWallEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		switch (event.type) {
			case 'wave-started':
				this.#showBanner({ kind: 'incoming', wave: event.wave }, 1700);
				this.#play('alarm', 0);
				break;
			case 'wave-cleared':
				this.#showBanner({ kind: 'cleared', bonus: event.bonus }, 2200);
				this.#play('chime-big', 0);
				break;
			case 'soldier-fell': {
				// Bloodless: the soldier tumbles away and a poof marks the spot
				const sideways = (this.#flavor() * 2 - 1) * 70;
				this.effects.push({
					kind: 'tumble',
					x: event.x,
					y: event.y,
					vx: this.reducedMotion ? 0 : sideways,
					vy: this.reducedMotion ? -40 : -150 - this.#flavor() * 70,
					spin: this.reducedMotion ? 0 : (this.#flavor() < 0.5 ? -1 : 1) * (6 + this.#flavor() * 5),
					soldier: event.kind,
					ageMs: 0,
					durationMs: 750 * short + 150
				});
				this.effects.push({
					kind: 'poof',
					x: event.x,
					y: event.y,
					size: event.kind === 'brute' ? 34 : 24,
					ageMs: 0,
					durationMs: 420 * short + 100
				});
				this.#play('pop', SOUND_GAP_MS);
				break;
			}
			case 'helmet-collected':
				this.effects.push({
					kind: 'popup',
					x: event.x,
					y: event.y,
					text: `+${event.value}`,
					ageMs: 0,
					durationMs: 650 * short + 150
				});
				this.#play('pickup', 0);
				break;
			case 'helmet-expired':
				this.effects.push({
					kind: 'poof',
					x: event.x,
					y: event.y,
					size: 14,
					ageMs: 0,
					durationMs: 300
				});
				break;
			case 'leak':
				this.effects.push({
					kind: 'poof',
					x: event.x,
					y: event.y,
					size: 40,
					ageMs: 0,
					durationMs: 550 * short + 100
				});
				this.#showBanner({ kind: 'breach' }, 1300);
				this.#play('alarm', 0);
				break;
			case 'squad-shot':
				this.effects.push(tracer(event, false));
				this.#play('click', SOUND_GAP_MS);
				break;
			case 'drone-strike':
				this.effects.push(tracer(event, true));
				this.#play('zap', SOUND_GAP_MS);
				break;
			case 'shell-launched':
				this.#play('thud', SOUND_GAP_MS);
				break;
			case 'shell-landed':
				this.effects.push({
					kind: 'blast',
					x: event.x,
					y: event.y,
					size: event.radius * 0.7,
					ageMs: 0,
					durationMs: 520 * short + 100
				});
				this.#play('explosion-small', SOUND_GAP_MS);
				break;
			case 'game-over':
				this.#finish();
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

	#showBanner(banner: DroneWallBanner, durationMs: number) {
		this.banner = banner;
		this.#bannerMs = durationMs;
	}

	#ageEffects(dtMs: number) {
		if (this.status !== 'playing') return;
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		if (this.#bannerMs > 0) {
			this.#bannerMs -= dtMs;
			if (this.#bannerMs <= 0) this.banner = null;
		}
	}

	#syncChrome() {
		this.score = this.state.score;
		this.lives = this.state.lives;
		this.helmets = this.state.currency;
		this.wave = this.state.wave;
		this.phase = this.state.phase;
		this.prepSeconds = Math.max(0, Math.ceil(this.state.prepMs / 1000));
		this.kills = this.state.kills;
		this.collected = this.state.collected;
	}

	#finish() {
		this.#syncChrome();
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const waveResult = this.#scores().submit(WAVE_KEY, this.state.wave);
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestWave = waveResult.best;
		this.banner = null;
		this.selectedSlot = null;
		this.status = 'over';
	}
}

function tracer(
	event: { fromX: number; fromY: number; toX: number; toY: number },
	drone: boolean
): Effect {
	return {
		kind: 'tracer',
		x1: event.fromX,
		y1: event.fromY - (drone ? 13 : 2),
		x2: event.toX,
		y2: event.toY,
		drone,
		ageMs: 0,
		durationMs: drone ? 260 : 110
	};
}

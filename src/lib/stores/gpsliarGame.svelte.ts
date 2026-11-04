/*
 * GPS Liar store: the level select, the running level, pause, results and the locally stored
 * progress. The simulation (GameState) is a plain object the canvas reads every frame; only what
 * the page chrome shows (hearts, score, deliveries, checks left, status) is reactive and copied
 * after each step.
 */
import { cargoName, hitText } from '#lib/components/gpsliarText.js';
import { STARTING_HEARTS } from '#lib/game/gpsliar/config.js';
import {
	addParticles,
	burst,
	stepParticles,
	wakeFoam,
	type Particle
} from '#lib/game/gpsliar/fx.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { createRandom } from '#lib/game/random.js';
import { keyVector, pointerVector } from '#lib/game/gpsliar/input.js';
import type { Vec } from '#lib/game/gpsliar/lie.js';
import { LEVEL_IDS, levelAt } from '#lib/game/gpsliar/levels.js';
import {
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	isGpsLiarProgress,
	isUnlocked,
	recordFinish,
	type GpsLiarProgress
} from '#lib/game/gpsliar/progress.js';
import { drawChartPreview, type Effect, type SceneExtras } from '#lib/game/gpsliar/render.js';
import {
	createGame,
	crossCheck,
	nextStop,
	setSteer,
	step,
	toggleSpoof,
	type Breakdown,
	type GameState,
	type GpsLiarEvent
} from '#lib/game/gpsliar/state.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import type { Cargo } from '#lib/game/gpsliar/level.js';

export type GpsLiarScreen = 'select' | 'play';
export type GpsLiarStatus = 'ready' | 'playing' | 'paused' | 'won' | 'over';

export { LEVEL_IDS };

export function highscoreParts(levelId: string): string[] {
	return ['gpsliar', levelId, 'score'];
}

/** How long and how hard (in scene pixels) a hit shakes the view */
const HIT_SHAKE_MS = 320;
const HIT_SHAKE_PX = 7;

export interface GpsLiarOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
}

export class GpsLiarGame {
	screen = $state<GpsLiarScreen>('select');
	status = $state<GpsLiarStatus>('ready');
	levelIndex = $state(0);
	hearts = $state(STARTING_HEARTS);
	score = $state(0);
	delivered = $state(0);
	stopsTotal = $state(0);
	crossChecksLeft = $state(0);
	/** Whether the chart shows the true position right now */
	revealing = $state(false);
	/** The cargo the next harbour wants, null once everything is unloaded */
	nextCargo = $state<Cargo | null>(null);
	/** Whole seconds on the clock, and the par time of the level */
	seconds = $state(0);
	par = $state(0);
	crossChecksUsed = $state(0);
	stars = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	/** Fuel and spoofer energy in whole percent, the patrol lock-on in whole percent, and whether the spoofer runs */
	fuelPercent = $state(100);
	spoofPercent = $state(100);
	alertPercent = $state(0);
	spoofing = $state(false);
	/** Whether the level has a fuel range at all, patrols or sanction checks */
	hasFuel = $state(false);
	hasPatrols = $state(false);
	/** Seconds until the sanction check when its warning is up, otherwise 0; and the storm banner */
	sanctionWarn = $state(0);
	stormNow = $state(false);
	fines = $state(0);
	sanctionsPassed = $state(0);
	/** The points of the won level, line by line */
	breakdown = $state<Breakdown | null>(null);
	isNewBest = $state(false);
	best = $state<number | null>(null);
	progress = $state<GpsLiarProgress>(EMPTY_PROGRESS);

	/** Simulation state, deliberately not reactive */
	state: GameState;
	effects: Effect[] = [];
	particles: Particle[] = [];
	readonly reducedMotion: boolean;

	#scores: () => Highscores;
	#store: () => Store;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping only, never rendered
	#keys = new Set<string>();
	#pointer: Vec | null = null;
	#shakeMs = 0;
	#random = createRandom(7);
	#foamMs = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		store = localStore
	}: GpsLiarOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#store = store;
		this.state = createGame(levelAt(0));
	}

	get levelCount(): number {
		return LEVEL_IDS.length;
	}

	get hasNextLevel(): boolean {
		return this.levelIndex + 1 < LEVEL_IDS.length;
	}

	/** Reads the stored progress; call in the browser only */
	load() {
		this.progress = this.#store().read(PROGRESS_KEY, EMPTY_PROGRESS, isGpsLiarProgress);
	}

	isUnlocked(index: number): boolean {
		return isUnlocked(this.progress, LEVEL_IDS, index);
	}

	starsFor(levelId: string): number {
		return this.progress.stars[levelId] ?? 0;
	}

	bestFor(levelId: string): number | null {
		return this.#scores().get(highscoreParts(levelId));
	}

	/** Opens a level on its "ready" screen; locked levels stay shut */
	openLevel(index: number) {
		if (!this.isUnlocked(index) || index < 0 || index >= LEVEL_IDS.length) return;
		const level = levelAt(index);
		this.levelIndex = index;
		this.state = createGame(level);
		this.effects = [];
		this.particles = [];
		this.#clearInput();
		this.isNewBest = false;
		this.stars = 0;
		this.breakdown = null;
		this.hurtCount = 0;
		this.#shakeMs = 0;
		this.best = this.bestFor(level.id);
		this.screen = 'play';
		this.status = 'ready';
		this.#sync();
	}

	/** The "ready" screen was dismissed: the level starts running */
	start() {
		if (this.status !== 'ready') return;
		this.status = 'playing';
		// A foghorn from the coast opens every level
		this.#play('foghorn', 0.8, 0.4);
	}

	retry() {
		this.openLevel(this.levelIndex);
		this.start();
	}

	nextLevel() {
		if (this.hasNextLevel) this.openLevel(this.levelIndex + 1);
	}

	backToSelect() {
		this.#clearInput();
		this.screen = 'select';
		this.status = 'ready';
	}

	pause() {
		if (this.status !== 'playing') return;
		this.#clearInput();
		this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A steering key goes down or up */
	setKey(code: string, down: boolean) {
		if (down && this.status !== 'playing') return;
		if (down) this.#keys.add(code);
		else this.#keys.delete(code);
		this.#steer();
	}

	/** A finger or the mouse steers toward a point at an offset (sea units) from the boat; null lets go */
	setPointer(offset: Vec | null) {
		this.#pointer = this.status === 'playing' ? offset : null;
		this.#steer();
	}

	/** The cross-check button: shows the true position on the chart for a few seconds */
	crossCheck() {
		if (this.status !== 'playing') return;
		for (const event of crossCheck(this.state)) this.#handle(event);
		this.#sync();
	}

	/** The spoofer button: a fake position hides the boat from radar and inspectors, at a price */
	spoof() {
		if (this.status !== 'playing') return;
		for (const event of toggleSpoof(this.state)) this.#handle(event);
		this.#sync();
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		this.particles = stepParticles(this.particles, dtMs);
		if (this.status !== 'playing') return;

		const dt = dtMs / 1000;
		this.#steer();
		for (const event of step(this.state, dt)) this.#handle(event);
		this.#wake(dtMs);
		this.#shakeMs = Math.max(0, this.#shakeMs - dtMs);
		this.#sync();

		if (this.state.phase === 'won') this.#win();
		else if (this.state.phase === 'over') this.#lose();
	}

	sceneExtras(): SceneExtras {
		return {
			effects: this.effects,
			reducedMotion: this.reducedMotion,
			// Hits shake the view; a storm rattles it a little all the time
			shake: this.reducedMotion
				? 0
				: (this.#shakeMs / HIT_SHAKE_MS) * HIT_SHAKE_PX + this.state.storm * 1.6,
			particles: this.particles
		};
	}

	/** Draws the final chart onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawChartPreview(context, this.state, x, y, size);
	};

	#play(id: SoundId, intensity = 1, pan = 0) {
		soundManager().play(id, intensity, pan);
	}

	/** Foam behind a moving boat, a few bubbles every so often (fewer when motion is reduced) */
	#wake(dtMs: number) {
		this.#foamMs += dtMs;
		const every = this.reducedMotion ? 220 : 70;
		if (this.#foamMs < every) return;
		this.#foamMs = 0;
		const { pos, facing, vel } = this.state;
		addParticles(this.particles, wakeFoam(pos, facing, Math.hypot(vel.x, vel.y), this.#random));
	}

	#burst(x: number, y: number, kind: Particle['kind'], count: number, speed: number) {
		const n = this.reducedMotion ? Math.ceil(count / 3) : count;
		addParticles(this.particles, burst({ x, y }, kind, n, speed, this.#random));
	}

	#popup(x: number, y: number, text: string, big: boolean) {
		const short = this.reducedMotion ? 0.5 : 1;
		this.effects.push({
			kind: 'popup',
			x,
			y: y - 0.5,
			text,
			big,
			ageMs: 0,
			durationMs: 1000 * short + 200
		});
	}

	#steer() {
		const keys = keyVector(this.#keys);
		const pointer = this.#pointer ? pointerVector(this.#pointer.x, this.#pointer.y) : null;
		// Keys win while any is held: a thumb resting on the glass must not fight the arrows
		const steer = keys.x !== 0 || keys.y !== 0 || !pointer ? keys : pointer;
		setSteer(this.state, steer.x, steer.y);
	}

	#clearInput() {
		this.#keys.clear();
		this.#pointer = null;
		setSteer(this.state, 0, 0);
	}

	#handle(event: GpsLiarEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		const { pos } = this.state;
		switch (event.type) {
			case 'hit':
				this.hurtCount += 1;
				this.#shakeMs = HIT_SHAKE_MS;
				this.#popup(pos.x, pos.y, hitText(event.cause), true);
				this.effects.push({
					kind: 'ring',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 450 * short + 60
				});
				this.#play(event.cause === 'rock' || event.cause === 'lighthouse' ? 'impact-stone' : 'hit');
				this.#play('alarm', 0.6);
				this.#burst(event.x, event.y, 'spark', 16, 3.2);
				haptic().play(0.7);
				break;
			case 'bump':
				this.#play('thud', 0.5);
				haptic().play(0.3);
				break;
			case 'deliver':
				this.#popup(
					event.x,
					event.y,
					m.gpsliar_popup_deliver({ cargo: cargoName(event.cargo), points: event.points }),
					true
				);
				this.#play('pickup');
				this.#play('chime', 0.8);
				this.#burst(event.x, event.y, 'confetti', 18, 3);
				haptic().play(0.5);
				break;
			case 'refuel':
				this.#popup(event.x, event.y + 0.4, m.gpsliar_popup_refuel(), false);
				break;
			case 'cross-check':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_cross_check(), false);
				this.#play('sparkle');
				haptic().play(0.2);
				break;
			case 'cross-check-empty':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_no_checks(), false);
				this.#play('ui-error');
				haptic().play(0.15);
				break;
			case 'lie-jump':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_jump(), false);
				this.#play('zap', 0.6);
				haptic().play(0.3);
				break;
			case 'spoof-on':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_spoof_on(), false);
				this.#play('spoof-glitch');
				this.#burst(pos.x, pos.y, 'glitch', 10, 2.4);
				haptic().play(0.35);
				break;
			case 'spoof-off':
				this.#popup(
					pos.x,
					pos.y,
					event.empty ? m.gpsliar_popup_spoof_dead() : m.gpsliar_popup_spoof_off(),
					false
				);
				this.#play('ais-off', 0.7);
				haptic().play(event.empty ? 0.3 : 0.15);
				break;
			case 'spoof-empty':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_spoof_empty(), false);
				this.#play('ui-error');
				haptic().play(0.15);
				break;
			case 'spotted':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_spotted(), false);
				this.#play('sonar-ping', 0.8);
				haptic().play(0.2);
				break;
			case 'fined':
				this.hurtCount += 1;
				this.#popup(pos.x, pos.y, m.gpsliar_popup_fined({ points: event.points }), true);
				this.#play('patrol-siren');
				this.#burst(event.x, event.y, 'spark', 10, 2.4);
				haptic().play(0.6);
				break;
			case 'sanction-warning':
				this.#play('patrol-siren', 0.5);
				haptic().play(0.25);
				break;
			case 'sanction-pass':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_sanction_pass({ points: event.points }), true);
				this.#play('chime', 0.7);
				haptic().play(0.3);
				break;
			case 'storm-warning':
				this.#play('foghorn', 1, 0);
				haptic().play(0.25);
				break;
			case 'storm-start':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_storm(), true);
				this.#play('thunder');
				haptic().play(0.5);
				break;
			case 'storm-end':
				break;
			case 'fuel-low':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_fuel_low(), false);
				this.#play('energy-empty');
				haptic().play(0.25);
				break;
			case 'fuel-empty':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_fuel_empty(), true);
				this.#play('energy-empty');
				haptic().play(0.4);
				break;
			case 'horn':
				this.#play('foghorn', 0.5, event.pan);
				break;
			case 'win':
				this.#play('chime-big');
				haptic().play(0.9);
				break;
			case 'game-over':
				haptic().play(1);
				break;
		}
	}

	#win() {
		const state = this.state;
		const level = levelAt(this.levelIndex);
		this.stars = state.stars;
		this.breakdown = state.breakdown;
		this.progress = recordFinish(this.progress, level.id, this.stars);
		this.#store().write(PROGRESS_KEY, this.progress);
		const result = this.#scores().submit(highscoreParts(level.id), state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.#clearInput();
		this.status = 'won';
	}

	#lose() {
		const level = levelAt(this.levelIndex);
		const result = this.#scores().submit(highscoreParts(level.id), this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.#clearInput();
		this.status = 'over';
	}

	#sync() {
		const state = this.state;
		this.hearts = state.hearts;
		this.score = state.score;
		this.delivered = state.delivered;
		this.stopsTotal = state.level.stops.length;
		this.crossChecksLeft = state.crossChecksLeft;
		this.crossChecksUsed = state.crossChecksUsed;
		this.revealing = state.reveal > 0;
		this.nextCargo = nextStop(state)?.cargo ?? null;
		this.seconds = Math.floor(state.time);
		this.par = state.level.par;
		this.fuelPercent = Math.round(state.fuel * 100);
		this.spoofPercent = Math.round(state.spoofEnergy * 100);
		this.alertPercent = Math.round(state.alert * 100);
		this.spoofing = state.spoof;
		this.hasFuel = (state.level.fuelRange ?? 0) > 0;
		this.hasPatrols = (state.level.patrols ?? []).length > 0;
		this.sanctionWarn = state.sanctionWarned ? Math.max(1, Math.ceil(state.sanctionIn)) : 0;
		this.stormNow = state.stormActive;
		this.fines = state.fines;
		this.sanctionsPassed = state.sanctionsPassed;
	}
}

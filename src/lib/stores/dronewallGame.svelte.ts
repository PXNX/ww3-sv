/*
 * Drone Wall game store: wraps the pure step logic with the player's input (selecting slots,
 * building, tapping helmets), the visual effects, banners, sounds and personal bests. The
 * simulation state is a plain object read by the canvas every frame; only what the page chrome
 * shows is reactive, synced after each step.
 */
import {
	HELMET_TARGET,
	POWERS,
	POWER_KINDS,
	STARTING_LIVES,
	WORLD_HEIGHT,
	eliteTier,
	type DefenseKind,
	type EnemyKind,
	type MapId,
	type Point,
	type PowerKind,
	type WeatherKind
} from '#lib/game/dronewall/config.js';
import { build, sell, upgrade, type EconomyResult } from '#lib/game/dronewall/economy.js';
import { callPower, isPowerUnlocked } from '#lib/game/dronewall/powers.js';
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
	| { kind: 'incoming'; wave: number }
	| { kind: 'cleared'; bonus: number }
	| { kind: 'breach' }
	| { kind: 'air' }
	| { kind: 'weather'; weather: WeatherKind }
	| { kind: 'rush'; started: boolean }
	| { kind: 'unlock'; power: PowerKind };

/** The game speeds the player can cycle through with one button */
export const GAME_SPEEDS = [1, 2, 4] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

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
	/** Counts up whenever a helmet lands on the counter, so the counter can bump */
	collectPulse = $state(0);
	/** How many simulation steps run per frame: x1, x2 or x4 */
	speed = $state<GameSpeed>(1);
	/** The weather now, and the forecast for the next wave */
	weather = $state<WeatherKind>('clear');
	forecast = $state<WeatherKind>('clear');
	/** Which powers are unlocked, and the whole seconds left until each can be called again */
	powerUnlocked = $state<Record<PowerKind, boolean>>({ airstrike: false, stormshadow: false });
	powerSeconds = $state<Record<PowerKind, number>>({ airstrike: 0, stormshadow: 0 });
	/** The power being aimed (the next tap on the field calls it), or null */
	armed = $state<PowerKind | null>(null);
	/** On big maps the view follows the front of the attack while this is on */
	follow = $state(true);
	/** The map for the next game (and the one on show before it starts) */
	mapId = $state<MapId>('serpentine');
	best = $state<number | null>(null);
	bestWave = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: DroneWallState = createGame();
	effects: Effect[] = [];
	/** Where collected helmets fly to, in world units; the canvas measures the real counter */
	helmetTarget: Point = HELMET_TARGET;
	/** The slice of the field on screen, in world units (the canvas of a big map scrolls) */
	view: { top: number; bottom: number } = { top: 0, bottom: WORLD_HEIGHT };
	/** Where the player is pointing while aiming a power, in world units */
	aimPoint: Point | null = null;

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

	/** Picks the map to play; before the first game it also shows that map on the field */
	selectMap(id: MapId) {
		if (this.status === 'playing' || this.status === 'paused') return;
		this.mapId = id;
		this.view = { top: 0, bottom: WORLD_HEIGHT };
		if (this.status === 'ready') {
			this.state = createGame(id);
			this.revision += 1;
		}
	}

	start() {
		const seed = this.#seed();
		this.#random = createRandom(seed);
		this.#flavor = createRandom(seed ^ 0x9e3779b9);
		this.state = createGame(this.mapId);
		this.effects = [];
		this.selectedSlot = null;
		this.armed = null;
		this.aimPoint = null;
		this.follow = true;
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
		if (slot !== null && !this.state.map.slots[slot]) return;
		this.armed = null;
		this.selectedSlot = slot === this.selectedSlot ? null : slot;
	}

	build(kind: DefenseKind): EconomyResult {
		return this.#spend((slot) => build(this.state, slot, kind), 'click');
	}

	upgrade(): EconomyResult {
		const slot = this.selectedSlot;
		const before = this.state.eliteRank;
		const result = this.#spend((slot) => upgrade(this.state, slot), 'chime');
		const defense = slot === null ? null : this.state.defenses[slot];
		if (result.ok && slot !== null && defense && eliteTier(defense.level) > 0) {
			// Going elite deserves a fanfare, and the first one unlocks a power
			const spot = this.state.map.slots[slot];
			this.effects.push({
				kind: 'ring',
				x: spot.x,
				y: spot.y,
				size: 54,
				ageMs: 0,
				durationMs: this.reducedMotion ? 300 : 650
			});
			this.#play('chime-big', 0);
			if (this.state.eliteRank > before) {
				for (const power of POWER_KINDS) {
					if (POWERS[power].unlockRank === this.state.eliteRank) {
						this.#showBanner({ kind: 'unlock', power }, 2600);
					}
				}
			}
		}
		return result;
	}

	sell(): EconomyResult {
		return this.#spend((slot) => sell(this.state, slot), 'thud');
	}

	/** Tapping a power button aims it (the next tap on the field calls it); tapping it again cancels */
	arm(power: PowerKind): boolean {
		if (this.status !== 'playing') return false;
		if (this.armed === power) {
			this.armed = null;
			return false;
		}
		if (!isPowerUnlocked(this.state, power) || this.state.powers[power].cooldownMs > 0) {
			this.#play('ui-error', 0);
			return false;
		}
		if (this.state.currency < POWERS[power].cost) {
			this.brokeCount += 1;
			this.#play('ui-error', 0);
			return false;
		}
		this.selectedSlot = null;
		this.armed = power;
		this.#play('ui-toggle', 0);
		return true;
	}

	disarm() {
		this.armed = null;
		this.aimPoint = null;
	}

	/** Calls the armed power on a spot of the field (world units) */
	callArmed(x: number, y: number): EconomyResult {
		const power = this.armed;
		if (power === null || this.status !== 'playing') return { ok: false, reason: 'bad-slot' };
		const events: DroneWallEvent[] = [];
		const result = callPower(this.state, power, x, y, events);
		if (result.ok) {
			this.armed = null;
			this.aimPoint = null;
			this.revision += 1;
			for (const event of events) this.#handle(event);
			this.#syncChrome();
		} else {
			if (result.reason === 'poor') this.brokeCount += 1;
			this.#play('ui-error', 0);
		}
		return result;
	}

	/** One button, three states: x1, then x2, then x4, then back to x1 */
	cycleSpeed(): GameSpeed {
		this.speed = GAME_SPEEDS[(GAME_SPEEDS.indexOf(this.speed) + 1) % GAME_SPEEDS.length];
		return this.speed;
	}

	/** One fixed step of the canvas game loop: runs `speed` simulation steps */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		// Sounds are spaced in real time, however fast the game runs
		this.#soundClock += dtMs;
		for (let i = 0; i < this.speed && this.status === 'playing'; i++) {
			this.#ageEffects(dtMs);
			const events = stepGame(this.state, this.#random, dtMs);
			for (const event of events) this.#handle(event);
		}
		this.#syncChrome();
	}

	sceneExtras(): SceneExtras {
		return {
			helmetTarget: this.helmetTarget,
			effects: this.effects,
			selectedSlot: this.selectedSlot,
			showEmptySlots: this.status === 'playing' || this.status === 'paused',
			viewTop: this.view.top,
			viewBottom: this.view.bottom,
			strikePreview:
				this.armed && this.aimPoint
					? { power: this.armed, x: this.aimPoint.x, y: this.aimPoint.y }
					: null
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
			case 'weather-changed':
				// The weather banner takes the place of the wave banner a moment later
				this.#showBanner({ kind: 'weather', weather: event.weather }, 2600);
				this.#play(
					event.weather === 'rain' ? 'thunder' : event.weather === 'snow' ? 'draft' : 'whoosh',
					0
				);
				break;
			case 'rush-warning':
				this.#showBanner({ kind: 'rush', started: false }, 2400);
				this.#play('alarm', 0);
				break;
			case 'rush-started':
				this.#showBanner({ kind: 'rush', started: true }, 2200);
				this.#play('alarm', 0);
				break;
			case 'soldier-froze':
				this.effects.push({
					kind: 'frost',
					x: event.x,
					y: event.y,
					size: 26,
					ageMs: 0,
					durationMs: 600 * short + 100
				});
				this.#play('impact-ice', SOUND_GAP_MS * 2);
				break;
			case 'power-called':
				this.effects.push({
					kind: 'ring',
					x: event.x,
					y: event.y,
					size: event.power === 'stormshadow' ? 80 : 120,
					ageMs: 0,
					durationMs: 700 * short + 100
				});
				this.#play(event.power === 'stormshadow' ? 'patriot-launch' : 'whoosh', 0);
				break;
			case 'wave-cleared':
				this.#showBanner({ kind: 'cleared', bonus: event.bonus }, 2200);
				this.#play('chime-big', 0);
				break;
			case 'soldier-fell': {
				// Bloodless: the soldier tumbles away and a poof marks the spot
				this.#tumble(event.x, event.y, event.kind);
				this.effects.push({
					kind: 'poof',
					x: event.x,
					y: event.y,
					size: BIG_ENEMIES.has(event.kind) ? 36 : event.kind === 'brute' ? 34 : 24,
					ageMs: 0,
					durationMs: 420 * short + 100
				});
				this.#play('pop', SOUND_GAP_MS);
				break;
			}
			case 'unit-spawned':
				this.effects.push({
					kind: 'poof',
					x: event.x,
					y: event.y,
					size: event.kind === 'leopard' ? 30 : 18,
					ageMs: 0,
					durationMs: 320 * short + 80
				});
				this.#play(event.kind === 'leopard' ? 'thud' : 'click', SOUND_GAP_MS);
				break;
			case 'unit-fell':
				this.effects.push({
					kind: 'poof',
					x: event.x,
					y: event.y,
					size: event.kind === 'leopard' ? 40 : 24,
					ageMs: 0,
					durationMs: 450 * short + 100
				});
				this.#play(event.kind === 'leopard' ? 'explosion-small' : 'pop', SOUND_GAP_MS);
				break;
			case 'melee-hit':
				this.effects.push({
					kind: 'poof',
					x: event.x,
					y: event.y,
					size: event.kind === 'leopard' ? 20 : 12,
					ageMs: 0,
					durationMs: 220 * short + 60
				});
				this.#play(event.kind === 'leopard' ? 'thud' : 'hit', SOUND_GAP_MS);
				break;
			case 'flyer-spawned':
				this.#showBanner({ kind: 'air' }, 1300);
				this.#play('alarm', 1500);
				break;
			case 'flyer-fell':
				// The wreck spins away and goes up in a blast
				this.#tumble(event.x, event.y, event.kind);
				this.effects.push({
					kind: 'blast',
					x: event.x,
					y: event.y,
					size: event.kind === 'bomber' ? 40 : event.kind === 'heli' ? 30 : 20,
					ageMs: 0,
					durationMs: 520 * short + 100
				});
				this.#play('explosion-small', SOUND_GAP_MS);
				break;
			case 'helmet-collected':
				// The helmet has just landed on the counter
				this.collectPulse += 1;
				this.effects.push({
					kind: 'popup',
					x: this.helmetTarget.x,
					y: this.helmetTarget.y + 30,
					text: `+${event.value}`,
					ageMs: 0,
					durationMs: 650 * short + 150
				});
				this.#play('pickup', SOUND_GAP_MS);
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
				this.effects.push(tracer(event));
				this.#play(event.weapon === 'sniper' ? 'fire' : 'click', SOUND_GAP_MS);
				break;
			case 'drone-launched':
				this.#play('zap', SOUND_GAP_MS);
				break;
			case 'missile-launched':
				this.#play('patriot-launch', SOUND_GAP_MS);
				break;
			case 'projectile-hit':
				this.effects.push({
					kind: 'blast',
					x: event.x,
					y: event.y,
					size: event.kind === 'missile' ? 24 : 13,
					ageMs: 0,
					durationMs: (event.kind === 'missile' ? 420 : 280) * short + 80
				});
				this.#play(event.kind === 'missile' ? 'explosion-small' : 'explosion-tiny', SOUND_GAP_MS);
				break;
			case 'projectile-lost':
				this.effects.push({
					kind: 'poof',
					x: event.x,
					y: event.y,
					size: 14,
					ageMs: 0,
					durationMs: 300
				});
				break;
			case 'shell-launched':
				this.#play(event.kind === 'rocket' ? 'patriot-launch' : 'thud', SOUND_GAP_MS);
				break;
			case 'shell-landed':
				this.effects.push({
					kind: 'blast',
					x: event.x,
					y: event.y,
					size: event.radius * 0.7,
					ageMs: 0,
					durationMs: (event.kind === 'cruise' ? 800 : 520) * short + 100
				});
				if (event.kind === 'cruise') {
					this.effects.push({
						kind: 'ring',
						x: event.x,
						y: event.y,
						size: event.radius * 1.6,
						ageMs: 0,
						durationMs: 600 * short + 100
					});
				}
				this.#play(event.kind === 'cruise' ? 'explosion-big' : 'explosion-small', SOUND_GAP_MS);
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

	/** An enemy thrown into the air, spinning away */
	#tumble(x: number, y: number, kind: EnemyKind) {
		const short = this.reducedMotion ? 0.5 : 1;
		const sideways = (this.#flavor() * 2 - 1) * 70;
		this.effects.push({
			kind: 'tumble',
			x,
			y,
			vx: this.reducedMotion ? 0 : sideways,
			vy: this.reducedMotion ? -40 : -150 - this.#flavor() * 70,
			spin: this.reducedMotion ? 0 : (this.#flavor() < 0.5 ? -1 : 1) * (6 + this.#flavor() * 5),
			soldier: kind,
			ageMs: 0,
			durationMs: 750 * short + 150
		});
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
		this.weather = this.state.weather;
		this.forecast = this.state.forecast;
		for (const power of POWER_KINDS) {
			this.powerUnlocked[power] = isPowerUnlocked(this.state, power);
			this.powerSeconds[power] = Math.ceil(this.state.powers[power].cooldownMs / 1000);
		}
		// Aiming ends when the power cannot be called any more
		if (this.armed && this.powerSeconds[this.armed] > 0) this.armed = null;
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
		this.armed = null;
		this.status = 'over';
	}
}

/** Armored vehicles fall with a bigger puff */
const BIG_ENEMIES: ReadonlySet<EnemyKind> = new Set(['btr', 'tank']);

function tracer(event: { fromX: number; fromY: number; toX: number; toY: number }): Effect {
	return {
		kind: 'tracer',
		x1: event.fromX,
		y1: event.fromY - 2,
		x2: event.toX,
		y2: event.toY,
		ageMs: 0,
		durationMs: 110
	};
}

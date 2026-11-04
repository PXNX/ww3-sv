/*
 * Grain Corridor game state. The simulation (src/lib/game/grain/state.ts) is plain data stepped by
 * the fixed loop and read by the canvas every frame; only the numbers the page shows are reactive,
 * synced after each step so the interface does not re-render sixty times a second. This class also
 * turns the simulation's events into sound, haptics and visual effects.
 */
import { SHIPS, SHIP_IDS, SHIP_Y, DEFAULT_SHIP, type ShipId } from '#lib/game/grain/config.js';
import {
	createFx,
	explosion,
	floatText,
	flash,
	grainBurst,
	heal,
	shake,
	splash,
	sweepWave,
	updateFx,
	wake,
	type Fx
} from '#lib/game/grain/effects.js';
import {
	createGame,
	finalScore,
	multiplier,
	nudge,
	starsFor,
	steerTo,
	step,
	sweep,
	waveAt,
	waveThreat,
	type GrainEvent,
	type GrainState as Sim,
	type WaveThreat
} from '#lib/game/grain/state.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const GRAIN_BEST_KEY = ['grain', 'score'] as const;
export const GRAIN_PORTS_KEY = ['grain', 'ports'] as const;
const SHIP_KEY = 'grain:ship';

export type GrainStatus = 'ready' | 'running' | 'paused' | 'over';

export interface WaveBanner {
	/** Changes with every banner, so the page can restart its animation */
	id: number;
	wave: number;
	threat: WaveThreat;
}

export interface GrainGameOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

const isShipId = (value: unknown): value is ShipId =>
	typeof value === 'string' && (SHIP_IDS as readonly string[]).includes(value);

export class GrainGame {
	status = $state<GrainStatus>('ready');
	shipId = $state<ShipId>(DEFAULT_SHIP);
	score = $state(0);
	lives = $state(SHIPS[DEFAULT_SHIP].lives);
	maxLives = $state(SHIPS[DEFAULT_SHIP].lives);
	hold = $state(0);
	holdMax = $state(SHIPS[DEFAULT_SHIP].hold);
	sweepers = $state(0);
	ports = $state(0);
	wave = $state(1);
	/** Metres sailed */
	distance = $state(0);
	chain = $state(0);
	multiplier = $state(1);
	crates = $state(0);
	delivered = $state(0);
	bestChain = $state(0);
	nearMisses = $state(0);
	swept = $state(0);
	stars = $state(0);
	/** Counts up on events the page pops a message for */
	hits = $state(0);
	sweeps = $state(0);
	best = $state<number | null>(null);
	bestPorts = $state<number | null>(null);
	isNewBest = $state(false);
	banner = $state<WaveBanner | null>(null);

	/** Not reactive on purpose: read by the canvas on every frame */
	sim: Sim = createGame();
	fx: Fx;
	readonly reducedMotion: boolean;

	#random: Random = createRandom(1);
	#cosmetic: Random = Math.random;
	#scores: () => Highscores;
	#seed: () => number;
	#bannerId = 0;
	#lastMultiplier = 1;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: GrainGameOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.fx = createFx(reducedMotion);
		this.#scores = scores;
		this.#seed = seed;
		this.sim = createGame(this.shipId);
	}

	/** Reads the stored bests and the last ship; call in the browser only */
	load() {
		this.best = this.#scores().get(GRAIN_BEST_KEY);
		this.bestPorts = this.#scores().get(GRAIN_PORTS_KEY);
		const ship = localStore().read<ShipId>(SHIP_KEY, DEFAULT_SHIP, isShipId);
		this.selectShip(ship, false);
	}

	/** Picks the ship for the next run (only before the run starts) */
	selectShip(id: ShipId, remember = true) {
		if (this.status === 'running' || this.status === 'paused') return;
		this.shipId = id;
		this.sim = createGame(id);
		this.fx = createFx(this.reducedMotion);
		this.#sync();
		if (remember) localStore().write(SHIP_KEY, id);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.sim = createGame(this.shipId);
		this.fx = createFx(this.reducedMotion);
		this.isNewBest = false;
		this.#lastMultiplier = 1;
		this.hits = 0;
		this.sweeps = 0;
		this.#sync();
		this.status = 'running';
		this.#announce(1, waveThreat(1));
	}

	pause() {
		if (this.status === 'running') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'running';
	}

	togglePause() {
		if (this.status === 'running') this.pause();
		else this.resume();
	}

	/** Back to the ship picker after a finished run */
	reset() {
		if (this.status === 'running' || this.status === 'paused') return;
		this.status = 'ready';
		this.selectShip(this.shipId, false);
	}

	/** Points the ship at a world x (a finger or the mouse) */
	steerTo(x: number) {
		if (this.status !== 'running') return;
		steerTo(this.sim, x);
	}

	/** One keyboard nudge to the left (-1) or right (1) */
	nudge(direction: -1 | 1) {
		if (this.status !== 'running') return;
		nudge(this.sim, direction);
	}

	/** Calls a minesweeper; a stray call with nothing to clear costs nothing */
	sweep() {
		if (this.status !== 'running') return;
		if (this.sim.sweepers <= 0 || this.sim.over) {
			soundManager().play('ui-error', 0.5);
			return;
		}
		const events = sweep(this.sim);
		if (events.length === 0) {
			soundManager().play('ui-error', 0.5);
			haptic().play(0.1);
			return;
		}
		this.#handle(events);
		this.#sync();
	}

	/** Advances the game by one fixed step */
	update(stepMs: number) {
		if (this.status !== 'running') return;
		const events = step(this.sim, stepMs, this.#random);
		updateFx(this.fx, stepMs, this.sim.speed);
		if (!this.sim.over) {
			wake(
				this.fx,
				stepMs,
				this.sim.shipX,
				SHIP_Y + SHIPS[this.shipId].radius + 6,
				SHIPS[this.shipId].radius,
				this.#cosmetic
			);
		}
		this.#handle(events);
		this.#sync();
		if (this.sim.over) this.#finish();
	}

	#announce(wave: number, threat: WaveThreat) {
		this.banner = { id: ++this.#bannerId, wave, threat };
	}

	#handle(events: GrainEvent[]) {
		const fx = this.fx;
		const sim = this.sim;
		const rnd = this.#cosmetic;
		const sound = soundManager();
		const buzz = haptic();
		for (const event of events) {
			switch (event.type) {
				case 'crate': {
					grainBurst(fx, event.x, event.y, 9, false, rnd);
					floatText(fx, event.x, event.y - 14, `+${event.points}`, '#ffd966');
					if (event.multiplier > this.#lastMultiplier) {
						floatText(fx, sim.shipX, SHIP_Y - 46, `×${event.multiplier}`, '#ffe9a0', true);
						sound.play('chime', 0.6);
					} else if (event.full) {
						sound.play('pickup', 0.7);
					} else {
						sound.play('pickup', 0.5 + Math.min(0.4, event.multiplier * 0.08));
					}
					this.#lastMultiplier = event.multiplier;
					buzz.play(0.12 + Math.min(0.2, event.multiplier * 0.04));
					break;
				}
				case 'near-miss':
					floatText(fx, event.x, event.y - 30, m.grain_near_miss(), '#9be7ff');
					shake(fx, 2.2, 160);
					sound.play('whoosh', 0.7);
					buzz.play(0.25);
					break;
				case 'hit': {
					const big = event.hazard !== 'drone';
					explosion(fx, event.x, event.y, big ? 1.15 : 0.9, rnd);
					if (event.spilled > 0) {
						grainBurst(fx, sim.shipX, SHIP_Y, event.spilled * 3, true, rnd);
						floatText(
							fx,
							sim.shipX,
							SHIP_Y - 54,
							m.grain_spilled({ count: event.spilled }),
							'#ffb199'
						);
					}
					floatText(fx, sim.shipX, SHIP_Y - 30, m.grain_hit(), '#ff6b5e', true);
					this.#lastMultiplier = 1;
					this.hits++;
					sound.play(event.hazard === 'mine' ? 'mine-explosion' : 'explosion-small', 1);
					if (event.spilled > 0) sound.play('splash', 0.7);
					buzz.play(event.lives <= 0 ? 1 : 0.8);
					break;
				}
				case 'buoy':
					if (event.healed) {
						heal(fx, event.x, event.y, rnd);
						flash(fx, '#8dffb0', 300);
						floatText(fx, event.x, event.y - 18, m.grain_repaired(), '#8dffb0', true);
						sound.play('chime', 0.8);
						buzz.play(0.3);
					} else {
						floatText(fx, event.x, event.y - 18, `+${event.points}`, '#ffd966');
						splash(fx, event.x, event.y, 0.6, rnd);
						sound.play('ding', 0.6);
						buzz.play(0.15);
					}
					break;
				case 'escort':
					heal(fx, event.x, event.fromPort ? SHIP_Y - 20 : event.y, rnd);
					floatText(fx, event.x, SHIP_Y - 70, m.grain_sweeper_ready(), '#6dffb7', true);
					sound.play('chime', 0.7);
					buzz.play(0.25);
					break;
				case 'sweep': {
					sweepWave(fx, event.x, event.y);
					for (const mine of event.cleared) explosion(fx, mine.x, mine.y, 0.55, rnd);
					flash(fx, '#6dffb7', 240);
					floatText(
						fx,
						event.x,
						SHIP_Y - 70,
						m.grain_swept({ count: event.cleared.length }),
						'#6dffb7',
						true
					);
					this.sweeps++;
					sound.play('sparkle', 0.9);
					sound.play('mine-explosion', 0.45);
					buzz.play(0.55);
					break;
				}
				case 'delivery':
					grainBurst(fx, sim.shipX, SHIP_Y - 10, 18, false, rnd);
					floatText(
						fx,
						sim.shipX,
						SHIP_Y - 86,
						m.grain_delivered({ crates: event.crates, points: event.points }),
						'#ffd966',
						true
					);
					sound.play('chime-big', 0.9);
					buzz.play(0.5);
					break;
				case 'patrol-warning':
					sound.play('alarm', 0.3);
					buzz.play(0.12);
					break;
				case 'milestone':
					floatText(
						fx,
						sim.shipX,
						SHIP_Y - 110,
						m.grain_port_reached({ port: event.port }),
						'#ffe9a0',
						true
					);
					sound.play('ding', 0.9);
					break;
				case 'wave':
					this.#announce(event.wave, event.threat);
					sound.play('alarm', 0.4);
					buzz.play(0.4);
					break;
				case 'game-over':
					sound.play('game-over', 0.9);
					buzz.play(1);
					break;
			}
		}
	}

	#sync() {
		const s = this.sim;
		this.score = finalScore(s);
		this.lives = s.lives;
		this.maxLives = s.maxLives;
		this.hold = s.hold;
		this.holdMax = SHIPS[s.shipId].hold;
		this.sweepers = s.sweepers;
		this.ports = s.ports;
		this.wave = waveAt(s.distance);
		this.distance = Math.floor(s.distance);
		this.chain = s.chain;
		this.multiplier = multiplier(s.chain);
		this.crates = s.crates;
		this.delivered = s.delivered;
		this.bestChain = s.bestChain;
		this.nearMisses = s.nearMisses;
		this.swept = s.swept;
		this.stars = starsFor(s.ports);
	}

	#finish() {
		this.status = 'over';
		const scores = this.#scores();
		const result = scores.submit(GRAIN_BEST_KEY, this.score);
		this.best = result.best;
		this.isNewBest = result.isNewBest;
		this.bestPorts = scores.submit(GRAIN_PORTS_KEY, this.ports).best;
	}
}

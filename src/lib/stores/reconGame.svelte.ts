/*
 * Recon game store: wraps the pure run rules with the screen flow (briefing, flying, debrief,
 * game over), player input, sound, haptics, short-lived screen effects and the personal best.
 * The run itself is a plain object that the canvas reads every frame; only what the page chrome
 * shows is reactive, and it is copied over once per update.
 */
import { prefersReducedMotion } from '#lib/game/loop.js';
import { MAX_INTEGRITY, MISSILE_FLIGHT_S } from '#lib/game/recon/config.js';
import {
	inferRole,
	nextSensor,
	type Dossier,
	type Role,
	type Sensor
} from '#lib/game/recon/contacts.js';
import {
	clear,
	contactAt,
	createRun,
	deselect,
	nextSortie,
	panBy,
	panTo,
	setSensor,
	stepRun,
	strike,
	tapContact,
	track,
	type OverReason,
	type ReconEvent,
	type Run,
	type SortieResult
} from '#lib/game/recon/run.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const RECON_SCORE_KEY = ['recon', 'score'] as const;

/** Briefing before the first sortie, flying, between sorties, paused, or the run is over */
export type ReconStatus = 'ready' | 'playing' | 'paused' | 'debrief' | 'over';

export type ReconBanner = 'threat' | 'noOrdnance';

/** Scope pan speed of the keyboard, in world units per second */
const KEY_PAN_SPEED = 240;
/** The last strike and its blast stay on screen this long before the debrief or game over card */
const END_DELAY_MS = 1100;
const BANNER_MS = 2400;
const SWITCH_MS = 180;
const SHAKE_MS = 320;
const FLASH_MS = 300;

export interface ReconGameOptions {
	/** Injected for tests; defaults to the browser's local storage */
	scores?: Highscores;
	/** Injected for tests; the random source for the maps */
	random?: Random;
}

interface PendingImpact {
	at: number;
	role: Role;
}

const sameDossier = (a: Dossier | null, b: Dossier | null) =>
	a === b || (a !== null && b !== null && a.eo === b.eo && a.ir === b.ir && a.sar === b.sar);

export class ReconGame {
	status = $state<ReconStatus>('ready');
	sortie = $state(1);
	score = $state(0);
	/** Seconds left on the sortie clock, rounded up for display */
	timeLeft = $state(0);
	ordnance = $state(0);
	integrity = $state(MAX_INTEGRITY);
	escalation = $state(0);
	sensor = $state<Sensor>('eo');
	threatened = $state(false);
	banner = $state<ReconBanner | null>(null);
	/** The selected contact: 1-based number for display, what the sensors have logged so far */
	selectedNumber = $state<number | null>(null);
	dossier = $state.raw<Dossier | null>(null);
	/** What the dossier proves; null while readings are missing. Never reveals the hidden role */
	verdictReady = $state(false);
	suggestedSensor = $state<Sensor | null>(null);
	locking = $state(false);
	result = $state.raw<SortieResult | null>(null);
	overReason = $state<OverReason | null>(null);
	bestSortie = $state(0);
	sortiesFlown = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	run: Run;
	timeMs = 0;
	switchMs = 0;
	flashMs = 0;
	flashBad = false;
	shakeMs = 0;
	readonly reducedMotion = prefersReducedMotion();

	#scores: Highscores;
	#random: Random;
	#pending: PendingImpact[] = [];
	#endDelayMs = 0;
	#bannerMs = 0;
	#held = { x: 0, y: 0 };

	constructor(options: ReconGameOptions = {}) {
		this.#scores = options.scores ?? highscores();
		this.#random = options.random ?? createRandom(randomSeed());
		this.best = this.#scores.get(RECON_SCORE_KEY);
		this.run = createRun(this.#random);
		this.#sync();
	}

	get playing(): boolean {
		return this.status === 'playing';
	}

	/** Takes off for the first sortie from the briefing */
	start() {
		if (this.status !== 'ready') return;
		this.status = 'playing';
		soundManager().play('ui-tap');
	}

	/** A fresh run after a game over */
	retry() {
		this.run = createRun(this.#random);
		this.result = null;
		this.bestSortie = 0;
		this.sortiesFlown = 0;
		this.overReason = null;
		this.isNewBest = false;
		this.#reset();
		this.status = 'playing';
		this.#sync();
		soundManager().play('ui-tap');
	}

	/** Flies the next sortie from the debrief card */
	launchNext() {
		if (this.status !== 'debrief') return;
		nextSortie(this.run);
		this.result = null;
		this.#reset();
		this.status = 'playing';
		this.#sync();
		soundManager().play('ui-tap');
	}

	pause() {
		if (this.status !== 'playing') return;
		this.status = 'paused';
		this.#held = { x: 0, y: 0 };
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** Moves the scope by a drag, in world units */
	pan(dx: number, dy: number) {
		if (this.status !== 'playing') return;
		panBy(this.run, dx, dy);
	}

	panTo(x: number, y: number) {
		if (this.status !== 'playing') return;
		panTo(this.run, x, y);
	}

	/** Held keyboard pan direction, each axis -1, 0 or 1 */
	setKeyPan(x: number, y: number) {
		this.#held = { x, y };
	}

	chooseSensor(sensor: Sensor) {
		if (this.status !== 'playing' || this.run.sensor === sensor) return;
		setSensor(this.run, sensor);
		this.switchMs = SWITCH_MS;
		soundManager().play('ui-toggle');
		// Keep the selected contact: the new sensor starts reading it straight away
		if (this.run.selected !== null) tapContact(this.run, this.run.selected);
		this.#sync();
	}

	/** A tap on the scope at a world position: selects the contact there or drops the selection */
	tapAt(x: number, y: number) {
		if (this.status !== 'playing') return;
		const id = contactAt(this.run, x, y);
		if (id === null) {
			deselect(this.run);
		} else {
			tapContact(this.run, id);
			soundManager().play('click');
		}
		this.#sync();
	}

	/** Fires a missile at the selected contact; returns whether one was launched */
	strike(): boolean {
		const id = this.run.selected;
		if (this.status !== 'playing' || id === null) return false;
		const launched = strike(this.run, id);
		if (!launched) {
			soundManager().play('ui-error');
			return false;
		}
		soundManager().play('whoosh');
		this.#drain();
		this.#sync();
		return true;
	}

	/** Marks the selected contact harmless; returns whether it was cleared */
	clearSelected(): boolean {
		const id = this.run.selected;
		if (this.status !== 'playing' || id === null) return false;
		const cleared = clear(this.run, id);
		if (cleared) {
			this.#drain();
			this.#sync();
		}
		return cleared;
	}

	/** Advances the run by one fixed step of the game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		this.timeMs += dtMs;
		this.switchMs = Math.max(0, this.switchMs - dtMs);
		this.flashMs = Math.max(0, this.flashMs - dtMs);
		this.shakeMs = Math.max(0, this.shakeMs - dtMs);
		if (this.#bannerMs > 0) {
			this.#bannerMs -= dtMs;
			if (this.#bannerMs <= 0) this.banner = null;
		}
		const dt = dtMs / 1000;
		if (this.#held.x !== 0 || this.#held.y !== 0) {
			panBy(this.run, this.#held.x * KEY_PAN_SPEED * dt, this.#held.y * KEY_PAN_SPEED * dt);
		}

		stepRun(this.run, dt);
		this.#drain();

		if (this.run.phase !== 'active') {
			this.#endDelayMs += dtMs;
			if (this.#endDelayMs >= END_DELAY_MS) this.#finishSortie();
		}
		this.#sync();
	}

	#reset() {
		this.#pending = [];
		this.#endDelayMs = 0;
		this.#bannerMs = 0;
		this.banner = null;
		this.switchMs = 0;
		this.flashMs = 0;
		this.shakeMs = 0;
	}

	#showBanner(kind: ReconBanner) {
		this.banner = kind;
		this.#bannerMs = BANNER_MS;
	}

	#drain() {
		const { run } = this;
		for (const event of run.events.splice(0)) this.#onEvent(event);
		// Blasts land when the missile arrives, not when it leaves
		for (const impact of this.#pending.splice(0)) {
			if (run.clock >= impact.at) this.#land(impact.role);
			else this.#pending.push(impact);
		}
	}

	#onEvent(event: ReconEvent) {
		switch (event.kind) {
			case 'lock-start':
				break;
			case 'lock-done':
				soundManager().play('ding');
				haptic().play(0.15);
				break;
			case 'launch':
				break;
			case 'impact':
				this.#pending.push({ at: this.run.clock + MISSILE_FLIGHT_S, role: event.role });
				// The last missile is gone while contacts are still open
				if (
					this.run.ordnance === 0 &&
					this.run.phase === 'active' &&
					this.run.tracks.some((t) => t.status === 'open')
				) {
					this.#showBanner('noOrdnance');
				}
				break;
			case 'cleared':
				soundManager().play('pop');
				break;
			case 'threat':
				this.#showBanner('threat');
				soundManager().play('alarm');
				haptic().play(0.5);
				break;
			case 'sortie-end':
				this.sortiesFlown = event.result.sortie;
				this.bestSortie = Math.max(this.bestSortie, event.result.total);
				if (event.result.ended === 'done') soundManager().play('chime');
				break;
			case 'over':
				break;
		}
	}

	#land(role: Role) {
		this.shakeMs = this.reducedMotion ? 0 : SHAKE_MS;
		this.flashBad = role !== 'hostile';
		this.flashMs = FLASH_MS;
		if (role === 'hostile') {
			soundManager().play('explosion-big');
			haptic().play(0.6);
		} else if (role === 'civilian') {
			soundManager().play('explosion-small');
			soundManager().play('ui-error');
			haptic().play(1);
		} else {
			soundManager().play('thud');
			haptic().play(0.4);
		}
	}

	#finishSortie() {
		this.result = this.run.result;
		if (this.run.phase === 'over') {
			this.overReason = this.run.overReason;
			const submitted = this.#scores.submit(RECON_SCORE_KEY, this.run.score);
			this.isNewBest = submitted.isNewBest;
			this.best = submitted.best;
			this.status = 'over';
			soundManager().play(this.run.overReason === 'won' ? 'chime-big' : 'game-over');
		} else {
			this.status = 'debrief';
		}
		this.#held = { x: 0, y: 0 };
		this.#sync();
	}

	#sync() {
		const { run } = this;
		this.sortie = run.sortie;
		this.score = run.score;
		this.timeLeft = Math.ceil(Math.max(0, run.timeLeft));
		this.ordnance = run.ordnance;
		this.integrity = Math.round(run.integrity);
		this.escalation = Math.round(run.escalation);
		this.sensor = run.sensor;
		this.threatened = run.threatened;
		this.locking = run.lock !== null;

		const selected = run.selected === null ? undefined : track(run, run.selected);
		if (selected) {
			this.selectedNumber = run.tracks.indexOf(selected) + 1;
			if (!sameDossier(this.dossier, selected.dossier)) this.dossier = { ...selected.dossier };
			this.verdictReady = inferRole(selected.dossier) !== null;
			this.suggestedSensor = nextSensor(selected.dossier);
		} else {
			this.selectedNumber = null;
			this.dossier = null;
			this.verdictReady = false;
			this.suggestedSensor = null;
		}
	}
}

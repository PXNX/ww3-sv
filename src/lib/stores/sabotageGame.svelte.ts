/*
 * Gig Saboteur game state: a run of jobs with three strikes, the level select with saved stars, and
 * the screens around a job (job card, playing, paused, cleared, busted, run over). The simulation
 * lives in $lib/game/sabotage; this store feeds it input, turns its events into sounds, haptics and
 * effects for the canvas, and keeps the numbers the HUD shows.
 */
import { STRIKES } from '#lib/game/sabotage/config.js';
import { LEVELS, LEVEL_COUNT, LEVEL_IDS, type Level } from '#lib/game/sabotage/levels.js';
import {
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	isSabotageProgress,
	isUnlocked,
	recordFinish,
	totalStars,
	type SabotageProgress
} from '#lib/game/sabotage/progress.js';
import {
	createSabotage,
	jobResult,
	step,
	targetInReach,
	targetsLeft,
	throwPhone,
	type Input,
	type JobResult,
	type SabotageEvent,
	type SabotageState
} from '#lib/game/sabotage/state.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const SABOTAGE_BEST_KEY = ['sabotage', 'score'] as const;

export type SabotageScreen =
	'select' | 'card' | 'playing' | 'paused' | 'cleared' | 'busted' | 'over';

/** A short-lived mark on the map, drawn by the canvas */
export interface Effect {
	kind: 'alert' | 'investigate' | 'noise' | 'boom' | 'phone';
	x: number;
	y: number;
	/** Dogs and guards look different */
	dog?: boolean;
	age: number;
	ttl: number;
}

export interface RunStats {
	strikes: number;
	total: number;
	jobs: number;
	stars: number;
}

const EFFECT_TTL: Record<Effect['kind'], number> = {
	alert: 1.1,
	investigate: 0.9,
	noise: 0.7,
	boom: 0.9,
	phone: 1.2
};

/** Keys that walk, by direction */
const KEY_DIRECTION: Record<string, [number, number]> = {
	ArrowUp: [0, -1],
	KeyW: [0, -1],
	ArrowDown: [0, 1],
	KeyS: [0, 1],
	ArrowLeft: [-1, 0],
	KeyA: [-1, 0],
	ArrowRight: [1, 0],
	KeyD: [1, 0]
};

export const isMoveKey = (code: string): boolean => code in KEY_DIRECTION;

export interface SabotageGameOptions {
	scores?: Highscores;
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
}

export class SabotageGame {
	screen = $state<SabotageScreen>('select');
	levelIndex = $state(0);
	progress = $state.raw<SabotageProgress>(EMPTY_PROGRESS);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** The current run, or null while choosing a job */
	run = $state<RunStats | null>(null);
	/** Whether the finished run reached the last job */
	runWon = $state(false);
	result = $state.raw<JobResult | null>(null);

	// What the HUD shows, refreshed after every step
	suspicion = $state(0);
	seconds = $state(0);
	targetsDone = $state(0);
	targetCount = $state(0);
	phoneLeft = $state(1);
	/** 0 to 1 while a target is being worked on */
	working = $state(0);
	canWork = $state(false);
	phoneArmed = $state(false);
	/** Counts up on every bust, so the page can flash the field */
	bustCount = $state(0);

	/** The running simulation, read by the canvas every frame (not reactive) */
	sim = $state.raw<SabotageState | null>(null);
	effects: Effect[] = [];
	/** 0 to 1, decays by itself; the canvas turns it into a screen shake */
	shake = 0;

	#scores: Highscores;
	#store: () => Store;
	#keys = new Set<string>();
	#stick = { x: 0, y: 0 };
	#sprintButton = false;
	#holdButton = false;
	#submitted = false;

	constructor({ scores = highscores(), store = localStore }: SabotageGameOptions = {}) {
		this.#scores = scores;
		this.#store = store;
		this.progress = this.#store().read(PROGRESS_KEY, EMPTY_PROGRESS, isSabotageProgress);
		this.best = this.#scores.get(SABOTAGE_BEST_KEY);
	}

	get level(): Level {
		return LEVELS[this.levelIndex];
	}

	get levels(): readonly Level[] {
		return LEVELS;
	}

	get totalStars(): number {
		return totalStars(this.progress, LEVEL_IDS);
	}

	get maxStars(): number {
		return LEVEL_COUNT * 3;
	}

	get score(): number {
		return this.run?.total ?? 0;
	}

	get hasNextJob(): boolean {
		return this.levelIndex + 1 < LEVEL_COUNT;
	}

	starsOf(index: number): number | null {
		return this.progress.stars[LEVEL_IDS[index]] ?? null;
	}

	unlocked(index: number): boolean {
		return isUnlocked(this.progress, LEVEL_IDS, index);
	}

	/** Starts a run at an open job and shows its job card */
	startRun(index: number): boolean {
		if (!this.unlocked(index)) return false;
		this.run = { strikes: STRIKES, total: 0, jobs: 0, stars: 0 };
		this.runWon = false;
		this.isNewBest = false;
		this.#submitted = false;
		this.levelIndex = index;
		this.screen = 'card';
		soundManager().play('ui-tap');
		return true;
	}

	/** Leaves the job card for the job itself */
	startJob() {
		if (!this.run) return;
		this.sim = createSabotage(this.level);
		this.effects = [];
		this.shake = 0;
		this.result = null;
		this.phoneArmed = false;
		this.#resetInput();
		this.#syncHud();
		this.screen = 'playing';
		soundManager().play('door-creak');
	}

	pause() {
		if (this.screen !== 'playing') return;
		this.screen = 'paused';
		this.phoneArmed = false;
		this.#resetInput();
	}

	resume() {
		if (this.screen === 'paused') this.screen = 'playing';
	}

	togglePause() {
		if (this.screen === 'playing') this.pause();
		else this.resume();
	}

	/** Starts the same job again from the top (a restart does not cost a strike) */
	restartJob() {
		if (this.screen !== 'paused') return;
		this.startJob();
	}

	/** After a bust with strikes left: try the job again */
	retryJob() {
		if (this.screen !== 'busted') return;
		this.startJob();
	}

	/** After a cleared job: the next job's card, or the end of the run after the last one */
	nextJob() {
		if (this.screen !== 'cleared') return;
		if (this.hasNextJob) {
			this.levelIndex += 1;
			this.screen = 'card';
			soundManager().play('ui-tap');
		} else {
			this.#finishRun(true);
		}
	}

	/** Gives up the run (what has been earned still counts) and goes back to the job list */
	backToSelect() {
		if (this.run && this.run.total > 0 && !this.#submitted) this.#submit();
		this.run = null;
		this.sim = null;
		this.screen = 'select';
		this.phoneArmed = false;
		this.#resetInput();
	}

	// --- Input -------------------------------------------------------------------------------

	setKey(code: string, down: boolean) {
		if (down) this.#keys.add(code);
		else this.#keys.delete(code);
	}

	/** The joystick: each axis -1 to 1, length up to 1 */
	setStick(x: number, y: number) {
		this.#stick = { x, y };
	}

	setSprint(down: boolean) {
		this.#sprintButton = down;
	}

	setHold(down: boolean) {
		this.#holdButton = down;
	}

	/** Arms the phone: the next tap on the map throws it there */
	armPhone() {
		if (this.screen !== 'playing' || !this.sim || this.sim.phoneLeft <= 0) return;
		this.phoneArmed = !this.phoneArmed;
		soundManager().play('ui-toggle');
	}

	/** Throws the armed phone at a spot, in tiles */
	throwAt(x: number, y: number): boolean {
		if (!this.phoneArmed || this.screen !== 'playing' || !this.sim) return false;
		this.phoneArmed = false;
		this.#handle(throwPhone(this.sim, x, y));
		this.#syncHud();
		return true;
	}

	#resetInput() {
		this.#keys.clear();
		this.#stick = { x: 0, y: 0 };
		this.#sprintButton = false;
		this.#holdButton = false;
	}

	#input(): Input {
		let x = this.#stick.x;
		let y = this.#stick.y;
		if (Math.hypot(x, y) < 0.08) {
			x = 0;
			y = 0;
			for (const code of this.#keys) {
				const direction = KEY_DIRECTION[code];
				if (direction) {
					x += direction[0];
					y += direction[1];
				}
			}
			const length = Math.hypot(x, y);
			if (length > 1) {
				x /= length;
				y /= length;
			}
		}
		const keys = this.#keys;
		return {
			x,
			y,
			sprint: this.#sprintButton || keys.has('ShiftLeft') || keys.has('ShiftRight'),
			sneak: keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC'),
			hold: this.#holdButton || keys.has('Space') || keys.has('KeyE')
		};
	}

	// --- Simulation --------------------------------------------------------------------------

	/** One fixed step of the loop, in milliseconds */
	update(dtMs: number) {
		this.#ageEffects(dtMs / 1000);
		const sim = this.sim;
		if (this.screen !== 'playing' || !sim) return;
		const events = step(sim, dtMs / 1000, this.#input());
		this.#handle(events);
		this.#syncHud();
		if (sim.phase === 'busted') this.#onBusted();
		else if (sim.phase === 'cleared') this.#onCleared(sim);
	}

	#ageEffects(dt: number) {
		for (const effect of this.effects) effect.age += dt;
		this.effects = this.effects.filter((effect) => effect.age < effect.ttl);
		this.shake = Math.max(0, this.shake - dt * 2.2);
	}

	#syncHud() {
		const sim = this.sim;
		if (!sim) return;
		this.suspicion = sim.suspicion;
		this.seconds = sim.time;
		this.targetCount = sim.targets.length;
		this.targetsDone = sim.targets.length - targetsLeft(sim);
		this.phoneLeft = sim.phoneLeft;
		this.working = sim.working >= 0 ? sim.targets[sim.working].progress : 0;
		this.canWork = targetInReach(sim) >= 0;
	}

	#addEffect(kind: Effect['kind'], x: number, y: number, dog = false) {
		this.effects.push({ kind, x, y, dog, age: 0, ttl: EFFECT_TTL[kind] });
	}

	#handle(events: SabotageEvent[]) {
		const sound = soundManager();
		for (const event of events) {
			switch (event.type) {
				case 'alert':
					this.#addEffect('alert', event.x, event.y, event.kind === 'dog');
					sound.play(event.kind === 'dog' ? 'cat-hiss' : 'ui-error', 0.7);
					haptic().play(0.15);
					break;
				case 'investigate':
					this.#addEffect('investigate', event.x, event.y, event.kind === 'dog');
					sound.play('pop', 0.5);
					break;
				case 'noise':
					this.#addEffect('noise', event.x, event.y);
					sound.play('thud', 0.35);
					break;
				case 'phone':
					this.#addEffect('phone', event.x, event.y);
					sound.play('ding');
					break;
				case 'sabotage-cancel':
					sound.play('ui-toggle', 0.5);
					break;
				case 'target-done':
					this.#addEffect('boom', event.x, event.y);
					this.shake = Math.max(this.shake, 0.5);
					sound.play('explosion-small');
					haptic().play(0.5);
					break;
				case 'exit-open':
					sound.play('chime');
					break;
				case 'busted':
					this.shake = 1;
					sound.play('alarm');
					haptic().play(0.9);
					break;
				case 'cleared':
					sound.play('chime-big');
					haptic().play(0.4);
					break;
			}
		}
	}

	#onBusted() {
		this.bustCount += 1;
		const run = this.run;
		if (!run) return;
		run.strikes -= 1;
		if (run.strikes <= 0) this.#finishRun(false);
		else this.screen = 'busted';
	}

	#onCleared(sim: SabotageState) {
		const result = jobResult(sim);
		this.result = result;
		this.progress = recordFinish(this.progress, this.level.id, result.count);
		this.#store().write(PROGRESS_KEY, this.progress);
		const run = this.run;
		if (run) {
			run.total += result.payout;
			run.jobs += 1;
			run.stars += result.count;
		}
		this.screen = 'cleared';
	}

	#finishRun(won: boolean) {
		this.runWon = won;
		this.screen = 'over';
		this.#submit();
		soundManager().play(won ? 'new-best' : 'game-over');
	}

	#submit() {
		if (!this.run || this.#submitted) return;
		this.#submitted = true;
		const result = this.#scores.submit(SABOTAGE_BEST_KEY, this.run.total);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
	}
}

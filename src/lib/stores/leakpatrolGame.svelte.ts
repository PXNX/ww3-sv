/*
 * Leak Patrol game store: wraps the pure rules with finger input, toasts, shake, sounds and the
 * personal best. The rules live in a plain state object; the meters, leaks and pickups the page
 * shows are copied into reactive fields after every step (they change continuously).
 */
import { STARTING_LIVES } from '#lib/game/leakpatrol/config.js';
import {
	answerDialog,
	armTool,
	collectPickup,
	createGame,
	holdLeak,
	releaseLeak,
	step,
	type Leak,
	type LeakPatrolEvent,
	type LeakPatrolState,
	type Pickup
} from '#lib/game/leakpatrol/state.js';
import { pluggingIds } from '#lib/game/leakpatrol/fingers.js';
import type { Inventory, ToolKind } from '#lib/game/leakpatrol/tools.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import { roomName } from '#lib/components/leakpatrolText.js';

export type LeakPatrolStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['leakpatrol', 'score'] as const;

const TOAST_MS = 1300;

export interface Toast {
	id: number;
	text: string;
}

export interface LeakPatrolOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class LeakPatrolGame {
	status = $state<LeakPatrolStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	wave = $state(1);
	/** Seconds survived, whole */
	seconds = $state(0);
	plugged = $state(0);
	absorbed = $state(0);
	dismissed = $state(0);
	rooms = $state.raw<number[]>([]);
	leaks = $state.raw<Leak[]>([]);
	pickups = $state.raw<Pickup[]>([]);
	/** Ids of the leaks that are being plugged by a finger that counts */
	plugging = $state.raw<number[]>([]);
	tools = $state.raw<Inventory>({ sharpie: 0, tape: 0, folder: 0 });
	armed = $state<ToolKind | null>(null);
	/** The group chat dialog: fraction of its time left, 1 to 0, or null when it is not up */
	dialog = $state<number | null>(null);
	toast = $state.raw<Toast | null>(null);
	/** The note about a new news cycle */
	waveNote = $state.raw<Toast | null>(null);
	/** Counts up on every flood, so the field can shake and flash */
	hurtCount = $state(0);
	burstCount = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: LeakPatrolState;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#toastMs = 0;
	#waveMs = 0;
	#toastId = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: LeakPatrolOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame();
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame();
		this.toast = null;
		this.waveNote = null;
		this.isNewBest = false;
		this.hurtCount = 0;
		this.burstCount = 0;
		this.#toastMs = 0;
		this.#waveMs = 0;
		this.#sync();
		this.status = 'playing';
	}

	pause() {
		if (this.status === 'playing') {
			this.state.held = [];
			this.status = 'paused';
			this.#sync();
		}
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A finger comes down on a leak (or a tool is applied to it) */
	hold(leakId: number) {
		if (this.status !== 'playing') return;
		this.#apply(holdLeak(this.state, leakId));
	}

	/** A finger lifts from a leak */
	release(leakId: number) {
		releaseLeak(this.state, leakId);
		this.#sync();
	}

	/** Lifts every finger, for example when the window loses focus */
	releaseAll() {
		this.state.held = [];
		this.#sync();
	}

	/** The player grabs a tool lying in a room */
	collect(pickupId: number) {
		if (this.status !== 'playing') return;
		this.#apply(collectPickup(this.state, pickupId));
	}

	/** The player takes a tool out of the tray, or puts it back */
	arm(tool: ToolKind) {
		if (this.status !== 'playing') return;
		this.#apply(armTool(this.state, tool));
	}

	/** The player answers the group chat dialog: no is safe */
	answer(accept: boolean) {
		if (this.status !== 'playing') return;
		this.#apply(answerDialog(this.state, accept, this.#random));
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		if (this.waveNote && (this.#waveMs -= dtMs) <= 0) this.waveNote = null;
		this.#apply(step(this.state, dtMs, this.#random));
	}

	/** Draws the West Wing onto the shared score card: six rooms with their water level */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const gap = size * 0.05;
		const width = (size - gap * 4) / 3;
		const height = (size - gap * 3) / 2;
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeStyle = '#111111';
		this.state.rooms.forEach((level, i) => {
			const left = x + gap + (i % 3) * (width + gap);
			const top = y + gap + Math.floor(i / 3) * (height + gap);
			context.fillStyle = '#ffffff';
			context.fillRect(left, top, width, height);
			const water = height * Math.min(1, level);
			context.fillStyle = '#4fa8d8';
			context.fillRect(left, top + height - water, width, water);
			context.strokeRect(left, top, width, height);
		});
		context.fillStyle = '#4fa8d8';
		for (const leak of this.state.leaks) {
			const left = x + gap + (leak.room % 3) * (width + gap) + width / 2;
			const top = y + gap + Math.floor(leak.room / 3) * (height + gap) + height * 0.2;
			context.beginPath();
			context.arc(left, top, size * 0.025, 0, Math.PI * 2);
			context.fill();
			context.stroke();
		}
	};

	#apply(events: LeakPatrolEvent[]) {
		for (const event of events) this.#handle(event);
		this.#sync();
		if (this.state.phase === 'over' && this.status === 'playing') this.#finish();
	}

	#handle(event: LeakPatrolEvent) {
		switch (event.type) {
			case 'drip':
				this.#play('splash', 0.35);
				break;
			case 'open':
				if (event.big) this.#play('alarm', 0.7);
				break;
			case 'plug':
				this.#showToast(m.leakpatrol_popup_plugged({ room: roomName(event.room) }));
				this.#play(event.how === 'sharpie' ? 'chime' : 'pop', 0.8);
				break;
			case 'tape':
				this.#showToast(m.leakpatrol_popup_taped());
				this.#play('click', 0.8);
				break;
			case 'untape':
				this.#showToast(m.leakpatrol_popup_untaped({ room: roomName(event.room) }));
				this.#play('ui-toggle', 0.6);
				break;
			case 'pickup-spawn':
				this.#play('ding', 0.5);
				break;
			case 'pickup':
				if (event.full) this.#showToast(m.leakpatrol_popup_full());
				else this.#play('pickup', 0.8);
				break;
			case 'arm':
				this.#play('ui-tap', 0.6);
				break;
			case 'dialog':
				this.#play('ding', 0.9);
				break;
			case 'dismiss':
				this.#showToast(m.leakpatrol_popup_dismissed());
				this.#play('click', 0.7);
				break;
			case 'burst':
				this.burstCount += 1;
				this.#showToast(
					event.absorbed ? m.leakpatrol_popup_absorbed() : m.leakpatrol_popup_burst()
				);
				this.#play(event.absorbed ? 'chime' : 'thud', 0.9);
				break;
			case 'wave':
				this.waveNote = {
					id: ++this.#toastId,
					text: m.leakpatrol_popup_wave({ wave: event.wave })
				};
				this.#waveMs = TOAST_MS * (this.reducedMotion ? 1.4 : 1);
				this.#play('whoosh', 0.8);
				break;
			case 'flood':
				this.hurtCount += 1;
				this.#showToast(m.leakpatrol_popup_flood({ room: roomName(event.room) }));
				this.#play('splash', 1);
				this.#play('ui-error', 0.8);
				break;
			case 'game-over':
				break;
		}
	}

	#showToast(text: string) {
		this.toast = { id: ++this.#toastId, text };
		this.#toastMs = TOAST_MS * (this.reducedMotion ? 1.4 : 1);
	}

	#play(id: SoundId, intensity: number) {
		soundManager().play(id, intensity);
	}

	#sync() {
		const state = this.state;
		this.score = state.score;
		this.lives = state.lives;
		this.wave = state.wave;
		this.seconds = Math.floor(state.elapsedMs / 1000);
		this.plugged = state.plugged;
		this.absorbed = state.absorbed;
		this.dismissed = state.dismissed;
		this.rooms = [...state.rooms];
		this.leaks = state.leaks.map((leak) => ({ ...leak }));
		this.pickups = state.pickups.map((pickup) => ({ ...pickup }));
		this.plugging = pluggingIds(state.held);
		this.tools = { ...state.tools };
		this.armed = state.armed;
		this.dialog = state.dialog ? Math.max(0, state.dialog.leftMs / state.dialog.windowMs) : null;
	}

	#finish() {
		const result = this.#scores().submit(SCORE_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.status = 'over';
	}
}

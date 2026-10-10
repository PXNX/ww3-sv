/*
 * Purr Pentagram game store: wraps the pure ritual logic with the player's pointer gestures (a slow
 * stroke inside a cat's circle pets it, dragging out of the circle draws the star), the sounds,
 * the sustained purrs and the finale music, the reduce-motion setting and the personal best.
 *
 * The ritual state is reactive on purpose: the board is a small SVG that redraws from it, and only
 * a handful of values change per frame.
 */
import { CAT_RADIUS, FIELD, STARTING_LIVES } from '#lib/game/purrpentagram/config.js';
import { finaleStage } from '#lib/game/purrpentagram/finale.js';
import {
	circleAt,
	insideCircle,
	seatPosition,
	type Point
} from '#lib/game/purrpentagram/geometry.js';
import { purrVoice } from '#lib/game/purrpentagram/purr.js';
import {
	createRitual,
	scoreOf,
	type RitualEvent,
	type RitualState
} from '#lib/game/purrpentagram/state.js';
import {
	beginPet,
	connect,
	endPet,
	nudgePet,
	petMove,
	stepRitual
} from '#lib/game/purrpentagram/step.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { prefersReducedMotion } from '#lib/game/loop.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import { PurrMixer } from '#lib/sound/purrMixer.js';
import type { RoomEvent } from '#lib/game/purrpentagram/reactions.js';

export type PurrPentagramStatus = 'ready' | 'playing' | 'paused' | 'won' | 'over';

/** A short line of feedback under the board; the page turns the kind into text */
export type NoticeKind = 'mistake' | 'not-ready' | 'out-of-turn' | 'too-fast';

const SCORE_KEY = ['purrpentagram', 'score'] as const;
const MOTION_KEY = 'purrpentagram:reduce-motion';
const NOTICE_MS = 2800;
/** The purrs sent to the mixer are refreshed at this interval: fast enough to follow a stroke */
const MIXER_SYNC_MS = 40;
/** How loud and steady every cat purrs while the finale plays */
const FINALE_PURR = 0.55;

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** Sound of each room event as it begins; the dim lights and the laser dot are silent */
const EVENT_SOUND: Partial<Record<RoomEvent, SoundId>> = {
	candles: 'candle-snuff',
	draft: 'draft',
	thunder: 'thunder',
	creak: 'door-creak'
};

export interface PurrPentagramOptions {
	/** Starting value of the reduce-motion setting when none was saved; defaults to the OS preference */
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Injected for tests; defaults to the browser's local storage */
	settings?: () => Store;
	/** Fixed seed for tests; a fresh random seed per ritual otherwise */
	seed?: () => number;
	/** Injected for tests; defaults to the real mixer */
	mixer?: PurrMixer;
}

interface Gesture {
	cat: number;
	mode: 'pet' | 'stroke';
}

/** The star stroke being dragged, for drawing the rubber band */
export interface Drag {
	from: number;
	x: number;
	y: number;
	/** The cat under the finger, if it is another cat */
	over: number | null;
}

export class PurrPentagramGame {
	status = $state<PurrPentagramStatus>('ready');
	state: RitualState = $state(createRitual(1));
	lives = $state(STARTING_LIVES);
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	drag = $state<Drag | null>(null);
	/** The cat chosen with the keyboard as the start of the next star stroke */
	anchor = $state<number | null>(null);
	notice = $state<{ kind: NoticeKind; id: number } | null>(null);
	reducedMotion = $state(false);

	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#settings: () => Store;
	#seed: () => number;
	#mixer: PurrMixer;
	#gesture: Gesture | null = null;
	#noticeMs = 0;
	#noticeCount = 0;
	#mixerMs = 0;
	#mutedSent: boolean | null = null;
	#linesHeard = 0;
	#burstHeard = false;

	constructor({
		reducedMotion = prefersReducedMotion(),
		scores = highscores,
		settings = localStore,
		seed = randomSeed,
		mixer = new PurrMixer()
	}: PurrPentagramOptions = {}) {
		this.#scores = scores;
		this.#settings = settings;
		this.#seed = seed;
		this.#mixer = mixer;
		this.reducedMotion = reducedMotion;
	}

	/** Reads the stored best and settings; call in the browser only */
	load() {
		this.best = this.#scores().get(SCORE_KEY);
		this.reducedMotion = this.#settings().read(MOTION_KEY, this.reducedMotion, isBoolean);
	}

	setReducedMotion(reduced: boolean) {
		this.reducedMotion = reduced;
		this.#settings().write(MOTION_KEY, reduced);
	}

	/** Starts audio from a user gesture, as browsers require */
	unlockAudio() {
		this.#mixer.unlock();
	}

	start() {
		const seed = this.#seed();
		this.#random = createRandom(seed);
		this.state = createRitual(seed, this.#random);
		this.#gesture = null;
		this.drag = null;
		this.anchor = null;
		this.notice = null;
		this.#noticeMs = 0;
		this.#linesHeard = 0;
		this.#burstHeard = false;
		this.isNewBest = false;
		this.score = 0;
		this.#silence();
		this.unlockAudio();
		this.#syncChrome();
		this.status = 'playing';
	}

	pause() {
		if (this.status !== 'playing') return;
		this.status = 'paused';
		this.#abortGesture();
		this.#silence();
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** One fixed step: called by the board's game loop */
	update(dtMs: number) {
		if (this.status !== 'playing' && this.status !== 'won') return;
		if (this.#mutedSent !== soundManager().muted) {
			this.#mutedSent = soundManager().muted;
			this.#mixer.setMuted(this.#mutedSent);
		}
		if (this.status === 'won') {
			this.#stepFinale(dtMs);
			return;
		}
		this.#noticeMs -= dtMs;
		if (this.notice && this.#noticeMs <= 0) this.notice = null;
		this.#apply(stepRitual(this.state, this.#random, dtMs));
		this.#syncMixer(dtMs);
	}

	/** A finger went down: petting begins when it landed inside a cat's circle */
	pointerDown(point: Point, t: number): boolean {
		if (this.status !== 'playing') return false;
		this.unlockAudio();
		const cat = circleAt(point, this.#centres());
		if (cat === null) return false;
		this.#gesture = { cat, mode: 'pet' };
		beginPet(this.state, cat);
		this.#apply(petMove(this.state, cat, { ...point, t }));
		return true;
	}

	pointerMove(point: Point, t: number) {
		const gesture = this.#gesture;
		if (!gesture || this.status !== 'playing') return;
		if (gesture.mode === 'pet') {
			if (insideCircle(point, this.#centres()[gesture.cat], CAT_RADIUS)) {
				this.#apply(petMove(this.state, gesture.cat, { ...point, t }));
				return;
			}
			// Out of the circle: this is the star stroke now, and petting stops
			gesture.mode = 'stroke';
			endPet(this.state, gesture.cat);
		}
		const over = circleAt(point, this.#centres());
		this.drag = {
			from: gesture.cat,
			x: point.x,
			y: point.y,
			over: over === gesture.cat ? null : over
		};
	}

	pointerUp(point: Point) {
		const gesture = this.#gesture;
		if (!gesture) return;
		this.#gesture = null;
		this.drag = null;
		if (gesture.mode === 'pet') {
			endPet(this.state, gesture.cat);
			return;
		}
		if (this.status !== 'playing') return;
		const over = circleAt(point, this.#centres());
		if (over !== null && over !== gesture.cat) this.#apply(connect(this.state, gesture.cat, over));
	}

	pointerCancel() {
		this.#abortGesture();
	}

	/** Keyboard: pet the cat gently for a moment (hold or repeat the key to keep it purring) */
	keyPet(cat: number) {
		if (this.status !== 'playing') return;
		this.unlockAudio();
		nudgePet(this.state, cat);
	}

	/**
	 * Keyboard: choose a cat for the star. At the start the first press picks where to begin and the
	 * second press picks the cat to join; once the star is under way every press joins the next cat
	 * from the one the star ended on.
	 */
	keySelect(cat: number) {
		if (this.status !== 'playing') return;
		this.unlockAudio();
		const tip = this.state.chain.at(-1);
		if (tip !== undefined) {
			if (cat !== tip) this.#apply(connect(this.state, tip, cat));
			return;
		}
		if (this.anchor === null) this.anchor = cat;
		else if (this.anchor === cat) this.anchor = null;
		else {
			const from = this.anchor;
			this.anchor = null;
			this.#apply(connect(this.state, from, cat));
		}
	}

	/** Stops the sustained sound and releases the audio device; call when leaving the page */
	dispose() {
		this.#mixer.dispose();
	}

	#centres(): Point[] {
		return this.state.cats.map((cat) => seatPosition(cat.seat));
	}

	#abortGesture() {
		const gesture = this.#gesture;
		this.#gesture = null;
		this.drag = null;
		if (gesture) endPet(this.state, gesture.cat);
	}

	/** Every purr to nothing, for a pause or a new ritual */
	#silence() {
		for (const cat of this.state.cats) {
			this.#mixer.setPurr(cat.profile.id, purrVoice(cat.profile.purrRank, 0, 0));
		}
	}

	#syncMixer(dtMs: number) {
		this.#mixerMs -= dtMs;
		if (this.#mixerMs > 0) return;
		this.#mixerMs = MIXER_SYNC_MS;
		for (const cat of this.state.cats) {
			const voice = purrVoice(cat.profile.purrRank, cat.purr, cat.happiness);
			this.#mixer.setPurr(
				cat.profile.id,
				voice,
				((seatPosition(cat.seat).x - FIELD / 2) / FIELD) * 1.6
			);
		}
	}

	/** The lines light up with a rising note each, the burst booms and the music takes over from the purrs */
	#stepFinale(dtMs: number) {
		this.state.finaleMs += dtMs;
		const stage = finaleStage(this.state.finaleMs, this.reducedMotion);
		const reached = stage.igniting ? stage.litLines + 1 : stage.litLines;
		while (this.#linesHeard < reached) {
			this.#linesHeard += 1;
			soundManager().play('ritual-line', this.#linesHeard / 5);
		}
		if (!this.#burstHeard && stage.phase !== 'igniting') {
			this.#burstHeard = true;
			soundManager().play('ritual-burst');
			this.#mixer.startFinale();
		}
		// Whatever purr the cats had keeps going, as a steady layer in the music
		this.#mixerMs -= dtMs;
		if (this.#mixerMs > 0) return;
		this.#mixerMs = MIXER_SYNC_MS;
		for (const cat of this.state.cats) {
			const voice = purrVoice(cat.profile.purrRank, FINALE_PURR * stage.halo, 1);
			this.#mixer.setPurr(
				cat.profile.id,
				voice,
				((seatPosition(cat.seat).x - FIELD / 2) / FIELD) * 1.6
			);
		}
	}

	#apply(events: readonly RitualEvent[]) {
		for (const event of events) this.#handle(event);
		this.#syncChrome();
	}

	#handle(event: RitualEvent) {
		switch (event.type) {
			case 'room-event': {
				const sound = EVENT_SOUND[event.event];
				if (sound) this.#play(sound);
				else this.#play('click');
				break;
			}
			case 'reaction':
				if (event.animation === 'hiss') this.#play('cat-hiss', 0.5);
				break;
			case 'name-shown':
				this.#play('sparkle');
				break;
			case 'pitch-shown':
				this.#play('chime');
				break;
			case 'scrub':
				this.#play(event.hiss ? 'cat-hiss' : 'cat-flick');
				if (event.hiss) this.#say('too-fast');
				break;
			case 'line':
				this.#play('ritual-line', (event.index + 1) / 4);
				break;
			case 'mistake':
				this.#play('cat-hiss');
				this.#say('mistake');
				break;
			case 'not-ready':
				this.#play('ui-error');
				this.#say('not-ready');
				break;
			case 'out-of-turn':
				this.#play('ui-error');
				this.#say('out-of-turn');
				break;
			case 'win':
				this.#finishWon();
				break;
			case 'game-over':
				this.#silence();
				this.status = 'over';
				break;
		}
	}

	#play(id: SoundId, intensity = 1) {
		soundManager().play(id, intensity);
	}

	#say(kind: NoticeKind) {
		this.#noticeCount += 1;
		this.notice = { kind, id: this.#noticeCount };
		this.#noticeMs = NOTICE_MS;
	}

	#finishWon() {
		this.#syncChrome();
		this.#silence();
		const result = this.#scores().submit(SCORE_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.#linesHeard = 0;
		this.#burstHeard = false;
		this.status = 'won';
	}

	#syncChrome() {
		this.lives = this.state.lives;
		this.score = scoreOf(this.state);
	}
}

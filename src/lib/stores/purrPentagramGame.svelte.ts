/*
 * Purr Pentagram game store: wraps the pure ritual logic with the player's pointer gestures (a finger
 * held on a cat pets it, dragging out of the circle draws the star), the sounds,
 * the sustained purrs and the finale music, the reduce-motion setting and the personal best.
 *
 * The ritual state is reactive on purpose: the board is a small SVG that redraws from it, and only
 * a handful of values change per frame.
 */
import {
	CANDLE_TAP_RADIUS,
	CAT_RADIUS,
	FIELD,
	PURR_SOLVED_KEY,
	STARTING_LIVES
} from '#lib/game/purrpentagram/config.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { isPact, type PactId } from '#lib/game/purrpentagram/pacts.js';
import { spawn, stepParticles, type Particle } from '#lib/game/purrpentagram/particles.js';
import { starsFor } from '#lib/game/purrpentagram/scoring.js';
import { finaleStage } from '#lib/game/purrpentagram/finale.js';
import {
	candlePosition,
	circleAt,
	distance,
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
	feedCat,
	nudgePet,
	relightCandle,
	stepRitual
} from '#lib/game/purrpentagram/step.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { prefersReducedMotion } from '#lib/game/loop.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import { PurrMixer } from '#lib/sound/purrMixer.js';
import type { RoomEvent } from '#lib/game/purrpentagram/reactions.js';

export type PurrPentagramStatus = 'ready' | 'playing' | 'paused' | 'won' | 'over';

/** A short line of feedback under the board; the page turns the kind into text */
export type NoticeKind = 'mistake' | 'not-ready' | 'out-of-turn' | 'no-treats' | 'candle-spent';

const PACT_KEY = 'purrpentagram:pact';
const SCORE_KEY = ['purrpentagram', 'score'] as const;
const NOTICE_MS = 2800;
/** The purrs sent to the mixer are refreshed at this interval: fast enough to follow a stroke */
const MIXER_SYNC_MS = 40;
/** How loud and steady every cat purrs while the finale plays */
const FINALE_PURR = 0.55;

/** Sound of each room event as it begins; the dim lights and the laser dot are silent */
const EVENT_SOUND: Partial<Record<RoomEvent, SoundId>> = {
	candles: 'candle-snuff',
	draft: 'draft',
	thunder: 'thunder',
	creak: 'door-creak'
};

export interface PurrPentagramOptions {
	/** Calmer animation without flashes; defaults to the OS preference */
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
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
	/** The pact chosen for the next ritual */
	pact = $state<PactId>('none');
	/** The next tap on a cat feeds it a treat */
	treatArmed = $state(false);
	/** Cosmetic particles, replaced every step so the board redraws from them */
	particles = $state.raw<Particle[]>([]);
	/** Screen shake from thunder, wrong strokes and the finale burst (0 to 1) */
	shake = $state(0);
	/** Stars earned by the finished ritual (0 while it is still on) */
	stars = $state(0);

	#pool: Particle[] = [];
	#fxRandom: () => number = Math.random;
	#emberMs = 0;
	#heartMs = 0;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
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
		seed = randomSeed,
		mixer = new PurrMixer()
	}: PurrPentagramOptions = {}) {
		this.#scores = scores;
		this.#seed = seed;
		this.#mixer = mixer;
		this.reducedMotion = reducedMotion;
	}

	/** Reads the stored best; call in the browser only */
	load() {
		this.best = this.#scores().get(SCORE_KEY);
		this.pact = localStore().read<PactId>(PACT_KEY, 'none', isPact);
	}

	/** Chooses the pact for the next ritual, before it begins */
	setPact(pact: PactId) {
		this.pact = pact;
		localStore().write(PACT_KEY, pact);
		haptic().play(0.15);
		this.#play('click');
	}

	/** Arms or disarms the treat: the next tap on a cat feeds it */
	toggleTreat() {
		if (this.status !== 'playing') return;
		this.treatArmed = !this.treatArmed;
		this.#play('click');
	}

	/** Starts audio from a user gesture, as browsers require */
	unlockAudio() {
		this.#mixer.unlock();
	}

	start() {
		// Whatever the last ritual's finale was playing ends with it
		this.#mixer.stopFinale();
		const seed = this.#seed();
		this.#random = createRandom(seed);
		this.state = createRitual(seed, this.#random, this.pact);
		this.#pool = [];
		this.particles = [];
		this.shake = 0;
		this.stars = 0;
		this.treatArmed = false;
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

	/** The back link during a run: ends it as a loss */
	forfeit() {
		if (this.status !== 'playing' && this.status !== 'paused') return;
		this.#silence();
		this.status = 'over';
	}

	/** One fixed step: called by the board's game loop */
	update(dtMs: number) {
		if (this.status !== 'playing' && this.status !== 'won') return;
		if (this.#mutedSent !== soundManager().muted) {
			this.#mutedSent = soundManager().muted;
			this.#mixer.setMuted(this.#mutedSent);
		}
		this.#stepFx(dtMs);
		if (this.status === 'won') {
			this.#apply(stepRitual(this.state, this.#random, dtMs));
			this.#stepFinale(dtMs);
			return;
		}
		this.#noticeMs -= dtMs;
		if (this.notice && this.#noticeMs <= 0) this.notice = null;
		this.#apply(stepRitual(this.state, this.#random, dtMs));
		this.#ambientFx(dtMs);
		this.#syncMixer(dtMs);
	}

	/** A finger went down: petting begins when it landed inside a cat's circle */
	pointerDown(point: Point): boolean {
		if (this.status !== 'playing') return false;
		this.unlockAudio();
		const cat = circleAt(point, this.#centres());
		if (cat === null) {
			const candle = this.state.candles.findIndex(
				(_, index) => distance(point, candlePosition(index)) <= CANDLE_TAP_RADIUS
			);
			if (candle < 0) return false;
			this.relight(candle);
			return false;
		}
		if (this.treatArmed) {
			this.treatArmed = false;
			this.#apply(feedCat(this.state, cat));
			return false;
		}
		this.#gesture = { cat, mode: 'pet' };
		beginPet(this.state, cat);
		return true;
	}

	pointerMove(point: Point) {
		const gesture = this.#gesture;
		if (!gesture || this.status !== 'playing') return;
		if (gesture.mode === 'pet') {
			// Anywhere inside the circle is petting; it only changes when the finger leaves
			if (insideCircle(point, this.#centres()[gesture.cat], CAT_RADIUS)) return;
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

	/** Lights a candle that has gone out */
	relight(index: number) {
		if (this.status !== 'playing') return;
		this.unlockAudio();
		this.#apply(relightCandle(this.state, index));
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
		if (this.treatArmed) {
			this.treatArmed = false;
			this.#apply(feedCat(this.state, cat));
			return;
		}
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

	/** The player has left (another tab or app): no music or purrs in the background */
	suspendAudio() {
		this.#mixer.suspend();
	}

	/** The player is back */
	resumeAudio() {
		this.#mixer.resume();
	}

	/** Stops the sustained sound and releases the audio device; call when leaving the page */
	dispose() {
		this.#mixer.dispose();
	}

	#centres(): Point[] {
		return this.state.cats.map((cat) => seatPosition(cat.seat));
	}

	/** Cosmetic: moves the particles and lets the shake die down; none of it with reduced motion */
	#stepFx(dtMs: number) {
		this.shake = this.reducedMotion ? 0 : Math.max(0, this.shake - dtMs / 600);
		if (this.#pool.length === 0 && this.particles.length === 0) return;
		stepParticles(this.#pool, dtMs);
		this.particles = this.#pool.slice();
	}

	#burst(kind: Parameters<typeof spawn>[1], point: Point, count: number) {
		if (this.reducedMotion) return;
		spawn(this.#pool, kind, point.x, point.y, this.#fxRandom, count);
	}

	/** Embers over the burning candles and hearts over the purring cats */
	#ambientFx(dtMs: number) {
		if (this.reducedMotion) return;
		this.#emberMs -= dtMs;
		if (this.#emberMs <= 0) {
			this.#emberMs = 260;
			this.state.candles.forEach((candle, index) => {
				if (candle.lit && this.#fxRandom() < 0.5) this.#burst('ember', this.#candleTip(index), 1);
			});
		}
		this.#heartMs -= dtMs;
		if (this.#heartMs <= 0) {
			this.#heartMs = 520;
			for (const cat of this.state.cats) {
				if (cat.purr > 0.5 && this.#fxRandom() < cat.purr) {
					const at = this.#catTip(cat.profile.id);
					this.#burst('heart', { x: at.x + (this.#fxRandom() - 0.5) * 80, y: at.y }, 1);
				}
			}
		}
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
		const stage = finaleStage(this.state.finaleMs, this.reducedMotion);
		const reached = stage.igniting ? stage.litLines + 1 : stage.litLines;
		while (this.#linesHeard < reached) {
			this.#linesHeard += 1;
			soundManager().play('ritual-line', this.#linesHeard / 5);
		}
		if (!this.#burstHeard && stage.phase !== 'igniting') {
			this.#burstHeard = true;
			soundManager().play('ritual-burst');
			this.#shake(1);
			haptic().play(1);
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
				if (event.event === 'thunder') {
					this.#shake(0.9);
					haptic().play(0.6);
				} else if (event.event === 'creak') haptic().play(0.2);
				break;
			}
			case 'omen':
				this.#play('omen-toll', (this.state.chain.length + 1) / 5);
				haptic().play(0.15);
				break;
			case 'candle-out':
				this.#play('candle-snuff');
				this.#burst('smoke', this.#candleTip(event.index), 5);
				break;
			case 'candle-lit':
				this.#play('candle-light', this.state.candles.filter((c) => c.lit).length / 5);
				this.#burst('ember', this.#candleTip(event.index), 6);
				haptic().play(0.1);
				break;
			case 'candle-spent':
				this.#burst('smoke', this.#candleTip(event.index), 4);
				this.#say('candle-spent');
				this.#play('ui-error');
				break;
			case 'treat':
				this.#play('treat-crunch');
				this.#play('sparkle', 0.5);
				this.#burst('heart', this.#catTip(event.cat), 4);
				haptic().play(0.3);
				break;
			case 'no-treats':
				this.#play('ui-error');
				this.#say('no-treats');
				break;
			case 'combo':
				if (event.combo > 1) this.#play('chime', Math.min(1, event.combo / 5));
				break;
			case 'landing':
				if (event.strength > 450) {
					this.#play('cat-pounce');
					const tip = this.#catTip(event.cat);
					this.#burst('dust', { x: tip.x, y: tip.y + 90 }, 4);
					haptic().play(0.08);
				}
				break;
			case 'reaction':
				if (event.animation === 'hiss') this.#play('cat-hiss', 0.5);
				break;
			case 'name-shown':
				this.#play('sparkle');
				break;
			case 'pitch-shown':
				this.#play('chime');
				break;
			case 'line':
				this.#play('ritual-line', (event.index + 1) / 4);
				this.#burst('spark', seatPosition(this.state.cats[event.to].seat), 10);
				haptic().play(0.3 + event.index * 0.1);
				break;
			case 'mistake':
				this.#play('cat-hiss');
				this.#say('mistake');
				this.#shake(0.5);
				haptic().play(0.7);
				break;
			case 'not-ready':
				haptic().play(0.2);
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
				haptic().play(1);
				this.#silence();
				this.status = 'over';
				break;
		}
	}

	#shake(amount: number) {
		if (!this.reducedMotion) this.shake = Math.max(this.shake, amount);
	}

	#catTip(cat: number): Point {
		const at = seatPosition(this.state.cats[cat].seat);
		return { x: at.x, y: at.y - 30 };
	}

	#candleTip(index: number): Point {
		const at = candlePosition(index);
		return { x: at.x, y: at.y - 30 };
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
		// Remembered for the cat ears of the agent
		localStore().write(PURR_SOLVED_KEY, true);
		this.#linesHeard = 0;
		this.#burstHeard = false;
		haptic().play(0.9);
		this.status = 'won';
	}

	#syncChrome() {
		this.lives = this.state.lives;
		this.stars = this.state.phase === 'won' ? starsFor(scoreOf(this.state)) : 0;
		this.score = scoreOf(this.state);
	}
}

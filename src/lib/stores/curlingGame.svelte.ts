/*
 * Iceberg Curling game store: wraps the pure rules in game/curling with the player's aim, sounds,
 * vibration, floating text and the personal best. The simulation state is a plain object the canvas
 * reads every frame; only what the page chrome shows is reactive, synced after each step.
 */
import {
	GAMBLE_PENALTY,
	HOUSE,
	STONES_PER_END,
	V_MAX,
	ENDS_TOTAL
} from '#lib/game/curling/config.js';
import type { EndResult, FinalScore, HazardKind } from '#lib/game/curling/ends.js';
import { hintFraction, ringPoints } from '#lib/game/curling/ends.js';
import { absorbEvents, addPopup, createFx, stepFx, type Fx } from '#lib/game/curling/fx.js';
import { predictPath, speedOf, trimPath } from '#lib/game/curling/physics.js';
import {
	createCurl,
	endGame,
	nextEnd,
	setAim,
	setGamble,
	setSpin,
	setSweeping,
	stepCurl,
	throwStone,
	type CurlEvent,
	type CurlState,
	type Phase
} from '#lib/game/curling/state.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export const CURLING_BEST_KEY = ['curling', 'score'] as const;

export interface CurlingOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
	/** Turn off sounds and vibration, for tests */
	silent?: boolean;
}

export class CurlingGame {
	phase = $state<Phase>('aiming');
	paused = $state(false);
	score = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	endIndex = $state(0);
	stoneIndex = $state(0);
	power = $state(0.6);
	angle = $state(0);
	spin = $state(1);
	gamble = $state(false);
	sweeping = $state(false);
	sweepEnergy = $state(1);
	wind = $state(0);
	/** The hazard introduced in the current end, for the announcement under the field */
	newHazard = $state<HazardKind | null>(null);
	/** Summary of the end that just finished */
	summary = $state<EndResult | null>(null);
	final = $state<FinalScore | null>(null);
	penguinHits = $state(0);
	sealBumps = $state(0);
	totalStars = $state(0);

	/** Simulation state, deliberately not reactive */
	state: CurlState;
	fx: Fx;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#silent: boolean;
	#clock = 0;
	#lastSound: Partial<Record<string, number>> = {};

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed,
		silent = false
	}: CurlingOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.#silent = silent;
		this.state = createCurl(this.#random);
		this.fx = createFx(reducedMotion);
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(CURLING_BEST_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createCurl(this.#random);
		this.fx = createFx(this.reducedMotion);
		this.paused = false;
		this.isNewBest = false;
		this.summary = null;
		this.final = null;
		this.newHazard = null;
		this.#clock = 0;
		this.#lastSound = {};
		this.#sync();
	}

	get stonesPerEnd() {
		return STONES_PER_END;
	}

	get endsTotal() {
		return ENDS_TOTAL;
	}

	/** The aiming hint: dots along the unswept path, shorter in later ends, none for a gamble */
	get hint(): { x: number; y: number }[] | null {
		const state = this.state;
		if (state.phase !== 'aiming' || state.gamble) return null;
		const path = predictPath({
			angle: state.angle,
			power: state.power,
			spin: state.spin,
			wind: state.hazards.wind,
			drift: state.hazards.drift,
			sweeping: false
		});
		return trimPath(path, hintFraction(state.endIndex));
	}

	aim(angle: number, power: number) {
		setAim(this.state, angle, power);
		this.angle = this.state.angle;
		this.power = this.state.power;
	}

	nudgeAim(deltaAngle: number, deltaPower: number) {
		this.aim(this.state.angle + deltaAngle, this.state.power + deltaPower);
	}

	toggleSpin() {
		if (this.state.phase !== 'aiming' || this.paused) return;
		setSpin(this.state, -this.state.spin);
		this.spin = this.state.spin;
		this.#play('ui-toggle', 0);
		this.#vibrate(0.1);
	}

	toggleGamble() {
		if (this.state.phase !== 'aiming' || this.paused) return;
		setGamble(this.state, !this.state.gamble);
		this.gamble = this.state.gamble;
		this.#play(this.gamble ? 'alarm' : 'ui-toggle', 0, 0.35);
		this.#vibrate(this.gamble ? 0.3 : 0.1);
	}

	throw() {
		if (this.paused) return;
		const events = throwStone(this.state);
		if (events.length === 0) return;
		this.#handle(events);
		this.#sync();
	}

	setSweeping(on: boolean) {
		if (this.paused) return;
		setSweeping(this.state, on);
		this.sweeping = this.state.sweeping;
	}

	/** Moves on from the end summary to the next end, or to the final result */
	nextEnd() {
		const events = nextEnd(this.state, this.#random);
		if (events.length === 0) return;
		this.#handle(events);
		this.summary = null;
		this.#sync();
	}

	forfeit() {
		if (this.state.over) return;
		this.#handle(endGame(this.state));
		this.#sync();
	}

	pause() {
		if (this.state.over) return;
		this.paused = true;
		setSweeping(this.state, false);
		this.sweeping = false;
	}

	resume() {
		this.paused = false;
	}

	togglePause() {
		if (this.paused) this.resume();
		else this.pause();
	}

	/** One fixed step from the canvas loop */
	update(dtMs: number) {
		if (this.paused) return;
		const dt = dtMs / 1000;
		this.#clock += dt;
		if (this.fx.hitStop > 0) {
			// A hard hit freezes the game for a moment; only the effects keep going
			stepFx(this.fx, this.state, dt);
			return;
		}
		const wasSliding = this.state.phase === 'sliding';
		const events = stepCurl(this.state, dt);
		if (events.length > 0) this.#handle(events);
		stepFx(this.fx, this.state, dt);
		if (wasSliding || events.length > 0) this.#ambience();
		if (this.state.sweeping !== this.sweeping) this.sweeping = this.state.sweeping;
		if (this.state.phase === 'sliding') {
			this.sweepEnergy = this.state.sweepEnergy;
		}
		if (events.length > 0 || this.phase !== this.state.phase) this.#sync();
	}

	/** The gliding rumble and the scrubbing, while the stone is on its way */
	#ambience() {
		const state = this.state;
		if (state.phase !== 'sliding') return;
		const moving = state.stones.find((stone) => stone.status === 'moving');
		if (!moving) return;
		const speed = speedOf(moving);
		this.#play('curl-glide', 320, Math.min(1, speed / V_MAX));
		if (state.sweeping && state.sweepEnergy > 0) {
			this.#play('curl-scrub', 110, 0.4 + Math.random() * 0.6);
			this.#buzz('scrub', 260, 0.08);
		}
	}

	#handle(events: readonly CurlEvent[]) {
		const state = this.state;
		absorbEvents(this.fx, state, events);
		for (const event of events) {
			switch (event.type) {
				case 'throw':
					this.#play('whoosh', 0, 0.4 + event.power * 0.5);
					this.#vibrate(0.2 + event.power * 0.2);
					break;
				case 'bump': {
					if (event.kind === 'stone') {
						this.#play('impact-stone', 60, 0.3 + event.strength * 0.7);
						this.#buzz('bump', 60, 0.15 + event.strength * 0.5);
					} else if (event.kind === 'seal') {
						this.#play('seal-bark', 250);
						this.#play('thud', 60, 0.4 + event.strength * 0.6);
						this.#buzz('bump', 60, 0.2 + event.strength * 0.4);
					} else {
						this.#play('thud', 60, 0.4 + event.strength * 0.6);
					}
					break;
				}
				case 'penguin-hit':
					this.#play('penguin-squawk', 0);
					this.#play('ui-error', 100, 0.8);
					addPopup(this.fx, event.x, event.y - 22, m.curling_popup_penguin(), 'bad');
					this.#vibrate(0.6);
					break;
				case 'sunk':
					this.#play('splash', 0, 0.9);
					addPopup(
						this.fx,
						Math.min(Math.max(event.x, 170), 470),
						Math.min(Math.max(event.y, 40), 330),
						event.gamble
							? `${m.curling_popup_gamble_lost()} -${GAMBLE_PENALTY}`
							: m.curling_popup_sunk(),
						'bad'
					);
					this.#vibrate(0.5);
					break;
				case 'stone-done': {
					const stone = state.stones[event.stone];
					if (!stone || stone.status === 'sunk') break;
					const ring = ringPoints(stone.x, stone.y);
					if (ring === 0) {
						if (stone.gamble) {
							addPopup(
								this.fx,
								stone.x,
								stone.y - 18,
								`${m.curling_popup_gamble_lost()} -${GAMBLE_PENALTY}`,
								'bad'
							);
							this.#play('ui-error', 0, 0.6);
							this.#vibrate(0.35);
						}
						break;
					}
					const points = stone.gamble ? ring * 2 : ring;
					const text =
						ring === 10
							? m.curling_popup_button()
							: stone.gamble
								? m.curling_popup_gamble_won()
								: '';
					addPopup(
						this.fx,
						stone.x,
						stone.y - 20,
						`${text ? `${text} ` : ''}+${points}`,
						ring === 10 || stone.gamble ? 'big' : 'good'
					);
					this.#play(ring === 10 ? 'chime' : 'ding', 0, ring / 10);
					this.#vibrate(0.25 + ring * 0.04);
					break;
				}
				case 'end-done':
					this.summary = event.result;
					this.#play(
						event.result.stars >= 3 ? 'chime-big' : event.result.stars > 0 ? 'chime' : 'ui-tap',
						0
					);
					if (event.result.sold) this.#play('sparkle', 0);
					this.#vibrate(0.3 + event.result.stars * 0.2);
					addPopup(this.fx, HOUSE.x, HOUSE.y - 70, `+${event.result.points}`, 'big');
					break;
				case 'end-start':
					this.newHazard = event.hazard;
					if (event.hazard) this.#play('ui-toggle', 0);
					if (state.hazards.seals.length > 0) this.#play('whoosh', 0, 0.4);
					break;
				case 'game-over':
					this.final = event.final;
					this.#finish(event.final);
					break;
			}
		}
	}

	#finish(final: FinalScore) {
		this.score = final.score;
		const result = this.#scores().submit(CURLING_BEST_KEY, final.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
	}

	#sync() {
		const state = this.state;
		this.phase = state.phase;
		this.endIndex = state.endIndex;
		this.stoneIndex = state.stoneIndex;
		this.angle = state.angle;
		this.power = state.power;
		this.spin = state.spin;
		this.gamble = state.gamble;
		this.sweeping = state.sweeping;
		this.sweepEnergy = state.sweepEnergy;
		this.wind = state.hazards.wind;
		this.score = state.score;
		this.penguinHits = state.penguinHits;
		this.sealBumps = state.sealBumps;
		this.totalStars = state.results.reduce((total, result) => total + result.stars, 0);
	}

	/** Plays a sound unless the same one played less than gapMs ago */
	#play(id: SoundId, gapMs: number, intensity = 1) {
		if (this.#silent) return;
		const last = this.#lastSound[id] ?? -Infinity;
		if (gapMs > 0 && (this.#clock - last) * 1000 < gapMs) return;
		this.#lastSound[id] = this.#clock;
		soundManager().play(id, intensity);
	}

	#vibrate(intensity: number) {
		if (!this.#silent) haptic().play(intensity);
	}

	#buzz(key: string, gapMs: number, intensity: number) {
		if (this.#silent) return;
		const last = this.#lastSound[`haptic-${key}`] ?? -Infinity;
		if ((this.#clock - last) * 1000 < gapMs) return;
		this.#lastSound[`haptic-${key}`] = this.#clock;
		haptic().play(intensity);
	}
}

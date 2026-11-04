/*
 * Shadow Fleet Shuffle: a shell game with ships. The sanctioned tanker is marked, cargo covers
 * drop over the fleet and shuffle (swaps, crossings, three-way rotations, flag repaints, AIS
 * blackouts), then you pick the cover that hides it. A satellite ping gives a hint for half pay.
 * Pure rules live in #lib/game/shuffle; this class sequences the phases and fires sounds and haptics.
 */
import { haptic } from '#lib/haptic/haptic.svelte.js';
import {
	MAX_PINGS,
	START_PINGS,
	STARTING_LIVES,
	TOTAL_ROUNDS,
	roundConfig,
	type RoundConfig
} from '#lib/game/shuffle/config.js';
import { createFleet, repaint, type Ship } from '#lib/game/shuffle/fleet.js';
import { applyMove, planShuffle, type MoveKind, type Step } from '#lib/game/shuffle/moves.js';
import {
	clearBonus,
	earnsPing,
	pickScore,
	starRating,
	streakMultiplier,
	wrongPenalty
} from '#lib/game/shuffle/scoring.js';
import { randomSeed, createRandom, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const SHUFFLE_BEST_KEY = ['shuffle', 'score'] as const;

export type ShufflePhase =
	'idle' | 'reveal' | 'cover' | 'shuffling' | 'guessing' | 'correct' | 'wrong' | 'over';

/** The move under way: the covers at `slots` rotate one place, started at `startedAt` (performance.now) */
export interface ActiveMove {
	id: number;
	kind: MoveKind;
	slots: number[];
	startedAt: number;
	duration: number;
}

export interface Feedback {
	id: number;
	kind: 'correct' | 'wrong' | 'ping' | 'reflag' | 'dark';
	shipId: number;
	gain: number;
	streak: number;
}

export interface ShuffleOptions {
	scores?: Highscores;
	random?: Random;
}

const COVER_MS = 650;
const REPAINT_MS = 380;
const DARK_MS = 320;
const CORRECT_MS = 1700;
const WRONG_PEEK_MS = 700;
const WRONG_MS = 2300;

export class ShuffleGame {
	phase = $state<ShufflePhase>('idle');
	ships = $state<Ship[]>([]);
	round = $state(1);
	lives = $state(STARTING_LIVES);
	score = $state(0);
	streak = $state(0);
	bestStreak = $state(0);
	pings = $state(START_PINGS);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	won = $state(false);
	roundsCleared = $state(0);
	correctPicks = $state(0);
	wrongPicks = $state(0);
	attempt = $state(1);
	/** Covers are down (they fly off while the tanker is marked, and again once a pick is revealed) */
	covered = $state(false);
	/** Ids of the ships whose cover is currently lifted to show what is underneath */
	lifted = $state<number[]>([]);
	move = $state<ActiveMove | null>(null);
	pinged = $state(false);
	pingAt = $state(0);
	pingShip = $state(-1);
	feedback = $state<Feedback>({ id: 0, kind: 'correct', shipId: -1, gain: 0, streak: 0 });
	/** Points the last pick scored, for the number pop in the HUD */
	lastGain = $state(0);

	config = $state<RoundConfig>(roundConfig(1));
	#tankerId = 0;
	#scores: Highscores;
	#random: Random;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#moveId = 0;
	#guessStart = 0;

	constructor({ scores = highscores(), random }: ShuffleOptions = {}) {
		this.#scores = scores;
		this.#random = random ?? createRandom(randomSeed());
		this.best = this.#scores.get(SHUFFLE_BEST_KEY);
	}

	get multiplier(): number {
		return streakMultiplier(Math.max(1, this.streak + 1));
	}

	get stars(): number {
		return starRating(this.won, this.roundsCleared, this.lives);
	}

	get tankerId(): number {
		return this.#tankerId;
	}

	get running(): boolean {
		return this.phase !== 'idle' && this.phase !== 'over';
	}

	loadBest() {
		this.best = this.#scores.get(SHUFFLE_BEST_KEY);
	}

	/** Ship id sitting in a slot, once the shuffle has settled */
	shipAtSlot(slot: number): Ship | undefined {
		return this.ships.find((ship) => ship.slot === slot);
	}

	start() {
		this.#clear();
		this.score = 0;
		this.streak = 0;
		this.bestStreak = 0;
		this.lives = STARTING_LIVES;
		this.pings = START_PINGS;
		this.round = 1;
		this.attempt = 1;
		this.roundsCleared = 0;
		this.correctPicks = 0;
		this.wrongPicks = 0;
		this.won = false;
		this.isNewBest = false;
		this.lastGain = 0;
		this.#startRound();
	}

	/** Gives the run up from the back link: ends it as a loss */
	forfeit() {
		if (!this.running) return;
		this.#clear();
		this.#end(false);
	}

	#later(ms: number, fn: () => void) {
		this.#timer = setTimeout(fn, ms);
	}

	#clear() {
		clearTimeout(this.#timer);
		this.#timer = undefined;
		this.move = null;
	}

	#startRound() {
		this.config = roundConfig(this.round);
		const { ships, tankerId } = createFleet(this.config.ships, this.#random);
		this.ships = ships;
		this.#tankerId = tankerId;
		this.lifted = [];
		this.pinged = false;
		this.pingShip = -1;
		this.covered = false;
		this.phase = 'reveal';
		this.#later(this.config.revealMs, () => this.#coverShips());
	}

	#coverShips() {
		this.phase = 'cover';
		this.covered = true;
		soundManager().play('thud', 0.35);
		haptic().play(0.15);
		this.#later(COVER_MS, () => {
			this.phase = 'shuffling';
			this.#runSteps(planShuffle(this.config, this.#random), 0);
		});
	}

	#runSteps(steps: Step[], index: number) {
		if (index >= steps.length) {
			for (const ship of this.ships) ship.dark = false;
			this.phase = 'guessing';
			this.#guessStart = performance.now();
			soundManager().play('ding', 0.4);
			return;
		}
		const step = steps[index];
		const next = () => this.#runSteps(steps, index + 1);
		if (step.type === 'move') {
			const duration = this.config.moveMs;
			this.move = {
				id: ++this.#moveId,
				kind: step.kind,
				slots: step.slots,
				startedAt: performance.now(),
				duration
			};
			soundManager().play('whoosh', 0.18);
			haptic().play(0.08);
			this.#later(duration, () => {
				const bySlot: number[] = [];
				for (const ship of this.ships) bySlot[ship.slot] = ship.id;
				applyMove(bySlot, step.slots).forEach((id, slot) => (this.ships[id].slot = slot));
				this.move = null;
				this.#later(this.config.gapMs, next);
			});
		} else if (step.type === 'reflag') {
			const ship = this.shipAtSlot(step.slot);
			if (ship) {
				Object.assign(ship, repaint(ship, this.#random));
				this.#note('reflag', ship.id);
				soundManager().play('ui-toggle', 0.5);
				haptic().play(0.1);
			}
			this.#later(REPAINT_MS, next);
		} else {
			const ship = this.shipAtSlot(step.slot);
			if (ship && !ship.dark) {
				ship.dark = true;
				this.#note('dark', ship.id);
				soundManager().play('ais-off', 0.5);
			}
			this.#later(DARK_MS, next);
		}
	}

	#note(kind: Feedback['kind'], shipId: number, gain = 0) {
		this.feedback = { id: this.feedback.id + 1, kind, shipId, gain, streak: this.streak };
	}

	/** Satellite ping: briefly shows where the tanker is, for half pay on this pick */
	ping(): boolean {
		if (this.phase !== 'guessing' || this.pinged || this.pings <= 0) return false;
		this.pings--;
		this.pinged = true;
		this.pingAt = performance.now();
		this.pingShip = this.#tankerId;
		this.#note('ping', this.#tankerId);
		soundManager().play('sonar-ping');
		haptic().play(0.3);
		return true;
	}

	/** Picks the cover in `slot` */
	pickSlot(slot: number) {
		const ship = this.shipAtSlot(slot);
		if (ship) this.pick(ship.id);
	}

	pick(shipId: number) {
		if (this.phase !== 'guessing') return;
		const elapsed = performance.now() - this.#guessStart;
		soundManager().play('pop', 0.6);
		haptic().play(0.2);
		if (shipId === this.#tankerId) this.#correct(shipId, elapsed);
		else this.#wrong(shipId);
	}

	#correct(shipId: number, elapsed: number) {
		this.phase = 'correct';
		this.streak++;
		this.bestStreak = Math.max(this.bestStreak, this.streak);
		this.correctPicks++;
		this.roundsCleared = this.round;
		const gain = pickScore({
			round: this.round,
			streak: this.streak,
			elapsedMs: elapsed,
			pinged: this.pinged
		});
		this.score += gain;
		this.lastGain = gain;
		this.lifted = [shipId];
		this.#note('correct', shipId, gain);
		soundManager().play('sparkle', 0.8);
		haptic().play(0.4);
		const streakPing = earnsPing(this.streak, this.pings);
		if (this.streak >= 3) {
			soundManager().play('chime-big', Math.min(1, this.streak / 8));
			haptic().play(0.6);
		}
		if (streakPing) this.pings = Math.min(MAX_PINGS, this.pings + 1);

		this.#later(CORRECT_MS, () => {
			if (this.round >= TOTAL_ROUNDS) {
				this.score += clearBonus(this.lives);
				this.#end(true);
			} else {
				this.round++;
				this.attempt = 1;
				this.#startRound();
			}
		});
	}

	#wrong(shipId: number) {
		this.phase = 'wrong';
		this.streak = 0;
		this.wrongPicks++;
		this.lives--;
		const penalty = Math.min(this.score, wrongPenalty(this.round));
		this.score -= penalty;
		this.lastGain = -penalty;
		this.lifted = [shipId];
		this.#note('wrong', shipId, -penalty);
		soundManager().play('hit', 0.9);
		soundManager().play('ui-error');
		haptic().play(0.8);
		// The tanker's cover lifts a moment later: it was right there
		this.#later(WRONG_PEEK_MS, () => {
			this.lifted = [shipId, this.#tankerId];
			soundManager().play('thud', 0.4);
			this.#later(WRONG_MS - WRONG_PEEK_MS, () => {
				if (this.lives <= 0) {
					this.#end(false);
				} else {
					this.attempt++;
					this.#startRound();
				}
			});
		});
	}

	#end(won: boolean) {
		this.won = won;
		this.phase = 'over';
		this.covered = false;
		this.move = null;
		const result = this.#scores.submit(SHUFFLE_BEST_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
	}
}

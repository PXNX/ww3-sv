/*
 * One attempt at a level: the bird squad, the turn phases and the result. It drives the physics
 * world one fixed step at a time and runs headlessly, so whole shots can be unit tested.
 *
 * aiming -> (launch) -> flying -> (all birds finished) -> settling -> aiming | won | failed
 * The level is won the moment the last golden dome breaks, in any phase.
 */
import type { Random } from '$lib/game/random';
import { BIRDS, type BirdKind } from './birds';
import { FuryWorld } from './furyWorld';
import { MIN_POWER, launchVelocity, type Aim } from './launch';
import type { LevelData } from './levels/schema';
import { calculateStars, finalScore, resolveTurn, unusedBirdBonus } from './rules';

export type FuryPhase = 'aiming' | 'flying' | 'settling' | 'won' | 'failed';

/** Bodies must rest for this many steps in a row before the turn ends */
const REST_STEPS = 20;
/** The turn ends this many steps after the birds finish even if something keeps rocking (6 s) */
export const SETTLE_TIMEOUT_STEPS = 360;

export class FuryMatch {
	readonly level: LevelData;
	readonly world: FuryWorld;
	phase: FuryPhase = 'aiming';
	/** Birds not yet launched; the first one sits in the slingshot while aiming */
	squad: BirdKind[];
	stepsInPhase = 0;
	#restSteps = 0;

	constructor(level: LevelData, random: Random) {
		this.level = level;
		this.world = new FuryWorld(level, random);
		this.squad = [...level.birds];
	}

	/** The bird in the slingshot, or null when none is ready */
	get currentBird(): BirdKind | null {
		return this.phase === 'aiming' ? (this.squad[0] ?? null) : null;
	}

	get birdsLeft(): number {
		return this.squad.length;
	}

	get isOver(): boolean {
		return this.phase === 'won' || this.phase === 'failed';
	}

	get bonus(): number {
		return this.phase === 'won' ? unusedBirdBonus(this.birdsLeft) : 0;
	}

	get score(): number {
		return finalScore(this.world.destructionPoints, this.birdsLeft, this.phase === 'won');
	}

	get stars(): 0 | 1 | 2 | 3 {
		return calculateStars({
			won: this.phase === 'won',
			birdsLeft: this.birdsLeft,
			blocksDestroyed: this.world.blocksDestroyed,
			blocksTotal: this.world.blocksTotal
		});
	}

	/** Launches the bird in the slingshot; a too-weak pull does nothing and returns false */
	launch(aim: Aim): boolean {
		const bird = this.currentBird;
		if (!bird || aim.power < MIN_POWER) return false;
		this.squad = this.squad.slice(1);
		this.world.launch(bird, launchVelocity(aim, BIRDS[bird].speedFactor));
		this.#enter('flying');
		return true;
	}

	canUseAbility(): boolean {
		return this.phase === 'flying' && this.world.abilityBird() !== null;
	}

	useAbility(): boolean {
		return this.phase === 'flying' && this.world.useAbility();
	}

	/** Advances one fixed step; the world keeps simulating after the result so debris can land */
	step(): void {
		this.world.step();
		this.stepsInPhase++;
		if (this.isOver) return;

		if (this.world.domesRemaining === 0) {
			this.#enter('won');
			return;
		}
		if (this.phase === 'flying' && this.world.birdsDone()) {
			this.#enter('settling');
			return;
		}
		if (this.phase === 'settling') {
			this.#restSteps = this.world.isAtRest() ? this.#restSteps + 1 : 0;
			const settled = this.#restSteps >= REST_STEPS || this.stepsInPhase >= SETTLE_TIMEOUT_STEPS;
			const outcome = resolveTurn({
				domesRemaining: this.world.domesRemaining,
				birdsLeft: this.birdsLeft,
				settled
			});
			if (outcome === 'next-bird') {
				this.world.clearSpentBirds();
				this.#enter('aiming');
			} else if (outcome === 'failed') {
				this.#enter('failed');
			}
		}
	}

	#enter(phase: FuryPhase) {
		this.phase = phase;
		this.stepsInPhase = 0;
		this.#restSteps = 0;
	}
}

/*
 * Iceberg Curling (Greenland): slide stones at a realtor's "For Sale" sign planted in the house.
 * An end is two stones; a stone that stays in the house scores its ring, so the second stone can
 * knock the first one out. Eight ends bring wind, a lost penguin, seals and drifting ice. Every
 * step returns events (bumps, splashes, scores) that the store turns into sounds, vibration and
 * effects, so this file stays free of any browser API.
 */
import type { Random } from '../random';
import {
	ENDS_TOTAL,
	HACK,
	PENGUIN_R,
	PENGUIN_RESTITUTION,
	SEAL_ENTER_TIME,
	SEAL_R,
	SEAL_RESTITUTION,
	SETTLE_DELAY,
	SHEET_L,
	SHEET_R,
	STONES_PER_END,
	STONE_RESTITUTION,
	SWEEP_DRAIN
} from './config';
import {
	endHazards,
	finalScore,
	hazardIntroducedAt,
	summarizeEnd,
	type EndResult,
	type FinalScore,
	type Hazards,
	type HazardKind
} from './ends';
import {
	clampAngle,
	clampPower,
	collideObstacle,
	collideStones,
	launchVelocity,
	onSheet,
	speedOf,
	stepStone
} from './physics';

export type StoneStatus = 'moving' | 'rest' | 'sunk';
export type Phase = 'aiming' | 'sliding' | 'summary' | 'over';

export interface Stone {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** +1 curls to the right, -1 to the left */
	spin: number;
	gamble: boolean;
	status: StoneStatus;
	/** Visual rotation in radians */
	rot: number;
	/** Game time when the stone went into the sea */
	sunkAt: number;
}

export type CurlEvent =
	| { type: 'throw'; power: number; gamble: boolean }
	| {
			type: 'bump';
			kind: 'stone' | 'seal' | 'penguin';
			x: number;
			y: number;
			strength: number;
			index?: number;
	  }
	| { type: 'penguin-hit'; x: number; y: number }
	| { type: 'sunk'; x: number; y: number; gamble: boolean }
	| { type: 'stone-done'; stone: number }
	| { type: 'end-done'; result: EndResult }
	| { type: 'end-start'; end: number; hazard: HazardKind | null }
	| { type: 'game-over'; final: FinalScore };

export interface CurlState {
	/** 0-based index of the current end */
	endIndex: number;
	/** Which stone of the end is next (or sliding) */
	stoneIndex: number;
	stones: Stone[];
	hazards: Hazards;
	phase: Phase;
	/** The player's aim: degrees from straight up (positive to the right) and power 0 to 1 */
	angle: number;
	power: number;
	spin: number;
	gamble: boolean;
	sweeping: boolean;
	/** Sweeping stamina of the current stone, 1 down to 0 */
	sweepEnergy: number;
	/** Seconds since the last stone stopped moving */
	settle: number;
	/** 1 when the seals just appeared, down to 0 once they have slid in */
	enter: number;
	penguinHits: number;
	/** Penguin hits in the current end */
	endPenguinHits: number;
	endSealBumps: number;
	sealBumps: number;
	results: EndResult[];
	score: number;
	/** Game time in seconds */
	time: number;
	nextId: number;
	over: boolean;
}

export function createCurl(random: Random): CurlState {
	return {
		endIndex: 0,
		stoneIndex: 0,
		stones: [],
		hazards: endHazards(0, random),
		phase: 'aiming',
		angle: 0,
		power: 0.6,
		spin: 1,
		gamble: false,
		sweeping: false,
		sweepEnergy: 1,
		settle: 0,
		enter: 0,
		penguinHits: 0,
		endPenguinHits: 0,
		endSealBumps: 0,
		sealBumps: 0,
		results: [],
		score: 0,
		time: 0,
		nextId: 1,
		over: false
	};
}

export const activeStone = (state: CurlState): Stone | undefined =>
	state.stones.find((stone) => stone.status === 'moving');

export const lastStone = (state: CurlState): Stone | undefined =>
	state.stones[state.stones.length - 1];

export function setAim(state: CurlState, angle: number, power: number) {
	if (state.phase !== 'aiming') return;
	state.angle = clampAngle(angle);
	state.power = clampPower(power);
}

export function setSpin(state: CurlState, spin: number) {
	if (state.phase !== 'aiming') return;
	state.spin = spin < 0 ? -1 : 1;
}

export function setGamble(state: CurlState, gamble: boolean) {
	if (state.phase !== 'aiming') return;
	state.gamble = gamble;
}

/** Releases the next stone from the hack with the current aim; false when it is not the moment */
export function throwStone(state: CurlState): CurlEvent[] {
	if (state.phase !== 'aiming' || state.over) return [];
	const { vx, vy } = launchVelocity(state.angle, state.power);
	state.stones.push({
		id: state.nextId++,
		x: HACK.x,
		y: HACK.y,
		vx,
		vy,
		spin: state.spin,
		gamble: state.gamble,
		status: 'moving',
		rot: 0,
		sunkAt: 0
	});
	state.phase = 'sliding';
	state.sweepEnergy = 1;
	state.settle = 0;
	return [{ type: 'throw', power: state.power, gamble: state.gamble }];
}

/** Starts or stops the sweepers; they cannot work with no energy left */
export function setSweeping(state: CurlState, on: boolean) {
	state.sweeping = on && state.phase === 'sliding';
}

function movePenguin(state: CurlState, dt: number) {
	const penguin = state.hazards.penguin;
	if (!penguin) return;
	penguin.x += penguin.vx * dt;
	penguin.phase += dt * 6;
	penguin.cooldown = Math.max(0, penguin.cooldown - dt);
	const left = SHEET_L + PENGUIN_R + 6;
	const right = SHEET_R - PENGUIN_R - 6;
	if (penguin.x < left) {
		penguin.x = left;
		penguin.vx = Math.abs(penguin.vx);
	} else if (penguin.x > right) {
		penguin.x = right;
		penguin.vx = -Math.abs(penguin.vx);
	}
}

/** Advances the game by dt seconds and returns what happened */
export function stepCurl(state: CurlState, dt: number): CurlEvent[] {
	const events: CurlEvent[] = [];
	if (state.over || state.phase === 'summary' || state.phase === 'over') return events;
	state.time += dt;
	state.enter = Math.max(0, state.enter - dt / SEAL_ENTER_TIME);
	movePenguin(state, dt);

	const active = state.phase === 'sliding' ? activeStone(state) : undefined;
	const sweeping = state.sweeping && state.sweepEnergy > 0 && active !== undefined;
	if (sweeping) {
		state.sweepEnergy = Math.max(0, state.sweepEnergy - SWEEP_DRAIN * dt);
	}

	const penguin = state.hazards.penguin;
	for (const stone of state.stones) {
		if (stone.status !== 'moving') continue;
		const own = stone === active && sweeping;
		const speed = speedOf(stone);
		stone.rot += stone.spin * (speed / 60 + 0.4) * dt * 2;
		const moving = stepStone(stone, dt, {
			wind: state.hazards.wind,
			drift: state.hazards.drift,
			sweeping: own
		});
		if (!moving) stone.status = 'rest';
	}

	// Seals and the penguin
	for (const stone of state.stones) {
		if (stone.status === 'sunk') continue;
		const movingBefore = stone.status === 'moving';
		for (let i = 0; i < state.hazards.seals.length; i++) {
			const seal = state.hazards.seals[i];
			if (!movingBefore) continue;
			const strength = collideObstacle(stone, seal, SEAL_R, SEAL_RESTITUTION);
			if (strength > 0) {
				state.sealBumps++;
				state.endSealBumps++;
				events.push({ type: 'bump', kind: 'seal', x: seal.x, y: seal.y, strength, index: i });
			}
		}
		if (penguin) {
			const pace = { x: penguin.x, y: penguin.y, vx: penguin.vx, vy: 0 };
			const speed = speedOf(stone);
			if (movingBefore) {
				const strength = collideObstacle(stone, pace, PENGUIN_R, PENGUIN_RESTITUTION);
				if (strength > 0 && speed > 12 && penguin.cooldown === 0) {
					penguin.cooldown = 1.2;
					state.penguinHits++;
					state.endPenguinHits++;
					events.push({ type: 'penguin-hit', x: penguin.x, y: penguin.y });
					events.push({ type: 'bump', kind: 'penguin', x: penguin.x, y: penguin.y, strength });
				}
			} else if (Math.hypot(stone.x - penguin.x, stone.y - penguin.y) < PENGUIN_R + 11) {
				// A waddling penguin gives a resting stone a gentle shove
				stone.vx = penguin.vx * 1.15;
				penguin.cooldown = Math.max(penguin.cooldown, 0.8);
				stone.vy = 0;
				stone.status = 'moving';
				const nx = Math.sign(stone.x - penguin.x) || 1;
				stone.x = penguin.x + nx * (PENGUIN_R + 11 + 0.5);
			}
		}
	}

	// Stone against stone
	for (let i = 0; i < state.stones.length; i++) {
		const a = state.stones[i];
		if (a.status === 'sunk') continue;
		for (let j = i + 1; j < state.stones.length; j++) {
			const b = state.stones[j];
			if (b.status === 'sunk') continue;
			if (a.status === 'rest' && b.status === 'rest') continue;
			const strength = collideStones(a, b, STONE_RESTITUTION);
			if (strength > 0) {
				a.status = speedOf(a) > 0 ? 'moving' : a.status;
				b.status = speedOf(b) > 0 ? 'moving' : b.status;
				events.push({
					type: 'bump',
					kind: 'stone',
					x: (a.x + b.x) / 2,
					y: (a.y + b.y) / 2,
					strength
				});
			}
		}
	}

	// Off the slab
	for (const stone of state.stones) {
		if (stone.status === 'sunk' || onSheet(stone)) continue;
		stone.status = 'sunk';
		stone.sunkAt = state.time;
		events.push({ type: 'sunk', x: stone.x, y: stone.y, gamble: stone.gamble });
		if (stone === active) state.sweeping = false;
	}

	if (state.phase === 'sliding') {
		if (state.stones.some((stone) => stone.status === 'moving')) {
			state.settle = 0;
		} else {
			state.settle += dt;
			if (state.settle >= SETTLE_DELAY) events.push(...finishStone(state));
		}
	}
	return events;
}

function finishStone(state: CurlState): CurlEvent[] {
	const events: CurlEvent[] = [{ type: 'stone-done', stone: state.stoneIndex }];
	state.sweeping = false;
	if (state.stoneIndex + 1 < STONES_PER_END) {
		state.stoneIndex++;
		state.phase = 'aiming';
		state.gamble = false;
		return events;
	}
	const result = summarizeEnd(
		state.endIndex,
		state.stones,
		state.endPenguinHits,
		state.endSealBumps
	);
	state.results.push(result);
	state.score = runningScore(state);
	state.phase = 'summary';
	events.push({ type: 'end-done', result });
	return events;
}

/** The score so far, counting the finished ends only */
export function runningScore(state: CurlState): number {
	return state.results.length === 0 ? 0 : finalScore(state.results, state.penguinHits).score;
}

/** Moves on from the end summary: the next end, or the end of the game after the last one */
export function nextEnd(state: CurlState, random: Random): CurlEvent[] {
	if (state.phase !== 'summary') return [];
	if (state.endIndex + 1 >= ENDS_TOTAL) return endGame(state);
	state.endIndex++;
	state.stoneIndex = 0;
	state.stones = [];
	state.hazards = endHazards(state.endIndex, random);
	state.phase = 'aiming';
	state.gamble = false;
	state.sweeping = false;
	state.sweepEnergy = 1;
	state.settle = 0;
	state.enter = state.hazards.seals.length > 0 ? 1 : 0;
	state.endPenguinHits = 0;
	state.endSealBumps = 0;
	state.angle = 0;
	state.score = runningScore(state);
	return [{ type: 'end-start', end: state.endIndex, hazard: hazardIntroducedAt(state.endIndex) }];
}

/** Ends the game now, counting the finished ends (also used when the player gives up) */
export function endGame(state: CurlState): CurlEvent[] {
	if (state.over) return [];
	const final = finalScore(state.results, state.penguinHits);
	state.over = true;
	state.phase = 'over';
	state.sweeping = false;
	state.score = final.score;
	return [{ type: 'game-over', final }];
}

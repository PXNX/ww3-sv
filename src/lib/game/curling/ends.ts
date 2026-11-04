/*
 * The rules around an end of Iceberg Curling: which hazards each end brings, how a stone scores
 * and how an end turns into points and stars. Difficulty rises with every end: wind from the
 * second, a lost penguin from the third, seals from the fourth and a drifting lane from the sixth,
 * while the aiming hint shrinks.
 */
import type { Random } from '../random';
import {
	CLEAN_ICE_BONUS,
	DRIFT_Y0,
	DRIFT_Y1,
	ENDS_TOTAL,
	GAMBLE_MULTIPLIER,
	GAMBLE_PENALTY,
	HACK,
	HOUSE,
	PENGUIN_PENALTY,
	PENGUIN_R,
	POINT_VALUE,
	RINGS,
	SEAL_R,
	SHEET_L,
	SHEET_R,
	STAR_THRESHOLDS,
	STAR_VALUE
} from './config';
import type { Drift } from './physics';

export type HazardKind = 'wind' | 'penguin' | 'seals' | 'drift';

export interface Seal {
	/** Where the seal comes to rest */
	x: number;
	y: number;
	/** Which edge it slid in from: -1 left, 1 right */
	side: -1 | 1;
}

export interface Penguin {
	x: number;
	y: number;
	/** Waddling speed, negative to the left */
	vx: number;
	/** Seconds until the penguin can be hit again */
	cooldown: number;
	/** Waddle clock, for the animation */
	phase: number;
}

export interface Hazards {
	/** Sideways wind acceleration, negative blows left */
	wind: number;
	penguin: Penguin | null;
	seals: Seal[];
	drift: Drift | null;
}

/** The end in which each hazard first shows up (0 is the first end) */
export const HAZARD_INTRO: Record<HazardKind, number> = {
	wind: 1,
	penguin: 2,
	seals: 3,
	drift: 5
};

export function hazardIntroducedAt(endIndex: number): HazardKind | null {
	for (const kind of Object.keys(HAZARD_INTRO) as HazardKind[]) {
		if (HAZARD_INTRO[kind] === endIndex) return kind;
	}
	return null;
}

export function sealCount(endIndex: number): number {
	if (endIndex < HAZARD_INTRO.seals) return 0;
	return endIndex < 5 ? 1 : endIndex < 7 ? 2 : 3;
}

/** Fraction of the predicted path the aiming hint shows: the whole way at first, little at the end */
export function hintFraction(endIndex: number): number {
	return Math.min(1, Math.max(0.1, 1 - endIndex * 0.13));
}

const sign = (random: Random): -1 | 1 => (random() < 0.5 ? -1 : 1);

/** Draws the hazards of an end; the same random sequence always gives the same end */
export function endHazards(endIndex: number, random: Random): Hazards {
	const hazards: Hazards = { wind: 0, penguin: null, seals: [], drift: null };
	if (endIndex >= HAZARD_INTRO.wind) {
		hazards.wind = sign(random) * (2.4 + endIndex * 0.55 + random());
	}
	if (endIndex >= HAZARD_INTRO.penguin) {
		hazards.penguin = {
			x: SHEET_L + 40 + random() * (SHEET_R - SHEET_L - 80),
			y: 236 + random() * 44,
			vx: sign(random) * (22 + endIndex * 3 + random() * 6),
			cooldown: 0,
			phase: random() * 6
		};
	}
	const count = sealCount(endIndex);
	for (let attempt = 0; hazards.seals.length < count && attempt < 60; attempt++) {
		const x = SHEET_L + 50 + random() * (SHEET_R - SHEET_L - 100);
		const y = 150 + random() * 130;
		const clear = hazards.seals.every((seal) => Math.hypot(seal.x - x, seal.y - y) > 70);
		const awayFromHouse = Math.hypot(x - HOUSE.x, y - HOUSE.y) > 70 + SEAL_R;
		const awayFromPenguin =
			!hazards.penguin || Math.abs(hazards.penguin.y - y) > PENGUIN_R + SEAL_R + 8;
		const awayFromHack = Math.hypot(x - HACK.x, y - HACK.y) > 90;
		if (clear && awayFromHouse && awayFromPenguin && awayFromHack) {
			hazards.seals.push({ x, y, side: x < 320 ? -1 : 1 });
		}
	}
	if (endIndex >= HAZARD_INTRO.drift) {
		hazards.drift = { ax: sign(random) * (26 + (endIndex - HAZARD_INTRO.drift) * 7) };
	}
	return hazards;
}

export function driftBand() {
	return { y0: DRIFT_Y0, y1: DRIFT_Y1 };
}

/** Points of a stone resting at a spot, before any gamble: the ring it lies in */
export function ringPoints(x: number, y: number): number {
	const distance = Math.hypot(x - HOUSE.x, y - HOUSE.y);
	for (const ring of RINGS) {
		if (distance <= ring.r) return ring.points;
	}
	return 0;
}

export type StoneOutcome = 'house' | 'outside' | 'sunk';

export interface StoneResult {
	outcome: StoneOutcome;
	/** Points of the ring the stone ended in (0 outside the house) */
	ring: number;
	gamble: boolean;
	/** Points the stone adds to the end: doubled by a gamble, negative when a gamble fails */
	points: number;
}

export function scoreStone(stone: {
	x: number;
	y: number;
	status: 'moving' | 'rest' | 'sunk';
	gamble: boolean;
}): StoneResult {
	if (stone.status === 'sunk') {
		return {
			outcome: 'sunk',
			ring: 0,
			gamble: stone.gamble,
			points: stone.gamble ? -GAMBLE_PENALTY : 0
		};
	}
	const ring = ringPoints(stone.x, stone.y);
	if (ring === 0) {
		return {
			outcome: 'outside',
			ring: 0,
			gamble: stone.gamble,
			points: stone.gamble ? -GAMBLE_PENALTY : 0
		};
	}
	return {
		outcome: 'house',
		ring,
		gamble: stone.gamble,
		points: stone.gamble ? ring * GAMBLE_MULTIPLIER : ring
	};
}

export function starsFor(points: number): number {
	let stars = 0;
	for (const threshold of STAR_THRESHOLDS) if (points >= threshold) stars++;
	return stars;
}

export interface EndResult {
	/** 0-based index of the end */
	end: number;
	stones: StoneResult[];
	penguinHits: number;
	sealBumps: number;
	/** Points lost to the penguin */
	penguinPenalty: number;
	/** Points of the end, never below zero */
	points: number;
	stars: number;
	/** A stone sits on the button: the sign flips to sold */
	sold: boolean;
}

export function summarizeEnd(
	end: number,
	stones: Parameters<typeof scoreStone>[0][],
	penguinHits: number,
	sealBumps: number
): EndResult {
	const results = stones.map(scoreStone);
	const penguinPenalty = penguinHits * PENGUIN_PENALTY;
	const sum = results.reduce((total, result) => total + result.points, 0) - penguinPenalty;
	const points = Math.max(0, sum);
	return {
		end,
		stones: results,
		penguinHits,
		sealBumps,
		penguinPenalty,
		points,
		stars: starsFor(points),
		sold: results.some((result) => result.outcome === 'house' && result.ring === RINGS[0].points)
	};
}

export interface FinalScore {
	points: number;
	stars: number;
	cleanIce: boolean;
	score: number;
}

export function finalScore(results: readonly EndResult[], penguinHits: number): FinalScore {
	const points = results.reduce((total, result) => total + result.points, 0);
	const stars = results.reduce((total, result) => total + result.stars, 0);
	const cleanIce = results.length >= ENDS_TOTAL && penguinHits === 0;
	return {
		points,
		stars,
		cleanIce,
		score: points * POINT_VALUE + stars * STAR_VALUE + (cleanIce ? CLEAN_ICE_BONUS : 0)
	};
}

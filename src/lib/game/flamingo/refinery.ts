/*
 * Refineries for the end of every Flamingo Flight segment: a seeded row of cartoon storage tanks
 * and one flare stack, plus strike scoring. A direct hit on the biggest tank sets off the whole
 * refinery; any other tank only sets off the tanks standing right next to it.
 */
import { randomInt, shuffle, type Random } from '../random';
import { GROUND_Y, type Rect } from './physics';

export interface TankTier {
	halfWidth: number;
	height: number;
	points: number;
}

/** The last tier is used for exactly one tank per refinery: the biggest one */
export const TANK_TIERS: readonly TankTier[] = [
	{ halfWidth: 18, height: 54, points: 20 },
	{ halfWidth: 24, height: 72, points: 30 },
	{ halfWidth: 30, height: 88, points: 40 },
	{ halfWidth: 42, height: 112, points: 60 }
];
export const BIGGEST_TIER = TANK_TIERS.length - 1;
export const BIGGEST_TANK_BONUS = 100;
/** Tanks whose walls are at most this far apart set each other off */
export const CHAIN_GAP = 14;
export const FLARE_WIDTH = 14;
/** How many invented refinery names exist in the message files */
export const REFINERY_NAME_COUNT = 6;

export interface Tank {
	/** Center in world units */
	x: number;
	halfWidth: number;
	height: number;
	tier: number;
}

export interface FlareStack {
	/** Center in world units */
	x: number;
	width: number;
	/** Height including the flame on top */
	height: number;
}

export interface Refinery {
	startX: number;
	endX: number;
	tanks: Tank[];
	flare: FlareStack;
	/** Index of the biggest tank */
	biggest: number;
	nameIndex: number;
}

export interface StrikeResult {
	hitIndex: number;
	destroyed: number[];
	biggestHit: boolean;
	points: number;
}

export function tankRect(tank: Tank): Rect {
	return {
		x: tank.x - tank.halfWidth,
		y: GROUND_Y - tank.height,
		width: tank.halfWidth * 2,
		height: tank.height
	};
}

export function flareRect(flare: FlareStack): Rect {
	return {
		x: flare.x - flare.width / 2,
		y: GROUND_Y - flare.height,
		width: flare.width,
		height: flare.height
	};
}

export function generateRefinery(random: Random, segment: number, startX: number): Refinery {
	const smallTanks = 2 + randomInt(random, 0, 2) + Math.min(2, Math.floor(segment / 2));
	const tiers = shuffle(random, [
		BIGGEST_TIER,
		...Array.from({ length: smallTanks }, () => randomInt(random, 0, BIGGEST_TIER))
	]);
	const flareSlot = randomInt(random, 0, tiers.length + 1);

	const tanks: Tank[] = [];
	let flare: FlareStack | undefined;
	let cursor = startX;
	let lastGap = 0;
	for (let slot = 0; slot <= tiers.length; slot++) {
		if (slot === flareSlot) {
			flare = {
				x: cursor + FLARE_WIDTH / 2,
				width: FLARE_WIDTH,
				height: 170 + randomInt(random, 0, 50) + Math.min(40, segment * 8)
			};
			cursor += FLARE_WIDTH;
		} else {
			const tier = tiers[slot < flareSlot ? slot : slot - 1];
			const { halfWidth, height } = TANK_TIERS[tier];
			tanks.push({
				x: cursor + halfWidth,
				halfWidth,
				height: height + randomInt(random, -6, 7),
				tier
			});
			cursor += halfWidth * 2;
		}
		// Some neighbors stand close enough to set each other off
		lastGap = random() < 0.4 ? randomInt(random, 4, CHAIN_GAP + 1) : randomInt(random, 24, 57);
		cursor += lastGap;
	}

	return {
		startX,
		endX: cursor - lastGap,
		tanks,
		flare: flare!,
		biggest: tanks.findIndex((tank) => tank.tier === BIGGEST_TIER),
		nameIndex: randomInt(random, 0, REFINERY_NAME_COUNT)
	};
}

function adjacent(a: Tank, b: Tank): boolean {
	return Math.abs(a.x - b.x) - a.halfWidth - b.halfWidth <= CHAIN_GAP;
}

/** Scores a dive onto the tank at hitIndex, including the chain reaction it sets off */
export function strikeTank(refinery: Refinery, hitIndex: number): StrikeResult {
	const { tanks } = refinery;
	const biggestHit = hitIndex === refinery.biggest;
	let destroyed: number[];

	if (biggestHit) {
		destroyed = tanks.map((_, index) => index);
	} else {
		const reached = new Set([hitIndex]);
		const queue = [hitIndex];
		while (queue.length > 0) {
			const current = queue.shift()!;
			tanks.forEach((tank, index) => {
				if (!reached.has(index) && adjacent(tanks[current], tank)) {
					reached.add(index);
					queue.push(index);
				}
			});
		}
		destroyed = [...reached].sort((a, b) => a - b);
	}

	const points =
		destroyed.reduce((sum, index) => sum + TANK_TIERS[tanks[index].tier].points, 0) +
		(biggestHit ? BIGGEST_TANK_BONUS : 0);
	return { hitIndex, destroyed, biggestHit, points };
}

/*
 * Targets for the end of every Flamingo Flight segment: usually a refinery, a seeded row of cartoon
 * storage tanks and one flare stack, now and then a rarer Wildberries warehouse or Yandex datacenter
 * built the same way from buildings and a mast, plus strike scoring. A direct hit on the biggest
 * building sets off the whole site; any other one only sets off those standing right next to it.
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

/** Refineries are the everyday target; the other two only show up now and then */
export type SiteKind = 'refinery' | 'warehouse' | 'datacenter';

interface SiteSpec {
	tiers: readonly TankTier[];
	bonus: number;
	/** Height of the mast (or flare stack) beside the buildings, before random extra */
	mastHeight: number;
}

/** Wide, low halls: easier to hit, so each is worth a little more than a tank of the same tier */
const WAREHOUSE_TIERS: readonly TankTier[] = [
	{ halfWidth: 22, height: 40, points: 25 },
	{ halfWidth: 32, height: 50, points: 35 },
	{ halfWidth: 46, height: 60, points: 50 },
	{ halfWidth: 66, height: 74, points: 80 }
];

/** Narrow server blocks stacked high */
const DATACENTER_TIERS: readonly TankTier[] = [
	{ halfWidth: 16, height: 46, points: 30 },
	{ halfWidth: 22, height: 62, points: 40 },
	{ halfWidth: 30, height: 80, points: 55 },
	{ halfWidth: 44, height: 106, points: 90 }
];

export const SITES: Record<SiteKind, SiteSpec> = {
	refinery: { tiers: TANK_TIERS, bonus: BIGGEST_TANK_BONUS, mastHeight: 170 },
	warehouse: { tiers: WAREHOUSE_TIERS, bonus: 150, mastHeight: 160 },
	datacenter: { tiers: DATACENTER_TIERS, bonus: 160, mastHeight: 190 }
};

/** Chance of each rarer site per segment; the rest are refineries */
export const WAREHOUSE_CHANCE = 0.12;
export const DATACENTER_CHANCE = 0.12;

/** Picks a site from a uniform roll in [0, 1); the first segment is always a refinery */
export function siteKindFor(segment: number, roll: number): SiteKind {
	if (segment === 0) return 'refinery';
	if (roll < WAREHOUSE_CHANCE) return 'warehouse';
	if (roll < WAREHOUSE_CHANCE + DATACENTER_CHANCE) return 'datacenter';
	return 'refinery';
}
/** Tanks whose walls are at most this far apart set each other off */
export const CHAIN_GAP = 14;
export const FLARE_WIDTH = 14;
/** How many invented refinery names exist in the message files; the other sites have one name each */
export const REFINERY_NAME_COUNT = 6;

/** One destructible building of a site: a tank, a warehouse hall or a datacenter block */
export interface Tank {
	/** Center in world units */
	x: number;
	halfWidth: number;
	height: number;
	tier: number;
}

/** The mast beside the buildings that the flamingo must not touch: a flare stack at refineries */
export interface FlareStack {
	/** Center in world units */
	x: number;
	width: number;
	/** Height including the flame on top */
	height: number;
}

export interface Refinery {
	kind: SiteKind;
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

export function generateRefinery(
	random: Random,
	segment: number,
	startX: number,
	kind: SiteKind = 'refinery'
): Refinery {
	const { tiers: tierTable, mastHeight } = SITES[kind];
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
				height: mastHeight + randomInt(random, 0, 50) + Math.min(40, segment * 8)
			};
			cursor += FLARE_WIDTH;
		} else {
			const tier = tiers[slot < flareSlot ? slot : slot - 1];
			const { halfWidth, height } = tierTable[tier];
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
		kind,
		startX,
		endX: cursor - lastGap,
		tanks,
		flare: flare!,
		biggest: tanks.findIndex((tank) => tank.tier === BIGGEST_TIER),
		nameIndex: kind === 'refinery' ? randomInt(random, 0, REFINERY_NAME_COUNT) : 0
	};
}

function adjacent(a: Tank, b: Tank): boolean {
	return Math.abs(a.x - b.x) - a.halfWidth - b.halfWidth <= CHAIN_GAP;
}

/** Scores a dive onto the tank at hitIndex, including the chain reaction it sets off */
export function strikeTank(refinery: Refinery, hitIndex: number): StrikeResult {
	const { tanks } = refinery;
	const { tiers, bonus } = SITES[refinery.kind];
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
		destroyed.reduce((sum, index) => sum + tiers[tanks[index].tier].points, 0) +
		(biggestHit ? bonus : 0);
	return { hitIndex, destroyed, biggestHit, points };
}

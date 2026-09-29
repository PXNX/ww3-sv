/*
 * Hand-authored obstacle patterns for Convoy Runner (requirements Section 4, "fair spawning").
 * Every pattern, and every pattern following another at top speed, leaves at least one lane the
 * tanker can reach given its lane-change time; the reachability check below proves it in tests.
 */
import { pickWeighted, type Random } from '$lib/game/random';
import {
	ITEM_SIZE,
	LANE_CHANGE_MS,
	LANES,
	TANKER_HALF_LENGTH,
	isObstacle,
	type ItemKind,
	type Lane
} from './constants';

export interface PatternItem {
	kind: ItemKind;
	lane: Lane;
	/** Distance from the start of the pattern, in world units */
	at: number;
	/** Gunboats only: the lane the gunboat drifts into while approaching */
	driftTo?: Lane;
}

export interface ObstaclePattern {
	id: string;
	/** Distance the run must have covered before this pattern can appear */
	minDistance: number;
	weight: number;
	items: readonly PatternItem[];
}

const CELL_KINDS: Record<string, ItemKind> = {
	M: 'mine',
	G: 'gunboat',
	D: 'drone',
	S: 'slick',
	B: 'barrel',
	E: 'escort'
};

/**
 * One row of a pattern, written as five characters, one per lane from left to right:
 * M mine, G gunboat, D drone, S oil slick, B oil barrel, E submarine escort, . empty,
 * and < or > for a gunboat drifting one lane to the left or right.
 */
function row(at: number, cells: string): PatternItem[] {
	if (cells.length !== LANES.length) throw new Error(`Row "${cells}" needs one cell per lane`);
	return LANES.flatMap((lane): PatternItem[] => {
		const cell = cells[lane];
		if (cell === '.') return [];
		if (cell === '<' || cell === '>') {
			const driftTo = lane + (cell === '<' ? -1 : 1);
			if (driftTo < 0 || driftTo >= LANES.length) throw new Error(`Gunboat drifts off the strait`);
			return [{ kind: 'gunboat', lane, at, driftTo: driftTo as Lane }];
		}
		const kind = CELL_KINDS[cell];
		if (!kind) throw new Error(`Unknown pattern cell "${cell}"`);
		return [{ kind, lane, at }];
	});
}

function pattern(
	id: string,
	minDistance: number,
	weight: number,
	rows: PatternItem[][]
): ObstaclePattern {
	return { id, minDistance, weight, items: rows.flat() };
}

export const PATTERNS: readonly ObstaclePattern[] = [
	pattern('lone-mine', 0, 3, [row(0, '.BMB.')]),
	pattern('side-mines', 0, 2, [row(0, '.MBM.'), row(1.2, '..B..')]),
	pattern('double-mine', 0, 2, [row(0, '.MM..'), row(1.5, '...B.')]),
	pattern('barrel-diagonal', 0, 1, [row(0, '.B...'), row(1, '..B..'), row(2, '...B.')]),
	pattern('barrel-alley', 0, 1.5, [row(0, '.MBM.'), row(1, '..B..'), row(2, '.MBM.')]),
	pattern('gunboat-drift', 30, 2, [row(0, '.>.B.')]),
	pattern('zigzag', 40, 2, [row(0, '.MM..'), row(3.2, '.M.M.'), row(6.4, '..MM.')]),
	pattern('slick-corridor', 50, 1.5, [row(0, '.SM..'), row(2, '...B.'), row(4, '..MS.')]),
	pattern('drone-pair', 60, 2, [row(0, '.D.D.'), row(1.5, '..B..')]),
	pattern('gunboat-pair', 80, 1.5, [row(0, '.G...'), row(3.4, '...<.')]),
	pattern('escort-drop', 100, 0.5, [row(0, '.MEM.')]),
	pattern('drone-chase', 120, 1.5, [row(0, '.DD..'), row(3.6, '..DD.')]),
	pattern('oil-spill', 150, 1, [row(0, '.BSB.'), row(1, '..S..'), row(4, '.M.M.')]),
	pattern('gauntlet', 200, 1.5, [row(0, '.G.M.'), row(3.4, '..D..'), row(6.8, '.M.S.')]),
	pattern('crossing-gunboat', 300, 1, [row(0, '..>..'), row(3.6, '.M...')])
];

/** Distance from the first to the last row of a pattern */
export function patternLength(source: ObstaclePattern): number {
	return Math.max(0, ...source.items.map((item) => item.at));
}

function mirrorLane(lane: Lane): Lane {
	return (LANES.length - 1 - lane) as Lane;
}

/** The same pattern flipped left to right, which is just as fair */
export function mirrorPattern(source: ObstaclePattern): ObstaclePattern {
	return {
		...source,
		id: `${source.id}-mirrored`,
		items: source.items.map((item) => ({
			...item,
			lane: mirrorLane(item.lane),
			driftTo: item.driftTo === undefined ? undefined : mirrorLane(item.driftTo)
		}))
	};
}

export function eligiblePatterns(distance: number): ObstaclePattern[] {
	return PATTERNS.filter((candidate) => candidate.minDistance <= distance);
}

/** Picks the next pattern by weight, avoiding an immediate repeat when there is a choice */
export function pickPattern(
	random: Random,
	distance: number,
	previousId: string | null = null
): ObstaclePattern {
	const eligible = eligiblePatterns(distance);
	const fresh = eligible.filter((candidate) => candidate.id !== previousId);
	const pool = fresh.length > 0 ? fresh : eligible;
	return pickWeighted(
		random,
		pool.map((item) => ({ item, weight: item.weight }))
	);
}

/** A stretch of tanker positions (its center's distance) during which lanes are unsafe */
export interface BlockedSpan {
	lanes: readonly Lane[];
	from: number;
	to: number;
}

/**
 * Converts pattern items placed at offset into blocked spans. Drifting gunboats conservatively
 * block every lane they pass through, since the player cannot know in advance where they settle.
 */
export function blockedSpans(items: readonly PatternItem[], offset = 0): BlockedSpan[] {
	return items
		.filter((item) => isObstacle(item.kind))
		.map((item) => {
			const reach = TANKER_HALF_LENGTH + ITEM_SIZE[item.kind].halfLength;
			const end = item.driftTo ?? item.lane;
			const lanes = LANES.filter(
				(lane) => lane >= Math.min(item.lane, end) && lane <= Math.max(item.lane, end)
			);
			return { lanes, from: offset + item.at - reach, to: offset + item.at + reach };
		});
}

/** Distance covered during one lane change at the given speed (world units per second) */
export function laneChangeDistance(speed: number): number {
	return (speed * LANE_CHANGE_MS) / 1000;
}

/**
 * Which lanes the tanker can still be in at distance to, starting in one of startLanes at
 * distance from, without touching a blocked span. A lane change is only allowed while both lanes
 * are clear for its whole duration, which is stricter than the real collision check.
 */
export function survivingLanes(
	spans: readonly BlockedSpan[],
	startLanes: readonly Lane[],
	speed: number,
	from: number,
	to: number,
	resolution = 0.02
): Lane[] {
	const steps = Math.max(0, Math.ceil((to - from) / resolution));
	const changeSteps = Math.max(1, Math.ceil(laneChangeDistance(speed) / resolution));

	// Blocked steps per lane, with running counts so a stretch can be checked in constant time
	const blockedCount = LANES.map((lane) => {
		const hits = new Uint8Array(steps + 1);
		for (const span of spans) {
			if (!span.lanes.includes(lane)) continue;
			const first = Math.max(0, Math.ceil((span.from - from) / resolution));
			const last = Math.min(steps, Math.floor((span.to - from) / resolution));
			for (let step = first; step <= last; step++) hits[step] = 1;
		}
		const counts = new Int32Array(steps + 2);
		for (let step = 0; step <= steps; step++) counts[step + 1] = counts[step] + hits[step];
		return counts;
	});
	const clear = (lane: Lane, first: number, last: number) =>
		blockedCount[lane][last + 1] - blockedCount[lane][first] === 0;
	const blocked = (lane: Lane, step: number) => !clear(lane, step, step);

	const reachable = Array.from({ length: steps + 1 }, () => new Set<Lane>());
	for (const lane of startLanes) if (!blocked(lane, 0)) reachable[0].add(lane);

	for (let step = 0; step < steps; step++) {
		for (const lane of reachable[step]) {
			if (!blocked(lane, step + 1)) reachable[step + 1].add(lane);
			for (const next of [lane - 1, lane + 1]) {
				if (next < 0 || next >= LANES.length) continue;
				const target = next as Lane;
				const arrival = Math.min(steps, step + changeSteps);
				if (clear(lane, step, arrival) && clear(target, step, arrival)) {
					reachable[arrival].add(target);
				}
			}
		}
	}
	return LANES.filter((lane) => reachable[steps].has(lane));
}

/** First and last tanker positions affected by a list of spans */
export function spanExtent(spans: readonly BlockedSpan[]): { from: number; to: number } {
	return {
		from: Math.min(...spans.map((span) => span.from)),
		to: Math.max(...spans.map((span) => span.to))
	};
}

import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import {
	ITEM_SIZE,
	LANES,
	MAX_SPEED,
	PATTERN_GAP,
	REACTION_MS,
	START_SPEED,
	TANKER_HALF_LENGTH,
	VIEW_AHEAD,
	isObstacle,
	type Lane
} from './constants';
import {
	PATTERNS,
	blockedSpans,
	eligiblePatterns,
	laneChangeDistance,
	mirrorPattern,
	patternLength,
	pickPattern,
	spanExtent,
	survivingLanes,
	type ObstaclePattern
} from './obstaclePatterns';

const ALL_PATTERNS = PATTERNS.flatMap((source) => [source, mirrorPattern(source)]);
const SPEEDS = [START_SPEED, (START_SPEED + MAX_SPEED) / 2, MAX_SPEED];
const LARGEST_HALF_LENGTH = Math.max(...Object.values(ITEM_SIZE).map((size) => size.halfLength));

/** How far ahead the first row is when the player can first react to it at a given speed */
function entryDistance(speed: number): number {
	return VIEW_AHEAD - (speed * REACTION_MS) / 1000;
}

function hasObstacles(source: ObstaclePattern): boolean {
	return source.items.some((item) => isObstacle(item.kind));
}

/** Lanes alive after a pattern, starting in the given lane with the first row entryDistance ahead */
function survive(source: ObstaclePattern, start: Lane, speed: number): Lane[] {
	const spans = blockedSpans(source.items);
	if (spans.length === 0) return [start];
	const firstAt = Math.min(...source.items.map((item) => item.at));
	const { to } = spanExtent(spans);
	return survivingLanes(spans, [start], speed, firstAt - entryDistance(speed), to);
}

describe('pattern set', () => {
	it('has unique ids, sane weights and rows inside the pattern', () => {
		const ids = PATTERNS.map((source) => source.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const source of PATTERNS) {
			expect(source.weight, source.id).toBeGreaterThan(0);
			expect(source.items.length, source.id).toBeGreaterThan(0);
			for (const item of source.items) {
				expect(item.at, source.id).toBeGreaterThanOrEqual(0);
				expect(LANES, source.id).toContain(item.lane);
				if (item.driftTo !== undefined) {
					expect(item.kind, source.id).toBe('gunboat');
					expect(Math.abs(item.driftTo - item.lane), source.id).toBe(1);
				}
			}
		}
	});

	it('never puts two things in the same spot', () => {
		for (const source of ALL_PATTERNS) {
			const spots = source.items.map((item) => `${item.lane}@${item.at}`);
			expect(new Set(spots).size, source.id).toBe(spots.length);
		}
	});

	it('uses every kind of hazard and collectible somewhere', () => {
		const kinds = new Set(PATTERNS.flatMap((source) => source.items.map((item) => item.kind)));
		expect([...kinds].sort()).toEqual(['barrel', 'drone', 'escort', 'gunboat', 'mine', 'slick']);
		expect(PATTERNS.some((source) => source.items.some((item) => item.driftTo !== undefined))).toBe(
			true
		);
	});

	it('offers easy patterns from the very start', () => {
		expect(eligiblePatterns(0).length).toBeGreaterThanOrEqual(3);
		expect(eligiblePatterns(Number.POSITIVE_INFINITY)).toHaveLength(PATTERNS.length);
	});

	it('mirrors lanes and gunboat drift', () => {
		const drift = PATTERNS.find((source) => source.id === 'gunboat-drift')!;
		const mirrored = mirrorPattern(drift);
		const gunboat = mirrored.items.find((item) => item.kind === 'gunboat')!;
		expect(gunboat).toMatchObject({ lane: 3, driftTo: 2 });
		expect(mirrorPattern(mirrored).items).toEqual(drift.items);
	});
});

describe('pickPattern', () => {
	it('is deterministic for a seed', () => {
		const sequence = (seed: number) => {
			const random = createRandom(seed);
			return Array.from({ length: 20 }, (_, index) => pickPattern(random, index * 30).id);
		};
		expect(sequence(7)).toEqual(sequence(7));
		expect(sequence(7)).not.toEqual(sequence(8));
	});

	it('only picks patterns unlocked at the distance', () => {
		const random = createRandom(3);
		for (let i = 0; i < 200; i++) {
			expect(pickPattern(random, 20).minDistance).toBeLessThanOrEqual(20);
		}
	});

	it('does not repeat the previous pattern when there is a choice', () => {
		const random = createRandom(11);
		let previous: string | null = null;
		for (let i = 0; i < 300; i++) {
			const picked = pickPattern(random, 1000, previous);
			expect(picked.id).not.toBe(previous);
			previous = picked.id;
		}
	});

	it('eventually picks every pattern late in a run', () => {
		const random = createRandom(5);
		const seen = new Set<string>();
		for (let i = 0; i < 2000; i++) seen.add(pickPattern(random, 1000).id);
		expect(seen.size).toBe(PATTERNS.length);
	});
});

describe('survivingLanes', () => {
	const wall = (lanes: readonly Lane[], at: number) =>
		blockedSpans(lanes.map((lane) => ({ kind: 'mine' as const, lane, at })));

	it('keeps a lane that is never blocked', () => {
		expect(survivingLanes(wall([0, 1, 3, 4], 3), [2], MAX_SPEED, 0, 3)).toEqual([2]);
	});

	it('finds nothing when every lane is walled off', () => {
		expect(survivingLanes(wall(LANES, 3), LANES, MAX_SPEED, 0, 5)).toEqual([]);
	});

	it('allows moving across when there is room', () => {
		// Checked while the wall is alongside the tanker: only the open lane is survivable there
		expect(survivingLanes(wall([1, 2, 3, 4], 3), [2], MAX_SPEED, 0, 3)).toEqual([0]);
		// Once the wall has passed, every lane is open again, given enough room to cross back to it
		expect(survivingLanes(wall([1, 2, 3, 4], 3), [2], MAX_SPEED, 0, 9)).toEqual([...LANES]);
	});

	it('rejects a lane change that would need more time than there is', () => {
		const reach = TANKER_HALF_LENGTH + ITEM_SIZE.mine.halfLength;
		// Lane 2 is blocked shortly after the start, too soon to move two lanes across
		const tooSoon = reach + laneChangeDistance(MAX_SPEED);
		expect(survivingLanes(wall([1, 2], tooSoon), [2], MAX_SPEED, 0, tooSoon + reach)).toEqual([]);
	});

	it('treats a drifting gunboat as blocking both lanes', () => {
		const spans = blockedSpans([{ kind: 'gunboat', lane: 0, at: 0, driftTo: 1 }]);
		expect(spans[0].lanes).toEqual([0, 1]);
	});

	it('catches an unfair staircase of mines', () => {
		const staircase = blockedSpans(
			LANES.map((lane) => ({ kind: 'mine' as const, lane, at: lane * 2 }))
		);
		expect(survivingLanes(staircase, LANES, MAX_SPEED, -3, LANES.length * 2 + 1)).toEqual([]);
	});

	it('ignores collectibles', () => {
		expect(blockedSpans([{ kind: 'barrel', lane: 0, at: 0 }])).toEqual([]);
		expect(blockedSpans([{ kind: 'escort', lane: 0, at: 0 }])).toEqual([]);
	});
});

describe('fair spawning', () => {
	it('shows enough of the strait to react and change two lanes at top speed', () => {
		const clearance = 2 * (TANKER_HALF_LENGTH + LARGEST_HALF_LENGTH);
		expect(entryDistance(MAX_SPEED)).toBeGreaterThan(
			2 * laneChangeDistance(MAX_SPEED) + clearance / 2
		);
		expect(PATTERN_GAP).toBeGreaterThan(2 * laneChangeDistance(MAX_SPEED) + clearance);
	});

	it.each(ALL_PATTERNS.filter(hasObstacles).map((source) => [source.id, source] as const))(
		'%s leaves a reachable lane from every starting lane at every speed',
		(_, source) => {
			for (const speed of SPEEDS) {
				for (const start of LANES) {
					expect(survive(source, start, speed), `speed ${speed}, lane ${start}`).not.toEqual([]);
				}
			}
		}
	);

	it('every pattern following any other leaves a reachable lane at top speed', () => {
		const failures: string[] = [];
		for (const first of ALL_PATTERNS) {
			// The player finishes the first pattern in any lane still alive, without having planned
			// for the second one, and must still get through it
			const firstSpans = blockedSpans(first.items);
			const endOfFirst = firstSpans.length ? spanExtent(firstSpans).to : 0;
			const aliveAfterFirst = new Set<Lane>(
				firstSpans.length
					? LANES.flatMap((start) =>
							survivingLanes(firstSpans, [start], MAX_SPEED, -entryDistance(MAX_SPEED), endOfFirst)
						)
					: LANES
			);
			const offset = patternLength(first) + PATTERN_GAP;

			for (const second of ALL_PATTERNS) {
				const secondSpans = blockedSpans(second.items, offset);
				if (secondSpans.length === 0) continue;
				const endOfSecond = spanExtent(secondSpans).to;
				for (const lane of aliveAfterFirst) {
					const through = survivingLanes(secondSpans, [lane], MAX_SPEED, endOfFirst, endOfSecond);
					if (through.length === 0) failures.push(`${first.id} -> ${second.id} from ${lane}`);
				}
			}
		}
		expect(failures).toEqual([]);
	}, 20_000);
});

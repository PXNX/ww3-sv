import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	ACTION_COST_MS,
	KIND_UNLOCK,
	LANES,
	LANE_COST_MS,
	MIN_GAP_MS,
	REACTION_MS,
	type Lane
} from './config';
import {
	advanceReach,
	checkFairness,
	createField,
	createGenerator,
	densityAt,
	extendField,
	gapMsAt,
	inTallSunflowers,
	isBlocking,
	nearestLane,
	pruneField,
	speedAt,
	type Cell,
	type Cells,
	type Field,
	type Flags
} from './patterns';

const NONE: Flags = [false, false, false];
const MIDDLE: Flags = [false, true, false];
const START_SPEED = speedAt(0);

function course(seed: number, until: number): Field {
	const field = createField();
	extendField(field, createGenerator(), createRandom(seed), until);
	return field;
}

/** Course distance that takes the given time at the starting speed */
const unitsFor = (ms: number) => (ms / 1000) * START_SPEED;

describe('speed and density', () => {
	it('speeds up with distance and levels off', () => {
		expect(speedAt(0)).toBeLessThan(speedAt(200));
		expect(speedAt(200)).toBeLessThan(speedAt(500));
		expect(speedAt(100_000)).toBe(speedAt(200_000));
	});

	it('gets denser with distance: tighter rows, never tighter than the floor', () => {
		expect(densityAt(0)).toBe(0);
		expect(densityAt(300)).toBeGreaterThan(0);
		expect(densityAt(1e6)).toBe(1);
		expect(gapMsAt(500)).toBeLessThan(gapMsAt(0));
		expect(gapMsAt(1e6)).toBe(MIN_GAP_MS);
	});
});

describe('advanceReach', () => {
	it('lets the runner stay in a lane and jump or duck, but not cross a mine', () => {
		expect(advanceReach(MIDDLE, NONE, ['ditch', 'arm', 'mine'], 5000)).toEqual([true, true, false]);
	});

	it('does not reach a lane with a mine, however much time there is', () => {
		expect(advanceReach(MIDDLE, NONE, ['mine', 'mine', 'mine'], 1e9)).toEqual(NONE);
	});

	it('needs time to change lanes, and more after a jump or duck', () => {
		const clear: Cells = [null, null, null];
		const oneLane = LANE_COST_MS + REACTION_MS;
		expect(advanceReach([true, false, false], NONE, clear, oneLane)).toEqual([true, true, false]);
		expect(advanceReach([true, false, false], NONE, clear, oneLane - 1)).toEqual([
			true,
			false,
			false
		]);
		const busy: Flags = [true, false, false];
		const twoLanes = ACTION_COST_MS + 2 * LANE_COST_MS + REACTION_MS;
		expect(advanceReach([true, false, false], busy, clear, twoLanes)).toEqual([true, true, true]);
		expect(advanceReach([true, false, false], busy, clear, twoLanes - 1)).toEqual([
			true,
			true,
			false
		]);
	});

	it('knows which kinds block a lane', () => {
		expect(isBlocking('mine')).toBe(true);
		expect(isBlocking('ditch')).toBe(false);
		expect(isBlocking('arm')).toBe(false);
		expect(isBlocking(null)).toBe(false);
	});
});

describe('checkFairness', () => {
	it('accepts spaced rows', () => {
		const rows = [
			{ z: 30, cells: ['ditch', null, 'mine'] as Cells },
			{ z: 30 + unitsFor(MIN_GAP_MS) + 0.5, cells: [null, 'arm', 'arm'] as Cells }
		];
		expect(checkFairness(rows, () => START_SPEED)).toEqual({
			fair: true,
			failedRow: null,
			reason: 'none'
		});
	});

	it('rejects a wall of mines', () => {
		const rows = [{ z: 30, cells: ['mine', 'mine', 'mine'] as Cells }];
		expect(checkFairness(rows)).toEqual({ fair: false, failedRow: 0, reason: 'blocked' });
	});

	it('accepts every pair of rows at the floor gap as long as no row is a wall of mines', () => {
		const kinds: Cell[] = [null, 'ditch', 'arm', 'mine'];
		const all: Cells[] = [];
		for (const a of kinds) for (const b of kinds) for (const c of kinds) all.push([a, b, c]);
		const open = all.filter((cells) => cells.some((cell) => !isBlocking(cell)));
		expect(open).toHaveLength(63);
		for (const first of open) {
			for (const second of open) {
				for (const third of [open[0], open[open.length - 1], second]) {
					const rows = [
						{ z: 30, cells: first },
						{ z: 30 + unitsFor(MIN_GAP_MS), cells: second },
						{ z: 30 + 2 * unitsFor(MIN_GAP_MS), cells: third }
					];
					expect(checkFairness(rows, () => START_SPEED).fair, JSON.stringify(rows)).toBe(true);
				}
			}
		}
	});

	it('rejects rows that follow each other too closely', () => {
		const rows = [
			{ z: 30, cells: ['ditch', null, null] as Cells },
			{ z: 34, cells: [null, null, 'arm'] as Cells }
		];
		expect(checkFairness(rows)).toEqual({ fair: false, failedRow: 1, reason: 'too-close' });
	});

	it('judges the gap at the speed of the later row', () => {
		const rows = [
			{ z: 30, cells: [null, null, null] as Cells },
			{ z: 30 + unitsFor(MIN_GAP_MS) + 0.2, cells: [null, null, null] as Cells }
		];
		expect(checkFairness(rows, () => START_SPEED).fair).toBe(true);
		expect(checkFairness(rows, () => START_SPEED * 1.5)).toMatchObject({
			fair: false,
			reason: 'too-close'
		});
	});

	it('agrees with a brute-force search over lane plans on random sequences', () => {
		const random = createRandom(99);
		const kinds = ['ditch', 'arm', 'mine'] as const;
		let unfair = 0;
		for (let n = 0; n < 400; n++) {
			const rows: { z: number; cells: Cells }[] = [];
			let z = 20;
			const count = 1 + Math.floor(random() * 5);
			for (let i = 0; i < count; i++) {
				// some sequences are spaced just at the floor, some far apart
				z += unitsFor(MIN_GAP_MS) + random() * unitsFor(random() < 0.5 ? 100 : 1200);
				const pick = (): Cell => (random() < 0.6 ? kinds[Math.floor(random() * 3)] : null);
				rows.push({ z, cells: [pick(), pick(), pick()] });
			}
			const expected = bruteForce(rows, START_SPEED);
			if (!expected) unfair += 1;
			expect(checkFairness(rows, () => START_SPEED).fair).toBe(expected);
		}
		// the comparison is only worth something if it saw both outcomes
		expect(unfair).toBeGreaterThan(3);
		expect(unfair).toBeLessThan(390);
	});
});

/** Tries every sequence of lanes, one per row, and checks each move against the same time costs */
function bruteForce(rows: readonly { z: number; cells: Cells }[], speed: number): boolean {
	const walk = (
		index: number,
		lane: Lane,
		previous: { z: number; cells: Cells } | null
	): boolean => {
		if (index === rows.length) return true;
		const row = rows[index];
		const gapMs = previous === null ? Infinity : ((row.z - previous.z) / speed) * 1000;
		return LANES.some((to) => {
			if (row.cells[to] === 'mine') return false;
			const busy = previous !== null && previous.cells[lane] !== null;
			const cost = (busy ? ACTION_COST_MS : 0) + Math.abs(to - lane) * LANE_COST_MS + REACTION_MS;
			return cost <= gapMs && walk(index + 1, to, row);
		});
	};
	return walk(0, 1, null);
}

describe('generated courses', () => {
	const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);

	it('are always fair: no unavoidable obstacle combination, however far the run goes', () => {
		for (const seed of SEEDS) {
			const field = course(seed, 4000);
			expect(field.rows.length).toBeGreaterThan(20);
			expect(checkFairness(field.rows), `seed ${seed}`).toEqual({
				fair: true,
				failedRow: null,
				reason: 'none'
			});
		}
	});

	it('are also fair for a brute-force lane planner', () => {
		for (const seed of SEEDS.slice(0, 10)) {
			const { rows } = course(seed, 800);
			// the planner works with one speed, so test it per window of rows at the speed of the window
			for (let start = 0; start + 4 <= rows.length; start += 4) {
				const window = rows.slice(start, start + 4);
				// the window's first row has no row before it, so check only the rows after it
				expect(bruteForce(window, speedAt(window.at(-1)!.z)), `seed ${seed} at ${start}`).toBe(
					true
				);
			}
		}
	});

	it('never wall off a row with mines: some lane is always free of them', () => {
		for (const seed of SEEDS) {
			for (const row of course(seed, 4000).rows) {
				expect(
					row.cells.some((cell) => !isBlocking(cell)),
					`seed ${seed}`
				).toBe(true);
			}
		}
	});

	it('keep every gap between rows at or above the floor, at the speed of the later row', () => {
		for (const seed of SEEDS) {
			const { rows } = course(seed, 4000);
			for (let i = 1; i < rows.length; i++) {
				const ms = ((rows[i].z - rows[i - 1].z) / speedAt(rows[i].z)) * 1000;
				expect(ms, `seed ${seed} row ${i}`).toBeGreaterThanOrEqual(MIN_GAP_MS);
			}
		}
	});

	it('leave a calm start and introduce obstacle kinds one at a time', () => {
		for (const seed of SEEDS) {
			const { rows } = course(seed, 600);
			expect(rows[0].z).toBeGreaterThanOrEqual(30);
			for (const row of rows) {
				for (const cell of row.cells) {
					if (cell) expect(row.z, `${cell} too early`).toBeGreaterThanOrEqual(KIND_UNLOCK[cell]);
				}
				if (row.z < 120) expect(row.cells.filter(Boolean).length).toBeLessThanOrEqual(2);
			}
		}
	});

	it('get denser with distance', () => {
		let early = 0;
		let late = 0;
		let earlyRows = 0;
		let lateRows = 0;
		let lateSpan = 0;
		for (const seed of SEEDS) {
			const { rows } = course(seed, 3000);
			for (const row of rows) {
				const count = row.cells.filter(Boolean).length;
				if (row.z < 300) {
					early += count;
					earlyRows += 1;
				} else if (row.z > 900) {
					late += count;
					lateRows += 1;
				}
			}
			lateSpan += rows.at(-1)!.z - 900;
		}
		expect(late / lateRows).toBeGreaterThan(early / earlyRows);
		// more obstacles per unit of course, not only per row
		expect(late / lateSpan).toBeGreaterThan(early / (270 * SEEDS.length));
	});

	it('are reproducible from a seed and differ between seeds', () => {
		expect(course(5, 800).rows).toEqual(course(5, 800).rows);
		expect(course(5, 800).rows).not.toEqual(course(6, 800).rows);
	});

	it('can be extended in pieces', () => {
		const pieces = createField();
		const generator = createGenerator();
		const random = createRandom(11);
		for (let until = 100; until <= 900; until += 25) extendField(pieces, generator, random, until);
		expect(pieces.rows.length).toBeGreaterThan(10);
		expect(checkFairness(pieces.rows).fair).toBe(true);
		expect(pieces.rows.every((row, index) => index === 0 || row.z > pieces.rows[index - 1].z)).toBe(
			true
		);
	});

	it('put pickups into lanes that are clear in the rows on both sides, away from obstacles', () => {
		let found = 0;
		for (const seed of SEEDS) {
			const { rows, pickups } = course(seed, 3000);
			for (const pickup of pickups) {
				found += 1;
				const before = rows.filter((row) => row.z < pickup.z).at(-1)!;
				const after = rows.find((row) => row.z > pickup.z)!;
				expect(before.cells[pickup.lane]).toBeNull();
				expect(after.cells[pickup.lane]).toBeNull();
				expect(pickup.z - before.z).toBeGreaterThanOrEqual(3);
				expect(after.z - pickup.z).toBeGreaterThanOrEqual(3);
			}
		}
		expect(found).toBeGreaterThan(40);
	});

	it('make both pickup kinds appear', () => {
		const kinds = new Set(SEEDS.flatMap((seed) => course(seed, 2000).pickups.map((p) => p.kind)));
		expect(kinds).toEqual(new Set(['helmet', 'rice']));
	});
});

describe('tall sunflower patches', () => {
	it('exist, cover one or two lanes and keep apart', () => {
		const { patches } = course(3, 2000);
		expect(patches.length).toBeGreaterThan(5);
		for (const patch of patches) {
			expect([1, 2]).toContain(patch.lanes.length);
			expect(patch.zEnd).toBeGreaterThan(patch.zStart);
		}
		for (let i = 1; i < patches.length; i++) {
			expect(patches[i].zStart).toBeGreaterThan(patches[i - 1].zEnd);
		}
	});

	it('hide the drone only for a runner in a covered lane, plus a short tail', () => {
		const field = createField();
		field.patches.push({ id: 1, zStart: 100, zEnd: 120, lanes: [0, 1] });
		expect(inTallSunflowers(field, 110, 0)).toBe(true);
		expect(inTallSunflowers(field, 110, 2)).toBe(false);
		expect(inTallSunflowers(field, 99, 0)).toBe(false);
		expect(inTallSunflowers(field, 121, 0)).toBe(false);
		expect(inTallSunflowers(field, 121, 0, 2)).toBe(true);
	});
});

describe('housekeeping', () => {
	it('prunes what lies far behind the runner', () => {
		const field = course(2, 1000);
		pruneField(field, 500);
		expect(field.rows.every((row) => row.z >= 500)).toBe(true);
		expect(field.pickups.every((pickup) => pickup.z >= 500)).toBe(true);
		expect(field.patches.every((patch) => patch.zEnd >= 500)).toBe(true);
	});

	it('maps a lane position to the nearest lane', () => {
		expect(nearestLane(-0.4)).toBe(0);
		expect(nearestLane(0.4)).toBe(0);
		expect(nearestLane(0.6)).toBe(1);
		expect(nearestLane(1.9)).toBe(2);
		expect(nearestLane(7)).toBe(2);
	});
});

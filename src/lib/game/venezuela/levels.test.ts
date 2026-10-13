import { describe, expect, it } from 'vitest';
import { overlaps } from './collision';
import { LEVEL_ROWS } from './config';
import { createHelicopter, helicopterSweepBox } from './enemies';
import { parseLevel, structureProblems, tileAt, type LevelData } from './level';
import { LEVEL_IDS, RAW_LEVELS, levelAt } from './levels';
import { analyzeReach } from './reach';
import { levelFrom } from './testLevel';

const standable = (level: LevelData, x: number, y: number) => {
	const below = tileAt(level, x, y + 1);
	return below === 'solid' || below === 'oneway';
};

describe('structure checks', () => {
	const good = { id: 'x', rows: levelFrom(['..P........G..', '##############']).rows };

	it('accept a well-formed level', () => {
		expect(structureProblems(good)).toEqual([]);
	});

	it('reject a missing start, a missing flag and a second flag', () => {
		const rows = [...good.rows];
		rows[LEVEL_ROWS - 2] = rows[LEVEL_ROWS - 2].replace('P', '.');
		expect(structureProblems({ id: 'x', rows })).toContain('needs exactly one start (P)');
		const noFlag = good.rows.map((row) => row.replace('G', '.'));
		expect(structureProblems({ id: 'x', rows: noFlag })).toContain('needs exactly one flag (G)');
		const two = [...good.rows];
		two[0] = `G${two[0].slice(1)}`;
		expect(structureProblems({ id: 'x', rows: two })).toContain('needs exactly one flag (G)');
	});

	it('reject wrong row counts, ragged rows and unknown tiles', () => {
		expect(structureProblems({ id: 'x', rows: good.rows.slice(1) })[0]).toMatch(/rows/);
		const ragged = [...good.rows];
		ragged[2] = ragged[2].slice(1);
		expect(structureProblems({ id: 'x', rows: ragged }).join()).toMatch(/different length/);
		const unknown = [...good.rows];
		unknown[3] = `?${unknown[3].slice(1)}`;
		expect(structureProblems({ id: 'x', rows: unknown }).join()).toMatch(/unknown tile/);
	});

	it('parseLevel throws on a broken level', () => {
		expect(() => parseLevel({ id: 'broken', rows: ['.'] })).toThrow(/broken/);
	});
});

describe('reachability with the jump physics', () => {
	const ground = '#'.repeat(40);
	const reachable = (rows: string[]) => analyzeReach(levelFrom(rows, 'probe')).goal;

	it('a flat level is finishable', () => {
		expect(reachable(['..P.........G.', ground, ground])).toBe(true);
	});

	it('a two tile gap can be jumped', () => {
		expect(reachable(['..P.........G...', '#####..#########', '#####..#########'])).toBe(true);
	});

	it('a gap much wider than any jump cannot', () => {
		expect(reachable(['..P.........G...', '#####.......####', '#####.......####'])).toBe(false);
	});

	it('a two tile wall can be climbed, a three tile wall cannot', () => {
		const wall = (height: number) => [
			'................',
			height >= 3 ? '......W.........' : '................',
			'......W.........',
			'..P...W.....G...',
			ground,
			ground
		];
		expect(reachable(wall(2))).toBe(true);
		expect(reachable(wall(3))).toBe(false);
	});

	it('a barrel on a high catwalk needs a crate step to reach', () => {
		const rows = (step: boolean) => [
			'........o...',
			'.......=====',
			'............',
			step ? '......W.....' : '............',
			step ? '..P...W...G.' : '..P.......G.',
			ground,
			ground
		];
		expect(analyzeReach(levelFrom(rows(false))).barrels).toEqual([false]);
		expect(analyzeReach(levelFrom(rows(true))).barrels).toEqual([true]);
	});

	it('does not cross a long row of barricades', () => {
		expect(reachable(['..P......G...', '....^^^^^^....', ground, ground])).toBe(false);
	});

	it('reports the furthest column reached, to locate a blocked level', () => {
		const result = analyzeReach(
			levelFrom(['..P.........G...', '#####.......####', '#####.......####'])
		);
		expect(result.farthest).toBeLessThan(5);
	});
});

describe('the shipped levels', () => {
	it('has at least three, with distinct ids', () => {
		expect(RAW_LEVELS.length).toBeGreaterThanOrEqual(3);
		expect(new Set(LEVEL_IDS).size).toBe(LEVEL_IDS.length);
	});

	describe.each(RAW_LEVELS.map((raw, index) => [raw.id, index] as const))('%s', (_id, index) => {
		const level = levelAt(index);

		it('is well formed, with a start and a flag', () => {
			expect(structureProblems(RAW_LEVELS[index])).toEqual([]);
			expect(level.start).toBeDefined();
			expect(level.goal).toBeDefined();
			expect(level.height).toBe(LEVEL_ROWS);
		});

		it('starts on firm ground, and the flag stands on it too', () => {
			expect(standable(level, level.start.x, level.start.y)).toBe(true);
			expect(standable(level, level.goal.x, level.goal.y)).toBe(true);
			// The pole needs free air above its base
			for (let up = 1; up <= 2; up++) {
				expect(tileAt(level, level.goal.x, level.goal.y - up)).toBe('empty');
			}
		});

		it('has the flag at the far end from the start', () => {
			expect(level.goal.x).toBeGreaterThan(level.width * 0.8);
			expect(level.start.x).toBeLessThan(level.width * 0.1);
		});

		it('can be finished: the flag is reachable with the jump physics', () => {
			const reach = analyzeReach(level);
			expect(reach.goal, `furthest standing spot at column ${reach.farthest}`).toBe(true);
		});

		it('has every barrel and checkpoint reachable', () => {
			const reach = analyzeReach(level);
			const missingBarrels = level.barrels.filter((_, i) => !reach.barrels[i]);
			const missingLamps = level.checkpoints.filter((_, i) => !reach.checkpoints[i]);
			expect(missingBarrels).toEqual([]);
			expect(missingLamps).toEqual([]);
		});

		it('has goons and lamps standing on something', () => {
			for (const spot of [...level.goons, ...level.jumpers, ...level.checkpoints]) {
				expect(standable(level, spot.x, spot.y), `${spot.x},${spot.y}`).toBe(true);
			}
		});

		it('has helicopters whose whole pattern stays out of the walls', () => {
			for (const [id, spot] of level.helicopters.entries()) {
				const sweep = helicopterSweepBox(createHelicopter(id, spot));
				for (let ty = Math.floor(sweep.y); ty <= Math.floor(sweep.y + sweep.h); ty++) {
					for (let tx = Math.floor(sweep.x); tx <= Math.floor(sweep.x + sweep.w); tx++) {
						if (tileAt(level, tx, ty) !== 'solid') continue;
						// A swoop may just touch the floor, never bury itself in it
						const tile = { x: tx, y: ty, w: 1, h: 1 };
						const shrunk = { x: sweep.x, y: sweep.y, w: sweep.w, h: sweep.h - 0.15 };
						expect(overlaps(shrunk, tile), `heli at ${spot.x},${spot.y}`).toBe(false);
					}
				}
			}
		});

		it('has some barrels to collect', () => {
			expect(level.barrels.length).toBeGreaterThanOrEqual(8);
		});
	});

	it('introduces the enemies gradually: the first level has no helicopter', () => {
		expect(levelAt(0).helicopters).toHaveLength(0);
		expect(levelAt(RAW_LEVELS.length - 1).helicopters.length).toBeGreaterThan(0);
	});
});

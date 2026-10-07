/*
 * Generates the 30 Tanker Parking levels into src/lib/game/parking/levels.json.
 *
 *   bun scripts/generate-parking-levels.ts
 *   bun run format        (prettier lays the JSON out)
 *   bun scripts/generate-parking-levels.ts --reformat   (rewrites the layout only, no search)
 *
 * Every level gets a target par (the fewest moves, as computed by the BFS solver). The generator
 * starts from a random layout and hill-climbs with small mutations (move, add or remove a ship or
 * a rock) until the solver reports exactly that par. The seeds are fixed, so a run always writes
 * the same file; the level tests then prove each stored par again.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	createPuzzle,
	validateLevel,
	type Level,
	type ShipSpec,
	type Tier
} from '../src/lib/game/parking/board';
import { solve } from '../src/lib/game/parking/solver';
import { createRandom, pickOne, randomInt, type Random } from '../src/lib/game/random';

interface Spec {
	tier: Tier;
	width: number;
	height: number;
	par: number;
	ships: [min: number, max: number];
	rocks: [min: number, max: number];
}

const EASY: Omit<Spec, 'par' | 'width' | 'height'> = { tier: 'easy', ships: [3, 6], rocks: [0, 1] };
const MEDIUM: Omit<Spec, 'par' | 'width' | 'height'> = {
	tier: 'medium',
	ships: [6, 10],
	rocks: [0, 3]
};
const HARD: Omit<Spec, 'par' | 'width' | 'height'> = {
	tier: 'hard',
	ships: [8, 12],
	rocks: [1, 4]
};

const SPECS: Spec[] = [
	...[2, 3, 3, 4].map((par) => ({ ...EASY, width: 5, height: 5, par })),
	...[4, 5, 6, 6, 7, 8].map((par) => ({ ...EASY, width: 6, height: 6, par })),
	...[9, 10, 11, 11, 12, 13, 13, 14, 15, 16].map((par) => ({
		...MEDIUM,
		width: 6,
		height: 6,
		par
	})),
	...[17, 18, 19, 20, 21, 22, 23, 24, 26, 28].map((par) => ({ ...HARD, width: 6, height: 6, par }))
];

const MAX_STATES = 150_000;
const STEPS_PER_RESTART = 1500;

function emptyLevel(spec: Spec, random: Random): Level {
	return {
		id: '',
		tier: spec.tier,
		width: spec.width,
		height: spec.height,
		par: spec.par,
		tanker: {
			row: randomInt(random, 1, spec.height - 1),
			col: randomInt(random, 0, 2),
			length: 2
		},
		ships: [],
		rocks: []
	};
}

function randomShip(spec: Spec, random: Random): ShipSpec {
	const axis = random() < 0.5 ? 'h' : 'v';
	const length = random() < 0.65 ? 2 : 3;
	const rowLimit = spec.height - (axis === 'v' ? length : 0);
	const colLimit = spec.width - (axis === 'h' ? length : 0);
	return { axis, length, row: randomInt(random, 0, rowLimit), col: randomInt(random, 0, colLimit) };
}

function tryAdd(level: Level, spec: Spec, random: Random): Level | null {
	for (let attempt = 0; attempt < 20; attempt++) {
		if (random() < 0.25 && level.rocks.length < spec.rocks[1]) {
			const rock: [number, number] = [
				randomInt(random, 0, spec.height),
				randomInt(random, 0, spec.width)
			];
			const next = { ...level, rocks: [...level.rocks, rock] };
			if (validateLevel(next).length === 0) return next;
		} else if (level.ships.length < spec.ships[1]) {
			const next = { ...level, ships: [...level.ships, randomShip(spec, random)] };
			if (validateLevel(next).length === 0) return next;
		}
	}
	return null;
}

function mutate(level: Level, spec: Spec, random: Random): Level | null {
	const roll = random();
	if (roll < 0.15) return tryAdd(level, spec, random);
	if (roll < 0.25) {
		if (level.ships.length > spec.ships[0] && random() < 0.7) {
			const drop = randomInt(random, 0, level.ships.length);
			return { ...level, ships: level.ships.filter((_, index) => index !== drop) };
		}
		if (level.rocks.length > spec.rocks[0]) {
			const drop = randomInt(random, 0, level.rocks.length);
			return { ...level, rocks: level.rocks.filter((_, index) => index !== drop) };
		}
		return null;
	}
	if (roll < 0.3 && level.rocks.length > 0) {
		const at = randomInt(random, 0, level.rocks.length);
		const rock: [number, number] = [
			randomInt(random, 0, spec.height),
			randomInt(random, 0, spec.width)
		];
		const next = { ...level, rocks: level.rocks.map((old, index) => (index === at ? rock : old)) };
		return validateLevel(next).length === 0 ? next : null;
	}
	if (roll < 0.34) {
		const next = {
			...level,
			tanker: {
				...level.tanker,
				row: randomInt(random, 1, spec.height - 1),
				col: randomInt(random, 0, 2)
			}
		};
		return validateLevel(next).length === 0 ? next : null;
	}
	if (level.ships.length === 0) return null;
	const at = randomInt(random, 0, level.ships.length);
	const old = level.ships[at];
	// Mostly nudge a ship along its axis or across; sometimes reshape it completely
	const replacement: ShipSpec =
		random() < 0.7
			? old.axis === 'h'
				? {
						...old,
						col: Math.max(
							0,
							Math.min(spec.width - old.length, old.col + pickOne(random, [-2, -1, 1, 2]))
						),
						row: random() < 0.4 ? randomInt(random, 0, spec.height) : old.row
					}
				: {
						...old,
						row: Math.max(
							0,
							Math.min(spec.height - old.length, old.row + pickOne(random, [-2, -1, 1, 2]))
						),
						col: random() < 0.4 ? randomInt(random, 0, spec.width) : old.col
					}
			: randomShip(spec, random);
	const next = {
		...level,
		ships: level.ships.map((ship, index) => (index === at ? replacement : ship))
	};
	return validateLevel(next).length === 0 ? next : null;
}

function parOf(level: Level): number | null {
	const solution = solve(createPuzzle(level), { maxStates: MAX_STATES });
	return solution ? solution.moves : null;
}

function fingerprint(level: Level): string {
	const ships = level.ships
		.map((ship) => `${ship.axis}${ship.length}@${ship.row},${ship.col}`)
		.sort();
	const rocks = level.rocks.map(([row, col]) => `r${row},${col}`).sort();
	return [
		level.width,
		level.height,
		`t${level.tanker.row},${level.tanker.col}`,
		...ships,
		...rocks
	].join('|');
}

function generate(spec: Spec, seed: number, taken: Set<string>): Level {
	const random = createRandom(seed);
	for (let restart = 0; restart < 400; restart++) {
		let level = emptyLevel(spec, random);
		const wanted = randomInt(random, spec.ships[0], spec.ships[1] + 1);
		for (let tries = 0; level.ships.length < wanted && tries < 60; tries++) {
			level = tryAdd(level, { ...spec, rocks: [0, 0] }, random) ?? level;
		}
		let par = parOf(level);
		for (let step = 0; step < STEPS_PER_RESTART; step++) {
			if (par === spec.par && !taken.has(fingerprint(level))) {
				const finished = { ...level, par };
				if (validateLevel(finished).length === 0) return finished;
			}
			const candidate = mutate(level, spec, random);
			if (!candidate) continue;
			const candidatePar = parOf(candidate);
			if (candidatePar === null || candidatePar > spec.par) continue;
			if (par === null || candidatePar >= par || random() < 0.03) {
				level = candidate;
				par = candidatePar;
			}
		}
	}
	throw new Error(`No level found for par ${spec.par} (${spec.tier})`);
}

const target = fileURLToPath(new URL('../src/lib/game/parking/levels.json', import.meta.url));

/** One level per block, with the tanker, ships and rocks on single lines so the file diffs well */
function formatLevels(all: Level[]): string {
	const inline = (value: unknown) => {
		const parts = Object.entries(value as Record<string, unknown>).map(
			([key, entry]) => '"' + key + '": ' + JSON.stringify(entry)
		);
		return '{ ' + parts.join(', ') + ' }';
	};
	const list = (items: unknown[]) =>
		items.length === 0
			? '[]'
			: '[\n\t\t\t' +
				items
					.map((item) => (Array.isArray(item) ? JSON.stringify(item) : inline(item)))
					.join(',\n\t\t\t') +
				'\n\t\t]';
	const block = (level: Level) =>
		[
			'\t{',
			'\t\t"id": "' + level.id + '",',
			'\t\t"tier": "' + level.tier + '",',
			'\t\t"width": ' + level.width + ',',
			'\t\t"height": ' + level.height + ',',
			'\t\t"par": ' + level.par + ',',
			'\t\t"tanker": ' + inline(level.tanker) + ',',
			'\t\t"ships": ' + list(level.ships) + ',',
			'\t\t"rocks": ' + list(level.rocks),
			'\t}'
		].join('\n');
	return '[\n' + all.map(block).join(',\n') + '\n]\n';
}

if (process.argv.includes('--reformat')) {
	writeFileSync(target, formatLevels(JSON.parse(readFileSync(target, 'utf8')) as Level[]));
	process.exit(0);
}

const levels: Level[] = [];
const taken = new Set<string>();
const counters: Record<Tier, number> = { easy: 0, medium: 0, hard: 0 };
const started = Date.now();
SPECS.forEach((spec, index) => {
	const level = generate(spec, 0x7a11 + index * 7919, taken);
	taken.add(fingerprint(level));
	counters[spec.tier]++;
	level.id = `${spec.tier[0]}${String(counters[spec.tier]).padStart(2, '0')}`;
	levels.push(level);
	console.log(
		`${level.id} par ${level.par} ships ${level.ships.length} rocks ${level.rocks.length}`
	);
});

writeFileSync(target, formatLevels(levels));
console.log(`Wrote ${levels.length} levels in ${((Date.now() - started) / 1000).toFixed(1)} s`);

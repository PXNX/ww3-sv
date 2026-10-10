/*
 * Generates the Belt & Road: Fill Grid levels into src/lib/game/beltroad/levels.json.
 *
 *   bun scripts/generate-beltroad-levels.ts
 *   bun run format        (prettier lays the JSON out)
 *
 * Every level starts from a solved board: a random Hamiltonian path through the grid cut into one
 * route per port pair (see generate.ts), so a solution exists by construction. The generator then
 * nudges the cut points and keeps changes that do not add solutions, until the solver finds exactly
 * one solution (two for the hardest tier), so a level cannot be cleared by luck. The seeds are fixed,
 * so a run always writes the same file; the level tests solve every level again and validate the
 * stored solution.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	PORTS,
	encodeRoute,
	validateLevel,
	type Cell,
	type Level,
	type PortId,
	type Tier
} from '../src/lib/game/beltroad/board';
import { randomCut, randomHamiltonianPath } from '../src/lib/game/beltroad/generate';
import { solve } from '../src/lib/game/beltroad/solver';
import { createRandom, randomInt, shuffle, type Random } from '../src/lib/game/random';

interface Spec {
	tier: Tier;
	size: number;
	pairs: number;
}

const SPECS: Spec[] = [
	{ tier: 'easy', size: 4, pairs: 3 },
	{ tier: 'easy', size: 4, pairs: 4 },
	{ tier: 'easy', size: 5, pairs: 4 },
	{ tier: 'easy', size: 5, pairs: 4 },
	{ tier: 'easy', size: 5, pairs: 5 },
	{ tier: 'easy', size: 5, pairs: 5 },
	{ tier: 'medium', size: 6, pairs: 5 },
	{ tier: 'medium', size: 6, pairs: 5 },
	{ tier: 'medium', size: 6, pairs: 6 },
	{ tier: 'medium', size: 6, pairs: 6 },
	{ tier: 'medium', size: 7, pairs: 6 },
	{ tier: 'medium', size: 7, pairs: 6 },
	{ tier: 'hard', size: 7, pairs: 7 },
	{ tier: 'hard', size: 7, pairs: 8 },
	{ tier: 'hard', size: 8, pairs: 8 },
	{ tier: 'hard', size: 8, pairs: 9 },
	{ tier: 'hard', size: 8, pairs: 9 },
	{ tier: 'hard', size: 8, pairs: 9 }
];

const MIN_ROUTE = 3;
const RESTARTS = 60;
const CLIMB_STEPS = 80;
const COUNT_LIMIT = 40;

const fingerprint = (level: Level) =>
	JSON.stringify([level.width, level.height, level.pairs.map((pair) => [pair.a, pair.b])]);

interface Candidate {
	level: Level;
	count: number;
	nodes: number;
}

/** A board from a Hamiltonian path and the lengths of its routes; solved to count its solutions */
function evaluate(
	spec: Spec,
	index: number,
	path: Cell[],
	lengths: number[],
	ports: PortId[],
	flips: boolean[]
): Candidate | null {
	let from = 0;
	const pairs = lengths.map((length, pair) => {
		const piece = path.slice(from, from + length);
		from += length;
		const ordered: Cell[] = flips[pair] ? [...piece].reverse() : piece;
		return { port: ports[pair], a: ordered[0], b: ordered[ordered.length - 1] };
	});
	const level: Level = {
		id: 'b' + String(index + 1).padStart(2, '0'),
		tier: spec.tier,
		width: spec.size,
		height: spec.size,
		pairs,
		solution: []
	};
	const result = solve(level, { limit: COUNT_LIMIT, maxNodes: 300_000 });
	if (result.exhausted || result.count === 0 || !result.paths) return null;
	level.solution = result.paths.map((route) => encodeRoute(route));
	if (validateLevel(level).length > 0) return null;
	return { level, count: result.count, nodes: result.nodes };
}

/** Moves the border between two neighboring routes by a cell or two */
function nudge(lengths: number[], random: Random): number[] | null {
	const next = [...lengths];
	const border = randomInt(random, 0, next.length - 1);
	const shift = (random() < 0.5 ? -1 : 1) * randomInt(random, 1, 3);
	next[border] += shift;
	next[border + 1] -= shift;
	return next[border] >= MIN_ROUTE && next[border + 1] >= MIN_ROUTE ? next : null;
}

/** Hill-climbs from random boards towards one with the fewest solutions (ideally exactly one) */
function build(spec: Spec, index: number, taken: Set<string>): Level {
	const random = createRandom(7000 + index * 101);
	const wanted = spec.tier === 'hard' ? 2 : 1;
	let best: Candidate | null = null;
	for (let restart = 0; restart < RESTARTS; restart++) {
		const path = randomHamiltonianPath(spec.size, spec.size, random);
		// The first level introduces the three ports named in the roadmap
		const ports: PortId[] =
			index === 0
				? ['shanghai', 'piraeus', 'hamburg']
				: shuffle(random, PORTS).slice(0, spec.pairs);
		const flips = ports.map(() => random() < 0.5);
		let lengths = randomCut(path, spec.pairs, MIN_ROUTE, random).map((piece) => piece.length);
		let current = evaluate(spec, index, path, lengths, ports, flips);
		for (let step = 0; step < CLIMB_STEPS && current; step++) {
			if (current.count <= wanted && !taken.has(fingerprint(current.level))) break;
			const candidateLengths = nudge(lengths, random);
			if (!candidateLengths) continue;
			const candidate = evaluate(spec, index, path, candidateLengths, ports, flips);
			if (candidate && candidate.count <= current.count) {
				current = candidate;
				lengths = candidateLengths;
			}
		}
		if (!current || taken.has(fingerprint(current.level))) continue;
		if (
			!best ||
			current.count < best.count ||
			(current.count === best.count && current.nodes > best.nodes)
		) {
			best = current;
		}
		if (best.count <= wanted) break;
	}
	if (!best) throw new Error(`No level for ${spec.size}x${spec.size} with ${spec.pairs} pairs`);
	console.log(
		`${best.level.id} ${spec.tier} ${spec.size}x${spec.size} pairs=${spec.pairs} solutions=${best.count} nodes=${best.nodes}`
	);
	return best.level;
}

const levels: Level[] = [];
const taken = new Set<string>();
SPECS.forEach((spec, index) => {
	const level = build(spec, index, taken);
	taken.add(fingerprint(level));
	levels.push(level);
});

const target = fileURLToPath(new URL('../src/lib/game/beltroad/levels.json', import.meta.url));
writeFileSync(target, JSON.stringify(levels, null, '\t') + '\n');
console.log(`Wrote ${levels.length} levels to ${target}`);

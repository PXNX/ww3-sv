import { describe, expect, it } from 'vitest';
import {
	buildGraph,
	edgeId,
	ELEMENTS,
	elementOfFactory,
	findRoute,
	laneTowards,
	minesOf,
	pointOnEdge,
	routeLength,
	switchNodes,
	WORLD
} from './graph.js';

const LINE = buildGraph(
	[
		{ id: 'a', kind: 'mine', x: 0, y: 0, to: ['b', 'c'] },
		{ id: 'b', kind: 'hub', x: 30, y: 40, to: ['d'] },
		{ id: 'c', kind: 'hub', x: 60, y: 0, to: ['d'] },
		{ id: 'd', kind: 'factory', x: 90, y: 0, to: [] }
	],
	{ neodymium: 'd', dysprosium: 'd', europium: 'd' }
);

describe('buildGraph', () => {
	it('measures lanes as the straight distance between nodes', () => {
		expect(LINE.edges['a>b'].length).toBe(50);
		expect(LINE.edges['a>c'].length).toBe(60);
		expect(LINE.nodes.a.out).toEqual(['a>b', 'a>c']);
		expect(edgeId('a', 'b')).toBe('a>b');
	});

	it('rejects a lane to a node that does not exist', () => {
		expect(() =>
			buildGraph([{ id: 'a', kind: 'mine', x: 0, y: 0, to: ['nowhere'] }], {
				neodymium: 'a',
				dysprosium: 'a',
				europium: 'a'
			})
		).toThrow('Unknown node');
	});
});

describe('the world map', () => {
	it('has three mines, three factories and a switch on everything else', () => {
		expect(minesOf(WORLD)).toHaveLength(3);
		const factories = WORLD.order.filter((id) => WORLD.nodes[id].kind === 'factory');
		expect(factories).toHaveLength(3);
		expect(switchNodes(WORLD)).toHaveLength(WORLD.order.length - 3);
		for (const node of switchNodes(WORLD)) expect(node.out.length).toBeGreaterThan(1);
		for (const id of factories) expect(WORLD.nodes[id].out).toEqual([]);
	});

	it('gives every element its own factory', () => {
		const factories = ELEMENTS.map((element) => WORLD.factoryOf[element]);
		expect(new Set(factories).size).toBe(ELEMENTS.length);
		for (const element of ELEMENTS) {
			expect(elementOfFactory(WORLD, WORLD.factoryOf[element])).toBe(element);
		}
		expect(elementOfFactory(WORLD, 'h0')).toBeNull();
	});

	it('only points forward, so every lane runs left to right', () => {
		for (const edge of Object.values(WORLD.edges)) {
			expect(WORLD.nodes[edge.to].x).toBeGreaterThan(WORLD.nodes[edge.from].x);
		}
	});

	it('lets every mine reach every factory', () => {
		for (const mine of minesOf(WORLD)) {
			for (const element of ELEMENTS) {
				expect(findRoute(WORLD, mine.id, WORLD.factoryOf[element])).not.toBeNull();
			}
		}
	});
});

describe('findRoute', () => {
	it('finds the shortest route', () => {
		expect(findRoute(LINE, 'a', 'd')).toEqual(['a>c', 'c>d']);
		expect(routeLength(LINE, ['a>c', 'c>d'])).toBeCloseTo(90);
	});

	it('is empty for a node that is already there', () => {
		expect(findRoute(LINE, 'a', 'a')).toEqual([]);
	});

	it('goes around blocked lanes and gives up when none is left', () => {
		expect(findRoute(LINE, 'a', 'd', { blocked: new Set(['a>c']) })).toEqual(['a>b', 'b>d']);
		expect(findRoute(LINE, 'a', 'd', { blocked: new Set(['a>b', 'a>c']) })).toBeNull();
	});

	it('detours through a checkpoint that has to be visited', () => {
		expect(findRoute(LINE, 'a', 'd', { via: ['b'] })).toEqual(['a>b', 'b>d']);
		expect(findRoute(LINE, 'a', 'd', { via: ['b', 'c'] })).toBeNull();
	});

	it('returns null for unknown nodes and for lanes that only run forward', () => {
		expect(findRoute(LINE, 'a', 'zzz')).toBeNull();
		expect(findRoute(LINE, 'zzz', 'd')).toBeNull();
		expect(findRoute(LINE, 'd', 'a')).toBeNull();
	});
});

describe('map helpers', () => {
	it('places a crate along a lane and clamps it to the ends', () => {
		expect(pointOnEdge(LINE, 'a>c', 30)).toEqual({ x: 30, y: 0 });
		expect(pointOnEdge(LINE, 'a>c', -5)).toEqual({ x: 0, y: 0 });
		expect(pointOnEdge(LINE, 'a>c', 999)).toEqual({ x: 60, y: 0 });
	});

	it('maps a drag to the lane it points at', () => {
		// a>b points down-right, a>c points right
		expect(laneTowards(LINE, 'a', 10, 0)).toBe(1);
		expect(laneTowards(LINE, 'a', 5, 40)).toBe(0);
		expect(laneTowards(LINE, 'a', -10, 0)).toBeNull();
		expect(laneTowards(LINE, 'a', 0, 0)).toBeNull();
		expect(laneTowards(LINE, 'zzz', 1, 1)).toBeNull();
	});
});

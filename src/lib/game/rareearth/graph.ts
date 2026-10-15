/*
 * The map: an abstract, stylized trade network, not a real geography. Mines on the left, then hubs
 * and ports, then the factories on the right. Every node that is not a factory has a few outgoing
 * lanes and one of them is selected (the switch); crates follow the selected lane. The graph only
 * ever points right, so a crate always ends up at a factory.
 */

export type NodeKind = 'mine' | 'hub' | 'port' | 'factory';

export const ELEMENTS = ['neodymium', 'dysprosium', 'europium'] as const;
export type Element = (typeof ELEMENTS)[number];

export interface GraphNode {
	id: string;
	kind: NodeKind;
	/** Position in map units (the map is MAP_WIDTH x MAP_HEIGHT) */
	x: number;
	y: number;
	/** Outgoing lane ids in switch order (empty for factories) */
	out: string[];
}

export interface Edge {
	id: string;
	from: string;
	to: string;
	/** Length in map units */
	length: number;
}

export interface Graph {
	nodes: Record<string, GraphNode>;
	edges: Record<string, Edge>;
	/** Node ids in drawing and keyboard order */
	order: string[];
	/** Which factory wants which element */
	factoryOf: Record<Element, string>;
}

export const MAP_WIDTH = 320;
export const MAP_HEIGHT = 240;

export function edgeId(from: string, to: string): string {
	return `${from}>${to}`;
}

export interface NodeSpec {
	id: string;
	kind: NodeKind;
	x: number;
	y: number;
	to: string[];
}

/** Builds a graph from node specs; the edge length is the straight distance between the nodes */
export function buildGraph(specs: readonly NodeSpec[], factoryOf: Record<Element, string>): Graph {
	const nodes: Record<string, GraphNode> = {};
	const edges: Record<string, Edge> = {};
	for (const spec of specs)
		nodes[spec.id] = { id: spec.id, kind: spec.kind, x: spec.x, y: spec.y, out: [] };
	for (const spec of specs) {
		for (const target of spec.to) {
			const to = nodes[target];
			if (!to) throw new Error(`Unknown node ${target}`);
			const id = edgeId(spec.id, target);
			edges[id] = {
				id,
				from: spec.id,
				to: target,
				length: Math.hypot(to.x - spec.x, to.y - spec.y)
			};
			nodes[spec.id].out.push(id);
		}
	}
	return { nodes, edges, order: specs.map((spec) => spec.id), factoryOf };
}

export const WORLD: Graph = buildGraph(
	[
		{ id: 'm0', kind: 'mine', x: 30, y: 44, to: ['h0', 'h1'] },
		{ id: 'm1', kind: 'mine', x: 30, y: 120, to: ['h0', 'h1', 'h2'] },
		{ id: 'm2', kind: 'mine', x: 30, y: 196, to: ['h1', 'h2'] },
		{ id: 'h0', kind: 'hub', x: 112, y: 34, to: ['p0', 'p1'] },
		{ id: 'h1', kind: 'hub', x: 112, y: 120, to: ['p0', 'p1', 'p2'] },
		{ id: 'h2', kind: 'hub', x: 112, y: 206, to: ['p1', 'p2'] },
		{ id: 'p0', kind: 'port', x: 204, y: 56, to: ['f0', 'f1'] },
		{ id: 'p1', kind: 'port', x: 204, y: 120, to: ['f0', 'f1', 'f2'] },
		{ id: 'p2', kind: 'port', x: 204, y: 184, to: ['f1', 'f2'] },
		{ id: 'f0', kind: 'factory', x: 290, y: 40, to: [] },
		{ id: 'f1', kind: 'factory', x: 290, y: 120, to: [] },
		{ id: 'f2', kind: 'factory', x: 290, y: 200, to: [] }
	],
	{ europium: 'f0', neodymium: 'f1', dysprosium: 'f2' }
);

/** Nodes that have a switch, in order: the ones the player taps */
export function switchNodes(graph: Graph): GraphNode[] {
	return graph.order.map((id) => graph.nodes[id]).filter((node) => node.kind !== 'factory');
}

export function minesOf(graph: Graph): GraphNode[] {
	return graph.order.map((id) => graph.nodes[id]).filter((node) => node.kind === 'mine');
}

/** The element a factory wants, or null for a node that is not a factory */
export function elementOfFactory(graph: Graph, nodeId: string): Element | null {
	return ELEMENTS.find((element) => graph.factoryOf[element] === nodeId) ?? null;
}

export interface RouteOptions {
	/** Lanes that must not be used */
	blocked?: ReadonlySet<string>;
	/** Nodes the route has to pass through, in any order */
	via?: readonly string[];
}

/**
 * The shortest route from one node to another as lane ids, or null when there is none. Blocked
 * lanes are skipped and every `via` node has to be visited on the way (a licence checkpoint).
 */
export function findRoute(
	graph: Graph,
	from: string,
	to: string,
	{ blocked, via = [] }: RouteOptions = {}
): string[] | null {
	if (!graph.nodes[from] || !graph.nodes[to]) return null;
	const bit = (nodeId: string) => {
		const index = via.indexOf(nodeId);
		return index < 0 ? 0 : 1 << index;
	};
	const full = (1 << via.length) - 1;
	interface Entry {
		node: string;
		mask: number;
		dist: number;
		path: string[];
	}
	const best = new Map<string, number>();
	const key = (node: string, mask: number) => `${node}#${mask}`;
	const open: Entry[] = [{ node: from, mask: bit(from), dist: 0, path: [] }];
	best.set(key(from, bit(from)), 0);
	while (open.length > 0) {
		let index = 0;
		for (let i = 1; i < open.length; i++) if (open[i].dist < open[index].dist) index = i;
		const [entry] = open.splice(index, 1);
		if (entry.dist > (best.get(key(entry.node, entry.mask)) ?? Infinity)) continue;
		if (entry.node === to && entry.mask === full) return entry.path;
		for (const id of graph.nodes[entry.node].out) {
			if (blocked?.has(id)) continue;
			const edge = graph.edges[id];
			const mask = entry.mask | bit(edge.to);
			const dist = entry.dist + edge.length;
			if (dist >= (best.get(key(edge.to, mask)) ?? Infinity)) continue;
			best.set(key(edge.to, mask), dist);
			open.push({ node: edge.to, mask, dist, path: [...entry.path, id] });
		}
	}
	return null;
}

export function routeLength(graph: Graph, route: readonly string[]): number {
	return route.reduce((sum, id) => sum + graph.edges[id].length, 0);
}

/** A point along a lane, for drawing crates */
export function pointOnEdge(graph: Graph, id: string, progress: number): { x: number; y: number } {
	const edge = graph.edges[id];
	const from = graph.nodes[edge.from];
	const to = graph.nodes[edge.to];
	const t = edge.length > 0 ? Math.min(1, Math.max(0, progress / edge.length)) : 0;
	return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/**
 * Which outgoing lane of a node a drag points at: the lane whose direction is closest to the drag
 * direction, or null when the drag points at none of them (or has no length).
 */
export function laneTowards(
	graph: Graph,
	nodeId: string,
	dx: number,
	dy: number,
	minCosine = 0.5
): number | null {
	const node = graph.nodes[nodeId];
	const drag = Math.hypot(dx, dy);
	if (!node || drag === 0) return null;
	let bestIndex: number | null = null;
	let bestCosine = minCosine;
	node.out.forEach((id, index) => {
		const edge = graph.edges[id];
		const target = graph.nodes[edge.to];
		const cosine = ((target.x - node.x) * dx + (target.y - node.y) * dy) / (edge.length * drag);
		if (cosine >= bestCosine) {
			bestCosine = cosine;
			bestIndex = index;
		}
	});
	return bestIndex;
}

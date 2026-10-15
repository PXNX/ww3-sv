/* Translated names of the nodes, lanes, elements and notices of Rare Earth Squeeze */
import { ELEMENTS, type Element, type Graph, type NodeKind } from '#lib/game/rareearth/graph.js';
import type { Rule, RuleKind } from '#lib/game/rareearth/rules.js';
import { m } from '#lib/paraglide/messages.js';

/** Chemical symbols are the same in every language */
export const ELEMENT_SYMBOLS: Record<Element, string> = {
	neodymium: 'Nd',
	dysprosium: 'Dy',
	europium: 'Eu'
};

const ELEMENT_NAMES: Record<Element, () => string> = {
	neodymium: m.rareearth_element_neodymium,
	dysprosium: m.rareearth_element_dysprosium,
	europium: m.rareearth_element_europium
};

const FACTORY_NAMES: Record<Element, () => string> = {
	neodymium: m.rareearth_factory_turbines,
	dysprosium: m.rareearth_factory_motors,
	europium: m.rareearth_factory_phones
};

const KIND_NAMES: Record<Exclude<NodeKind, 'factory'>, () => string> = {
	mine: m.rareearth_node_mine,
	hub: m.rareearth_node_hub,
	port: m.rareearth_node_port
};

const KIND_SHORTS: Record<Exclude<NodeKind, 'factory'>, () => string> = {
	mine: m.rareearth_short_mine,
	hub: m.rareearth_short_hub,
	port: m.rareearth_short_port
};

const RULE_KIND_NAMES: Record<RuleKind, () => string> = {
	ban: m.rareearth_kind_ban,
	tariff: m.rareearth_kind_tariff,
	quota: m.rareearth_kind_quota,
	licence: m.rareearth_kind_licence
};

export function elementName(element: Element): string {
	return ELEMENT_NAMES[element]();
}

export function factoryName(element: Element): string {
	return FACTORY_NAMES[element]();
}

/** The element a factory node wants */
export function elementOf(graph: Graph, nodeId: string): Element | null {
	return ELEMENTS.find((element) => graph.factoryOf[element] === nodeId) ?? null;
}

/** 1-based number of a node among the nodes of its kind */
function numberOf(graph: Graph, nodeId: string): number {
	const kind = graph.nodes[nodeId].kind;
	return graph.order.filter((id) => graph.nodes[id].kind === kind).indexOf(nodeId) + 1;
}

export function nodeName(graph: Graph, nodeId: string): string {
	const node = graph.nodes[nodeId];
	if (node.kind === 'factory') {
		const element = elementOf(graph, nodeId);
		return element ? factoryName(element) : nodeId;
	}
	return m.rareearth_node_name({ kind: KIND_NAMES[node.kind](), n: numberOf(graph, nodeId) });
}

/** The label drawn on the map, for example M1 */
export function nodeShort(graph: Graph, nodeId: string): string {
	const node = graph.nodes[nodeId];
	if (node.kind === 'factory') {
		const element = elementOf(graph, nodeId);
		return element ? ELEMENT_SYMBOLS[element] : '';
	}
	return `${KIND_SHORTS[node.kind]()}${numberOf(graph, nodeId)}`;
}

export function laneName(graph: Graph, edgeId: string): string {
	const edge = graph.edges[edgeId];
	return m.rareearth_lane_name({
		from: nodeName(graph, edge.from),
		to: nodeName(graph, edge.to)
	});
}

export function ruleKindName(kind: RuleKind): string {
	return RULE_KIND_NAMES[kind]();
}

/** The notice as the ministry words it */
export function ruleText(graph: Graph, rule: Rule): string {
	switch (rule.kind) {
		case 'ban':
			return m.rareearth_notice_ban({ lane: laneName(graph, rule.edge ?? '') });
		case 'tariff':
			return m.rareearth_notice_tariff({ lane: laneName(graph, rule.edge ?? '') });
		case 'quota':
			return m.rareearth_notice_quota({
				lane: laneName(graph, rule.edge ?? ''),
				limit: rule.limit
			});
		case 'licence':
			return m.rareearth_notice_licence({
				element: elementName(rule.element ?? 'neodymium'),
				node: nodeName(graph, rule.node ?? '')
			});
	}
}

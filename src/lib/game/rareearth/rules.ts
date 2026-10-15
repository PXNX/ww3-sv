/*
 * The notices of the ministry of export affairs. Every few rounds a new one is issued: it is
 * announced first (so the player can plan), takes effect a few seconds later and is gone after a
 * fixed number of rounds. Four kinds exist: a lane is banned, a lane is tariffed (crates crawl and
 * do not count as by-the-book), a lane carries only a few crates per round (a quota), and one
 * element needs a licence stamp at a checkpoint on its way to the factory. The scheduler only
 * issues a notice that leaves every mine able to reach every factory, so a run is never unwinnable.
 */
import { pickOne, randomInt, type Random } from '../random.js';
import {
	NOTICE_LEAD_MS,
	QUOTA_MAX,
	QUOTA_MIN,
	RULE_ATTEMPTS,
	RULE_EVERY_ROUNDS,
	RULE_LIFE_ROUNDS,
	ROUND_MS
} from './config.js';
import type { Difficulty } from './difficulty.js';
import { ELEMENTS, findRoute, minesOf, type Element, type Graph } from './graph.js';

export type RuleKind = 'ban' | 'tariff' | 'quota' | 'licence';

export type RuleStatus = 'announced' | 'active' | 'expired';

export interface Rule {
	id: number;
	kind: RuleKind;
	/** When the notice was issued, when it takes effect and when it is gone (game time) */
	noticeMs: number;
	startMs: number;
	endMs: number;
	/** The lane a ban, tariff or quota is about; null for a licence */
	edge: string | null;
	/** Crates a quota lets through per round; 0 for the other kinds */
	limit: number;
	/** Crates that entered the quota lane in the current round */
	used: number;
	/** The element a licence is about; null for the other kinds */
	element: Element | null;
	/** The checkpoint a licensed element has to pass; null for the other kinds */
	node: string | null;
}

/** A licence a crate was handed when it spawned: it must have passed `node` by delivery */
export interface Need {
	rule: number;
	node: string;
}

export function ruleStatus(rule: Rule, nowMs: number): RuleStatus {
	if (nowMs >= rule.endMs) return 'expired';
	return nowMs >= rule.startMs ? 'active' : 'announced';
}

/** Rules that are announced or in force */
export function liveRules(rules: readonly Rule[], nowMs: number): Rule[] {
	return rules.filter((rule) => ruleStatus(rule, nowMs) !== 'expired');
}

/** Rules in force right now */
export function activeRules(rules: readonly Rule[], nowMs: number): Rule[] {
	return rules.filter((rule) => ruleStatus(rule, nowMs) === 'active');
}

/** Whether a new notice is issued at the start of this round: round 2, then every few rounds */
export function isNoticeRound(round: number): boolean {
	return round >= 2 && (round - 2) % RULE_EVERY_ROUNDS === 0;
}

/** The lanes a set of rules bans. With `inForceOnly` false the announced bans count as well */
export function bannedLanes(
	rules: readonly Rule[],
	nowMs: number,
	inForceOnly = true
): Set<string> {
	const lanes = new Set<string>();
	for (const rule of inForceOnly ? activeRules(rules, nowMs) : liveRules(rules, nowMs)) {
		if (rule.kind === 'ban' && rule.edge) lanes.add(rule.edge);
	}
	return lanes;
}

export function ruleOnLane(
	rules: readonly Rule[],
	nowMs: number,
	kind: RuleKind,
	edge: string
): Rule | undefined {
	return activeRules(rules, nowMs).find((rule) => rule.kind === kind && rule.edge === edge);
}

/** Whether a quota lane has taken all the crates it lets through this round */
export function quotaFull(rule: Rule): boolean {
	return rule.kind === 'quota' && rule.used >= rule.limit;
}

/** The licences a crate of this element needs if it spawns now (announced ones count) */
export function needsFor(rules: readonly Rule[], nowMs: number, element: Element): Need[] {
	return liveRules(rules, nowMs)
		.filter((rule) => rule.kind === 'licence' && rule.element === element && rule.node)
		.map((rule) => ({ rule: rule.id, node: rule.node as string }));
}

/** A new round starts: every quota counts from zero again */
export function resetQuotas(rules: readonly Rule[]): void {
	for (const rule of rules) rule.used = 0;
}

/**
 * Whether every mine can still send every element to its factory under these rules: no banned
 * lane in the way and every licence checkpoint on the route.
 */
export function stillSolvable(graph: Graph, rules: readonly Rule[], elements: number): boolean {
	const blocked = new Set<string>();
	for (const rule of rules) if (rule.kind === 'ban' && rule.edge) blocked.add(rule.edge);
	for (const element of ELEMENTS.slice(0, elements)) {
		const via = rules
			.filter((rule) => rule.kind === 'licence' && rule.element === element && rule.node)
			.map((rule) => rule.node as string);
		for (const mine of minesOf(graph)) {
			if (!findRoute(graph, mine.id, graph.factoryOf[element], { blocked, via })) return false;
		}
	}
	return true;
}

function allLanes(graph: Graph): string[] {
	return graph.order.flatMap((id) => graph.nodes[id].out);
}

function checkpoints(graph: Graph): string[] {
	return graph.order.filter((id) => ['hub', 'port'].includes(graph.nodes[id].kind));
}

/**
 * A notice for the given moment, or null when none can be issued (the slots are taken, or no
 * candidate leaves the map solvable). The random source decides the kind and the target.
 */
export function proposeRule(
	graph: Graph,
	rules: readonly Rule[],
	nowMs: number,
	difficulty: Difficulty,
	random: Random,
	id: number
): Rule | null {
	const live = liveRules(rules, nowMs);
	if (live.length >= difficulty.maxRules) return null;
	const lanes = allLanes(graph);
	for (let attempt = 0; attempt < RULE_ATTEMPTS; attempt++) {
		const kind = pickOne(random, difficulty.ruleKinds);
		const rule: Rule = {
			id,
			kind,
			noticeMs: nowMs,
			startMs: nowMs + NOTICE_LEAD_MS,
			endMs: nowMs + RULE_LIFE_ROUNDS * ROUND_MS,
			edge: null,
			limit: 0,
			used: 0,
			element: null,
			node: null
		};
		if (kind === 'licence') {
			rule.element = pickOne(random, ELEMENTS.slice(0, difficulty.elements));
			rule.node = pickOne(random, checkpoints(graph));
			if (live.some((other) => other.kind === 'licence' && other.element === rule.element))
				continue;
		} else {
			rule.edge = pickOne(random, lanes);
			if (live.some((other) => other.edge === rule.edge)) continue;
			if (kind === 'quota') rule.limit = randomInt(random, QUOTA_MIN, QUOTA_MAX + 1);
		}
		if (stillSolvable(graph, [...live, rule], difficulty.elements)) return rule;
	}
	return null;
}

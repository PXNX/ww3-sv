/*
 * Rare Earth Squeeze rules as a plain state machine. Crates spawn at the mines, wait a moment for
 * their mine switch, then follow the selected lane of every node they reach until they arrive at a
 * factory. The ministry's notices (see rules.ts) are announced, take effect and expire as game time
 * passes. A broken rule, a missed deadline or a delivery to the wrong factory costs a heart and the
 * combo. The store and components only react to the events.
 */
import { pickOne, type Random } from '../random.js';
import {
	DEADLINE_ALLOWANCE_MS,
	FIRST_SPAWN_MS,
	LOAD_MS,
	STARTING_LIVES,
	TARIFF_SPEED
} from './config.js';
import { difficulty, roundAt } from './difficulty.js';
import {
	ELEMENTS,
	findRoute,
	minesOf,
	routeLength,
	WORLD,
	type Element,
	type Graph
} from './graph.js';
import {
	bannedLanes,
	isNoticeRound,
	needsFor,
	proposeRule,
	quotaFull,
	resetQuotas,
	ruleOnLane,
	type Need,
	type Rule
} from './rules.js';
import { scoreDelivery } from './scoring.js';

export interface Crate {
	id: number;
	element: Element;
	mine: string;
	spawnedMs: number;
	/** Game time by which the crate has to be at its factory */
	deadlineMs: number;
	/** Map units per second on an untariffed lane, fixed when the crate spawns */
	speed: number;
	/** The node the crate waits at (edge null) or last left */
	node: string;
	/** The lane the crate is on, or null while it waits at its mine */
	edge: string | null;
	/** Distance travelled on the lane, in map units */
	progress: number;
	/** Time left to wait at the mine before departing */
	loadMs: number;
	/** Checkpoints passed so far */
	visited: string[];
	/** Whether the crate was ever slowed by a tariff */
	tariffed: boolean;
	/** The licences the crate has to collect on its way */
	needs: Need[];
}

export type Phase = 'playing' | 'over';

export interface RareEarthState {
	graph: Graph;
	phase: Phase;
	elapsedMs: number;
	round: number;
	lives: number;
	score: number;
	combo: number;
	multiplier: number;
	crates: Crate[];
	/** Every notice issued so far; expired ones stay (a crate may still owe its licence) */
	rules: Rule[];
	/** For every node with a switch, the index of the selected outgoing lane */
	switches: Record<string, number>;
	nextSpawnMs: number;
	nextCrateId: number;
	nextRuleId: number;
	delivered: number;
	violations: number;
	late: number;
	wrong: number;
	bestCombo: number;
}

export type ViolationKind = 'ban' | 'quota' | 'licence';

export type RareEarthEvent =
	| { type: 'round'; round: number }
	| { type: 'notice'; rule: Rule }
	| { type: 'rule-start'; rule: Rule }
	| { type: 'rule-end'; rule: Rule }
	| { type: 'spawn'; crate: Crate }
	| { type: 'switch'; node: string; lane: number; auto: boolean }
	| {
			type: 'deliver';
			crate: Crate;
			points: number;
			multiplier: number;
			combo: number;
			byTheBook: boolean;
	  }
	| { type: 'wrong'; crate: Crate; factory: string }
	| { type: 'late'; crate: Crate }
	| { type: 'violation'; crate: Crate; kind: ViolationKind; node: string; rule: Rule }
	| { type: 'game-over' };

export function createGame(graph: Graph = WORLD): RareEarthState {
	const switches: Record<string, number> = {};
	for (const id of graph.order) if (graph.nodes[id].out.length > 0) switches[id] = 0;
	return {
		graph,
		phase: 'playing',
		elapsedMs: 0,
		round: 1,
		lives: STARTING_LIVES,
		score: 0,
		combo: 0,
		multiplier: 1,
		crates: [],
		rules: [],
		switches,
		nextSpawnMs: FIRST_SPAWN_MS,
		nextCrateId: 1,
		nextRuleId: 1,
		delivered: 0,
		violations: 0,
		late: 0,
		wrong: 0,
		bestCombo: 0
	};
}

/** The lane a node currently sends crates down, or null for a factory */
export function selectedLane(state: RareEarthState, nodeId: string): string | null {
	const node = state.graph.nodes[nodeId];
	if (!node || node.out.length === 0) return null;
	return node.out[state.switches[nodeId] ?? 0] ?? null;
}

/** Points a node's switch at one of its outgoing lanes; returns the events (empty when nothing changed) */
export function setSwitch(
	state: RareEarthState,
	nodeId: string,
	lane: number,
	auto = false
): RareEarthEvent[] {
	const node = state.graph.nodes[nodeId];
	if (state.phase !== 'playing' || !node || node.out.length === 0) return [];
	if (!Number.isInteger(lane) || lane < 0 || lane >= node.out.length) return [];
	if (state.switches[nodeId] === lane) return [];
	state.switches[nodeId] = lane;
	return [{ type: 'switch', node: nodeId, lane, auto }];
}

/** A tap on a node: the switch moves on to the next lane */
export function cycleSwitch(state: RareEarthState, nodeId: string, step = 1): RareEarthEvent[] {
	const node = state.graph.nodes[nodeId];
	if (!node || node.out.length === 0) return [];
	const count = node.out.length;
	const next = ((((state.switches[nodeId] ?? 0) + step) % count) + count) % count;
	return setSwitch(state, nodeId, next);
}

/** Fraction of its allowed time a crate still has left, 0 to 1 */
export function timeLeftShare(crate: Crate, nowMs: number): number {
	const total = crate.deadlineMs - crate.spawnedMs;
	if (total <= 0) return 0;
	return Math.min(1, Math.max(0, (crate.deadlineMs - nowMs) / total));
}

/** A lane a crate may enter without breaking a rule, as far as the rules in force go */
function laneIsLegal(state: RareEarthState, laneId: string): boolean {
	if (bannedLanes(state.rules, state.elapsedMs).has(laneId)) return false;
	const quota = ruleOnLane(state.rules, state.elapsedMs, 'quota', laneId);
	return !(quota && quotaFull(quota));
}

/** After a violation the clerk flips the switch to the next lane that is legal, if any */
function redirect(state: RareEarthState, nodeId: string, events: RareEarthEvent[]) {
	const node = state.graph.nodes[nodeId];
	const current = state.switches[nodeId] ?? 0;
	for (let offset = 1; offset < node.out.length; offset++) {
		const lane = (current + offset) % node.out.length;
		if (laneIsLegal(state, node.out[lane])) {
			events.push(...setSwitch(state, nodeId, lane, true));
			return;
		}
	}
}

function loseHeart(state: RareEarthState, events: RareEarthEvent[]) {
	state.combo = 0;
	state.multiplier = 1;
	state.lives = Math.max(0, state.lives - 1);
	if (state.lives === 0 && state.phase === 'playing') {
		state.phase = 'over';
		events.push({ type: 'game-over' });
	}
}

function violate(
	state: RareEarthState,
	crate: Crate,
	kind: ViolationKind,
	node: string,
	rule: Rule,
	events: RareEarthEvent[]
) {
	state.violations += 1;
	events.push({ type: 'violation', crate, kind, node, rule });
	loseHeart(state, events);
}

/** The shortest legal trip of a crate in map units, ignoring slowdowns */
function tripLength(state: RareEarthState, mine: string, element: Element, needs: Need[]): number {
	const graph = state.graph;
	const target = graph.factoryOf[element];
	const blocked = bannedLanes(state.rules, state.elapsedMs, false);
	const via = needs.map((need) => need.node);
	const route =
		findRoute(graph, mine, target, { blocked, via }) ?? findRoute(graph, mine, target, { via });
	return route ? routeLength(graph, route) : 0;
}

export function spawnCrate(state: RareEarthState, random: Random): Crate {
	const d = difficulty(state.round);
	const mine = pickOne(random, minesOf(state.graph)).id;
	const element = pickOne(random, ELEMENTS.slice(0, d.elements));
	const needs = needsFor(state.rules, state.elapsedMs, element);
	const tripMs = (tripLength(state, mine, element, needs) / d.speed) * 1000;
	const crate: Crate = {
		id: state.nextCrateId++,
		element,
		mine,
		spawnedMs: state.elapsedMs,
		deadlineMs: state.elapsedMs + LOAD_MS + tripMs * d.slack + DEADLINE_ALLOWANCE_MS,
		speed: d.speed,
		node: mine,
		edge: null,
		progress: 0,
		loadMs: LOAD_MS,
		visited: [],
		tariffed: false,
		needs
	};
	state.crates.push(crate);
	return crate;
}

/** The crate leaves a node down its selected lane; false when a rule stopped it there */
function depart(state: RareEarthState, crate: Crate, events: RareEarthEvent[]): boolean {
	const nodeId = crate.node;
	const laneId = selectedLane(state, nodeId);
	if (!laneId) return false;
	const now = state.elapsedMs;
	const ban = ruleOnLane(state.rules, now, 'ban', laneId);
	if (ban) {
		violate(state, crate, 'ban', nodeId, ban, events);
		redirect(state, nodeId, events);
		return false;
	}
	const quota = ruleOnLane(state.rules, now, 'quota', laneId);
	if (quota) {
		if (quotaFull(quota)) {
			violate(state, crate, 'quota', nodeId, quota, events);
			redirect(state, nodeId, events);
			return false;
		}
		quota.used += 1;
	}
	crate.edge = laneId;
	crate.progress = 0;
	return true;
}

/** The crate reached a factory */
function arrive(state: RareEarthState, crate: Crate, nodeId: string, events: RareEarthEvent[]) {
	if (state.graph.factoryOf[crate.element] !== nodeId) {
		state.wrong += 1;
		events.push({ type: 'wrong', crate, factory: nodeId });
		loseHeart(state, events);
		return;
	}
	const missing = crate.needs.find((need) => !crate.visited.includes(need.node));
	if (missing) {
		const rule = state.rules.find((entry) => entry.id === missing.rule);
		if (rule) {
			violate(state, crate, 'licence', nodeId, rule, events);
			return;
		}
	}
	const result = scoreDelivery(state.combo, timeLeftShare(crate, state.elapsedMs), !crate.tariffed);
	state.score += result.points;
	state.combo = result.combo;
	state.multiplier = result.multiplier;
	state.bestCombo = Math.max(state.bestCombo, state.combo);
	state.delivered += 1;
	events.push({
		type: 'deliver',
		crate,
		points: result.points,
		multiplier: result.multiplier,
		combo: result.combo,
		byTheBook: !crate.tariffed
	});
}

/** Moves a crate along; returns false when the crate is gone (delivered, confiscated) */
function moveCrate(
	state: RareEarthState,
	crate: Crate,
	dtMs: number,
	events: RareEarthEvent[]
): boolean {
	let timeMs = dtMs;
	if (crate.edge === null) {
		crate.loadMs -= timeMs;
		if (crate.loadMs > 0) return true;
		timeMs = -crate.loadMs;
		crate.loadMs = 0;
		if (!depart(state, crate, events)) return false;
	}
	while (timeMs > 0 && crate.edge !== null) {
		const edge = state.graph.edges[crate.edge];
		const tariff = ruleOnLane(state.rules, state.elapsedMs, 'tariff', edge.id);
		if (tariff) crate.tariffed = true;
		const perMs = (crate.speed * (tariff ? TARIFF_SPEED : 1)) / 1000;
		const reach = edge.length - crate.progress;
		if (perMs * timeMs < reach) {
			crate.progress += perMs * timeMs;
			return true;
		}
		timeMs -= reach / perMs;
		const nodeId = edge.to;
		crate.node = nodeId;
		crate.edge = null;
		crate.progress = 0;
		if (state.graph.nodes[nodeId].kind === 'factory') {
			arrive(state, crate, nodeId, events);
			return false;
		}
		crate.visited.push(nodeId);
		if (!depart(state, crate, events)) return false;
	}
	return true;
}

/** Advances the game by one step of game time */
export function step(state: RareEarthState, dtMs: number, random: Random): RareEarthEvent[] {
	const events: RareEarthEvent[] = [];
	if (state.phase !== 'playing' || dtMs <= 0) return events;
	const before = state.elapsedMs;
	state.elapsedMs += dtMs;
	const now = state.elapsedMs;

	const round = roundAt(now);
	if (round !== state.round) {
		state.round = round;
		resetQuotas(state.rules);
		events.push({ type: 'round', round });
		if (isNoticeRound(round)) {
			const rule = proposeRule(
				state.graph,
				state.rules,
				now,
				difficulty(round),
				random,
				state.nextRuleId
			);
			if (rule) {
				state.nextRuleId += 1;
				state.rules.push(rule);
				events.push({ type: 'notice', rule });
			}
		}
	}

	for (const rule of state.rules) {
		if (before < rule.startMs && now >= rule.startMs && now < rule.endMs) {
			events.push({ type: 'rule-start', rule });
		}
		if (before < rule.endMs && now >= rule.endMs) events.push({ type: 'rule-end', rule });
	}

	state.nextSpawnMs -= dtMs;
	if (state.nextSpawnMs <= 0) {
		const d = difficulty(state.round);
		if (state.crates.length < d.maxCrates) {
			events.push({ type: 'spawn', crate: spawnCrate(state, random) });
			state.nextSpawnMs += d.spawnEveryMs;
		} else {
			// The map is full: try again shortly
			state.nextSpawnMs = 400;
		}
	}

	const alive: Crate[] = [];
	for (const crate of state.crates) {
		if (state.phase !== 'playing') break;
		if (!moveCrate(state, crate, dtMs, events)) continue;
		if (now >= crate.deadlineMs) {
			state.late += 1;
			events.push({ type: 'late', crate });
			loseHeart(state, events);
			continue;
		}
		alive.push(crate);
	}
	state.crates = state.phase === 'playing' ? alive : [];
	return events;
}

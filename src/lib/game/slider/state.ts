/*
 * Sondage Slider: the poll line is YOUR approval rating. It sinks all the time and the pressure
 * grows every week. Tap rallies to lift it, counter scandals before they blow up, leave fake polls
 * alone. A spring-and-damper makes the drawn line overshoot and wobble after every hit. Survive all
 * eight weeks above the resign line; the final approval decides the stars.
 */
import type { Random } from '#lib/game/random.js';

export const WEEKS_TOTAL = 8;
export const WEEK_SECONDS = 14;
export const START_APPROVAL = 45;
export const RESIGN_LINE = 10;
/** Final approval needed for one, two and three stars */
export const STAR_LINES = [40, 55, 70] as const;
export const MAX_APPROVAL = 100;

export const PRESS_COOLDOWN = 12;
export const MAX_TARGETS = 7;
export const RALLY_GAIN = 3;
export const COUNTER_GAIN = 0.8;
export const DECOY_PENALTY = 6;
export const SCANDAL_PENALTY = 9;
export const PRESS_GAIN = 2;
export const STAR_BONUS = 400;

const SPRING = 60;
const DAMPING = 7;
const HISTORY_STEP = 0.12;
const HISTORY_LENGTH = 70;

export type TargetKind = 'rally' | 'scandal' | 'decoy';

export interface Target {
	id: number;
	kind: TargetKind;
	/** Position in percent of the arena */
	x: number;
	y: number;
	age: number;
	ttl: number;
}

export type SliderEvent =
	| { type: 'rally'; x: number; y: number; gain: number; points: number; combo: number }
	| { type: 'counter'; x: number; y: number; gain: number; points: number; combo: number }
	| { type: 'decoy'; x: number; y: number; loss: number }
	| { type: 'scandal'; x: number; y: number; loss: number }
	| { type: 'missed'; kind: 'rally'; x: number; y: number }
	| { type: 'press'; cleared: number; gain: number }
	| { type: 'press-not-ready' }
	| { type: 'spawn'; kind: TargetKind }
	| { type: 'week'; week: number }
	| { type: 'end'; won: boolean };

export interface SliderState {
	/** The true approval in percent */
	approval: number;
	/** The drawn line: it chases the approval like a spring and overshoots */
	shown: number;
	velocity: number;
	history: number[];
	targets: Target[];
	elapsed: number;
	week: number;
	combo: number;
	bestCombo: number;
	score: number;
	countered: number;
	spawnTimer: number;
	historyTimer: number;
	pressCooldown: number;
	nextId: number;
	over: boolean;
	won: boolean;
	stars: number;
}

export function createSlider(): SliderState {
	return {
		approval: START_APPROVAL,
		shown: START_APPROVAL,
		velocity: 0,
		history: [],
		targets: [],
		elapsed: 0,
		week: 1,
		combo: 0,
		bestCombo: 0,
		score: 0,
		countered: 0,
		spawnTimer: 0.6,
		historyTimer: 0,
		pressCooldown: 0,
		nextId: 1,
		over: false,
		won: false,
		stars: 0
	};
}

/** Approval lost per second to the news cycle */
export function driftPerSecond(week: number): number {
	return 0.5 + (week - 1) * 0.25;
}

/** Seconds between new tap targets */
export function spawnInterval(week: number): number {
	return Math.max(0.5, 1.5 - (week - 1) * 0.13);
}

/** How long a target stays before it expires */
export function targetLifetime(kind: TargetKind, week: number): number {
	const base = kind === 'scandal' ? 3.6 : kind === 'decoy' ? 2.6 : 2.4;
	const floor = kind === 'scandal' ? 2.2 : kind === 'decoy' ? 1.7 : 1.5;
	return Math.max(floor, base - (week - 1) * 0.15);
}

/** Score multiplier from the current streak: x1 up to x3 */
export function comboMultiplier(combo: number): number {
	return Math.min(3, 1 + Math.floor(combo / 5) * 0.5);
}

export function starsFor(approval: number): number {
	return STAR_LINES.filter((line) => approval >= line).length;
}

/** The relative chance of each kind of target this week: scandals from week 2, fake polls from week 3 */
export function spawnWeights(week: number): Record<TargetKind, number> {
	return {
		rally: 1,
		scandal: week >= 2 ? 0.25 + week * 0.03 : 0,
		decoy: week >= 3 ? 0.2 + week * 0.03 : 0
	};
}

function pickKind(week: number, random: Random): TargetKind {
	const weights = spawnWeights(week);
	let roll = random() * (weights.rally + weights.scandal + weights.decoy);
	if ((roll -= weights.rally) < 0) return 'rally';
	if ((roll -= weights.scandal) < 0) return 'scandal';
	return 'decoy';
}

function place(state: SliderState, random: Random): { x: number; y: number } {
	let best = { x: 50, y: 50 };
	let bestGap = -1;
	for (let attempt = 0; attempt < 8; attempt++) {
		const x = 10 + random() * 80;
		const y = 12 + random() * 76;
		const gap = Math.min(
			100,
			...state.targets.map((target) => Math.hypot(target.x - x, (target.y - y) * 0.8))
		);
		if (gap > bestGap) {
			bestGap = gap;
			best = { x, y };
		}
		if (gap >= 20) break;
	}
	return best;
}

function spawn(state: SliderState, random: Random, events: SliderEvent[]) {
	const kind = pickKind(state.week, random);
	const { x, y } = place(state, random);
	state.targets.push({
		id: state.nextId++,
		kind,
		x,
		y,
		age: 0,
		ttl: targetLifetime(kind, state.week)
	});
	events.push({ type: 'spawn', kind });
}

/** Changes the approval and kicks the drawn line so it swings past the new value */
function shift(state: SliderState, amount: number, kick: number) {
	state.approval = Math.min(MAX_APPROVAL, Math.max(0, state.approval + amount));
	state.velocity += kick;
}

function breakCombo(state: SliderState) {
	state.combo = 0;
}

function finish(state: SliderState, won: boolean, events: SliderEvent[]) {
	if (state.over) return;
	state.over = true;
	state.won = won;
	state.targets = [];
	state.stars = won ? starsFor(state.approval) : 0;
	if (won) state.score += state.stars * STAR_BONUS + Math.round(state.approval * 4);
	events.push({ type: 'end', won });
}

/** Advances the game by dt seconds; returns what happened, for sounds and effects */
export function tick(state: SliderState, dt: number, random: Random): SliderEvent[] {
	const events: SliderEvent[] = [];
	if (state.over) return events;

	state.elapsed += dt;
	state.pressCooldown = Math.max(0, state.pressCooldown - dt);
	shift(state, -driftPerSecond(state.week) * dt, 0);

	const week = Math.min(WEEKS_TOTAL, 1 + Math.floor(state.elapsed / WEEK_SECONDS));
	if (week > state.week) {
		state.week = week;
		events.push({ type: 'week', week });
	}

	// Spring and damper: the drawn line chases the approval with a lively overshoot
	const acceleration = SPRING * (state.approval - state.shown) - DAMPING * state.velocity;
	state.velocity += acceleration * dt;
	state.shown += state.velocity * dt;

	state.historyTimer += dt;
	while (state.historyTimer >= HISTORY_STEP) {
		state.historyTimer -= HISTORY_STEP;
		state.history.push(state.shown);
		if (state.history.length > HISTORY_LENGTH) state.history.shift();
	}

	for (const target of [...state.targets]) {
		target.age += dt;
		if (target.age < target.ttl) continue;
		state.targets = state.targets.filter((other) => other.id !== target.id);
		if (target.kind === 'scandal') {
			const loss = SCANDAL_PENALTY + state.week * 0.5;
			shift(state, -loss, -loss * 3);
			breakCombo(state);
			events.push({ type: 'scandal', x: target.x, y: target.y, loss });
		} else if (target.kind === 'rally') {
			breakCombo(state);
			events.push({ type: 'missed', kind: 'rally', x: target.x, y: target.y });
		}
	}

	state.spawnTimer -= dt;
	if (state.spawnTimer <= 0 && state.targets.length < MAX_TARGETS) {
		state.spawnTimer = spawnInterval(state.week) * (0.7 + random() * 0.6);
		spawn(state, random, events);
	} else if (state.spawnTimer <= 0) {
		state.spawnTimer = 0.2;
	}

	if (state.approval <= RESIGN_LINE) finish(state, false, events);
	else if (state.elapsed >= WEEKS_TOTAL * WEEK_SECONDS) finish(state, true, events);
	return events;
}

/** The player taps a target */
export function tap(state: SliderState, id: number): SliderEvent[] {
	const events: SliderEvent[] = [];
	if (state.over) return events;
	const target = state.targets.find((candidate) => candidate.id === id);
	if (!target) return events;
	state.targets = state.targets.filter((candidate) => candidate.id !== id);
	const { x, y } = target;

	if (target.kind === 'decoy') {
		shift(state, -DECOY_PENALTY, -DECOY_PENALTY * 2);
		breakCombo(state);
		events.push({ type: 'decoy', x, y, loss: DECOY_PENALTY });
	} else {
		state.combo++;
		state.bestCombo = Math.max(state.bestCombo, state.combo);
		const multiplier = comboMultiplier(state.combo);
		if (target.kind === 'rally') {
			const gain = RALLY_GAIN + Math.min(state.combo, 10) * 0.15;
			const points = Math.round(10 * multiplier);
			state.score += points;
			shift(state, gain, gain * 4);
			events.push({ type: 'rally', x, y, gain, points, combo: state.combo });
		} else {
			const points = Math.round(25 * multiplier);
			state.score += points;
			state.countered++;
			shift(state, COUNTER_GAIN, COUNTER_GAIN * 4);
			events.push({ type: 'counter', x, y, gain: COUNTER_GAIN, points, combo: state.combo });
		}
	}
	return events;
}

/** The press conference clears every scandal on screen and lifts the poll, but costs the streak */
export function pressConference(state: SliderState): SliderEvent[] {
	if (state.over) return [];
	if (state.pressCooldown > 0) return [{ type: 'press-not-ready' }];
	const cleared = state.targets.filter((target) => target.kind === 'scandal').length;
	state.targets = state.targets.filter((target) => target.kind !== 'scandal');
	state.countered += cleared;
	const gain = 1 + cleared * PRESS_GAIN;
	shift(state, gain, gain * 4);
	breakCombo(state);
	state.pressCooldown = PRESS_COOLDOWN;
	return [{ type: 'press', cleared, gain }];
}

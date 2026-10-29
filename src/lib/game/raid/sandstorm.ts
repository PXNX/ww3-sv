/*
 * Sandstorms on the desert map (the strait): a few dust devils wander the dunes. Whoever is inside
 * one (the player and any enemy on foot) is caught, dragged round and round for six seconds,
 * unable to walk or shoot, and then thrown clear in the direction it was spun. A dust devil rests
 * briefly after the throw, and dies down after a while; new ones rise elsewhere.
 */
import type { Random } from '#lib/game/random.js';
import { PLAYER_RADIUS, isElite } from './config';
import { resolveCircle } from './geometry';
import type { RaidEvent, RaidState } from './state';

/** How many dust devils at most, and when the first ones rise */
export const TORNADO_COUNT = 3;
export const TORNADO_FIRST_MS = 15_000;
/** Time between new ones rising, while there are fewer than TORNADO_COUNT */
export const TORNADO_SPAWN_MS = 6000;
/** How long one lasts before it dies down */
export const TORNADO_LIFE_MS = 30_000;
/** It catches whoever comes this close to its middle */
export const TORNADO_RADIUS = 30;
export const TORNADO_SPEED = 55;
/** Dragged round inside for six seconds, then the throw */
export const TORNADO_TRAP_MS = 6000;
export const TORNADO_SPIT_SPEED = 720;
export const TORNADO_SPIT_MS = 380;
/** After spitting someone out it cannot catch again for this long */
export const TORNADO_REST_MS = 1500;
/** New ones rise at least this far from the player */
const RISE_DISTANCE = 360;
/** Enemies larger than this are too heavy to be lifted */
const HEAVIEST = 36;

/** Who a dust devil holds or threw: the player, or an enemy by id */
export type TornadoTarget = 'player' | number;

export interface Tornado {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	ageMs: number;
	restMs: number;
	/** Everyone dragged around inside it right now */
	captives: { target: TornadoTarget; ms: number; angle: number; orbit: number }[];
}

/** Someone just spat out, still flying */
export interface Flung {
	target: TornadoTarget;
	vx: number;
	vy: number;
	ms: number;
}

export function updateSandstorms(
	state: RaidState,
	random: Random,
	dtMs: number,
	events: RaidEvent[]
) {
	const dt = dtMs / 1000;
	updateFlung(state, dtMs);
	if (state.mapId !== 'strait') return;
	rise(state, random, dtMs);

	const kept: Tornado[] = [];
	for (const tornado of state.tornadoes) {
		tornado.ageMs += dtMs;
		tornado.restMs = Math.max(0, tornado.restMs - dtMs);
		wander(state, tornado, random, dt);
		if (tornado.captives.length > 0) spin(state, tornado, random, dtMs, events);
		else if (tornado.restMs <= 0 && tornado.ageMs < TORNADO_LIFE_MS)
			catchAll(state, tornado, random, events);
		// Dies down once it is old and holds nobody
		if (tornado.ageMs < TORNADO_LIFE_MS || tornado.captives.length > 0) kept.push(tornado);
	}
	state.tornadoes = kept;
}

/** A new dust devil now and then, somewhere off to the side of the player */
function rise(state: RaidState, random: Random, dtMs: number) {
	const { map, player } = state;
	if (state.timeMs < TORNADO_FIRST_MS || state.tornadoes.length >= TORNADO_COUNT) return;
	state.tornadoRiseMs -= dtMs;
	if (state.tornadoRiseMs > 0) return;
	state.tornadoRiseMs = TORNADO_SPAWN_MS * (0.6 + random() * 0.8);
	for (let attempt = 0; attempt < 8; attempt++) {
		const x = 60 + random() * (map.width - 120);
		const y = 60 + random() * (map.height - 120);
		if (Math.hypot(x - player.x, y - player.y) < RISE_DISTANCE) continue;
		const heading = random() * Math.PI * 2;
		state.tornadoes.push({
			id: state.nextId++,
			x,
			y,
			vx: Math.cos(heading) * TORNADO_SPEED,
			vy: Math.sin(heading) * TORNADO_SPEED,
			ageMs: 0,
			restMs: 0,
			captives: []
		});
		return;
	}
}

/** Drifts on a slowly turning heading, bouncing off the edges of the map; slower while full */
function wander(state: RaidState, tornado: Tornado, random: Random, dt: number) {
	const { map } = state;
	const turn = (random() - 0.5) * 2.4 * dt;
	const cos = Math.cos(turn);
	const sin = Math.sin(turn);
	[tornado.vx, tornado.vy] = [
		tornado.vx * cos - tornado.vy * sin,
		tornado.vx * sin + tornado.vy * cos
	];
	const pace = tornado.captives.length > 0 ? 0.35 : 1;
	tornado.x += tornado.vx * pace * dt;
	tornado.y += tornado.vy * pace * dt;
	const margin = 40;
	if (tornado.x < margin || tornado.x > map.width - margin) tornado.vx = -tornado.vx;
	if (tornado.y < margin || tornado.y > map.height - margin) tornado.vy = -tornado.vy;
	tornado.x = Math.max(margin, Math.min(map.width - margin, tornado.x));
	tornado.y = Math.max(margin, Math.min(map.height - margin, tornado.y));
}

/** Whether someone is already caught in or flying out of a dust devil */
function busy(state: RaidState, target: TornadoTarget): boolean {
	return (
		state.tornadoes.some((tornado) =>
			tornado.captives.some((captive) => captive.target === target)
		) || state.flung.some((flung) => flung.target === target)
	);
}

/** Catches everyone inside at once: the player, and any enemy on foot that is light enough */
function catchAll(state: RaidState, tornado: Tornado, random: Random, events: RaidEvent[]) {
	const reach = (radius: number) => TORNADO_RADIUS + radius * 0.5;
	const catchTarget = (target: TornadoTarget, x: number, y: number, radius: number) => {
		if (busy(state, target)) return;
		if (Math.hypot(x - tornado.x, y - tornado.y) > reach(radius)) return;
		tornado.captives.push({
			target,
			ms: TORNADO_TRAP_MS,
			angle: random() * Math.PI * 2,
			orbit: 8 + random() * 14
		});
		events.push({ type: 'tornado-catch', x: tornado.x, y: tornado.y, player: target === 'player' });
	};
	const { player } = state;
	if (!state.over && !state.down && player.dashMs <= 0)
		catchTarget('player', player.x, player.y, PLAYER_RADIUS);
	for (const enemy of state.enemies) {
		if (enemy.flying || enemy.archetype === 'boss' || isElite(enemy.archetype)) continue;
		if (enemy.radius > HEAVIEST) continue;
		catchTarget(enemy.id, enemy.x, enemy.y, enemy.radius);
	}
}

/** Drags everyone it holds round the middle, then throws them clear when their six seconds are up */
function spin(
	state: RaidState,
	tornado: Tornado,
	random: Random,
	dtMs: number,
	events: RaidEvent[]
) {
	const kept: Tornado['captives'] = [];
	let released = false;
	for (const captive of tornado.captives) {
		const body = bodyOf(state, captive.target);
		// The enemy inside was killed while it spun
		if (!body) continue;
		captive.ms -= dtMs;
		captive.angle += (dtMs / 1000) * 6;
		body.x = tornado.x + Math.cos(captive.angle) * captive.orbit;
		body.y = tornado.y + Math.sin(captive.angle) * captive.orbit;
		body.vx = 0;
		body.vy = 0;
		hold(state, captive.target, captive.ms + TORNADO_SPIT_MS);
		if (captive.ms > 0) {
			kept.push(captive);
			continue;
		}
		// Out of the funnel they go, pushed on in the direction they were spun
		const heading = captive.angle + (random() - 0.5) * 0.5;
		state.flung.push({
			target: captive.target,
			vx: Math.cos(heading) * TORNADO_SPIT_SPEED,
			vy: Math.sin(heading) * TORNADO_SPIT_SPEED,
			ms: TORNADO_SPIT_MS
		});
		released = true;
		events.push({
			type: 'tornado-spit',
			x: tornado.x,
			y: tornado.y,
			player: captive.target === 'player'
		});
	}
	tornado.captives = kept;
	if (released) tornado.restMs = TORNADO_REST_MS;
}

/** Thrown ones fly out, slowing down, and stop at cover and the edge of the map */
function updateFlung(state: RaidState, dtMs: number) {
	const { map } = state;
	const dt = dtMs / 1000;
	const kept: Flung[] = [];
	for (const flung of state.flung) {
		const body = bodyOf(state, flung.target);
		if (!body) continue;
		flung.ms -= dtMs;
		const slow = Math.max(0, flung.ms / TORNADO_SPIT_MS);
		body.x += flung.vx * slow * dt;
		body.y += flung.vy * slow * dt;
		body.vx = 0;
		body.vy = 0;
		const radius = flung.target === 'player' ? PLAYER_RADIUS : (body.radius ?? PLAYER_RADIUS);
		resolveCircle(body, radius, map.obstacles, map.width, map.height);
		if (flung.ms > 0) kept.push(flung);
	}
	state.flung = kept;
}

function bodyOf(
	state: RaidState,
	target: TornadoTarget
): { x: number; y: number; vx: number; vy: number; radius?: number } | null {
	if (target === 'player') return state.player;
	return state.enemies.find((enemy) => enemy.id === target) ?? null;
}

/** Keeps a captive from walking and shooting (the stun) or attacking while it spins and flies */
function hold(state: RaidState, target: TornadoTarget, ms: number) {
	if (target === 'player') {
		state.player.stunMs = Math.max(state.player.stunMs, ms);
		return;
	}
	const enemy = state.enemies.find((entry) => entry.id === target);
	if (enemy) enemy.attackMs = Math.max(enemy.attackMs, ms);
}

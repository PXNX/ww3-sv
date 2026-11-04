/*
 * Iron Dome Juggler cosmetics: the battery's recoil, screen shake, building wobble, and the
 * debris, sparks, smoke, water and shock rings thrown by a launch, an intercept and an impact.
 *
 * Everything here is plain data stepped with the same fixed step as the rules, so the canvas only
 * has to draw it and the maths stays testable. It never touches the run: particles cannot hurt a
 * building, and a reduced-motion player gets a third of them, no shake and no flash.
 */
import { GROUND_Y, SEA_END, TARGETS } from './config.js';

export type ParticleKind = 'spark' | 'ember' | 'debris' | 'smoke' | 'drop';

export interface Particle {
	kind: ParticleKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Downward pull in world units per second squared */
	gravity: number;
	/** Exponential drag per second */
	drag: number;
	ageMs: number;
	lifeMs: number;
	size: number;
	/** Growth in world units per second: smoke spreads as it climbs */
	grow: number;
	/** Spin in radians and radians per second */
	rot: number;
	vr: number;
	color: string;
}

export interface Ring {
	x: number;
	y: number;
	radius: number;
	width: number;
	ageMs: number;
	lifeMs: number;
	color: string;
}

export interface DomeFx {
	particles: Particle[];
	rings: Ring[];
	/** Battery recoil in world units, positive pushes the tubes down, and its velocity */
	recoil: number;
	recoilV: number;
	/** Screen shake: time left, the time it started with, and its strength in world units */
	shakeMs: number;
	shakeMaxMs: number;
	shakeStrength: number;
	/** Warm flash left after a building is hit, and how long it lasts */
	flashMs: number;
	flashMaxMs: number;
	/** Per building: wobble left in ms after it was hit */
	wobble: number[];
	reduced: boolean;
}

export const MAX_PARTICLES = 420;
/** How long a hit building keeps wobbling */
export const WOBBLE_MS = 360;

const SPARKS = ['#fff3b0', '#ffd23f', '#ff9f1c', '#ff5d2b'];
const GOLD = ['#fff3b0', '#f5c83a', '#ffd23f'];
const ASH = ['#c9ccd3', '#e8e1bc', '#ffffff'];
const DEBRIS = ['#3a3f47', '#6d7482', '#9a5a2b', '#c9ccd3'];
const SMOKE = ['#6d7482', '#9aa0a8', '#4b5563'];
const WATER = ['#cdeeff', '#9fd6ef', '#e8f7ff'];

export function createFx(reduced = false): DomeFx {
	return {
		particles: [],
		rings: [],
		recoil: 0,
		recoilV: 0,
		shakeMs: 0,
		shakeMaxMs: 1,
		shakeStrength: 0,
		flashMs: 0,
		flashMaxMs: 1,
		wobble: TARGETS.map(() => 0),
		reduced
	};
}

type Rand = () => number;

/** How many particles to make: a reduced-motion player gets a third of them */
function many(fx: DomeFx, count: number): number {
	return fx.reduced ? Math.max(1, Math.round(count / 3)) : count;
}

function add(fx: DomeFx, particle: Particle) {
	if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();
	fx.particles.push(particle);
}

function particle(
	fx: DomeFx,
	kind: ParticleKind,
	init: Partial<Particle> & { x: number; y: number; color: string }
) {
	add(fx, {
		kind,
		vx: 0,
		vy: 0,
		gravity: 0,
		drag: 0,
		ageMs: 0,
		lifeMs: 600,
		size: 2,
		grow: 0,
		rot: 0,
		vr: 0,
		...init
	});
}

/** Shakes the screen for a moment; the strongest call wins, reduced motion ignores it */
export function shakeScreen(fx: DomeFx, strength: number, ms = 260) {
	if (fx.reduced || strength <= 0) return;
	fx.shakeStrength = Math.max(fx.shakeStrength, strength);
	fx.shakeMs = Math.max(fx.shakeMs, ms);
	fx.shakeMaxMs = Math.max(fx.shakeMaxMs, ms);
}

/** A short warm flash over the whole field after a building is hit */
export function flashScreen(fx: DomeFx, ms = 150) {
	if (fx.reduced) return;
	fx.flashMs = Math.max(fx.flashMs, ms);
	fx.flashMaxMs = Math.max(fx.flashMaxMs, ms);
}

/** Startles the building the rocket landed on; the renderer turns it into a decaying wobble */
export function wobbleBuilding(fx: DomeFx, index: number | null, ms = WOBBLE_MS) {
	if (index === null || index < 0 || index >= fx.wobble.length) return;
	fx.wobble[index] = Math.max(fx.wobble[index], ms);
}

/**
 * An interceptor leaving the battery: a muzzle flare, a puff of smoke, a shock ring and the kick
 * that makes the tubes dip on their spring.
 */
export function launchFx(
	fx: DomeFx,
	x: number,
	y: number,
	heading: number,
	random: Rand = Math.random
) {
	fx.recoilV += 70;
	for (let i = 0; i < many(fx, 8); i++) {
		const angle = heading + (random() - 0.5) * 0.7;
		const speed = 40 + random() * 90;
		particle(fx, 'spark', {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			gravity: 180,
			drag: 1.4,
			lifeMs: 220 + random() * 260,
			size: 1.4 + random() * 1.8,
			color: GOLD[Math.floor(random() * GOLD.length)]
		});
	}
	for (let i = 0; i < many(fx, 3); i++) {
		particle(fx, 'smoke', {
			x: x + (random() - 0.5) * 8,
			y: y + (random() - 0.5) * 6,
			vx: -Math.cos(heading) * (10 + random() * 14),
			vy: -14 - random() * 16,
			drag: 0.9,
			lifeMs: 520 + random() * 300,
			size: 4 + random() * 3,
			grow: 7,
			color: SMOKE[Math.floor(random() * SMOKE.length)]
		});
	}
	fx.rings.push({ x, y, radius: 22, width: 2.5, ageMs: 0, lifeMs: 320, color: '#f5c83a' });
}

/** The soft puff a rocket or an interceptor leaves behind as it flies */
export function trailFx(
	fx: DomeFx,
	x: number,
	y: number,
	kind: 'rocket' | 'interceptor',
	random: Rand = Math.random
) {
	if (fx.reduced && random() < 0.6) return;
	particle(fx, 'smoke', {
		x: x + (random() - 0.5) * 4,
		y: y + (random() - 0.5) * 4,
		vx: (random() - 0.5) * 8,
		vy: (random() - 0.5) * 8,
		drag: 0.6,
		lifeMs: kind === 'rocket' ? 380 + random() * 260 : 260 + random() * 180,
		size: kind === 'rocket' ? 3 + random() * 2 : 2 + random() * 1.5,
		grow: 6,
		color: kind === 'rocket' ? '#d8dbe0' : '#ffffff'
	});
	if (kind === 'rocket' && random() < 0.25) {
		particle(fx, 'ember', {
			x,
			y,
			vx: (random() - 0.5) * 16,
			vy: 6 + random() * 14,
			gravity: 60,
			drag: 0.4,
			lifeMs: 220 + random() * 180,
			size: 1.2 + random() * 1.2,
			color: SPARKS[Math.floor(random() * SPARKS.length)]
		});
	}
}

/** A starburst of sparks where an interceptor met a rocket, gold for a real hit and ash for a waste */
export function interceptFx(
	fx: DomeFx,
	x: number,
	y: number,
	gold: boolean,
	random: Rand = Math.random
) {
	const colors = gold ? GOLD : ASH;
	for (let i = 0; i < many(fx, 18); i++) {
		const angle = random() * Math.PI * 2;
		const speed = 50 + random() * 150;
		particle(fx, 'spark', {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			gravity: 260,
			drag: 1.1,
			lifeMs: 300 + random() * 320,
			size: 1.5 + random() * 2,
			color: colors[Math.floor(random() * colors.length)]
		});
	}
	for (let i = 0; i < many(fx, 5); i++) {
		particle(fx, 'smoke', {
			x: x + (random() - 0.5) * 10,
			y: y + (random() - 0.5) * 8,
			vx: (random() - 0.5) * 24,
			vy: -8 - random() * 22,
			drag: 0.7,
			lifeMs: 500 + random() * 380,
			size: 5 + random() * 5,
			grow: 8,
			color: SMOKE[Math.floor(random() * SMOKE.length)]
		});
	}
	fx.rings.push({
		x,
		y,
		radius: gold ? 30 : 20,
		width: 3,
		ageMs: 0,
		lifeMs: 380,
		color: gold ? '#f5c83a' : '#c9ccd3'
	});
	shakeScreen(fx, gold ? 2.4 : 1.4, 150);
}

/** A small puff where an interceptor runs out of time or outlives its rocket */
export function fizzleFx(fx: DomeFx, x: number, y: number, random: Rand = Math.random) {
	for (let i = 0; i < many(fx, 5); i++) {
		particle(fx, 'smoke', {
			x: x + (random() - 0.5) * 6,
			y: y + (random() - 0.5) * 6,
			vx: (random() - 0.5) * 20,
			vy: -6 - random() * 14,
			drag: 0.9,
			lifeMs: 420 + random() * 260,
			size: 4 + random() * 3,
			grow: 7,
			color: SMOKE[Math.floor(random() * SMOKE.length)]
		});
	}
	fx.rings.push({ x, y, radius: 16, width: 2, ageMs: 0, lifeMs: 300, color: '#c9ccd3' });
}

/** Water thrown up where a rocket lands in the sea, with a foam ring on the surface */
export function splashFx(fx: DomeFx, x: number, y: number, scale = 1, random: Rand = Math.random) {
	const surface = Math.min(y, GROUND_Y - 5);
	for (let i = 0; i < many(fx, 16); i++) {
		const angle = -Math.PI / 2 + (random() - 0.5) * 2.1;
		const speed = (70 + random() * 150) * scale;
		particle(fx, 'drop', {
			x: x + (random() - 0.5) * 10,
			y: surface,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			gravity: 420,
			drag: 0.1,
			lifeMs: 420 + random() * 320,
			size: 1.4 + random() * 2,
			color: WATER[Math.floor(random() * WATER.length)]
		});
	}
	fx.rings.push({
		x,
		y: surface,
		radius: 34 * scale,
		width: 2.5,
		ageMs: 0,
		lifeMs: 560,
		color: '#e8f7ff'
	});
}

/** A rocket that lands in the empty field: dust, torn grass and a little shake */
export function fieldFx(fx: DomeFx, x: number, y: number, random: Rand = Math.random) {
	for (let i = 0; i < many(fx, 12); i++) {
		const angle = -Math.PI / 2 + (random() - 0.5) * 2.4;
		const speed = 40 + random() * 110;
		particle(fx, 'debris', {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			gravity: 340,
			drag: 0.2,
			lifeMs: 600 + random() * 500,
			size: 1.6 + random() * 2.4,
			rot: random() * Math.PI,
			vr: (random() - 0.5) * 12,
			color: random() < 0.7 ? '#7fb85a' : '#5e9a41'
		});
	}
	for (let i = 0; i < many(fx, 4); i++) {
		particle(fx, 'smoke', {
			x: x + (random() - 0.5) * 12,
			y: y - random() * 8,
			vx: (random() - 0.5) * 26,
			vy: -6 - random() * 18,
			drag: 0.8,
			lifeMs: 420 + random() * 300,
			size: 4 + random() * 4,
			grow: 6,
			color: '#d9ccae'
		});
	}
	shakeScreen(fx, 3, 180);
}

/**
 * A building taking a hit: a fireball, sparks, masonry that arcs and bounces, smoke, a shock ring,
 * a flash and the hardest shake in the game.
 */
export function impactFx(
	fx: DomeFx,
	x: number,
	y: number,
	cost: number,
	random: Rand = Math.random
) {
	for (let i = 0; i < many(fx, 22); i++) {
		const angle = random() * Math.PI * 2;
		const speed = 60 + random() * 190;
		particle(fx, 'spark', {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 40,
			gravity: 300,
			drag: 0.9,
			lifeMs: 360 + random() * 380,
			size: 1.6 + random() * 2.6,
			color: SPARKS[Math.floor(random() * SPARKS.length)]
		});
	}
	for (let i = 0; i < many(fx, 12); i++) {
		const angle = random() * Math.PI * 2;
		const speed = 50 + random() * 160;
		particle(fx, 'debris', {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 90,
			gravity: 360,
			drag: 0.15,
			lifeMs: 900 + random() * 700,
			size: 2.5 + random() * 4,
			rot: random() * Math.PI * 2,
			vr: (random() - 0.5) * 16,
			color: DEBRIS[Math.floor(random() * DEBRIS.length)]
		});
	}
	for (let i = 0; i < many(fx, 8); i++) {
		particle(fx, 'smoke', {
			x: x + (random() - 0.5) * 18,
			y: y - random() * 12,
			vx: (random() - 0.5) * 38,
			vy: -12 - random() * 30,
			drag: 0.6,
			lifeMs: 900 + random() * 700,
			size: 8 + random() * 9,
			grow: 10,
			color: SMOKE[Math.floor(random() * SMOKE.length)]
		});
	}
	fx.rings.push({
		x,
		y,
		radius: 54 + cost * 6,
		width: 4,
		ageMs: 0,
		lifeMs: 520,
		color: '#ffb347'
	});
	shakeScreen(fx, 9 + cost * 1.5, 340);
	flashScreen(fx, 160);
}

/**
 * Advances every effect by one fixed step: gravity, drag and spin for the particles, a bounce off
 * the land (debris) or a quick end in the water (everything else), the battery's recoil spring and
 * the decay of shake, flash and wobble.
 */
export function stepFx(fx: DomeFx, dtMs: number) {
	const dt = dtMs / 1000;

	// The tubes are a damped spring back to rest after the launch kick
	const accel = -170 * fx.recoil - 16 * fx.recoilV;
	fx.recoilV += accel * dt;
	fx.recoil += fx.recoilV * dt;

	let write = 0;
	for (const p of fx.particles) {
		p.ageMs += dtMs;
		if (p.ageMs >= p.lifeMs) continue;
		p.vy += p.gravity * dt;
		const damp = Math.exp(-p.drag * dt);
		p.vx *= damp;
		p.vy *= damp;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.rot += p.vr * dt;
		p.size = Math.max(0.4, p.size + p.grow * dt);

		const floor = p.x < SEA_END ? GROUND_Y - 5 : GROUND_Y - 2;
		if (p.y > floor) {
			if (p.kind === 'smoke') {
				// Smoke settles on the ground instead of sinking through it
				p.y = floor;
				p.vy = 0;
			} else if (p.kind === 'debris' && p.x >= SEA_END) {
				// Masonry lands on the grass and bounces with the energy it has left
				p.y = floor;
				p.vy = -Math.abs(p.vy) * 0.42;
				p.vx *= 0.68;
				p.vr *= 0.7;
				if (Math.abs(p.vy) < 8) p.vy = 0;
			} else {
				// Sparks fizzle out and drops and sea debris vanish in the water
				continue;
			}
		}
		fx.particles[write++] = p;
	}
	fx.particles.length = write;

	let rings = 0;
	for (const ring of fx.rings) {
		ring.ageMs += dtMs;
		if (ring.ageMs < ring.lifeMs) fx.rings[rings++] = ring;
	}
	fx.rings.length = rings;

	for (let i = 0; i < fx.wobble.length; i++) {
		fx.wobble[i] = Math.max(0, fx.wobble[i] - dtMs);
	}

	fx.shakeMs = Math.max(0, fx.shakeMs - dtMs);
	fx.shakeStrength *= Math.exp(-8 * dt);
	if (fx.shakeMs <= 0) fx.shakeStrength = 0;

	fx.flashMs = Math.max(0, fx.flashMs - dtMs);
}

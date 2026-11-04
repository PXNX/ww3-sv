/*
 * Particles for GPS Liar: foam in the wake, sparks and splashes on a hit, confetti at a harbour and
 * glitch bits when the spoofer switches on. They are scenery only: a flat list that is aged and
 * moved here, drawn by render.ts. The list is capped so a long run cannot grow it.
 */
import type { Random } from '../random.js';
import type { Vec } from './lie.js';

export type ParticleKind = 'foam' | 'spark' | 'confetti' | 'glitch';

export interface Particle extends Vec {
	kind: ParticleKind;
	vx: number;
	vy: number;
	ageMs: number;
	durationMs: number;
	size: number;
	/** Hue index or rotation, kind specific */
	tint: number;
}

export const MAX_PARTICLES = 220;

/** Appends particles, dropping the oldest when the cap is reached */
export function addParticles(list: Particle[], more: readonly Particle[]) {
	list.push(...more);
	if (list.length > MAX_PARTICLES) list.splice(0, list.length - MAX_PARTICLES);
}

/** Two bubbles of foam at the stern of a boat moving at some speed; empty when it is nearly still */
export function wakeFoam(pos: Vec, facing: number, speed: number, random: Random): Particle[] {
	if (speed < 0.5) return [];
	const back = { x: -Math.cos(facing), y: -Math.sin(facing) };
	const side = { x: -back.y, y: back.x };
	return [-1, 1].map((sign) => {
		const spread = (0.15 + random() * 0.1) * sign;
		return {
			kind: 'foam' as const,
			x: pos.x + back.x * 0.4 + side.x * spread,
			y: pos.y + back.y * 0.4 + side.y * spread,
			vx: side.x * sign * 0.25 + back.x * 0.1,
			vy: side.y * sign * 0.25 + back.y * 0.1,
			ageMs: 0,
			durationMs: 700 + random() * 500,
			size: 0.07 + Math.min(0.08, speed * 0.03),
			tint: 0
		};
	});
}

/** A burst of particles from a point, flying outward in all directions */
export function burst(
	at: Vec,
	kind: ParticleKind,
	count: number,
	speed: number,
	random: Random
): Particle[] {
	return Array.from({ length: count }, () => {
		const angle = random() * Math.PI * 2;
		const push = speed * (0.4 + random() * 0.6);
		return {
			kind,
			x: at.x,
			y: at.y,
			vx: Math.cos(angle) * push,
			vy: Math.sin(angle) * push,
			ageMs: 0,
			durationMs: 450 + random() * 500,
			size: 0.06 + random() * 0.08,
			tint: Math.floor(random() * 4)
		};
	});
}

/** Ages and moves particles by dt milliseconds, returning only the ones still alive */
export function stepParticles(list: readonly Particle[], dtMs: number): Particle[] {
	const dt = dtMs / 1000;
	const alive: Particle[] = [];
	for (const particle of list) {
		particle.ageMs += dtMs;
		if (particle.ageMs >= particle.durationMs) continue;
		particle.x += particle.vx * dt;
		particle.y += particle.vy * dt;
		// Everything slows in the water or air
		const drag = Math.max(0, 1 - 2.2 * dt);
		particle.vx *= drag;
		particle.vy *= drag;
		alive.push(particle);
	}
	return alive;
}

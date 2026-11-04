/*
 * Map effects as plain data: bursts of particles with a little gravity and drag, and the
 * headline ticker. The map component only draws what these functions return.
 */
import type { Random } from '#lib/game/random.js';

export type BurstKind = 'capture' | 'lost' | 'repelled' | 'held' | 'crisis';

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Seconds left to live, and how long it lived to begin with */
	life: number;
	span: number;
	size: number;
	color: string;
}

const PALETTES: Record<BurstKind, readonly string[]> = {
	capture: ['#4fa8d8', '#ffd23f', '#ffffff'],
	lost: ['#e5484d', '#7a1f23', '#2b2b2b'],
	repelled: ['#e5484d', '#ffb347', '#444444'],
	held: ['#4fa8d8', '#9ad0ec', '#ffffff'],
	crisis: ['#ffd23f', '#ff8a3d', '#e5484d']
};

const COUNTS: Record<BurstKind, number> = {
	capture: 26,
	lost: 30,
	repelled: 16,
	held: 14,
	crisis: 20
};

/** Sparks and debris flying out from a point, in map units (0 to 100) */
export function burst(kind: BurstKind, x: number, y: number, random: Random): Particle[] {
	const palette = PALETTES[kind];
	return Array.from({ length: COUNTS[kind] }, () => {
		const angle = random() * Math.PI * 2;
		const speed = 8 + random() * 22;
		const span = 0.5 + random() * 0.7;
		return {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 6,
			life: span,
			span,
			size: 0.5 + random() * 0.9,
			color: palette[Math.floor(random() * palette.length)]
		};
	});
}

const GRAVITY = 40;
const DRAG = 2.2;

/** Moves every particle on by `dt` seconds and returns the survivors */
export function stepParticles(particles: Particle[], dt: number): Particle[] {
	const survivors: Particle[] = [];
	for (const particle of particles) {
		const life = particle.life - dt;
		if (life <= 0) continue;
		const damp = Math.max(0, 1 - DRAG * dt);
		const vx = particle.vx * damp;
		const vy = particle.vy * damp + GRAVITY * dt;
		survivors.push({
			...particle,
			x: particle.x + vx * dt,
			y: particle.y + vy * dt,
			vx,
			vy,
			life
		});
	}
	return survivors;
}

/** A damped spring step for meters: returns the next value and velocity */
export function springStep(
	value: number,
	velocity: number,
	target: number,
	dt: number,
	stiffness = 140,
	damping = 14
): { value: number; velocity: number } {
	const accel = stiffness * (target - value) - damping * velocity;
	const nextVelocity = velocity + accel * dt;
	return { value: value + nextVelocity * dt, velocity: nextVelocity };
}

export interface Headline {
	id: number;
	text: string;
	tone: 'good' | 'bad' | 'neutral';
}

/** Keeps the newest headlines, newest first */
export function pushHeadline(list: readonly Headline[], item: Headline, max = 12): Headline[] {
	return [item, ...list].slice(0, max);
}

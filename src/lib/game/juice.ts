/*
 * Pure parts of the juice kit: tiny particles with gravity, drag and a bouncing floor, drifting
 * score numbers and an exponentially decaying screen shake. Kept free of Svelte so the physics can
 * be unit tested and reused by canvas renderers as well as the DOM layer.
 */

export type BurstKind = 'spark' | 'confetti' | 'smoke' | 'splash';

export interface Particle {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	size: number;
	color: string;
	spin: number;
	angle: number;
	shape: BurstKind;
}

export interface FloatText {
	id: number;
	x: number;
	y: number;
	vy: number;
	life: number;
	maxLife: number;
	text: string;
	color: string;
}

export interface Bounds {
	width: number;
	height: number;
	/** Y of the floor the particles bounce off; defaults to the bottom of the bounds */
	floor?: number;
}

export interface Shake {
	/** Current amplitude in pixels */
	amplitude: number;
	/** Horizontal offset for this frame */
	x: number;
	y: number;
}

const PALETTES: Record<BurstKind, string[]> = {
	spark: ['#f5c83a', '#e5484d', '#ffffff'],
	confetti: ['#f5c83a', '#4fa8d8', '#e5484d', '#7c8c5c', '#ffffff'],
	smoke: ['#aeb4be', '#6a7c9b', '#e8e1bc'],
	splash: ['#4fa8d8', '#aeb4be', '#ffffff']
};

/** Deterministic tiny PRNG so a burst can be reproduced from a seed in tests */
export function rng(seed: number): () => number {
	let state = seed >>> 0 || 1;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

export function makeBurst(
	id: () => number,
	x: number,
	y: number,
	kind: BurstKind = 'spark',
	count = 12,
	random: () => number = Math.random
): Particle[] {
	const colors = PALETTES[kind];
	return Array.from({ length: count }, () => {
		const angle = random() * Math.PI * 2;
		const speed = (kind === 'confetti' ? 160 : 110) + random() * (kind === 'smoke' ? 60 : 190);
		const maxLife = (kind === 'smoke' ? 0.9 : 0.55) + random() * 0.5;
		return {
			id: id(),
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - (kind === 'confetti' ? 180 : 60),
			life: maxLife,
			maxLife,
			size: (kind === 'confetti' ? 7 : 4) + random() * 5,
			color: colors[Math.floor(random() * colors.length)],
			spin: (random() - 0.5) * 12,
			angle: random() * Math.PI,
			shape: kind
		};
	});
}

export function makeFloat(
	id: () => number,
	x: number,
	y: number,
	text: string,
	color = '#f5c83a'
): FloatText {
	return { id: id(), x, y, vy: -70, life: 0.9, maxLife: 0.9, text, color };
}

/**
 * One physics step: gravity pulls, air drag slows, and particles bounce off the floor with a loss
 * of energy and a little ground friction. Smoke floats up instead of falling.
 */
export function stepParticles(particles: Particle[], dt: number, bounds: Bounds): Particle[] {
	const floor = bounds.floor ?? bounds.height;
	const alive: Particle[] = [];
	for (const p of particles) {
		p.life -= dt;
		if (p.life <= 0) continue;
		const gravity = p.shape === 'smoke' ? -40 : p.shape === 'confetti' ? 420 : 780;
		const drag = p.shape === 'smoke' ? 1.6 : p.shape === 'confetti' ? 1.1 : 0.5;
		p.vy += gravity * dt;
		const damp = Math.max(0, 1 - drag * dt);
		p.vx *= damp;
		p.vy *= damp;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.angle += p.spin * dt;
		if (p.y > floor) {
			p.y = floor;
			p.vy = -p.vy * 0.42;
			p.vx *= 0.72;
			p.spin *= 0.6;
		}
		alive.push(p);
	}
	return alive;
}

export function stepFloats(floats: FloatText[], dt: number): FloatText[] {
	const alive: FloatText[] = [];
	for (const f of floats) {
		f.life -= dt;
		if (f.life <= 0) continue;
		f.y += f.vy * dt;
		f.vy *= Math.max(0, 1 - 1.2 * dt);
		alive.push(f);
	}
	return alive;
}

/** Shake decays fast and jitters with a sine/cosine pair at different rates */
export function stepShake(shake: Shake, dt: number, time: number): Shake {
	const amplitude = Math.max(0, shake.amplitude - dt * 28);
	if (amplitude === 0) return { amplitude, x: 0, y: 0 };
	return {
		amplitude,
		x: Math.sin(time * 0.09) * amplitude,
		y: Math.cos(time * 0.13) * amplitude * 0.6
	};
}

/*
 * Cosmetic particles: embers and smoke from the candles, sparks along the star, hearts for
 * purring cats and dust where a cat lands. They never influence the ritual, so they use their own
 * random and stay out of the replayable state. The pool is capped so a busy moment cannot choke
 * the renderer.
 */

export type ParticleKind = 'ember' | 'smoke' | 'spark' | 'heart' | 'dust';

export interface Particle {
	kind: ParticleKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Remaining life in ms, and the total it started with */
	life: number;
	span: number;
	size: number;
}

export const MAX_PARTICLES = 150;

export interface ParticleSpec {
	life: number;
	size: number;
	/** Speed ranges in units per second */
	speed: number;
	rise: number;
}

const SPECS: Record<ParticleKind, ParticleSpec> = {
	ember: { life: 1400, size: 3.5, speed: 14, rise: -34 },
	smoke: { life: 2600, size: 9, speed: 10, rise: -40 },
	spark: { life: 900, size: 4, speed: 130, rise: -10 },
	heart: { life: 1500, size: 11, speed: 12, rise: -55 },
	dust: { life: 600, size: 6, speed: 90, rise: -15 }
};

export function spawn(
	pool: Particle[],
	kind: ParticleKind,
	x: number,
	y: number,
	random: () => number,
	count = 1
): void {
	const spec = SPECS[kind];
	for (let i = 0; i < count; i++) {
		if (pool.length >= MAX_PARTICLES) pool.shift();
		const angle = random() * Math.PI * 2;
		const speed = spec.speed * (0.4 + random() * 0.6);
		const life = spec.life * (0.7 + random() * 0.5);
		pool.push({
			kind,
			x,
			y,
			vx: Math.cos(angle) * speed,
			// Dust and sparks fly sideways, everything else drifts up
			vy: kind === 'dust' || kind === 'spark' ? Math.sin(angle) * speed * 0.5 : spec.rise,
			life,
			span: life,
			size: spec.size * (0.7 + random() * 0.6)
		});
	}
}

/** Moves every particle and drops the dead ones, in place */
export function stepParticles(pool: Particle[], dtMs: number): void {
	const dt = dtMs / 1000;
	let write = 0;
	for (const particle of pool) {
		particle.life -= dtMs;
		if (particle.life <= 0) continue;
		particle.x += particle.vx * dt;
		particle.y += particle.vy * dt;
		// Smoke spreads and slows as it climbs; dust slows quickly
		const drag = particle.kind === 'dust' ? 4 : particle.kind === 'smoke' ? 0.6 : 0.2;
		particle.vx -= particle.vx * drag * dt;
		if (particle.kind === 'dust') particle.vy -= particle.vy * drag * dt;
		pool[write++] = particle;
	}
	pool.length = write;
}

/** How far through its life a particle is, 0 (new) to 1 (gone) */
export function age(particle: Particle): number {
	return 1 - particle.life / particle.span;
}

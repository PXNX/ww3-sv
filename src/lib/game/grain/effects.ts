/*
 * Grain Corridor visual effects: debris, splashes, grain, foam, shock rings and floating
 * call-outs. Pure data stepped with the same fixed loop as the rules (no DOM), so it can be tested
 * and drawn by any renderer. Everything is cosmetic: it never touches the game state.
 */
import { WORLD_WIDTH } from './config.js';

export type ParticleKind = 'spark' | 'debris' | 'drop' | 'grain' | 'smoke' | 'foam' | 'bubble';

export interface Particle {
	kind: ParticleKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Downward pull, world units per second squared (0 for things floating on the sea) */
	gravity: number;
	/** Share of the sea's scroll speed the particle follows: 1 sits on the water, 0 stays put */
	drift: number;
	ageMs: number;
	lifeMs: number;
	size: number;
	rot: number;
	vr: number;
	color: string;
}

export type RingKind = 'shock' | 'sweep' | 'pulse' | 'heal';

export interface Ring {
	kind: RingKind;
	x: number;
	y: number;
	ageMs: number;
	lifeMs: number;
	radius: number;
	color: string;
}

export interface FloatText {
	x: number;
	y: number;
	text: string;
	ageMs: number;
	lifeMs: number;
	color: string;
	big: boolean;
}

export interface Fx {
	particles: Particle[];
	rings: Ring[];
	texts: FloatText[];
	/** Screen shake time left, and the hit flash time left */
	shakeMs: number;
	shakeStrength: number;
	flashMs: number;
	flashColor: string;
	/** Fewer particles, no shake and no flash */
	reduced: boolean;
	/** Time since the last wake puff */
	wakeMs: number;
}

export const MAX_PARTICLES = 420;
export const SHAKE_MS = 320;
export const FLASH_MS = 360;

export function createFx(reduced = false): Fx {
	return {
		particles: [],
		rings: [],
		texts: [],
		shakeMs: 0,
		shakeStrength: 0,
		flashMs: 0,
		flashColor: '#ff3b30',
		reduced,
		wakeMs: 0
	};
}

type Rand = () => number;

function add(fx: Fx, particle: Particle) {
	if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();
	fx.particles.push(particle);
}

/** How many particles to make: a reduced-motion player gets a third of them */
function count(fx: Fx, n: number): number {
	return fx.reduced ? Math.max(1, Math.round(n / 3)) : n;
}

const DEBRIS = ['#3a3f47', '#6b7280', '#9a3412', '#4b5563'];
const FIRE = ['#fff3b0', '#ffd23f', '#ff9f1c', '#ff5d2b'];

/** A mine or a crashed ship going up: a fireball, flying debris, smoke and a water column */
export function explosion(fx: Fx, x: number, y: number, scale = 1, random: Rand = Math.random) {
	for (let i = 0; i < count(fx, 16); i++) {
		const angle = random() * Math.PI * 2;
		const speed = (60 + random() * 190) * scale;
		add(fx, {
			kind: 'spark',
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 30,
			gravity: 160,
			drift: 0.4,
			ageMs: 0,
			lifeMs: 380 + random() * 320,
			size: (2 + random() * 3.5) * scale,
			rot: 0,
			vr: 0,
			color: FIRE[Math.floor(random() * FIRE.length)]
		});
	}
	for (let i = 0; i < count(fx, 10); i++) {
		const angle = random() * Math.PI * 2;
		const speed = (50 + random() * 150) * scale;
		add(fx, {
			kind: 'debris',
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 80,
			gravity: 320,
			drift: 0.6,
			ageMs: 0,
			lifeMs: 700 + random() * 500,
			size: (2.5 + random() * 3.5) * scale,
			rot: random() * Math.PI * 2,
			vr: (random() - 0.5) * 14,
			color: DEBRIS[Math.floor(random() * DEBRIS.length)]
		});
	}
	for (let i = 0; i < count(fx, 6); i++) {
		add(fx, {
			kind: 'smoke',
			x: x + (random() - 0.5) * 14,
			y: y + (random() - 0.5) * 10,
			vx: (random() - 0.5) * 36,
			vy: -10 - random() * 26,
			gravity: 0,
			drift: 0.7,
			ageMs: 0,
			lifeMs: 800 + random() * 600,
			size: (9 + random() * 9) * scale,
			rot: 0,
			vr: 0,
			color: '#2d3440'
		});
	}
	splash(fx, x, y, scale * 1.2, random);
	fx.rings.push({
		kind: 'shock',
		x,
		y,
		ageMs: 0,
		lifeMs: 460,
		radius: 70 * scale,
		color: '#ffd23f'
	});
	if (!fx.reduced) {
		fx.shakeMs = SHAKE_MS;
		fx.shakeStrength = 7 * scale;
	}
	fx.flashMs = FLASH_MS;
	fx.flashColor = '#ff3b30';
}

/** Droplets thrown up and a foam ring: water where something fell in or blew up */
export function splash(fx: Fx, x: number, y: number, scale = 1, random: Rand = Math.random) {
	for (let i = 0; i < count(fx, 14); i++) {
		const angle = -Math.PI / 2 + (random() - 0.5) * 2.2;
		const speed = (60 + random() * 150) * scale;
		add(fx, {
			kind: 'drop',
			x: x + (random() - 0.5) * 12,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			gravity: 420,
			drift: 1,
			ageMs: 0,
			lifeMs: 420 + random() * 300,
			size: (1.5 + random() * 2.5) * scale,
			rot: 0,
			vr: 0,
			color: '#cdeeff'
		});
	}
	fx.rings.push({
		kind: 'pulse',
		x,
		y,
		ageMs: 0,
		lifeMs: 620,
		radius: 38 * scale,
		color: '#dff6ff'
	});
}

/** Grain pouring out of a crate that was caught, or spilling from a breached hold */
export function grainBurst(
	fx: Fx,
	x: number,
	y: number,
	n = 10,
	spill = false,
	random: Rand = Math.random
) {
	for (let i = 0; i < count(fx, n); i++) {
		const angle = spill ? random() * Math.PI * 2 : -Math.PI / 2 + (random() - 0.5) * 2.6;
		const speed = 40 + random() * (spill ? 150 : 110);
		add(fx, {
			kind: 'grain',
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			gravity: spill ? 260 : 220,
			drift: spill ? 1 : 0.5,
			ageMs: 0,
			lifeMs: 520 + random() * 400,
			size: 1.8 + random() * 1.8,
			rot: random() * Math.PI,
			vr: (random() - 0.5) * 10,
			color: random() < 0.5 ? '#f4c542' : '#e8a92b'
		});
	}
}

/** Sparkles for a repair or a restocked minesweeper */
export function heal(fx: Fx, x: number, y: number, random: Rand = Math.random) {
	for (let i = 0; i < count(fx, 10); i++) {
		const angle = random() * Math.PI * 2;
		add(fx, {
			kind: 'spark',
			x,
			y,
			vx: Math.cos(angle) * (30 + random() * 70),
			vy: Math.sin(angle) * (30 + random() * 70) - 30,
			gravity: -40,
			drift: 0.6,
			ageMs: 0,
			lifeMs: 500 + random() * 300,
			size: 2 + random() * 2,
			rot: 0,
			vr: 0,
			color: '#8dffb0'
		});
	}
	fx.rings.push({ kind: 'heal', x, y, ageMs: 0, lifeMs: 520, radius: 40, color: '#8dffb0' });
}

/** The sonar pulse of a minesweeper: a ring that races up the lane */
export function sweepWave(fx: Fx, x: number, y: number) {
	fx.rings.push({ kind: 'sweep', x, y, ageMs: 0, lifeMs: 560, radius: 260, color: '#6dffb7' });
}

/** A short line of foam from the stern; call it every step, it makes one puff per interval */
export function wake(
	fx: Fx,
	dtMs: number,
	x: number,
	y: number,
	width: number,
	random: Rand = Math.random
) {
	fx.wakeMs += dtMs;
	if (fx.wakeMs < (fx.reduced ? 90 : 38)) return;
	fx.wakeMs = 0;
	for (const side of [-1, 1]) {
		add(fx, {
			kind: 'foam',
			x: x + side * width * 0.5,
			y: y + 4,
			vx: side * (10 + random() * 16),
			vy: 0,
			gravity: 0,
			drift: 0.92,
			ageMs: 0,
			lifeMs: 700 + random() * 300,
			size: 2.2 + random() * 1.6,
			rot: 0,
			vr: 0,
			color: '#e8f7ff'
		});
	}
	if (random() < 0.4) {
		add(fx, {
			kind: 'bubble',
			x: x + (random() - 0.5) * width * 0.6,
			y: y + 8,
			vx: (random() - 0.5) * 8,
			vy: 0,
			gravity: 0,
			drift: 0.85,
			ageMs: 0,
			lifeMs: 500 + random() * 300,
			size: 1.2 + random() * 1.4,
			rot: 0,
			vr: 0,
			color: '#bfe6ff'
		});
	}
}

/** A call-out that rises and fades, centred on x and kept on the screen */
export function floatText(
	fx: Fx,
	x: number,
	y: number,
	text: string,
	color = '#ffffff',
	big = false
) {
	if (fx.texts.length > 12) fx.texts.shift();
	fx.texts.push({
		x: Math.min(WORLD_WIDTH - 40, Math.max(40, x)),
		y,
		text,
		ageMs: 0,
		lifeMs: big ? 1100 : 800,
		color,
		big
	});
}

/** A flash of colour over the screen (a hit, a heal) */
export function flash(fx: Fx, color: string, ms = FLASH_MS) {
	fx.flashMs = ms;
	fx.flashColor = color;
}

/** A shorter, softer shake for a near miss or a near thing */
export function shake(fx: Fx, strength: number, ms = SHAKE_MS) {
	if (fx.reduced) return;
	fx.shakeMs = Math.max(fx.shakeMs, ms);
	fx.shakeStrength = Math.max(fx.shakeStrength, strength);
}

/** Advances every effect; scrollSpeed is the sea's speed in world units per second */
export function updateFx(fx: Fx, dtMs: number, scrollSpeed: number) {
	const dt = dtMs / 1000;
	for (const p of fx.particles) {
		p.ageMs += dtMs;
		p.vy += p.gravity * dt;
		p.x += p.vx * dt;
		p.y += (p.vy + scrollSpeed * p.drift) * dt;
		p.rot += p.vr * dt;
	}
	fx.particles = fx.particles.filter((p) => p.ageMs < p.lifeMs);
	for (const r of fx.rings) {
		r.ageMs += dtMs;
		r.y += scrollSpeed * 0.9 * dt;
	}
	fx.rings = fx.rings.filter((r) => r.ageMs < r.lifeMs);
	for (const t of fx.texts) {
		t.ageMs += dtMs;
		t.y -= 34 * dt;
	}
	fx.texts = fx.texts.filter((t) => t.ageMs < t.lifeMs);
	fx.shakeMs = Math.max(0, fx.shakeMs - dtMs);
	fx.flashMs = Math.max(0, fx.flashMs - dtMs);
}

/*
 * Visual effects of Iceberg Curling: ice spray and trails, sweeping flurries, splashes, squash
 * and screen shake on impacts, seal and penguin reactions, floating score text and a gentle camera.
 * It only reads the game state and turns its events into short-lived effects; with reduced motion
 * the shake, the hit pause and the camera stay off and the particles thin out.
 */
import { HOUSE, STONE_R } from './config';
import { speedOf } from './physics';
import type { CurlEvent, CurlState } from './state';

export type ParticleKind = 'spray' | 'splash' | 'spark' | 'scrub' | 'star';

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	size: number;
	kind: ParticleKind;
}

export type PopupTone = 'good' | 'bad' | 'neutral' | 'big';

export interface Popup {
	x: number;
	y: number;
	text: string;
	tone: PopupTone;
	life: number;
	max: number;
}

export interface TrailPoint {
	x: number;
	y: number;
	age: number;
}

export interface Fx {
	reduced: boolean;
	particles: Particle[];
	trails: Record<number, TrailPoint[]>;
	popups: Popup[];
	/** Squash of a stone after an impact: strength 0 to 1 along the impact direction */
	squash: Record<number, { amount: number; nx: number; ny: number }>;
	/** Seconds left of the bump reaction of each seal */
	sealReact: number[];
	/** Seconds left of the penguin's hurt spin */
	penguinHurt: number;
	/** Seconds left of the squawk bubble */
	penguinAlarm: number;
	/** Seconds since the sign flipped to sold, or -1 */
	sold: number;
	shake: number;
	shakeX: number;
	shakeY: number;
	/** Seconds the game freezes after a hard impact */
	hitStop: number;
	flash: number;
	camera: { x: number; y: number; zoom: number };
	time: number;
}

const MAX_PARTICLES = 420;

export function createFx(reduced = false): Fx {
	return {
		reduced,
		particles: [],
		trails: {},
		popups: [],
		squash: {},
		sealReact: [],
		penguinHurt: 0,
		penguinAlarm: 0,
		sold: -1,
		shake: 0,
		shakeX: 0,
		shakeY: 0,
		hitStop: 0,
		flash: 0,
		camera: { x: 0, y: 0, zoom: 1 },
		time: 0
	};
}

export function resetFx(fx: Fx) {
	Object.assign(fx, createFx(fx.reduced));
}

function burst(
	fx: Fx,
	x: number,
	y: number,
	count: number,
	kind: ParticleKind,
	speed: number,
	life: number,
	size: number,
	direction?: { nx: number; ny: number; spread: number }
) {
	const amount = fx.reduced ? Math.ceil(count * 0.3) : count;
	for (let i = 0; i < amount && fx.particles.length < MAX_PARTICLES; i++) {
		const base = direction ? Math.atan2(direction.ny, direction.nx) : Math.random() * Math.PI * 2;
		const angle = direction ? base + (Math.random() - 0.5) * direction.spread : base;
		const velocity = speed * (0.3 + Math.random() * 0.9);
		fx.particles.push({
			x,
			y,
			vx: Math.cos(angle) * velocity,
			vy: Math.sin(angle) * velocity,
			life: life * (0.6 + Math.random() * 0.6),
			max: life,
			size: size * (0.6 + Math.random() * 0.8),
			kind
		});
	}
}

export function addPopup(fx: Fx, x: number, y: number, text: string, tone: PopupTone = 'neutral') {
	fx.popups.push({ x, y, text, tone, life: 1.3, max: 1.3 });
}

export function kick(fx: Fx, amount: number) {
	if (fx.reduced) return;
	fx.shake = Math.min(1, Math.max(fx.shake, amount));
}

/** Turns what happened in the game into effects (sounds and text are the store's job) */
export function absorbEvents(fx: Fx, state: CurlState, events: readonly CurlEvent[]) {
	for (const event of events) {
		switch (event.type) {
			case 'throw': {
				const stone = state.stones[state.stones.length - 1];
				if (stone) {
					burst(fx, stone.x, stone.y, 14, 'spray', 70, 0.5, 2.4, { nx: 0, ny: 1, spread: 1.6 });
				}
				kick(fx, 0.12 + event.power * 0.12);
				break;
			}
			case 'bump': {
				const strength = event.strength;
				burst(
					fx,
					event.x,
					event.y,
					Math.round(6 + strength * 16),
					'spark',
					60 + strength * 100,
					0.45,
					2.2
				);
				kick(fx, 0.15 + strength * 0.6);
				if (strength > 0.55 && !fx.reduced) fx.hitStop = 0.05 + strength * 0.04;
				if (event.kind === 'seal' && event.index !== undefined) {
					fx.sealReact[event.index] = 0.7;
				}
				if (event.kind === 'stone') {
					for (const stone of state.stones) {
						if (stone.status === 'sunk') continue;
						const dx = stone.x - event.x;
						const dy = stone.y - event.y;
						const distance = Math.hypot(dx, dy);
						if (distance <= STONE_R + 3 && distance > 0.01) {
							fx.squash[stone.id] = {
								amount: 0.25 + strength * 0.35,
								nx: dx / distance,
								ny: dy / distance
							};
						}
					}
				} else {
					// The stone itself squashes against a seal or the penguin
					let nearest: { id: number; dx: number; dy: number; d: number } | undefined;
					for (const stone of state.stones) {
						if (stone.status === 'sunk') continue;
						const dx = stone.x - event.x;
						const dy = stone.y - event.y;
						const d = Math.hypot(dx, dy);
						if (!nearest || d < nearest.d) nearest = { id: stone.id, dx, dy, d };
					}
					if (nearest && nearest.d > 0.01) {
						fx.squash[nearest.id] = {
							amount: 0.25 + strength * 0.3,
							nx: nearest.dx / nearest.d,
							ny: nearest.dy / nearest.d
						};
					}
				}
				break;
			}
			case 'penguin-hit':
				fx.penguinHurt = 1.1;
				fx.penguinAlarm = 1.4;
				burst(fx, event.x, event.y, 14, 'star', 80, 0.7, 3);
				kick(fx, 0.4);
				break;
			case 'sunk':
				burst(fx, event.x, event.y, 26, 'splash', 90, 0.8, 3);
				kick(fx, 0.3);
				fx.flash = 0;
				break;
			case 'end-done': {
				if (event.result.stars > 0) {
					for (let i = 0; i < event.result.stars; i++) {
						burst(fx, HOUSE.x, HOUSE.y, 18, 'star', 150, 1.2, 4);
					}
					fx.flash = 0.35;
				}
				if (event.result.sold) fx.sold = 0;
				break;
			}
			case 'end-start':
				fx.sold = -1;
				fx.trails = {};
				fx.squash = {};
				fx.sealReact = [];
				break;
			default:
				break;
		}
	}
}

/** Advances the effects by dt seconds, spawning spray, trails and sweeping flurries from the state */
export function stepFx(fx: Fx, state: CurlState, dt: number) {
	fx.time += dt;
	fx.penguinHurt = Math.max(0, fx.penguinHurt - dt);
	fx.penguinAlarm = Math.max(0, fx.penguinAlarm - dt);
	fx.flash = Math.max(0, fx.flash - dt * 1.6);
	fx.hitStop = Math.max(0, fx.hitStop - dt);
	if (fx.sold >= 0) fx.sold += dt;
	for (let i = 0; i < fx.sealReact.length; i++) {
		if (fx.sealReact[i] > 0) fx.sealReact[i] = Math.max(0, fx.sealReact[i] - dt);
	}

	// Shake decays and jitters
	fx.shake = Math.max(0, fx.shake - dt * 2.8);
	const jitter = fx.shake * fx.shake * 7;
	fx.shakeX = fx.reduced ? 0 : (Math.random() - 0.5) * 2 * jitter;
	fx.shakeY = fx.reduced ? 0 : (Math.random() - 0.5) * 2 * jitter;

	for (const id of Object.keys(fx.squash)) {
		const entry = fx.squash[Number(id)];
		entry.amount -= dt * 3.2;
		if (entry.amount <= 0) delete fx.squash[Number(id)];
	}

	const active = state.stones.find((stone) => stone.status === 'moving');
	for (const stone of state.stones) {
		if (stone.status !== 'moving') continue;
		const speed = speedOf(stone);
		const trail = (fx.trails[stone.id] ??= []);
		if (fx.time % 0.03 < dt) trail.push({ x: stone.x, y: stone.y, age: 0 });
		if (trail.length > 60) trail.shift();
		// Ice spray flung behind the stone
		const rate = Math.min(1, speed / 120);
		if (Math.random() < rate * (fx.reduced ? 0.25 : 0.8)) {
			burst(fx, stone.x, stone.y + STONE_R * 0.6, 1, 'spray', 28 + speed * 0.25, 0.45, 1.8, {
				nx: -stone.vx,
				ny: -stone.vy,
				spread: 1.4
			});
		}
	}
	for (const id of Object.keys(fx.trails)) {
		const trail = fx.trails[Number(id)];
		for (const point of trail) point.age += dt;
		while (trail.length > 0 && trail[0].age > 1.4) trail.shift();
	}

	// Sweeping flurries: snow thrown sideways just in front of the stone
	if (active && state.sweeping && state.sweepEnergy > 0) {
		const amount = fx.reduced ? 1 : 3;
		for (let i = 0; i < amount; i++) {
			const side = Math.random() < 0.5 ? -1 : 1;
			burst(
				fx,
				active.x + side * (STONE_R + 3),
				active.y - STONE_R - 6 + Math.random() * 6,
				1,
				'scrub',
				48,
				0.4,
				2.2,
				{
					nx: side,
					ny: -0.4,
					spread: 1
				}
			);
		}
	}

	for (const particle of fx.particles) {
		particle.life -= dt;
		particle.x += particle.vx * dt;
		particle.y += particle.vy * dt;
		const drag = particle.kind === 'splash' || particle.kind === 'star' ? 0.96 : 0.9;
		particle.vx *= Math.pow(drag, dt * 60);
		particle.vy *= Math.pow(drag, dt * 60);
		if (particle.kind === 'splash') particle.vy += 160 * dt;
		if (particle.kind === 'star') particle.vy += 40 * dt;
	}
	fx.particles = fx.particles.filter((particle) => particle.life > 0);

	for (const popup of fx.popups) {
		popup.life -= dt;
		popup.y -= 26 * dt;
	}
	fx.popups = fx.popups.filter((popup) => popup.life > 0);

	// The camera drifts towards the moving stone and leans in near the house
	const target = { x: 0, y: 0, zoom: 1 };
	if (!fx.reduced && active) {
		target.x = (320 - active.x) * 0.04;
		target.y = Math.max(0, (330 - active.y) / 330) * 14;
		const nearHouse = Math.max(0, 1 - Math.abs(active.y - HOUSE.y) / 160);
		target.zoom = 1 + nearHouse * 0.05;
	}
	const follow = Math.min(1, dt * 3);
	fx.camera.x += (target.x - fx.camera.x) * follow;
	fx.camera.y += (target.y - fx.camera.y) * follow;
	fx.camera.zoom += (target.zoom - fx.camera.zoom) * follow;
}

/** Seal bump reaction scale for drawing: a quick wobble */
export const sealWobble = (fx: Fx, index: number) =>
	Math.sin((fx.sealReact[index] ?? 0) * 28) * (fx.sealReact[index] ?? 0) * 0.5;

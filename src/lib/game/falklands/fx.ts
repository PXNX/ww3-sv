/*
 * Small animation helpers for the Falklands sea: a damped spring for momentum and buoyancy, easing
 * curves, a capped particle pool (sparks, smoke, spray, foam, confetti) and floating popups. Pure
 * and canvas-light so the maths is testable.
 */

/** One semi-implicit Euler step of a damped spring pulling `pos` towards `target` */
export function springStep(
	pos: number,
	vel: number,
	target: number,
	stiffness: number,
	damping: number,
	dt: number
): [number, number] {
	const nextVel = vel + (stiffness * (target - pos) - damping * vel) * dt;
	return [pos + nextVel * dt, nextVel];
}

/** Damping for a critical (no overshoot) spring, used when motion is reduced */
export function criticalDamping(stiffness: number): number {
	return 2 * Math.sqrt(stiffness);
}

export function easeOutBack(t: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	const u = Math.min(1, Math.max(0, t)) - 1;
	return 1 + c3 * u * u * u + c1 * u * u;
}

export function easeOutCubic(t: number): number {
	const u = 1 - Math.min(1, Math.max(0, t));
	return 1 - u * u * u;
}

/** Frame-rate independent exponential approach of `value` to `target` */
export function approach(value: number, target: number, rate: number, dt: number): number {
	return value + (target - value) * (1 - Math.exp(-rate * dt));
}

export type ParticleKind = 'dot' | 'smoke' | 'spray' | 'foam' | 'confetti' | 'ring';

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	size: number;
	/** Size gained per second (smoke and rings grow) */
	grow: number;
	color: string;
	/** Exponential drag per second */
	drag: number;
	gravity: number;
	kind: ParticleKind;
	spin: number;
	angle: number;
}

export type ParticleInit = Partial<Particle> & { x: number; y: number; color: string };

export class Particles {
	list: Particle[] = [];
	readonly cap: number;

	constructor(cap = 360) {
		this.cap = cap;
	}

	spawn(init: ParticleInit) {
		if (this.list.length >= this.cap) this.list.shift();
		this.list.push({
			vx: 0,
			vy: 0,
			life: 0.6,
			max: init.life ?? 0.6,
			size: 2,
			grow: 0,
			drag: 0,
			gravity: 0,
			kind: 'dot',
			spin: 0,
			angle: 0,
			...init
		});
	}

	update(dt: number) {
		for (const p of this.list) {
			p.life -= dt;
			p.vy += p.gravity * dt;
			const damp = Math.exp(-p.drag * dt);
			p.vx *= damp;
			p.vy *= damp;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.size = Math.max(0, p.size + p.grow * dt);
			p.angle += p.spin * dt;
		}
		this.list = this.list.filter((p) => p.life > 0);
	}

	draw(ctx: CanvasRenderingContext2D) {
		for (const p of this.list) {
			const alpha = Math.max(0, Math.min(1, p.life / p.max));
			ctx.globalAlpha = p.kind === 'smoke' ? alpha * 0.55 : alpha;
			if (p.kind === 'ring') {
				ctx.strokeStyle = p.color;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, p.size, p.size * 0.35, 0, 0, Math.PI * 2);
				ctx.stroke();
			} else if (p.kind === 'confetti') {
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.angle);
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
				ctx.restore();
			} else {
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
	}
}

export interface Popup {
	x: number;
	y: number;
	text: string;
	color: string;
	age: number;
	life: number;
	size: number;
}

/** Floating text that pops in with a little overshoot, drifts up and fades out */
export class Popups {
	list: Popup[] = [];

	add(x: number, y: number, text: string, color: string, size = 14) {
		// Nudge a popup up if another is on top of it, so two readouts never overprint
		let top = y;
		for (const other of this.list) {
			if (Math.abs(other.x - x) < 50 && Math.abs(other.y - top) < size) top = other.y - size - 2;
		}
		this.list.push({ x, y: top, text, color, age: 0, life: 1.5, size });
	}

	update(dt: number) {
		for (const p of this.list) {
			p.age += dt;
			p.y -= 18 * (1 - p.age / p.life) * dt;
		}
		this.list = this.list.filter((p) => p.age < p.life);
	}

	draw(ctx: CanvasRenderingContext2D, reduced: boolean) {
		ctx.textAlign = 'center';
		ctx.lineJoin = 'round';
		for (const p of this.list) {
			const pop = reduced ? 1 : 0.6 + 0.4 * easeOutBack(p.age / 0.22);
			const fade = p.age > p.life - 0.4 ? Math.max(0, (p.life - p.age) / 0.4) : 1;
			ctx.save();
			ctx.globalAlpha = fade;
			ctx.translate(p.x, p.y);
			ctx.scale(pop, pop);
			ctx.font = `800 ${p.size}px system-ui, sans-serif`;
			ctx.lineWidth = 4;
			ctx.strokeStyle = '#111111';
			ctx.strokeText(p.text, 0, 0);
			ctx.fillStyle = p.color;
			ctx.fillText(p.text, 0, 0);
			ctx.restore();
		}
	}
}

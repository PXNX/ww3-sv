/*
 * The effects of the Black Sea Fleet Hunt: shell arcs, splashes, water ripples, explosions with
 * fire and smoke, sonar rings, sinking ships and the screen shake. Everything lives in a small
 * particle world measured in grid cells (x from 0 to 10 across, y from 0 to 10 down), so it does
 * not care how large the canvas is; the canvas component only steps the world and draws it.
 * Time runs in seconds. The random source is passed in so the effects can be tested.
 */
import type { Random } from '../random';
import { COLUMNS, ROWS, columnOf, rowOf, type Weapon } from './fleet';

export type ParticleKind = 'drop' | 'fire' | 'smoke' | 'bubble' | 'spark' | 'debris' | 'trail';

export interface Particle {
	kind: ParticleKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Seconds left */
	life: number;
	/** Seconds in total, for fading */
	max: number;
	/** Radius in cells */
	size: number;
	/** Cells per second squared, positive pulls down */
	gravity: number;
	/** Share of the speed lost per second */
	drag: number;
}

export type RingKind = 'ripple' | 'sonar' | 'shock';

/** An expanding ring on the water */
export interface Ring {
	kind: RingKind;
	x: number;
	y: number;
	radius: number;
	maxRadius: number;
	life: number;
	max: number;
}

/** A shell, missile or drone on its way to a cell */
export interface Shell {
	kind: 'shell' | 'drone' | 'charge';
	from: { x: number; y: number };
	to: { x: number; y: number };
	/** Seconds before it leaves */
	wait: number;
	/** Seconds in the air */
	flight: number;
	elapsed: number;
	arc: number;
	onLand: () => void;
}

/** A sunk ship going down: it tips over, sinks and fades while it blows bubbles */
export interface Sinker {
	x: number;
	y: number;
	/** Size in cells, along the grid axes */
	width: number;
	height: number;
	angle: number;
	spin: number;
	vy: number;
	life: number;
	max: number;
}

interface Timer {
	at: number;
	run: () => void;
}

export function cellCentre(cell: number): { x: number; y: number } {
	return { x: columnOf(cell) + 0.5, y: rowOf(cell) + 0.5 };
}

/** Milliseconds a strike with this weapon takes to land, counted from the tap */
export const FLIGHT_MS: Record<Weapon, number> = {
	neptune: 460,
	usv: 640,
	salvo: 380,
	depth: 520,
	sonar: 120
};

/** Milliseconds between the cells of a salvo, or the cross of a depth charge */
export const VOLLEY_GAP_MS: Record<Weapon, number> = {
	neptune: 0,
	usv: 0,
	salvo: 130,
	depth: 70,
	sonar: 0
};

/** When the cell `index` of a volley lands, in milliseconds after the tap */
export function impactAt(weapon: Weapon, index: number): number {
	return FLIGHT_MS[weapon] + index * VOLLEY_GAP_MS[weapon];
}

/** Longest a ship takes to sink, in seconds */
export const SINK_SECONDS = 2.4;

export class FxWorld {
	particles: Particle[] = [];
	rings: Ring[] = [];
	shells: Shell[] = [];
	sinkers: Sinker[] = [];
	/** Screen shake strength in cells; decays by itself */
	shake = 0;
	time = 0;
	#timers: Timer[] = [];
	#random: Random;

	constructor(random: Random) {
		this.#random = random;
	}

	/** True while anything is still moving */
	get busy(): boolean {
		return (
			this.particles.length + this.rings.length + this.shells.length + this.sinkers.length > 0 ||
			this.#timers.length > 0 ||
			this.shake > 0.001
		);
	}

	clear() {
		this.particles = [];
		this.rings = [];
		this.shells = [];
		this.sinkers = [];
		this.#timers = [];
		this.shake = 0;
	}

	/** Runs `run` after `seconds` of world time */
	after(seconds: number, run: () => void) {
		this.#timers.push({ at: this.time + seconds, run });
	}

	#rand(min: number, max: number): number {
		return min + this.#random() * (max - min);
	}

	#particle(partial: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>): Particle {
		const life = partial.life ?? 1;
		const particle: Particle = {
			vx: 0,
			vy: 0,
			life,
			max: life,
			size: 0.1,
			gravity: 0,
			drag: 0,
			...partial
		};
		this.particles.push(particle);
		return particle;
	}

	/** A missile, drone or depth charge flying towards a cell; `onLand` runs on arrival */
	launch(kind: Shell['kind'], toCell: number, wait: number, flight: number, onLand: () => void) {
		const to = cellCentre(toCell);
		const from =
			kind === 'shell'
				? { x: COLUMNS / 2, y: ROWS + 1.5 }
				: kind === 'drone'
					? { x: to.x + (this.#random() - 0.5) * 3, y: ROWS + 1 }
					: { x: to.x, y: to.y - 1.8 };
		const distance = Math.hypot(to.x - from.x, to.y - from.y);
		const arc = kind === 'shell' ? Math.min(5, 1.5 + distance * 0.35) : kind === 'drone' ? 0.4 : 0;
		this.shells.push({ kind, from, to, wait, flight, elapsed: 0, arc, onLand });
	}

	/** Where a shell is, from 0 (just left) to 1 (landed) */
	static shellPosition(shell: Shell, progress: number): { x: number; y: number } {
		const t = Math.min(Math.max(progress, 0), 1);
		const x = shell.from.x + (shell.to.x - shell.from.x) * t;
		const y = shell.from.y + (shell.to.y - shell.from.y) * t - shell.arc * 4 * t * (1 - t);
		return { x, y };
	}

	/** Water thrown up by a miss: droplets that fall back and two ripples */
	splash(cell: number, size = 1) {
		const { x, y } = cellCentre(cell);
		const count = Math.round(10 * size);
		for (let n = 0; n < count; n++) {
			const angle = -Math.PI / 2 + this.#rand(-0.9, 0.9);
			const speed = this.#rand(1.6, 3.6) * size;
			this.#particle({
				kind: 'drop',
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: this.#rand(0.45, 0.8),
				size: this.#rand(0.04, 0.09),
				gravity: 9
			});
		}
		this.ripple(cell, 0.9 * size);
		this.after(0.18, () => this.ripple(cell, 0.6 * size));
		this.shake = Math.max(this.shake, 0.01);
	}

	/** A ring spreading over the water */
	ripple(cell: number, maxRadius = 0.9, kind: RingKind = 'ripple') {
		const { x, y } = cellCentre(cell);
		const life = kind === 'sonar' ? 1.1 : 0.9;
		this.rings.push({ kind, x, y, radius: 0.05, maxRadius, life, max: life });
	}

	/** A sonar ping: rings that spread out over the whole square the ping listens to */
	ping(cell: number, radius: number) {
		for (let n = 0; n < 3; n++) {
			this.after(n * 0.22, () => this.ripple(cell, radius + 0.6, 'sonar'));
		}
	}

	/** A hit: flash, sparks, fire and rising smoke, and a shake that grows with `power` (0 to 1) */
	explosion(cell: number, power = 0.5) {
		const { x, y } = cellCentre(cell);
		this.rings.push({
			kind: 'shock',
			x,
			y,
			radius: 0.1,
			maxRadius: 0.8 + power * 1.2,
			life: 0.4,
			max: 0.4
		});
		const fire = Math.round(10 + power * 16);
		for (let n = 0; n < fire; n++) {
			const angle = this.#rand(0, Math.PI * 2);
			const speed = this.#rand(0.4, 2.2 + power * 2);
			this.#particle({
				kind: 'fire',
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 0.8,
				life: this.#rand(0.35, 0.8),
				size: this.#rand(0.1, 0.2 + power * 0.1),
				gravity: -1.2,
				drag: 2.5
			});
		}
		for (let n = 0; n < 6 + power * 8; n++) {
			const angle = this.#rand(0, Math.PI * 2);
			const speed = this.#rand(2, 4.5 + power * 3);
			this.#particle({
				kind: 'spark',
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 1,
				life: this.#rand(0.3, 0.7),
				size: 0.035,
				gravity: 7
			});
		}
		for (let n = 0; n < 4 + power * 5; n++) this.smoke(x, y, this.#rand(0.9, 1.7));
		this.shake = Math.max(this.shake, 0.05 + power * 0.22);
	}

	/** One puff of smoke that drifts up and spreads */
	smoke(x: number, y: number, life = 1.2) {
		this.#particle({
			kind: 'smoke',
			x: x + this.#rand(-0.12, 0.12),
			y: y + this.#rand(-0.1, 0.1),
			vx: this.#rand(-0.25, 0.4),
			vy: this.#rand(-0.9, -0.4),
			life,
			size: this.#rand(0.12, 0.22),
			gravity: -0.1,
			drag: 0.6
		});
	}

	/** What a cell that is still burning gives off during `dt` seconds: flames and now and then smoke */
	burn(cell: number, dt: number) {
		const { x, y } = cellCentre(cell);
		if (this.#random() < dt * 14) {
			this.#particle({
				kind: 'fire',
				x: x + this.#rand(-0.18, 0.18),
				y: y + this.#rand(-0.05, 0.15),
				vx: this.#rand(-0.1, 0.1),
				vy: this.#rand(-0.9, -0.4),
				life: this.#rand(0.3, 0.55),
				size: this.#rand(0.07, 0.13),
				gravity: -0.6
			});
		}
		if (this.#random() < dt * 3) this.smoke(x, y - 0.1, this.#rand(1, 1.6));
	}

	/** A ship that was just sunk, tipping over and going down in a cloud of bubbles */
	sink(cells: readonly number[]) {
		const first = cellCentre(cells[0]);
		const last = cellCentre(cells[cells.length - 1]);
		const vertical = cells.length > 1 && columnOf(cells[0]) === columnOf(cells[1]);
		const x = (first.x + last.x) / 2;
		const y = (first.y + last.y) / 2;
		const side = this.#random() < 0.5 ? -1 : 1;
		this.sinkers.push({
			x,
			y,
			width: vertical ? 0.7 : cells.length - 0.2,
			height: vertical ? cells.length - 0.2 : 0.7,
			angle: 0,
			spin: side * this.#rand(0.35, 0.7),
			vy: 0,
			life: SINK_SECONDS,
			max: SINK_SECONDS
		});
		for (const cell of cells) {
			this.explosion(cell, 0.85);
			const centre = cellCentre(cell);
			for (let n = 0; n < 5; n++) {
				this.#particle({
					kind: 'debris',
					x: centre.x,
					y: centre.y,
					vx: this.#rand(-2, 2),
					vy: this.#rand(-3.5, -1),
					life: this.#rand(0.6, 1.1),
					size: this.#rand(0.04, 0.08),
					gravity: 9
				});
			}
		}
		this.shake = Math.max(this.shake, 0.4);
	}

	/** Bubbles rising from a sinking ship */
	#bubbles(sinker: Sinker, dt: number) {
		if (this.#random() > dt * 36) return;
		this.#particle({
			kind: 'bubble',
			x: sinker.x + (this.#random() - 0.5) * sinker.width,
			y: sinker.y + (this.#random() - 0.5) * sinker.height,
			vx: this.#rand(-0.15, 0.15),
			vy: this.#rand(-1.1, -0.5),
			life: this.#rand(0.6, 1.3),
			size: this.#rand(0.03, 0.08),
			gravity: -0.3
		});
	}

	/** Moves the world on by `dt` seconds (call with at most a few frames' worth) */
	step(dt: number) {
		this.time += dt;

		const due = this.#timers.filter((timer) => timer.at <= this.time);
		this.#timers = this.#timers.filter((timer) => timer.at > this.time);
		for (const timer of due) timer.run();

		for (const shell of this.shells) {
			if (shell.wait > 0) {
				shell.wait -= dt;
				continue;
			}
			shell.elapsed += dt;
			if (shell.kind !== 'charge' && this.#random() < dt * 60) {
				const { x, y } = FxWorld.shellPosition(shell, shell.elapsed / shell.flight);
				this.#particle({ kind: 'trail', x, y, life: 0.35, size: 0.06, vy: 0.1 });
			}
			if (shell.elapsed >= shell.flight) shell.onLand();
		}
		this.shells = this.shells.filter((shell) => shell.elapsed < shell.flight);

		for (const particle of this.particles) {
			particle.life -= dt;
			particle.vy += particle.gravity * dt;
			const keep = Math.max(0, 1 - particle.drag * dt);
			particle.vx *= keep;
			particle.vy *= keep;
			particle.x += particle.vx * dt;
			particle.y += particle.vy * dt;
			if (particle.kind === 'smoke') particle.size += dt * 0.12;
		}
		this.particles = this.particles.filter((particle) => particle.life > 0);

		for (const ring of this.rings) {
			ring.life -= dt;
			ring.radius = ring.maxRadius * (1 - ring.life / ring.max) ** 0.6;
		}
		this.rings = this.rings.filter((ring) => ring.life > 0);

		for (const sinker of this.sinkers) {
			sinker.life -= dt;
			// Heavier on one side, so it rolls over faster and faster; gravity pulls it under
			sinker.angle += sinker.spin * dt * (1 + (1 - sinker.life / sinker.max) * 2);
			sinker.vy += 0.9 * dt;
			sinker.y += sinker.vy * dt;
			this.#bubbles(sinker, dt);
		}
		this.sinkers = this.sinkers.filter((sinker) => sinker.life > 0);

		this.shake *= Math.max(0, 1 - 5 * dt);
		if (this.shake < 0.001) this.shake = 0;
	}

	/** A calm patch of sea now and then gets a lazy ripple, so the water is never dead still */
	ambient(dt: number) {
		if (this.#random() < dt * 0.7) {
			const x = this.#random() * COLUMNS;
			const y = this.#random() * ROWS;
			this.rings.push({
				kind: 'ripple',
				x,
				y,
				radius: 0.05,
				maxRadius: this.#rand(0.5, 0.9),
				life: 1.6,
				max: 1.6
			});
		}
	}

	/** The shake as an offset in cells, different every frame */
	shakeOffset(): { x: number; y: number } {
		return {
			x: (this.#random() - 0.5) * 2 * this.shake,
			y: (this.#random() - 0.5) * 2 * this.shake
		};
	}
}

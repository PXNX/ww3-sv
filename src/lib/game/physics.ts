/*
 * Small shared rigid-body wrapper around planck for modes that want real physics without copying
 * Fury's world. It advances with a fixed timestep (same result on 30/60/120 Hz screens), lets bodies
 * sleep, clamps catch-up work after a background tab, exposes a deterministic random source for
 * spawn jitter, and can draw an outline debug view over a canvas.
 */

import {
	Box,
	Circle,
	Edge,
	World,
	type Body,
	type BodyDef,
	type CircleShape,
	type FixtureDef,
	type PolygonShape,
	type Shape
} from 'planck';
import { rng } from './juice.js';

export interface PhysicsBody {
	id: number;
	body: Body;
}

export interface PhysicsOptions {
	gravity?: { x: number; y: number };
	/** Fixed step in seconds; 1/60 by default */
	stepSeconds?: number;
	/** Never run more than this many steps in one call (prevents a catch-up spiral) */
	maxSteps?: number;
	/** Seed for the deterministic random helper */
	seed?: number;
}

export interface BodyOptions {
	restitution?: number;
	friction?: number;
	density?: number;
	dynamic?: boolean;
	angle?: number;
	linearDamping?: number;
	angularDamping?: number;
}

export interface PhysicsWorld {
	readonly world: World;
	readonly bodies: readonly PhysicsBody[];
	/** Deterministic 0..1 values, handy for spawn offsets and debris scatter */
	random(): number;
	addBox(x: number, y: number, width: number, height: number, options?: BodyOptions): PhysicsBody;
	addCircle(x: number, y: number, radius: number, options?: BodyOptions): PhysicsBody;
	addGround(y: number, width?: number): PhysicsBody;
	remove(body: PhysicsBody): void;
	setVelocity(body: PhysicsBody, x: number, y: number): void;
	applyImpulse(body: PhysicsBody, x: number, y: number): void;
	/** Advances by elapsed milliseconds; returns the number of fixed steps taken */
	step(elapsedMs: number): number;
	/** Draws body outlines in screen space for debugging */
	drawDebug(ctx: CanvasRenderingContext2D, scale?: number): void;
	destroy(): void;
}

const VELOCITY_ITERATIONS = 8;
const POSITION_ITERATIONS = 3;

export function createPhysicsWorld({
	gravity = { x: 0, y: -10 },
	stepSeconds = 1 / 60,
	maxSteps = 5,
	seed = 1
}: PhysicsOptions = {}): PhysicsWorld {
	const world = new World({ gravity, allowSleep: true });
	const random = rng(seed);
	const entries = new Map<number, PhysicsBody>();
	const bodies: PhysicsBody[] = [];
	let nextId = 0;
	let accumulator = 0;

	function add(shape: Shape, x: number, y: number, options: BodyOptions = {}) {
		const definition: BodyDef = {
			type: options.dynamic === false ? 'static' : 'dynamic',
			position: { x, y },
			angle: options.angle ?? 0,
			linearDamping: options.linearDamping ?? 0.01,
			angularDamping: options.angularDamping ?? 0.01,
			allowSleep: true
		};
		const body = world.createBody(definition);
		const fixture: FixtureDef = {
			shape,
			density: options.density ?? 1,
			friction: options.friction ?? 0.5,
			restitution: options.restitution ?? 0.15
		};
		body.createFixture(fixture);
		const entry: PhysicsBody = { id: ++nextId, body };
		entries.set(entry.id, entry);
		bodies.push(entry);
		return entry;
	}

	return {
		world,
		bodies,
		random,
		addBox: (x, y, width, height, options) =>
			add(Box(width / 2, height / 2), x, y, options),
		addCircle: (x, y, radius, options) => add(Circle(radius), x, y, options),
		addGround: (y, width = 200) =>
			add(Edge({ x: -width, y }, { x: width, y }), 0, 0, {
				dynamic: false,
				friction: 0.7
			}),
		remove(entry) {
			world.destroyBody(entry.body);
			entries.delete(entry.id);
			const index = bodies.indexOf(entry);
			if (index >= 0) bodies.splice(index, 1);
		},
		setVelocity(entry, x, y) {
			entry.body.setLinearVelocity({ x, y });
			entry.body.setAwake(true);
		},
		applyImpulse(entry, x, y) {
			entry.body.applyLinearImpulse({ x, y }, entry.body.getWorldCenter(), true);
		},
		step(elapsedMs) {
			accumulator += Math.min(elapsedMs / 1000, stepSeconds * maxSteps);
			let steps = 0;
			while (accumulator >= stepSeconds && steps < maxSteps) {
				world.step(stepSeconds, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
				accumulator -= stepSeconds;
				steps++;
			}
			return steps;
		},
		drawDebug(ctx, scale = 1) {
			ctx.save();
			ctx.lineWidth = 1 / scale;
			ctx.strokeStyle = '#e5484d';
			for (const entry of bodies) {
				const fixture = entry.body.getFixtureList();
				const position = entry.body.getPosition();
				ctx.save();
				ctx.translate(position.x, position.y);
				ctx.rotate(entry.body.getAngle());
				ctx.beginPath();
				const shape = fixture?.getShape();
				if (shape?.getType() === 'circle') {
					ctx.arc(0, 0, (shape as CircleShape).getRadius(), 0, Math.PI * 2);
				} else if (shape?.getType() === 'polygon') {
					const vertices = (shape as PolygonShape).getVertices();
					for (let i = 0; i < vertices.length; i++) {
						const vertex = vertices[i];
						if (i === 0) ctx.moveTo(vertex.x, vertex.y);
						else ctx.lineTo(vertex.x, vertex.y);
					}
					ctx.closePath();
				}
				ctx.stroke();
				ctx.restore();
			}
			ctx.restore();
		},
		destroy() {
			for (const entry of [...bodies]) this.remove(entry);
			entries.clear();
		}
	};
}

/*
 * The physics world of Magyar's Birds, built on Planck.js (a Box2D port) and advanced with a fixed
 * timestep so every shot plays out the same way. Blocks are wood, stone or ice with different
 * strengths; impacts above a material's threshold wear the block down until it breaks. Golden
 * domes are the targets: they break from impacts or when they topple onto the ground. Landmarks
 * (oil tanks, a refinery, a factory, an S-400-style unit) are bigger sprite-drawn targets that break
 * the same way. Destruction is purely cartoonish: dust puffs, flying splinters and golden sparkles.
 */
import { Box, Chain, Circle, Edge, Polygon, World, type Body, type Contact } from 'planck';
import type { Random } from '#lib/game/random.js';
import {
	BIRDS,
	BLAST_DAMAGE,
	BLAST_IMPULSE,
	BLAST_RADIUS,
	EGG_DAMAGE_MULTIPLIER,
	EGG_DENSITY,
	EGG_RADIUS,
	SPLIT_RADIUS,
	blastFalloff,
	boomerangVelocity,
	dashVelocity,
	diveVelocity,
	eggVelocity,
	splitOffsets,
	splitVelocities
} from './birds';
import type { BirdKind } from './birds';
import { GRAVITY, POUCH, STEP_SECONDS, type Vec } from './launch';
import {
	DOME_HEIGHT_RATIO,
	LANDMARKS,
	MAX_LEVEL_PIECES,
	type BlockShape,
	type LandmarkKind,
	type LevelData,
	type Material
} from './levels/schema';
import { BLOCK_POINTS, DOME_POINTS } from './rules';
import { groundMax, terrainPoints } from './terrain';

export interface MaterialSpec {
	density: number;
	friction: number;
	restitution: number;
	/** Impulses (newton seconds) at or below this cause no damage, so resting weight never counts */
	threshold: number;
	/** Damage a fresh block can take before it breaks */
	hp: number;
}

export const MATERIALS: Record<Material, MaterialSpec> = {
	wood: { density: 1, friction: 0.7, restitution: 0.05, threshold: 2.6, hp: 7 },
	stone: { density: 2.4, friction: 0.8, restitution: 0.02, threshold: 6, hp: 16 },
	ice: { density: 0.9, friction: 0.1, restitution: 0.05, threshold: 1.6, hp: 3 }
};

export const DOME_MATERIAL: MaterialSpec = {
	density: 0.8,
	friction: 0.6,
	restitution: 0.05,
	threshold: 2.4,
	hp: 6
};

/** Velocity and position iterations of the constraint solver */
const VELOCITY_ITERATIONS = 8;
const POSITION_ITERATIONS = 3;
/** Damage is ignored for this many steps after loading, while the stacks settle */
export const GRACE_STEPS = 30;
/** A bird counts as finished after moving slower than REST_SPEED for this many steps */
const BIRD_REST_SPEED = 0.4;
const BIRD_REST_STEPS = 40;
/** A bird's flight ends after this many steps no matter what (12 seconds) */
export const BIRD_MAX_STEPS = 720;
/** Bodies slower than these count as resting */
const REST_LINEAR_SPEED = 0.15;
const REST_ANGULAR_SPEED = 0.3;
/** Pieces further than this outside the field are removed (and count as destroyed) */
const OUT_OF_BOUNDS_MARGIN = 3;
/** Cap on visual effects alive at once, to protect the frame rate */
export const MAX_EFFECTS = 140;
/** Most birds on the field at once (a split flamingo becomes three) */
export const MAX_BIRDS = 3;
/** Hard cap on physics bodies: every level piece, the active birds and the ground */
export const MAX_BODIES = MAX_LEVEL_PIECES + MAX_BIRDS + 1;
/** How long the wobble-then-burst animation of a destroyed dome lasts, in steps */
export const DOME_POP_STEPS = 42;

/** Damage one impact deals: only the part of the impulse above the threshold counts */
export function impactDamage(impulse: number, threshold: number, multiplier = 1): number {
	if (!Number.isFinite(impulse) || impulse <= 0) return 0;
	return Math.max(0, impulse * multiplier - threshold);
}

/** Convex outline of an onion dome's body, from its base (origin) upwards, for a given width */
export function domeVertices(size: number): Vec[] {
	const outline: [number, number][] = [
		[-0.34, 0],
		[0.34, 0],
		[0.5, 0.36],
		[0.44, 0.62],
		[0.2, 0.9],
		[0, DOME_HEIGHT_RATIO],
		[-0.2, 0.9],
		[-0.44, 0.62],
		[-0.5, 0.36]
	];
	return outline.map(([x, y]) => ({ x: x * size, y: y * size }));
}

interface PieceCommon {
	id: number;
	body: Body;
	alive: boolean;
}

export interface BlockPiece extends PieceCommon {
	kind: 'block';
	material: Material;
	shape: BlockShape;
	w: number;
	h: number;
	hp: number;
	maxHp: number;
}

export interface DomePiece extends PieceCommon {
	kind: 'dome';
	size: number;
	/** Height of the base above the ground below it when loaded; a dome that started off the ground breaks when it lands */
	startY: number;
	hp: number;
	maxHp: number;
	/** Wobble amplitude from 0 to 1, raised by knocks and decaying over time */
	wobble: number;
	toppled: boolean;
}

export interface BirdPiece extends PieceCommon {
	kind: 'bird';
	bird: BirdKind;
	radius: number;
	small: boolean;
	/** A goose's egg: a small, heavy projectile dropped by the bird */
	egg: boolean;
	hasHit: boolean;
	abilityUsed: boolean;
	age: number;
	slowSteps: number;
	done: boolean;
}

export interface LandmarkPiece extends PieceCommon {
	kind: 'landmark';
	landmark: LandmarkKind;
	w: number;
	h: number;
	hp: number;
	maxHp: number;
}

export type Piece = BlockPiece | DomePiece | BirdPiece | LandmarkPiece;

export type EffectTone = Material | 'gold' | 'dust' | 'feather' | 'explosion';

export type Effect =
	| {
			kind: 'puff';
			x: number;
			y: number;
			vx: number;
			vy: number;
			radius: number;
			tone: EffectTone;
			age: number;
			life: number;
	  }
	| {
			kind: 'shard';
			x: number;
			y: number;
			vx: number;
			vy: number;
			angle: number;
			spin: number;
			w: number;
			h: number;
			tone: EffectTone;
			age: number;
			life: number;
			delay: number;
	  }
	| { kind: 'dome'; x: number; y: number; size: number; angle: number; age: number; life: number }
	| { kind: 'points'; x: number; y: number; value: number; age: number; life: number };

export type WorldEvent =
	| { type: 'block-destroyed'; material: Material; points: number }
	| { type: 'landmark-destroyed'; landmark: LandmarkKind; points: number }
	| { type: 'dome-destroyed'; remaining: number }
	| { type: 'impact'; strength: number; surface: ImpactSurface }
	| { type: 'ability'; bird: BirdKind };

/** What a bird struck hardest in a step, so the impact can sound like it */
export type ImpactSurface = Material | 'dome' | 'ground' | 'bird';

const GROUND = 'ground';

/** The surface a bird hit; landmarks are heavy masonry, so they sound like stone */
function surfaceOf(piece: Piece | typeof GROUND | null): ImpactSurface {
	if (!piece || piece === GROUND) return 'ground';
	switch (piece.kind) {
		case 'block':
			return piece.material;
		case 'dome':
			return 'dome';
		case 'landmark':
			return 'stone';
		case 'bird':
			return 'bird';
	}
}

export class FuryWorld {
	readonly level: LevelData;
	readonly physics: World;
	readonly pieces: Piece[] = [];
	readonly effects: Effect[] = [];
	readonly blocksTotal: number;
	readonly domesTotal: number;
	blocksDestroyed = 0;
	domesDestroyed = 0;
	/** Points for destroyed blocks and domes (the unused-bird bonus is added by the match) */
	destructionPoints = 0;
	steps = 0;

	#random: Random;
	#nextId = 1;
	#events: WorldEvent[] = [];
	#damage = new Map<BlockPiece | DomePiece | LandmarkPiece, number>();
	#strongestImpact = 0;
	#strongestSurface: ImpactSurface = 'ground';
	/** Birds launched this turn (a split flamingo adds its two siblings) */
	#turnBirds: BirdPiece[] = [];

	constructor(level: LevelData, random: Random) {
		this.level = level;
		this.#random = random;
		this.physics = new World({ gravity: { x: 0, y: GRAVITY } });

		const ground = this.physics.createBody({ type: 'static', userData: GROUND });
		if (level.hills && level.hills.length > 0) {
			ground.createFixture({
				shape: new Chain(terrainPoints(level.hills, -40, level.width + 40), false),
				friction: 0.9
			});
		} else {
			ground.createFixture({
				shape: new Edge({ x: -40, y: 0 }, { x: level.width + 40, y: 0 }),
				friction: 0.9
			});
		}

		for (const block of level.blocks) this.#addBlock(block);
		for (const dome of level.domes) this.#addDome(dome.x, dome.y, dome.size);
		for (const landmark of level.landmarks ?? []) {
			this.#addLandmark(landmark.kind, landmark.x, landmark.y);
		}
		this.blocksTotal = level.blocks.length + (level.landmarks?.length ?? 0);
		this.domesTotal = level.domes.length;

		this.physics.on('post-solve', (contact, impulse) => {
			const pointCount = contact.getManifold().pointCount;
			let total = 0;
			for (let i = 0; i < pointCount; i++) total += impulse.normalImpulses[i] ?? 0;
			this.#onImpact(contact, total);
		});
	}

	get domesRemaining(): number {
		return this.domesTotal - this.domesDestroyed;
	}

	get bodyCount(): number {
		return this.physics.getBodyCount();
	}

	/** Advances the simulation by one fixed step and applies damage, removals and effects */
	step(): void {
		this.#damage.clear();
		this.#strongestImpact = 0;
		this.physics.step(STEP_SECONDS, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
		this.steps++;

		if (this.#strongestImpact > 4) {
			this.#events.push({
				type: 'impact',
				strength: this.#strongestImpact,
				surface: this.#strongestSurface
			});
		}

		let removed = false;
		if (this.steps > GRACE_STEPS) {
			for (const [piece, damage] of this.#damage) {
				if (!piece.alive) continue;
				piece.hp -= damage;
				if (piece.kind === 'dome') piece.wobble = Math.min(1, piece.wobble + 0.3 + damage / 4);
				if (piece.hp <= 0) removed = this.#destroy(piece) || removed;
			}
		}

		for (const piece of this.pieces) {
			if (!piece.alive) continue;
			if (piece.kind === 'dome' && piece.toppled) {
				removed = this.#destroy(piece) || removed;
				continue;
			}
			const position = piece.body.getPosition();
			const outside =
				position.x < -OUT_OF_BOUNDS_MARGIN ||
				position.x > this.level.width + OUT_OF_BOUNDS_MARGIN ||
				position.y < -OUT_OF_BOUNDS_MARGIN;
			if (piece.kind === 'bird') {
				this.#updateBird(piece, outside);
				continue;
			}
			if (outside) removed = this.#destroy(piece, false) || removed;
			else if (piece.kind === 'dome' && piece.wobble > 0) {
				piece.wobble = piece.wobble < 0.01 ? 0 : piece.wobble * 0.97;
			}
		}

		if (removed) this.#compact();
		this.#updateEffects();
	}

	/** True when nothing on the field is still noticeably moving */
	isAtRest(): boolean {
		for (const piece of this.pieces) {
			if (!piece.alive || !piece.body.isAwake()) continue;
			if (piece.kind === 'bird' && piece.done) continue;
			const velocity = piece.body.getLinearVelocity();
			if (Math.hypot(velocity.x, velocity.y) > REST_LINEAR_SPEED) return false;
			if (Math.abs(piece.body.getAngularVelocity()) > REST_ANGULAR_SPEED) return false;
		}
		return true;
	}

	/** Launches a bird from the pouch with the given velocity */
	launch(kind: BirdKind, velocity: Vec, from: Vec = POUCH): BirdPiece {
		this.clearSpentBirds();
		const spec = BIRDS[kind];
		const bird = this.#addBird(kind, spec.radius, false, from, velocity);
		this.#turnBirds = [bird];
		return bird;
	}

	/** True while all birds of the current turn have finished flying and rolling */
	birdsDone(): boolean {
		return this.#turnBirds.every((bird) => bird.done || !bird.alive);
	}

	/** The bird whose tap ability can still be used, if any */
	abilityBird(): BirdPiece | null {
		const bird = this.#turnBirds[0];
		if (!bird || this.#turnBirds.length !== 1) return null;
		if (!bird.alive || bird.done || bird.hasHit || bird.abilityUsed) return null;
		return BIRDS[bird.bird].ability ? bird : null;
	}

	/** Uses the flying bird's tap ability; returns whether anything happened */
	useAbility(): boolean {
		const bird = this.abilityBird();
		if (!bird) return false;
		const ability = BIRDS[bird.bird].ability;
		const velocity = bird.body.getLinearVelocity();
		const current = { x: velocity.x, y: velocity.y };
		const position = bird.body.getPosition();
		bird.abilityUsed = true;

		if (ability === 'dash') {
			bird.body.setLinearVelocity(dashVelocity(current));
			this.#puffs(position.x, position.y, 3, bird.radius, 'feather');
		} else if (ability === 'dive') {
			bird.body.setLinearVelocity(diveVelocity(current));
			this.#puffs(position.x, position.y, 3, bird.radius, 'feather');
		} else if (ability === 'boomerang') {
			bird.body.setLinearVelocity(boomerangVelocity(current));
			this.#puffs(position.x, position.y, 3, bird.radius, 'feather');
		} else if (ability === 'blast') {
			this.#blast(position.x, position.y);
			this.physics.destroyBody(bird.body);
			bird.alive = false;
			this.#turnBirds = [];
			this.#compact();
		} else if (ability === 'egg') {
			const drop = {
				x: position.x,
				y: position.y - bird.radius - EGG_RADIUS - 0.05
			};
			const egg = this.#addBird(bird.bird, EGG_RADIUS, true, drop, eggVelocity(current), true);
			// The egg joins the turn, so the turn lasts until it has landed as well
			this.#turnBirds = [bird, egg];
			this.#puffs(drop.x, drop.y, 2, 0.2, 'feather');
		} else if (ability === 'split') {
			const center = { x: position.x, y: position.y };
			this.physics.destroyBody(bird.body);
			bird.alive = false;
			const offsets = splitOffsets(current);
			this.#turnBirds = splitVelocities(current).map((splitVelocity, index) =>
				this.#addBird(
					bird.bird,
					SPLIT_RADIUS,
					true,
					{ x: center.x + offsets[index].x, y: center.y + offsets[index].y },
					splitVelocity
				)
			);
			this.#compact();
			this.#puffs(center.x, center.y, 3, 0.35, 'feather');
		} else {
			return false;
		}
		this.#events.push({ type: 'ability', bird: bird.bird });
		return true;
	}

	/**
	 * The phoenix's explosion: everything within reach is shoved away and damaged, both fading out
	 * with distance, so a tight cluster of blocks is blown apart while far-off pieces stay put.
	 */
	#blast(x: number, y: number) {
		let removed = false;
		for (const piece of this.pieces) {
			if (!piece.alive || piece.kind === 'bird') continue;
			const center = piece.body.getWorldCenter();
			const dx = center.x - x;
			const dy = center.y - y;
			const distance = Math.hypot(dx, dy);
			const share = blastFalloff(distance);
			if (share <= 0) continue;
			const length = Math.max(distance, 0.1);
			const push = BLAST_IMPULSE * share * Math.sqrt(piece.body.getMass());
			// A little lift keeps the debris from just grinding along the ground
			piece.body.applyLinearImpulse(
				{ x: (dx / length) * push, y: (dy / length) * push + push * 0.3 },
				center,
				true
			);
			piece.hp -= BLAST_DAMAGE * share;
			if (piece.kind === 'dome') piece.wobble = Math.min(1, piece.wobble + share);
			if (piece.hp <= 0) removed = this.#destroy(piece) || removed;
		}
		this.#puffs(x, y, 6, BLAST_RADIUS * 0.3, 'explosion');
		this.#shards(x, y, 8, 0.25, 'explosion', 0);
		if (removed) this.#compact();
	}

	/** Removes the birds of the previous turn with a puff, so bodies never pile up */
	clearSpentBirds(): void {
		let removed = false;
		for (const piece of this.pieces) {
			if (piece.kind !== 'bird' || !piece.alive) continue;
			const position = piece.body.getPosition();
			this.#puffs(position.x, position.y, 2, piece.radius * 0.8, 'feather');
			this.physics.destroyBody(piece.body);
			piece.alive = false;
			removed = true;
		}
		this.#turnBirds = [];
		if (removed) this.#compact();
	}

	/** Returns and clears the events since the last call */
	drainEvents(): WorldEvent[] {
		const events = this.#events;
		this.#events = [];
		return events;
	}

	#addBlock(block: LevelData['blocks'][number]) {
		const spec = MATERIALS[block.material];
		const fixture = {
			density: spec.density,
			friction: spec.friction,
			restitution: spec.restitution
		};
		const body = this.physics.createBody({
			type: 'dynamic',
			position: { x: block.x, y: block.shape === 'spire' ? block.y : block.y + block.h / 2 },
			angularDamping: 0.3
		});
		if (block.shape === 'ball') {
			body.createFixture({ shape: new Circle(block.w / 2), ...fixture });
		} else if (block.shape === 'tire') {
			// A tire bounces: birds and neighbouring blocks rebound off it
			body.createFixture({ shape: new Circle(block.w / 2), ...fixture, restitution: 0.45 });
		} else if (block.shape === 'spire') {
			const vertices = [
				{ x: -block.w / 2, y: 0 },
				{ x: block.w / 2, y: 0 },
				{ x: 0, y: block.h }
			];
			body.createFixture({ shape: new Polygon(vertices), ...fixture });
		} else {
			body.createFixture({ shape: new Box(block.w / 2, block.h / 2), ...fixture });
		}
		const piece: BlockPiece = {
			kind: 'block',
			id: this.#nextId++,
			body,
			alive: true,
			material: block.material,
			shape: block.shape,
			w: block.w,
			h: block.h,
			hp: spec.hp,
			maxHp: spec.hp
		};
		body.setUserData(piece);
		this.pieces.push(piece);
	}

	#addDome(x: number, y: number, size: number) {
		const body = this.physics.createBody({
			type: 'dynamic',
			position: { x, y },
			angularDamping: 0.3
		});
		body.createFixture({
			shape: new Polygon(domeVertices(size)),
			density: DOME_MATERIAL.density,
			friction: DOME_MATERIAL.friction,
			restitution: DOME_MATERIAL.restitution
		});
		const piece: DomePiece = {
			kind: 'dome',
			id: this.#nextId++,
			body,
			alive: true,
			size,
			startY: y - groundMax(this.level.hills, x - size / 2, x + size / 2),
			hp: DOME_MATERIAL.hp,
			maxHp: DOME_MATERIAL.hp,
			wobble: 0,
			toppled: false
		};
		body.setUserData(piece);
		this.pieces.push(piece);
	}

	#addLandmark(kind: LandmarkKind, x: number, y: number) {
		const spec = LANDMARKS[kind];
		const body = this.physics.createBody({
			type: 'dynamic',
			position: { x, y: y + spec.h / 2 },
			angularDamping: 0.3
		});
		body.createFixture({
			shape: new Box(spec.w / 2, spec.h / 2),
			density: 1.6,
			friction: 0.7,
			restitution: 0.05
		});
		const piece: LandmarkPiece = {
			kind: 'landmark',
			id: this.#nextId++,
			body,
			alive: true,
			landmark: kind,
			w: spec.w,
			h: spec.h,
			hp: spec.hp,
			maxHp: spec.hp
		};
		body.setUserData(piece);
		this.pieces.push(piece);
	}

	#addBird(
		kind: BirdKind,
		radius: number,
		small: boolean,
		position: Vec,
		velocity: Vec,
		egg = false
	) {
		const spec = BIRDS[kind];
		const body = this.physics.createBody({
			type: 'dynamic',
			position: { ...position },
			linearVelocity: { ...velocity },
			// Angular damping only slows rolling; it does not bend the flight path
			angularDamping: 1.5,
			gravityScale: egg ? 1 : spec.gravityScale,
			bullet: true
		});
		body.createFixture({
			shape: new Circle(radius),
			density: egg ? EGG_DENSITY : spec.density,
			friction: 0.6,
			restitution: 0.2
		});
		const piece: BirdPiece = {
			kind: 'bird',
			id: this.#nextId++,
			body,
			alive: true,
			bird: kind,
			radius,
			small,
			egg,
			hasHit: false,
			abilityUsed: small,
			age: 0,
			slowSteps: 0,
			done: false
		};
		body.setUserData(piece);
		this.pieces.push(piece);
		return piece;
	}

	#onImpact(contact: Contact, impulse: number) {
		const a = contact.getFixtureA().getBody().getUserData() as Piece | typeof GROUND | null;
		const b = contact.getFixtureB().getBody().getUserData() as Piece | typeof GROUND | null;
		this.#impactOn(a, b, impulse);
		this.#impactOn(b, a, impulse);
	}

	#impactOn(
		target: Piece | typeof GROUND | null,
		other: Piece | typeof GROUND | null,
		impulse: number
	) {
		if (!target || target === GROUND) return;
		if (target.kind === 'bird') {
			const firstHit = !target.hasHit;
			target.hasHit = true;
			if (impulse > this.#strongestImpact) {
				this.#strongestImpact = impulse;
				this.#strongestSurface = surfaceOf(other);
			}
			if (firstHit && target.bird === 'pelican' && impulse > 1) {
				const position = target.body.getPosition();
				this.#burst(position.x, position.y);
			}
			return;
		}
		if (this.steps < GRACE_STEPS) return;
		const multiplier =
			other && other !== GROUND && other.kind === 'bird'
				? other.egg
					? EGG_DAMAGE_MULTIPLIER
					: BIRDS[other.bird].damageMultiplier
				: 1;
		const spec =
			target.kind === 'dome'
				? DOME_MATERIAL
				: target.kind === 'landmark'
					? LANDMARKS[target.landmark]
					: MATERIALS[target.material];
		const damage = impactDamage(impulse, spec.threshold, multiplier);
		if (damage > 0) this.#damage.set(target, (this.#damage.get(target) ?? 0) + damage);
		if (target.kind === 'dome') {
			// Even harmless knocks make a dome wobble ridiculously
			if (impulse > spec.threshold * 0.3) target.wobble = Math.min(1, target.wobble + 0.08);
			// Toppling off its perch onto the ground breaks it
			if (other === GROUND && target.startY > 0.05) target.toppled = true;
		}
	}

	#updateBird(bird: BirdPiece, outside: boolean) {
		if (bird.done) return;
		bird.age++;
		const velocity = bird.body.getLinearVelocity();
		bird.slowSteps = Math.hypot(velocity.x, velocity.y) < BIRD_REST_SPEED ? bird.slowSteps + 1 : 0;
		if (outside || bird.slowSteps >= BIRD_REST_STEPS || bird.age >= BIRD_MAX_STEPS) {
			bird.done = true;
		}
	}

	/** Removes a block, dome or landmark; returns true. Pieces that left the field give no dust. */
	#destroy(piece: BlockPiece | DomePiece | LandmarkPiece, visible = true): boolean {
		const position = piece.body.getPosition();
		const angle = piece.body.getAngle();
		this.physics.destroyBody(piece.body);
		piece.alive = false;

		if (piece.kind === 'dome') {
			this.domesDestroyed++;
			this.destructionPoints += DOME_POINTS;
			this.#events.push({ type: 'dome-destroyed', remaining: this.domesRemaining });
			if (visible) {
				this.#addEffect({
					kind: 'dome',
					x: position.x,
					y: position.y,
					size: piece.size,
					angle,
					age: 0,
					life: DOME_POP_STEPS
				});
				const cx = position.x - Math.sin(angle) * piece.size * 0.5;
				const cy = position.y + Math.cos(angle) * piece.size * 0.5;
				this.#shards(cx, cy, 7, piece.size * 0.22, 'gold', DOME_POP_STEPS * 0.6);
				this.#puffs(cx, cy, 3, piece.size * 0.45, 'dust');
			}
			this.#addEffect({
				kind: 'points',
				x: position.x,
				y: position.y + piece.size,
				value: DOME_POINTS,
				age: 0,
				life: 60
			});
		} else if (piece.kind === 'landmark') {
			this.blocksDestroyed++;
			const points = LANDMARKS[piece.landmark].points;
			this.destructionPoints += points;
			this.#events.push({ type: 'landmark-destroyed', landmark: piece.landmark, points });
			if (visible) {
				const cy = position.y + piece.h * 0.4;
				this.#puffs(position.x, cy, 5, piece.w * 0.45, 'dust');
				this.#shards(position.x, cy, 7, Math.min(0.6, piece.w * 0.28), 'explosion', 0);
			}
			this.#addEffect({
				kind: 'points',
				x: position.x,
				y: position.y + piece.h,
				value: points,
				age: 0,
				life: 60
			});
		} else {
			this.blocksDestroyed++;
			const points = BLOCK_POINTS[piece.material];
			this.destructionPoints += points;
			this.#events.push({ type: 'block-destroyed', material: piece.material, points });
			if (visible) {
				const cy = piece.shape === 'spire' ? position.y + piece.h / 3 : position.y;
				const size = Math.max(piece.w, piece.h);
				this.#puffs(position.x, cy, 2 + Math.round(size), Math.min(0.6, size * 0.3), 'dust');
				const shardCount = piece.shape === 'crate' ? 6 : 4;
				this.#shards(position.x, cy, shardCount, Math.min(0.5, size * 0.25), piece.material, 0);
			}
			this.#addEffect({
				kind: 'points',
				x: position.x,
				y: position.y,
				value: points,
				age: 0,
				life: 50
			});
		}
		return true;
	}

	#compact() {
		for (let i = this.pieces.length - 1; i >= 0; i--) {
			if (!this.pieces[i].alive) this.pieces.splice(i, 1);
		}
	}

	#addEffect(effect: Effect) {
		if (this.effects.length >= MAX_EFFECTS) this.effects.shift();
		this.effects.push(effect);
	}

	/** A small burst on the pelican's first impact: it hits hard enough to leave a little explosion */
	#burst(x: number, y: number) {
		this.#puffs(x, y, 4, 0.4, 'explosion');
		this.#shards(x, y, 5, 0.18, 'explosion', 0);
	}

	#puffs(x: number, y: number, count: number, radius: number, tone: EffectTone) {
		for (let i = 0; i < count; i++) {
			const angle = this.#random() * Math.PI * 2;
			const speed = 0.4 + this.#random() * 0.8;
			this.#addEffect({
				kind: 'puff',
				x: x + Math.cos(angle) * radius * 0.5,
				y: y + Math.sin(angle) * radius * 0.5,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed + 0.3,
				radius: radius * (0.6 + this.#random() * 0.6),
				tone,
				age: 0,
				life: 34 + Math.floor(this.#random() * 16)
			});
		}
	}

	#shards(x: number, y: number, count: number, size: number, tone: EffectTone, delay: number) {
		for (let i = 0; i < count; i++) {
			const angle = Math.PI * (0.1 + this.#random() * 0.8);
			const speed = 2 + this.#random() * 4;
			this.#addEffect({
				kind: 'shard',
				x,
				y,
				vx: Math.cos(angle) * speed * (this.#random() < 0.5 ? -1 : 1),
				vy: Math.sin(angle) * speed,
				angle: this.#random() * Math.PI,
				spin: (this.#random() - 0.5) * 0.5,
				w: size * (0.6 + this.#random() * 0.8),
				h: size * 0.35,
				tone,
				age: 0,
				life: 45 + Math.floor(this.#random() * 20),
				delay: Math.round(delay)
			});
		}
	}

	#updateEffects() {
		for (let i = this.effects.length - 1; i >= 0; i--) {
			const effect = this.effects[i];
			effect.age++;
			if (effect.age >= effect.life) {
				this.effects.splice(i, 1);
				continue;
			}
			if (effect.kind === 'puff') {
				effect.x += effect.vx * STEP_SECONDS;
				effect.y += effect.vy * STEP_SECONDS;
				effect.vx *= 0.95;
				effect.vy *= 0.95;
			} else if (effect.kind === 'shard' && effect.age > effect.delay) {
				effect.vy += GRAVITY * STEP_SECONDS;
				effect.x += effect.vx * STEP_SECONDS;
				effect.y += effect.vy * STEP_SECONDS;
				effect.angle += effect.spin;
			} else if (effect.kind === 'points') {
				effect.y += 0.9 * STEP_SECONDS;
			}
		}
	}
}

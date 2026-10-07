/*
 * Homing projectiles: FPV drones from the nests chase soldiers, Patriot missiles chase aerial
 * enemies. They steer toward their target with a limited turn rate, so a volley fans out of the
 * launcher and curves in. A projectile whose target fell picks the nearest new one, or fizzles.
 */
import type { Random } from '#lib/game/random.js';
import { FLYERS, SOLDIERS, isFlyerKind, type DefenseStats, type Point } from './config';
import { distanceBetween } from './path';
import type {
	DroneWallEvent,
	DroneWallState,
	Flyer,
	Projectile,
	ProjectileKind,
	Soldier
} from './state';

interface Flight {
	/** Radians per second */
	turnRate: number;
	/** Within this distance of the target the projectile locks on and steers perfectly */
	lockRange: number;
	/** How far it looks for a new target once its own is gone */
	retargetRange: number;
	/** It gives up after this long */
	maxAgeMs: number;
	/** Speed fraction at launch, reaching 1 after `rampMs` */
	startSpeed: number;
	rampMs: number;
}

const FLIGHT: Record<ProjectileKind, Flight> = {
	fpv: {
		turnRate: 7,
		lockRange: 34,
		retargetRange: 150,
		maxAgeMs: 3600,
		startSpeed: 0.5,
		rampMs: 300
	},
	missile: {
		turnRate: 5,
		lockRange: 44,
		retargetRange: 220,
		maxAgeMs: 4500,
		startSpeed: 0.55,
		rampMs: 350
	}
};

/** A hit lands when the projectile gets within this much of the target's body */
const HIT_MARGIN = 5;

/** An FPV drone leaves the nest in a random direction in the upper half, then turns toward its prey */
export function launchFpv(
	state: DroneWallState,
	random: Random,
	origin: Point,
	stats: DefenseStats,
	target: Soldier
): Projectile {
	const projectile: Projectile = {
		id: state.nextId++,
		kind: 'fpv',
		x: origin.x,
		y: origin.y - 12,
		angle: -Math.PI / 2 + (random() - 0.5) * 2.4,
		targetId: target.id,
		damage: stats.damage,
		speed: stats.speed,
		ageMs: 0
	};
	state.projectiles.push(projectile);
	return projectile;
}

/** A Patriot missile climbs straight up out of its canister, then arcs over onto its target */
export function launchMissile(
	state: DroneWallState,
	origin: Point,
	stats: DefenseStats,
	target: Flyer
): Projectile {
	const projectile: Projectile = {
		id: state.nextId++,
		kind: 'missile',
		x: origin.x,
		y: origin.y - 8,
		angle: -Math.PI / 2,
		targetId: target.id,
		damage: stats.damage,
		speed: stats.speed,
		ageMs: 0
	};
	state.projectiles.push(projectile);
	return projectile;
}

type Target = Soldier | Flyer;

function targetsOf(state: DroneWallState, kind: ProjectileKind): readonly Target[] {
	return kind === 'fpv' ? state.soldiers : state.flyers;
}

function radiusOf(target: Target): number {
	return isFlyerKind(target.kind) ? FLYERS[target.kind].radius : SOLDIERS[target.kind].radius;
}

const inPlay = (target: Target) => target.hp > 0 && target.y >= 0;

function nearest(targets: readonly Target[], from: Point, range: number): Target | null {
	let best: Target | null = null;
	let bestDistance = range;
	for (const target of targets) {
		if (!inPlay(target)) continue;
		const distance = distanceBetween(from, target);
		if (distance <= bestDistance) {
			best = target;
			bestDistance = distance;
		}
	}
	return best;
}

/** Turns `from` toward `to` by at most `maxTurn` radians along the short way round */
function steer(from: number, to: number, maxTurn: number): number {
	let diff = to - from;
	while (diff > Math.PI) diff -= Math.PI * 2;
	while (diff < -Math.PI) diff += Math.PI * 2;
	return from + Math.max(-maxTurn, Math.min(maxTurn, diff));
}

/** Flies every projectile one step; `damage` hurts the target it reaches */
export function flyProjectiles(
	state: DroneWallState,
	dtMs: number,
	damage: (target: Target, amount: number) => void,
	events: DroneWallEvent[]
) {
	state.projectiles = state.projectiles.filter((projectile) => {
		const flight = FLIGHT[projectile.kind];
		projectile.ageMs += dtMs;
		const targets = targetsOf(state, projectile.kind);

		let target = targets.find((t) => t.id === projectile.targetId && inPlay(t)) ?? null;
		if (!target) {
			target = nearest(targets, projectile, flight.retargetRange);
			projectile.targetId = target?.id ?? null;
		}
		if (!target || projectile.ageMs > flight.maxAgeMs) {
			events.push({
				type: 'projectile-lost',
				kind: projectile.kind,
				x: projectile.x,
				y: projectile.y
			});
			return false;
		}

		const distance = distanceBetween(projectile, target);
		const step =
			(projectile.speed *
				Math.min(
					1,
					flight.startSpeed + (1 - flight.startSpeed) * (projectile.ageMs / flight.rampMs)
				) *
				dtMs) /
			1000;
		if (distance <= radiusOf(target) + HIT_MARGIN + step) {
			damage(target, projectile.damage);
			events.push({
				type: 'projectile-hit',
				kind: projectile.kind,
				x: target.x,
				y: target.y
			});
			return false;
		}

		const wanted = Math.atan2(target.y - projectile.y, target.x - projectile.x);
		projectile.angle =
			distance <= flight.lockRange
				? wanted
				: steer(projectile.angle, wanted, (flight.turnRate * dtMs) / 1000);
		projectile.x += Math.cos(projectile.angle) * step;
		projectile.y += Math.sin(projectile.angle) * step;
		return true;
	});
}

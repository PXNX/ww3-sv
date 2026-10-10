/*
 * Targeting and damage rules. Everything here is a pure function of the soldiers, so the rules
 * can be tested without running a whole game.
 */
import {
	SLOTS,
	defenseStats,
	isGarrison,
	type DefenseKind,
	type DefenseStats,
	type Point
} from './config';
import { ROAD, distanceBetween, pointAt, type Path } from './path';
import type { Defense, Flyer, Projectile, Soldier } from './state';

const isAlive = (soldier: Soldier) => soldier.hp > 0;

/** Soldiers still alive and within `range` of the origin (soldiers beyond the top edge are not in play yet) */
export function inRange(
	soldiers: readonly Soldier[],
	origin: Point,
	range: number,
	minRange = 0
): Soldier[] {
	return soldiers.filter((soldier) => {
		if (!isAlive(soldier) || soldier.y < 0) return false;
		const distance = distanceBetween(origin, soldier);
		return distance <= range && distance >= minRange;
	});
}

/** The squad shoots whoever is closest to breaking through */
export function pickSquadTarget(
	soldiers: readonly Soldier[],
	origin: Point,
	stats: DefenseStats
): Soldier | null {
	let best: Soldier | null = null;
	for (const soldier of inRange(soldiers, origin, stats.range)) {
		if (!best || soldier.progress > best.progress) best = soldier;
	}
	return best;
}

/**
 * The drone nest picks the toughest soldier in reach (the one with the most health left). Damage
 * already on its way (`incoming`, by soldier id) is counted as gone, so a stream of drones
 * spreads over the crowd instead of all diving onto the same soldier.
 */
export function pickNestTarget(
	soldiers: readonly Soldier[],
	origin: Point,
	stats: DefenseStats,
	incoming: ReadonlyMap<number, number> = NO_INCOMING
): Soldier | null {
	let best: Soldier | null = null;
	let bestHp = 0;
	for (const soldier of inRange(soldiers, origin, stats.range)) {
		const hp = soldier.hp - (incoming.get(soldier.id) ?? 0);
		if (!best || hp > bestHp || (hp === bestHp && soldier.progress > best.progress)) {
			best = soldier;
			bestHp = hp;
		}
	}
	return best;
}

const NO_INCOMING: ReadonlyMap<number, number> = new Map();

/** Damage that homing projectiles of one kind still have to deliver, by target id */
export function incomingDamage(
	projectiles: readonly Projectile[],
	kind: Projectile['kind']
): Map<number, number> {
	const incoming = new Map<number, number>();
	for (const projectile of projectiles) {
		if (projectile.kind !== kind || projectile.targetId === null) continue;
		incoming.set(projectile.targetId, (incoming.get(projectile.targetId) ?? 0) + projectile.damage);
	}
	return incoming;
}

/** Aerial enemies still alive and within `range` (the ones above the top edge are not in play yet) */
export function flyersInRange(flyers: readonly Flyer[], origin: Point, range: number): Flyer[] {
	return flyers.filter(
		(flyer) => flyer.hp > 0 && flyer.y >= 0 && distanceBetween(origin, flyer) <= range
	);
}

/** Distance an enemy still has to travel before it breaches the line */
export function remainingDistance(enemy: Soldier | Flyer, road: Path = ROAD): number {
	return 'air' in enemy ? enemy.length - enemy.progress : road.length - enemy.progress;
}

/** The aerial enemy closest to the line in reach, for squads (which hurt aircraft less) */
export function pickAirTarget(
	flyers: readonly Flyer[],
	origin: Point,
	range: number
): Flyer | null {
	let best: Flyer | null = null;
	for (const flyer of flyersInRange(flyers, origin, range)) {
		if (!best || remainingDistance(flyer) < remainingDistance(best)) best = flyer;
	}
	return best;
}

/**
 * The Patriot shoots the aerial enemy closest to the line that is not already doomed by missiles
 * in the air; with nothing left to shoot at it holds fire.
 */
export function pickPatriotTarget(
	flyers: readonly Flyer[],
	origin: Point,
	stats: DefenseStats,
	incoming: ReadonlyMap<number, number> = NO_INCOMING
): Flyer | null {
	let best: Flyer | null = null;
	for (const flyer of flyersInRange(flyers, origin, stats.range)) {
		if (flyer.hp - (incoming.get(flyer.id) ?? 0) <= 0) continue;
		if (!best || remainingDistance(flyer) < remainingDistance(best)) best = flyer;
	}
	return best;
}

/** Where a soldier will be after `ms`, if nothing slows it down */
export function predictPosition(soldier: Soldier, ms: number, path: Path = ROAD): Point {
	const sample = pointAt(path, soldier.progress + (soldier.speed * ms) / 1000);
	return { x: sample.x, y: sample.y };
}

export interface MortarAim {
	x: number;
	y: number;
	/** Soldiers inside the blast when the shell lands */
	hits: number;
}

/**
 * The mortar aims for the spot where the most soldiers will be inside the blast when the shell
 * lands, so it loves clumps. Ties go to the spot closest to the line. Spots within a blast of an
 * `avoid` point are skipped, so a salvo spreads out over the crowd.
 */
export function pickMortarAim(
	soldiers: readonly Soldier[],
	origin: Point,
	stats: DefenseStats,
	path: Path = ROAD,
	avoid: readonly Point[] = []
): MortarAim | null {
	const candidates = inRange(soldiers, origin, stats.range + stats.splashRadius * 0.5);
	if (candidates.length === 0) return null;
	const landing = candidates.map((soldier) => ({
		soldier,
		spot: predictPosition(soldier, stats.flightMs, path)
	}));

	let best: (MortarAim & { progress: number }) | null = null;
	for (const { soldier, spot } of landing) {
		const distance = distanceBetween(origin, spot);
		if (distance > stats.range || distance < stats.minRange) continue;
		if (avoid.some((other) => distanceBetween(spot, other) < stats.splashRadius * 0.9)) continue;
		const hits = landing.filter(
			(other) => distanceBetween(spot, other.spot) <= stats.splashRadius
		).length;
		if (!best || hits > best.hits || (hits === best.hits && soldier.progress > best.progress)) {
			best = { x: spot.x, y: spot.y, hits, progress: soldier.progress };
		}
	}
	return best && { x: best.x, y: best.y, hits: best.hits };
}

/**
 * The sniper shoots the soldier with the most health in reach, and goes for officers and medics
 * first: killing those breaks up the rest. Soldiers in `taken` already got a shot this round.
 */
export function pickSniperTarget(
	soldiers: readonly Soldier[],
	origin: Point,
	stats: DefenseStats,
	taken: ReadonlySet<number> = new Set()
): Soldier | null {
	let best: Soldier | null = null;
	let bestScore = -1;
	for (const soldier of inRange(soldiers, origin, stats.range)) {
		if (taken.has(soldier.id)) continue;
		const support = soldier.kind === 'officer' || soldier.kind === 'medic' ? 1000 : 0;
		const score = support + soldier.hp;
		if (score > bestScore) {
			best = soldier;
			bestScore = score;
		}
	}
	return best;
}

/** The ground target closest to breaking through that is not in `taken` (flak, squads) */
export function pickGroundTarget(
	soldiers: readonly Soldier[],
	origin: Point,
	range: number,
	taken: ReadonlySet<number> = new Set()
): Soldier | null {
	let best: Soldier | null = null;
	for (const soldier of inRange(soldiers, origin, range)) {
		if (taken.has(soldier.id)) continue;
		if (!best || soldier.progress > best.progress) best = soldier;
	}
	return best;
}

/** The aerial enemy closest to the line in reach that is not in `taken` */
export function pickAirTargetExcept(
	flyers: readonly Flyer[],
	origin: Point,
	range: number,
	taken: ReadonlySet<number>
): Flyer | null {
	let best: Flyer | null = null;
	for (const flyer of flyersInRange(flyers, origin, range)) {
		if (taken.has(flyer.id)) continue;
		if (!best || remainingDistance(flyer) < remainingDistance(best)) best = flyer;
	}
	return best;
}

/** Blast damage: full at the centre, half at the edge, nothing outside */
export function splashDamage(damage: number, distance: number, radius: number): number {
	if (radius <= 0 || distance > radius) return 0;
	return damage * (1 - 0.5 * (distance / radius));
}

/** The slowest speed multiplier among the trenches that reach the point (1 when none does) */
export function slowAt(
	point: Point,
	defenses: readonly (Defense | null)[],
	slots: readonly Point[] = SLOTS
): number {
	let slow = 1;
	defenses.forEach((defense, slot) => {
		if (!defense || defense.kind !== 'trench') return;
		const stats = defenseStats('trench', defense.level);
		if (distanceBetween(slots[slot], point) <= stats.range) slow = Math.min(slow, stats.slow);
	});
	return slow;
}

/** Mine damage per second at a point: the strongest trench reaching it (mines do not stack) */
export function mineDpsAt(
	point: Point,
	defenses: readonly (Defense | null)[],
	slots: readonly Point[] = SLOTS
): number {
	let dps = 0;
	defenses.forEach((defense, slot) => {
		if (!defense || defense.kind !== 'trench') return;
		const stats = defenseStats('trench', defense.level);
		if (distanceBetween(slots[slot], point) <= stats.range) dps = Math.max(dps, stats.dps);
	});
	return dps;
}

/**
 * What the jammers do to an aircraft at a point: the strongest slow and the strongest damage of
 * the jammers reaching it (jammers do not stack)
 */
export function jamAt(
	point: Point,
	defenses: readonly (Defense | null)[],
	slots: readonly Point[] = SLOTS
): { slow: number; dps: number } {
	let slow = 1;
	let dps = 0;
	defenses.forEach((defense, slot) => {
		if (!defense || defense.kind !== 'jammer') return;
		const stats = defenseStats('jammer', defense.level);
		if (distanceBetween(slots[slot], point) > stats.range) return;
		slow = Math.min(slow, stats.slow);
		dps = Math.max(dps, stats.dps);
	});
	return { slow, dps };
}

export function isShooter(kind: DefenseKind): boolean {
	return kind !== 'trench' && kind !== 'jammer' && !isGarrison(kind);
}

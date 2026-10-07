/*
 * Targeting and damage rules. Everything here is a pure function of the soldiers, so the rules
 * can be tested without running a whole game.
 */
import { SLOTS, defenseStats, type DefenseKind, type DefenseStats, type Point } from './config';
import { ROAD, distanceBetween, pointAt, type Path } from './path';
import type { Defense, Soldier } from './state';

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

/** The drone nest picks the toughest soldier in reach (the one with the most health left) */
export function pickNestTarget(
	soldiers: readonly Soldier[],
	origin: Point,
	stats: DefenseStats
): Soldier | null {
	let best: Soldier | null = null;
	for (const soldier of inRange(soldiers, origin, stats.range)) {
		if (
			!best ||
			soldier.hp > best.hp ||
			(soldier.hp === best.hp && soldier.progress > best.progress)
		) {
			best = soldier;
		}
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
 * lands, so it loves clumps. Ties go to the spot closest to the line.
 */
export function pickMortarAim(
	soldiers: readonly Soldier[],
	origin: Point,
	stats: DefenseStats,
	path: Path = ROAD
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
		const hits = landing.filter(
			(other) => distanceBetween(spot, other.spot) <= stats.splashRadius
		).length;
		if (!best || hits > best.hits || (hits === best.hits && soldier.progress > best.progress)) {
			best = { x: spot.x, y: spot.y, hits, progress: soldier.progress };
		}
	}
	return best && { x: best.x, y: best.y, hits: best.hits };
}

/** Blast damage: full at the centre, half at the edge, nothing outside */
export function splashDamage(damage: number, distance: number, radius: number): number {
	if (radius <= 0 || distance > radius) return 0;
	return damage * (1 - 0.5 * (distance / radius));
}

/** The slowest speed multiplier among the trenches that reach the point (1 when none does) */
export function slowAt(point: Point, defenses: readonly (Defense | null)[]): number {
	let slow = 1;
	defenses.forEach((defense, slot) => {
		if (!defense || defense.kind !== 'trench') return;
		const stats = defenseStats('trench', defense.level);
		if (distanceBetween(SLOTS[slot], point) <= stats.range) slow = Math.min(slow, stats.slow);
	});
	return slow;
}

/** Mine damage per second at a point: the strongest trench reaching it (mines do not stack) */
export function mineDpsAt(point: Point, defenses: readonly (Defense | null)[]): number {
	let dps = 0;
	defenses.forEach((defense, slot) => {
		if (!defense || defense.kind !== 'trench') return;
		const stats = defenseStats('trench', defense.level);
		if (distanceBetween(SLOTS[slot], point) <= stats.range) dps = Math.max(dps, stats.dps);
	});
	return dps;
}

export function isShooter(kind: DefenseKind): boolean {
	return kind !== 'trench';
}

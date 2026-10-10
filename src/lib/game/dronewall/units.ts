/*
 * Garrison units: an Azov post sends infantry, a Leopard post one tank. They walk a slow circle
 * around their post, and when a soldier comes within the post's range they run at the closest
 * one and fight it in melee. A soldier touching a unit stops marching and fights back, so units
 * block the road; when a unit falls, the post sends a new one after a while.
 */
import { SOLDIERS, defenseStats, isGarrison, type DefenseStats, type Point } from './config';
import { WEATHER } from './weather';
import { damageSoldier } from './damage';
import { distanceBetween } from './path';
import type { Defense, DroneWallEvent, DroneWallState, Soldier, Unit } from './state';
import { inRange } from './targeting';

/** Distance from the post at which idle units walk their circle */
const PATROL_RADIUS = { azov: 32, leopard: 40 } as const;
/** Idle units walk at this share of their speed */
const PATROL_SPEED = 0.55;
/** Radians per millisecond that the patrol circle turns */
const PATROL_TURN = 0.0006;
/** Time between two units of a new or upgraded post appearing */
const FILL_GAP_MS = 600;
const SWING_MS = 220;

function spawnUnit(state: DroneWallState, slot: number, defense: Defense, count: number): Unit {
	const home = state.map.slots[slot];
	const stats = defenseStats(defense.kind, defense.level);
	const unit: Unit = {
		id: state.nextId++,
		slot,
		kind: defense.kind as Unit['kind'],
		x: home.x,
		y: home.y + 6,
		hp: stats.unitHp,
		maxHp: stats.unitHp,
		facing: Math.PI / 2,
		phase: (count * Math.PI * 2) / Math.max(1, stats.unitCount),
		targetId: null,
		attackMs: 0,
		hitMs: 0,
		swingMs: 0
	};
	state.units.push(unit);
	return unit;
}

function moveToward(unit: Unit, goal: Point, step: number, stopAt: number) {
	const distance = distanceBetween(unit, goal);
	if (distance <= stopAt) return;
	const go = Math.min(step, distance - stopAt);
	unit.x += ((goal.x - unit.x) / distance) * go;
	unit.y += ((goal.y - unit.y) / distance) * go;
}

function updateUnit(
	state: DroneWallState,
	unit: Unit,
	stats: DefenseStats,
	home: Point,
	dtMs: number,
	events: DroneWallEvent[]
) {
	unit.hitMs = Math.max(0, unit.hitMs - dtMs);
	unit.attackMs = Math.max(0, unit.attackMs - dtMs);
	unit.swingMs = Math.max(0, unit.swingMs - dtMs);
	// An upgrade makes the unit sturdier, and heals it by the difference
	if (unit.maxHp !== stats.unitHp) {
		unit.hp = Math.min(stats.unitHp, unit.hp + Math.max(0, stats.unitHp - unit.maxHp));
		unit.maxHp = stats.unitHp;
	}
	// Rain bogs the tank down, snow slows the infantry
	const weather = WEATHER[state.weather];
	const going = unit.kind === 'leopard' ? weather.vehicleSpeed : weather.friendlyInfantrySpeed;
	const step = (stats.unitSpeed * going * dtMs) / 1000;

	// Keep the soldier it is fighting while it stays in reach of the post, else pick the closest
	let target =
		state.soldiers.find(
			(soldier) =>
				soldier.id === unit.targetId &&
				soldier.hp > 0 &&
				soldier.y >= 0 &&
				distanceBetween(home, soldier) <= stats.range + 10
		) ?? null;
	if (!target) {
		let closest = Infinity;
		for (const soldier of inRange(state.soldiers, home, stats.range)) {
			const distance = distanceBetween(unit, soldier);
			if (distance < closest) {
				closest = distance;
				target = soldier;
			}
		}
	}
	unit.targetId = target?.id ?? null;

	// Every soldier touching the unit stops to fight it, and hurts it
	const touching: Soldier[] = state.soldiers.filter(
		(soldier) =>
			soldier.hp > 0 &&
			soldier.y >= 0 &&
			distanceBetween(unit, soldier) <= stats.unitReach + SOLDIERS[soldier.kind].radius
	);
	let taken = 0;
	for (const soldier of touching) {
		soldier.engaged = true;
		taken += (SOLDIERS[soldier.kind].meleeDps * dtMs) / 1000;
	}
	if (taken > 0) {
		unit.hp -= taken;
		unit.hitMs = 120;
	}

	if (!target) {
		// Walk the slow circle around the post, and patch up
		const angle = unit.phase + state.timeMs * PATROL_TURN;
		const radius = PATROL_RADIUS[unit.kind];
		const goal = {
			x: home.x + Math.cos(angle) * radius,
			y: home.y + Math.sin(angle) * radius * 0.8
		};
		if (distanceBetween(unit, goal) > 1.5) {
			unit.facing = Math.atan2(goal.y - unit.y, goal.x - unit.x);
			moveToward(unit, goal, step * PATROL_SPEED, 0);
		}
		unit.hp = Math.min(unit.maxHp, unit.hp + (stats.unitRegen * dtMs) / 1000);
		return;
	}

	unit.facing = Math.atan2(target.y - unit.y, target.x - unit.x);
	const contact = touching.includes(target);
	if (!contact) {
		const close = stats.unitReach + SOLDIERS[target.kind].radius;
		moveToward(unit, target, step, close * 0.8);
		return;
	}
	if (unit.attackMs > 0) return;
	// A tank crushes everything in reach, infantry only the one it fights
	for (const victim of stats.cleave ? touching : [target]) damageSoldier(victim, stats.damage);
	unit.attackMs = stats.unitAttackMs;
	unit.swingMs = SWING_MS;
	events.push({ type: 'melee-hit', x: target.x, y: target.y, kind: unit.kind });
}

/**
 * Runs the garrisons for one step: sends new units, lets every unit fight or patrol, and removes
 * the fallen (their post starts the replacement timer). Marks the soldiers in melee as engaged,
 * which stops them marching; call before the soldiers march.
 */
export function updateUnits(state: DroneWallState, dtMs: number, events: DroneWallEvent[]) {
	for (const soldier of state.soldiers) soldier.engaged = false;
	// Units of a sold defense go away with it
	state.units = state.units.filter((unit) => {
		const defense = state.defenses[unit.slot];
		return defense !== null && defense !== undefined && defense.kind === unit.kind;
	});

	state.defenses.forEach((defense, slot) => {
		if (!defense || !isGarrison(defense.kind)) return;
		const stats = defenseStats(defense.kind, defense.level);
		const home = state.map.slots[slot];
		const mine = state.units.filter((unit) => unit.slot === slot);

		defense.cooldownMs = Math.max(0, defense.cooldownMs - dtMs);
		if (mine.length < stats.unitCount && defense.cooldownMs <= 0) {
			const unit = spawnUnit(state, slot, defense, mine.length);
			mine.push(unit);
			defense.cooldownMs = FILL_GAP_MS;
			events.push({ type: 'unit-spawned', x: unit.x, y: unit.y, kind: unit.kind });
		}

		for (const unit of mine) updateUnit(state, unit, stats, home, dtMs, events);

		for (const unit of mine) {
			if (unit.hp > 0) continue;
			events.push({ type: 'unit-fell', x: unit.x, y: unit.y, kind: unit.kind });
			defense.cooldownMs = Math.max(defense.cooldownMs, stats.intervalMs);
		}
	});
	state.units = state.units.filter((unit) => unit.hp > 0);
}

/*
 * What the shooting defenses do when their cooldown runs out: squads, snipers and Gepard flak
 * tanks shoot, mortars, HIMARS and Pion lob shells, nests launch FPV drones, Patriots launch
 * missiles. Trenches, jammers and garrisons do not fire here (they work all the time). Elite
 * defenses fire a volley: several shots, drones, missiles or rockets at different targets.
 */
import type { Random } from '#lib/game/random.js';
import {
	SOLDIERS,
	defenseStats,
	isGarrison,
	type DefenseKind,
	type DefenseStats,
	type Point
} from './config';
import { damageSoldier } from './damage';
import { launchFpv, launchMissile } from './projectiles';
import type { Defense, DroneWallEvent, DroneWallState, Flyer, ShellKind, Soldier } from './state';
import {
	incomingDamage,
	pickAirTargetExcept,
	pickGroundTarget,
	pickMortarAim,
	pickNestTarget,
	pickPatriotTarget,
	pickSniperTarget,
	remainingDistance
} from './targeting';
import { WEATHER } from './weather';

/** Gap between the rockets and shells of one salvo */
const SALVO_GAP_MS: Partial<Record<DefenseKind, number>> = { mortar: 220, himars: 150, pion: 400 };

type Fire = (
	state: DroneWallState,
	random: Random,
	slot: number,
	defense: Defense,
	origin: Point,
	stats: DefenseStats,
	events: DroneWallEvent[]
) => Point | null;

/** Share of a shot's damage that gets through to this enemy */
function bulletFactor(target: Soldier | Flyer, stats: DefenseStats): number {
	if ('air' in target) return stats.air;
	const armor = SOLDIERS[target.kind].armor;
	return stats.ground * (armor + (1 - armor) * stats.pierce);
}

function shoot(
	slot: number,
	weapon: DefenseKind,
	origin: Point,
	target: Soldier | Flyer,
	stats: DefenseStats,
	events: DroneWallEvent[]
) {
	damageSoldier(target, stats.damage * bulletFactor(target, stats));
	events.push({
		type: 'squad-shot',
		weapon,
		slot,
		fromX: origin.x,
		fromY: origin.y,
		toX: target.x,
		toY: target.y
	});
}

/** The squad shoots whoever is closest to breaking through, aircraft included (but they hurt little) */
const fireSquad: Fire = (state, _random, slot, defense, origin, stats, events) => {
	const taken = new Set<number>();
	let last: Point | null = null;
	for (let i = 0; i < stats.volley; i++) {
		const ground = pickGroundTarget(state.soldiers, origin, stats.range, taken);
		const air = pickAirTargetExcept(state.flyers, origin, stats.range, taken);
		const shootAir =
			air !== null &&
			(!ground || remainingDistance(air) < remainingDistance(ground, state.map.road));
		const target = shootAir ? air : ground;
		if (!target) break;
		taken.add(target.id);
		shoot(slot, defense.kind, origin, target, stats, events);
		last = target;
	}
	return last;
};

/** The Gepard fires at aircraft first, and at the ground only when there is nothing in the air */
const fireGepard: Fire = (state, _random, slot, defense, origin, stats, events) => {
	const taken = new Set<number>();
	let last: Point | null = null;
	for (let i = 0; i < stats.volley; i++) {
		const target =
			pickAirTargetExcept(state.flyers, origin, stats.range, taken) ??
			pickGroundTarget(state.soldiers, origin, stats.range, taken);
		if (!target) break;
		taken.add(target.id);
		shoot(slot, defense.kind, origin, target, stats, events);
		last = target;
	}
	return last;
};

const fireSniper: Fire = (state, _random, slot, defense, origin, stats, events) => {
	const taken = new Set<number>();
	let last: Point | null = null;
	for (let i = 0; i < stats.volley; i++) {
		const target = pickSniperTarget(state.soldiers, origin, stats, taken);
		if (!target) break;
		taken.add(target.id);
		shoot(slot, defense.kind, origin, target, stats, events);
		last = target;
	}
	return last;
};

const fireArtillery: Fire = (state, _random, slot, defense, origin, stats, events) => {
	const kind: ShellKind = defense.kind === 'himars' ? 'rocket' : 'shell';
	const gap = SALVO_GAP_MS[defense.kind] ?? 200;
	const aims: Point[] = [];
	for (let i = 0; i < stats.volley; i++) {
		// The aim leads the soldiers by the time the shell is in the air, and the wait
		const flying = { ...stats, flightMs: stats.flightMs + i * gap };
		const spot =
			pickMortarAim(state.soldiers, origin, flying, state.map.road, aims) ??
			(i > 0 ? pickMortarAim(state.soldiers, origin, flying, state.map.road) : null);
		if (!spot) break;
		aims.push(spot);
		state.shells.push({
			id: state.nextId++,
			kind,
			fromX: origin.x,
			fromY: origin.y,
			toX: spot.x,
			toY: spot.y,
			ageMs: -i * gap,
			flightMs: stats.flightMs,
			damage: stats.damage,
			radius: stats.splashRadius
		});
		events.push({
			type: 'shell-launched',
			kind,
			slot,
			fromX: origin.x,
			fromY: origin.y,
			toX: spot.x,
			toY: spot.y
		});
	}
	return aims[0] ?? null;
};

const fireNest: Fire = (state, random, slot, _defense, origin, stats, events) => {
	// Fog blinds the drones: they see less far and hit softer
	const weather = WEATHER[state.weather];
	const foggy = {
		...stats,
		range: stats.range * weather.fpvRange,
		damage: stats.damage * weather.fpvPower
	};
	const incoming = incomingDamage(state.projectiles, 'fpv');
	let last: Point | null = null;
	for (let i = 0; i < stats.volley; i++) {
		const target = pickNestTarget(state.soldiers, origin, foggy, incoming);
		if (!target) break;
		launchFpv(state, random, origin, foggy, target);
		incoming.set(target.id, (incoming.get(target.id) ?? 0) + foggy.damage);
		events.push({ type: 'drone-launched', slot, x: origin.x, y: origin.y });
		last = target;
	}
	return last;
};

const firePatriot: Fire = (state, _random, slot, _defense, origin, stats, events) => {
	const incoming = incomingDamage(state.projectiles, 'missile');
	let last: Point | null = null;
	for (let i = 0; i < stats.volley; i++) {
		const target = pickPatriotTarget(state.flyers, origin, stats, incoming);
		if (!target) break;
		launchMissile(state, origin, stats, target);
		incoming.set(target.id, (incoming.get(target.id) ?? 0) + stats.damage);
		events.push({ type: 'missile-launched', slot, x: origin.x, y: origin.y });
		last = target;
	}
	return last;
};

const FIRE: Partial<Record<DefenseKind, Fire>> = {
	squad: fireSquad,
	gepard: fireGepard,
	sniper: fireSniper,
	mortar: fireArtillery,
	himars: fireArtillery,
	pion: fireArtillery,
	nest: fireNest,
	patriot: firePatriot
};

/** Runs the cooldowns of the shooting defenses and fires the ones that are ready */
export function fireDefenses(
	state: DroneWallState,
	random: Random,
	dtMs: number,
	events: DroneWallEvent[]
) {
	state.defenses.forEach((defense, slot) => {
		if (!defense || isGarrison(defense.kind)) return;
		const fire = FIRE[defense.kind];
		if (!fire) return;
		defense.firedMs = Math.max(0, defense.firedMs - dtMs);
		defense.cooldownMs = Math.max(0, defense.cooldownMs - dtMs);
		if (defense.cooldownMs > 0) return;

		const origin = state.map.slots[slot];
		const stats = defenseStats(defense.kind, defense.level);
		const aim = fire(state, random, slot, defense, origin, stats, events);
		if (!aim) return;
		defense.aim = Math.atan2(aim.y - origin.y, aim.x - origin.x);
		defense.cooldownMs = stats.intervalMs;
		defense.firedMs = 160;
	});
}

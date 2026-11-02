/*
 * Beachhead rules: a landing party walks from the beach towards the nearest building, shoots it
 * when it is in range, and the surviving guns shoot back. The state is a plain object, so a whole
 * attack can be simulated in a test without a canvas or a browser.
 */
import {
	BUILDINGS,
	LANDING_X,
	PAR_SECONDS,
	ROWS,
	SQUADS,
	TROOP,
	TROOPS_PER_SQUAD,
	type BuildingKind,
	type Island
} from './config.js';

export type BattleStatus = 'playing' | 'won' | 'lost';

/** What the player's shore-base upgrades change about the landing party */
export interface BattleModifiers {
	troopHp: number;
	troopDamage: number;
	troopsPerSquad: number;
}

export const DEFAULT_MODIFIERS: BattleModifiers = {
	troopHp: TROOP.hp,
	troopDamage: TROOP.damage,
	troopsPerSquad: TROOPS_PER_SQUAD
};

export interface Building {
	id: number;
	kind: BuildingKind;
	x: number;
	y: number;
	width: number;
	height: number;
	hp: number;
	maxHp: number;
	/** Milliseconds until this gun can fire again */
	cooldownMs: number;
	destroyed: boolean;
	/** Counts down after a hit, for the hit flash */
	flashMs: number;
}

export interface Troop {
	id: number;
	x: number;
	y: number;
	hp: number;
	/** The troop's full health with the current training upgrade, for the health bar */
	maxHp: number;
	cooldownMs: number;
	targetId: number | null;
	flashMs: number;
}

export type BattleEvent =
	| { kind: 'deploy'; x: number; y: number }
	| {
			kind: 'troop-shot';
			troopId: number;
			buildingId: number;
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
	  }
	| {
			kind: 'defense-shot';
			buildingId: number;
			troopId: number;
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
	  }
	| { kind: 'building-destroyed'; buildingId: number; x: number; y: number; big: boolean }
	| { kind: 'troop-down'; x: number; y: number }
	| { kind: 'won' }
	| { kind: 'lost' };

export interface BattleState {
	island: Island;
	timeMs: number;
	squadsLeft: number;
	/** Troops landed so far, for the survival share in the stars */
	deployed: number;
	/** The upgraded strength of one soldier */
	troopHp: number;
	troopDamage: number;
	troopsPerSquad: number;
	troops: Troop[];
	buildings: Building[];
	/** A building tapped by the player, which every troop heads for until it falls */
	focusId: number | null;
	status: BattleStatus;
	events: BattleEvent[];
}

export function createBattle(
	island: Island,
	modifiers: BattleModifiers = DEFAULT_MODIFIERS
): BattleState {
	return {
		island,
		timeMs: 0,
		squadsLeft: SQUADS,
		deployed: 0,
		troopHp: modifiers.troopHp,
		troopDamage: modifiers.troopDamage,
		troopsPerSquad: modifiers.troopsPerSquad,
		troops: [],
		buildings: island.buildings.map((spec, id) => {
			const stats = BUILDINGS[spec.kind];
			return {
				id,
				kind: spec.kind,
				x: spec.x,
				y: spec.y,
				width: stats.width,
				height: stats.height,
				hp: stats.hp,
				maxHp: stats.hp,
				// Stagger the first volley a little so the guns do not all fire on the same frame
				cooldownMs: (stats.reloadMs * (id % 3)) / 3,
				destroyed: false,
				flashMs: 0
			};
		}),
		focusId: null,
		status: 'playing',
		events: []
	};
}

/** Taps a building to focus the landing party on it; tapping nothing clears the focus */
export function setFocus(state: BattleState, buildingId: number | null) {
	const building = state.buildings.find((candidate) => candidate.id === buildingId);
	state.focusId = building && !building.destroyed ? building.id : null;
}

/** Lands the next squad on a beach row; false when there is no craft left or the row is off the map */
export function deploy(state: BattleState, row: number): boolean {
	if (state.status !== 'playing' || state.squadsLeft <= 0) return false;
	if (!Number.isInteger(row) || row < 0 || row >= ROWS) return false;
	const base = state.troops.length > 0 ? Math.max(...state.troops.map((troop) => troop.id)) + 1 : 0;
	for (let index = 0; index < state.troopsPerSquad; index++) {
		state.troops.push({
			id: base + index,
			x: LANDING_X,
			y: row + 0.5 + (index - (state.troopsPerSquad - 1) / 2) * 0.16,
			hp: state.troopHp,
			maxHp: state.troopHp,
			cooldownMs: index * 40,
			targetId: null,
			flashMs: 0
		});
	}
	state.squadsLeft -= 1;
	state.deployed += state.troopsPerSquad;
	state.events.push({ kind: 'deploy', x: LANDING_X, y: row + 0.5 });
	return true;
}

export function rectDistance(x: number, y: number, building: Building): number {
	const dx = Math.max(building.x - x, 0, x - (building.x + building.width));
	const dy = Math.max(building.y - y, 0, y - (building.y + building.height));
	return Math.hypot(dx, dy);
}

/** The point on a building edge closest to a troop, for moving and for aiming */
export function nearestPointOn(x: number, y: number, building: Building): { x: number; y: number } {
	return {
		x: Math.min(Math.max(x, building.x), building.x + building.width),
		y: Math.min(Math.max(y, building.y), building.y + building.height)
	};
}

function chooseTarget(state: BattleState, troop: Troop): number | null {
	const focused = state.buildings.find((building) => building.id === state.focusId);
	if (focused && !focused.destroyed) return focused.id;
	let best: Building | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const building of state.buildings) {
		if (building.destroyed) continue;
		const distance = rectDistance(troop.x, troop.y, building);
		if (distance < bestDistance - 1e-9) {
			best = building;
			bestDistance = distance;
		}
	}
	return best?.id ?? null;
}

export function stepBattle(state: BattleState, dtMs: number) {
	if (state.status !== 'playing' || dtMs <= 0) return;
	const dt = Math.min(dtMs, 100) / 1000;
	state.timeMs += Math.min(dtMs, 100);

	const buildings = new Map(state.buildings.map((building) => [building.id, building]));

	for (const troop of state.troops) {
		if (troop.hp <= 0) continue;
		troop.cooldownMs = Math.max(0, troop.cooldownMs - dtMs);
		troop.flashMs = Math.max(0, troop.flashMs - dtMs);

		let target = troop.targetId === null ? undefined : buildings.get(troop.targetId);
		if (!target || target.destroyed) {
			troop.targetId = chooseTarget(state, troop);
			target = troop.targetId === null ? undefined : buildings.get(troop.targetId);
		}
		if (!target) continue;

		let distance = rectDistance(troop.x, troop.y, target);
		if (distance > TROOP.range) {
			const point = nearestPointOn(troop.x, troop.y, target);
			const dx = point.x - troop.x;
			const dy = point.y - troop.y;
			const length = Math.hypot(dx, dy) || 1;
			const step = Math.min(TROOP.speed * dt, Math.max(0, distance - TROOP.range));
			troop.x += (dx / length) * step;
			troop.y += (dy / length) * step;
			distance = rectDistance(troop.x, troop.y, target);
		}

		// Whatever building the troop walks into is shot first: no soldier shoots through a wall
		for (const building of state.buildings) {
			if (building.destroyed || building.id === target.id) continue;
			if (rectDistance(troop.x, troop.y, building) <= TROOP.body) {
				troop.targetId = building.id;
				target = building;
				distance = rectDistance(troop.x, troop.y, building);
				break;
			}
		}

		if (distance <= TROOP.range + 0.01 && troop.cooldownMs <= 0) {
			target.hp = Math.max(0, target.hp - state.troopDamage);
			target.flashMs = 130;
			troop.cooldownMs = TROOP.attackMs;
			state.events.push({
				kind: 'troop-shot',
				troopId: troop.id,
				buildingId: target.id,
				fromX: troop.x,
				fromY: troop.y,
				toX: nearestPointOn(troop.x, troop.y, target).x,
				toY: nearestPointOn(troop.x, troop.y, target).y
			});
		}
	}

	for (const building of state.buildings) {
		building.flashMs = Math.max(0, building.flashMs - dtMs);
		if (building.destroyed || building.hp <= 0) continue;
		const stats = BUILDINGS[building.kind];
		if (stats.damage <= 0) continue;
		building.cooldownMs = Math.max(0, building.cooldownMs - dtMs);
		if (building.cooldownMs > 0) continue;

		const minRange = stats.minRange ?? 0;
		const targeting = stats.targeting ?? 'nearest';
		let target: Troop | null = null;
		// "weakest" compares health, the distance modes compare range to the building
		let bestValue = targeting === 'farthest' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
		for (const troop of state.troops) {
			if (troop.hp <= 0) continue;
			const distance = rectDistance(troop.x, troop.y, building);
			if (distance > stats.range || distance < minRange) continue;
			const value = targeting === 'weakest' ? troop.hp : distance;
			const better = targeting === 'farthest' ? value > bestValue + 1e-9 : value < bestValue - 1e-9;
			if (better) {
				target = troop;
				bestValue = value;
			}
		}
		if (!target) continue;

		target.hp = Math.max(0, target.hp - stats.damage);
		target.flashMs = 130;
		if (stats.splash > 0) {
			for (const other of state.troops) {
				if (other.id === target.id || other.hp <= 0) continue;
				if (Math.hypot(other.x - target.x, other.y - target.y) > stats.splash) continue;
				other.hp = Math.max(0, other.hp - Math.round(stats.damage * 0.6));
				other.flashMs = 130;
			}
		}
		building.cooldownMs = stats.reloadMs;
		state.events.push({
			kind: 'defense-shot',
			buildingId: building.id,
			troopId: target.id,
			fromX: building.x + building.width / 2,
			fromY: building.y + building.height / 2,
			toX: target.x,
			toY: target.y
		});
	}

	for (const troop of state.troops) {
		if (troop.hp > 0) continue;
		state.events.push({ kind: 'troop-down', x: troop.x, y: troop.y });
	}
	state.troops = state.troops.filter((troop) => troop.hp > 0);

	for (const building of state.buildings) {
		if (building.destroyed || building.hp > 0) continue;
		building.destroyed = true;
		state.events.push({
			kind: 'building-destroyed',
			buildingId: building.id,
			x: building.x + building.width / 2,
			y: building.y + building.height / 2,
			big: building.kind === 'hq'
		});
		if (building.kind === 'hq') {
			state.status = 'won';
			state.events.push({ kind: 'won' });
		}
	}

	if (state.status === 'won') return;
	if (state.troops.length === 0 && state.squadsLeft === 0) {
		state.status = 'lost';
		state.events.push({ kind: 'lost' });
	}
}

/** Destruction and surviving troops make the score; a quick win adds a small bonus */
export function scoreOf(state: BattleState): number {
	const destroyed = state.buildings.reduce(
		(sum, building) => sum + (building.destroyed ? BUILDINGS[building.kind].score : 0),
		0
	);
	const survivors = state.troops.reduce((sum, troop) => sum + Math.round(troop.hp / 10), 0);
	const seconds = state.timeMs / 1000;
	const timeBonus = state.status === 'won' ? Math.round(Math.max(0, PAR_SECONDS - seconds) * 5) : 0;
	return destroyed + survivors + timeBonus;
}

/** One star for a win, more for bringing most of the landing party home */
export function starsOf(state: BattleState): number {
	if (state.status !== 'won') return 0;
	const remaining = state.troops.reduce((sum, troop) => sum + troop.hp, 0);
	const share = state.deployed > 0 ? remaining / (state.deployed * state.troopHp) : 0;
	if (share >= 0.5) return 3;
	if (share >= 0.25) return 2;
	return 1;
}

/** Troops still on the beach, for the HUD */
export function troopsAlive(state: BattleState): number {
	return state.troops.filter((troop) => troop.hp > 0).length;
}

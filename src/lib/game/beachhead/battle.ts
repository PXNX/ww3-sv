/*
 * Beachhead rules: a landing party walks from the beach towards the nearest building, shoots it
 * when it is in range, and the surviving guns shoot back. The state is a plain object, so a whole
 * attack can be simulated in a test without a canvas or a browser.
 */
import {
	BUILDINGS,
	COLUMNS,
	LANDING_X,
	PAR_SECONDS,
	ROWS,
	SKILLS,
	SKILL_ENERGY,
	SQUADS,
	TROOP,
	TROOPS,
	TROOPS_PER_SQUAD,
	type BuildingKind,
	type Island,
	type ProjectileKind,
	type SkillId,
	type TroopKind
} from './config.js';

export type BattleStatus = 'playing' | 'won' | 'lost';

/** One soldier as the shore base has trained them, including boat type and level bonuses */
export interface SquadTroop {
	kind: TroopKind;
	hp: number;
	damage: number;
	range: number;
	speed: number;
	attackMs: number;
	projectile?: ProjectileKind;
	projectileSpeed?: number;
	splash?: number;
	homing?: boolean;
	/** How far a shot can land from its aim point */
	scatter?: number;
	/** The M113 drops reinforcements while it lives */
	spawnKind?: TroopKind;
	spawnEveryMs?: number;
	spawnCap?: number;
	healRadius?: number;
	healAmount?: number;
	healEveryMs?: number;
}

/** What the player's shore base and army change about the landing party */
export interface BattleModifiers {
	/** One entry per boat, in the order the boats land */
	squads: readonly (readonly SquadTroop[])[];
}

const RIFLEMAN: SquadTroop = {
	kind: 'assault',
	hp: TROOPS.assault.hp,
	damage: TROOPS.assault.damage,
	range: TROOPS.assault.range,
	speed: TROOPS.assault.speed,
	attackMs: TROOPS.assault.attackMs
};

export const DEFAULT_MODIFIERS: BattleModifiers = {
	squads: Array.from({ length: SQUADS }, () =>
		Array.from({ length: TROOPS_PER_SQUAD }, () => RIFLEMAN)
	)
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
	/** Counts down after firing, for the recoil kick */
	recoilMs: number;
}

export interface Troop {
	id: number;
	kind: TroopKind;
	x: number;
	y: number;
	hp: number;
	/** The troop's full health with the current training upgrade, for the health bar */
	maxHp: number;
	/** This unit's attack, range and reload, from its type and training level */
	damage: number;
	range: number;
	speed: number;
	attackMs: number;
	projectile?: ProjectileKind;
	projectileSpeed?: number;
	splash?: number;
	homing?: boolean;
	/** How far a shot can land from its aim point */
	scatter?: number;
	/** The M113 drops reinforcements while it lives */
	spawnKind?: TroopKind;
	spawnEveryMs?: number;
	spawnCap?: number;
	spawnCooldownMs: number;
	/** Set on units an APC has dropped, so its cap counts them */
	spawnedBy?: number;
	/** Medics and the hero patch up the troops around them */
	healRadius?: number;
	healAmount?: number;
	healEveryMs?: number;
	healCooldownMs: number;
	cooldownMs: number;
	targetId: number | null;
	flashMs: number;
	/** Blast velocity, in grid cells per second; it fades away with drag */
	vx: number;
	vy: number;
	/** Time left too shaken to move or shoot */
	stunMs: number;
	/** Time left on the muzzle flash */
	muzzleMs: number;
	/** Unit vector the soldier is looking along, for the rifle and the muzzle flash */
	aimX: number;
	aimY: number;
	/** Advances while walking, for the little step bob */
	walkPhase: number;
	/** True while the soldier is moving towards a target this frame */
	moving: boolean;
}

/** A shell, rocket or drone in flight; damage is applied when it lands */
export interface Projectile {
	id: number;
	kind: ProjectileKind;
	/** True for a shell the landing party fired at a building */
	friendly: boolean;
	sourceId: number;
	targetId: number;
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	x: number;
	y: number;
	ageMs: number;
	flightMs: number;
	damage: number;
	splash: number;
	homing: boolean;
}

/** A flare, smoke cloud or healing circle left on the island for a few seconds */
export interface SkillZone {
	x: number;
	y: number;
	radius: number;
	remainingMs: number;
	durationMs: number;
}

/** A missile or barrage shell on its way down from off the island */
export interface SkillStrike {
	id: number;
	skill: SkillId;
	x: number;
	y: number;
	radius: number;
	damage: number;
	ageMs: number;
	delayMs: number;
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
			/** Set for a tank, mortar team or drone operator */
			troopKind?: TroopKind;
			/** Set when the damage lands with a projectile instead of instantly */
			flightMs?: number;
	  }
	| { kind: 'troop-heal'; x: number; y: number; amount: number; hero: boolean }
	| { kind: 'troop-spawn'; x: number; y: number; troopKind: TroopKind }
	| {
			kind: 'defense-shot';
			buildingId: number;
			troopId: number;
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
			weapon: BuildingKind;
			/** Set for guns whose damage lands when the projectile arrives */
			flightMs?: number;
	  }
	| {
			kind: 'projectile-impact';
			projectileKind: ProjectileKind;
			x: number;
			y: number;
			radius: number;
			hits: number;
	  }
	| {
			kind: 'skill-cast';
			skill: SkillId;
			x: number;
			y: number;
			cost: number;
			energy: number;
	  }
	| {
			kind: 'skill-impact';
			skill: SkillId;
			x: number;
			y: number;
			radius: number;
			hits: number;
	  }
	| { kind: 'building-destroyed'; buildingId: number; x: number; y: number; big: boolean }
	| { kind: 'troop-down'; x: number; y: number }
	| { kind: 'won' }
	| { kind: 'lost' };

export interface BattleState {
	island: Island;
	timeMs: number;
	squadsLeft: number;
	/** The boats still waiting offshore, with the units packed into each */
	squads: SquadTroop[][];
	/** Troops landed so far, for the survival share in the stars */
	deployed: number;
	/** Total health that has landed, so a party of tanks is judged fairly */
	deployedHp: number;
	troops: Troop[];
	buildings: Building[];
	/** Shells, rockets and drones still in the air */
	projectiles: Projectile[];
	/** Missiles and barrage shells still on their way down */
	strikes: SkillStrike[];
	/** Energy for support skills; every call makes the next one more expensive */
	energy: number;
	skillsUsed: number;
	/** Active support zones, one of each kind at a time */
	flare: SkillZone | null;
	smoke: SkillZone | null;
	heal: SkillZone | null;
	/** A building tapped by the player, which every troop heads for until it falls */
	focusId: number | null;
	status: BattleStatus;
	events: BattleEvent[];
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function copySquad(squad: readonly SquadTroop[]): SquadTroop[] {
	return squad.map((troop) => ({ ...troop }));
}

export function createBattle(
	island: Island,
	modifiers: BattleModifiers = DEFAULT_MODIFIERS
): BattleState {
	const squads = modifiers.squads.map(copySquad);
	return {
		island,
		timeMs: 0,
		squadsLeft: squads.length,
		squads,
		deployed: 0,
		deployedHp: 0,
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
				flashMs: 0,
				recoilMs: 0
			};
		}),
		projectiles: [],
		strikes: [],
		energy: SKILL_ENERGY.start,
		skillsUsed: 0,
		flare: null,
		smoke: null,
		heal: null,
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

/** What the next support skill costs; every call raises the price for the rest of the attack */
export function skillCost(state: BattleState): number {
	return SKILL_ENERGY.baseCost + SKILL_ENERGY.costStep * state.skillsUsed;
}

export function canCastSkill(state: BattleState): boolean {
	return state.status === 'playing' && state.energy >= skillCost(state);
}

/** A small fixed pattern, so a barrage always covers the aim point the same way in tests */
const BARRAGE_OFFSETS: readonly { x: number; y: number }[] = [
	{ x: 0, y: 0 },
	{ x: 0.9, y: 0.35 },
	{ x: -0.85, y: 0.6 },
	{ x: 0.55, y: -0.9 },
	{ x: -0.6, y: -0.5 },
	{ x: 0.1, y: 1.05 }
];

function skillZone(x: number, y: number, radius: number, durationMs: number): SkillZone {
	return { x, y, radius, remainingMs: durationMs, durationMs };
}

/**
 * Calls in a support skill at a point on the island. The cost rises with every call in the battle,
 * so the player has to choose between many small calls and a few decisive ones.
 */
export function castSkill(state: BattleState, skill: SkillId, x: number, y: number): boolean {
	if (!canCastSkill(state)) return false;
	const stats = SKILLS[skill];
	if (!stats) return false;
	const cost = skillCost(state);
	const aimX = clamp(Number.isFinite(x) ? x : 0, 0, COLUMNS);
	const aimY = clamp(Number.isFinite(y) ? y : 0, 0, ROWS);
	state.energy -= cost;
	state.skillsUsed += 1;
	state.events.push({ kind: 'skill-cast', skill, x: aimX, y: aimY, cost, energy: state.energy });

	if (skill === 'flamingo' || skill === 'barrage') {
		const shells = skill === 'barrage' ? (stats.shells ?? 1) : 1;
		const baseId = state.strikes.reduce((highest, strike) => Math.max(highest, strike.id), 0) + 1;
		const nextId = state.projectiles.reduce(
			(highest, projectile) => Math.max(highest, projectile.id),
			baseId - 1
		);
		for (let shell = 0; shell < shells; shell++) {
			const offset =
				skill === 'barrage' ? BARRAGE_OFFSETS[shell % BARRAGE_OFFSETS.length] : { x: 0, y: 0 };
			const scatter = skill === 'barrage' ? (stats.scatter ?? 1) : 0;
			state.strikes.push({
				id: nextId + shell + 1,
				skill,
				x: clamp(aimX + offset.x * scatter, 0.15, COLUMNS - 0.15),
				y: clamp(aimY + offset.y * scatter, 0.15, ROWS - 0.15),
				radius: stats.radius,
				damage: stats.damage,
				ageMs: 0,
				delayMs: stats.delayMs + shell * 115
			});
		}
		return true;
	}

	const duration = stats.durationMs ?? 6000;
	const zone = skillZone(aimX, aimY, stats.radius, duration);
	if (skill === 'flare') state.flare = zone;
	else if (skill === 'smoke') state.smoke = zone;
	else if (skill === 'heal') state.heal = zone;
	return true;
}

function insideZone(zone: SkillZone | null, x: number, y: number): boolean {
	return zone !== null && Math.hypot(x - zone.x, y - zone.y) <= zone.radius;
}

/** Lands the next boat on a beach row; false when there is no craft left or the row is off the map */
export function deploy(state: BattleState, row: number): boolean {
	if (state.status !== 'playing' || state.squadsLeft <= 0) return false;
	if (!Number.isInteger(row) || row < 0 || row >= ROWS) return false;
	const squad = state.squads.shift();
	if (!squad || squad.length === 0) return false;
	const base = state.troops.length > 0 ? Math.max(...state.troops.map((troop) => troop.id)) + 1 : 0;
	squad.forEach((spec, index) => {
		state.troops.push({
			...spec,
			id: base + index,
			x: LANDING_X,
			y: row + 0.5 + (index - (squad.length - 1) / 2) * 0.16,
			hp: spec.hp,
			maxHp: spec.hp,
			healCooldownMs: (spec.healEveryMs ?? 0) * 0.5,
			spawnCooldownMs: spec.spawnEveryMs ?? 0,
			cooldownMs: index * 40,
			targetId: null,
			flashMs: 0,
			vx: 0,
			vy: 0,
			stunMs: 0,
			muzzleMs: 0,
			aimX: 1,
			aimY: 0,
			walkPhase: index * 1.7,
			moving: false
		});
		state.deployedHp += spec.hp;
	});
	state.squadsLeft = state.squads.length;
	state.deployed += squad.length;
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

/** Pushes a troop away from a blast; exported so the physics is easy to pin down in a test */
export function applyBlast(
	troop: Troop,
	fromX: number,
	fromY: number,
	force = TROOP.knockback,
	stunMs = TROOP.stunMs
) {
	const dx = troop.x - fromX;
	const dy = troop.y - fromY;
	const length = Math.hypot(dx, dy) || 1;
	troop.vx += (dx / length) * force;
	troop.vy += (dy / length) * force;
	troop.stunMs = Math.max(troop.stunMs, stunMs);
}

function aimAt(troop: Troop, x: number, y: number) {
	const dx = x - troop.x;
	const dy = y - troop.y;
	const length = Math.hypot(dx, dy) || 1;
	troop.aimX = dx / length;
	troop.aimY = dy / length;
}

/** Keeps a soldier on the island and out of the solid buildings */
function settleTroop(state: BattleState, troop: Troop) {
	troop.x = clamp(troop.x, 0.35, COLUMNS - 0.2);
	troop.y = clamp(troop.y, 0.2, ROWS - 0.2);
	for (const building of state.buildings) {
		if (building.destroyed) continue;
		const left = building.x - TROOP.body;
		const right = building.x + building.width + TROOP.body;
		const top = building.y - TROOP.body;
		const bottom = building.y + building.height + TROOP.body;
		if (troop.x <= left || troop.x >= right || troop.y <= top || troop.y >= bottom) continue;
		// Push out through the closest edge instead of letting the soldier stand inside a wall
		const exits = [
			{ distance: troop.x - left, x: left, y: troop.y },
			{ distance: right - troop.x, x: right, y: troop.y },
			{ distance: troop.y - top, x: troop.x, y: top },
			{ distance: bottom - troop.y, x: troop.x, y: bottom }
		];
		const exit = exits.reduce((best, candidate) =>
			candidate.distance < best.distance ? candidate : best
		);
		troop.x = clamp(exit.x, 0.35, COLUMNS - 0.2);
		troop.y = clamp(exit.y, 0.2, ROWS - 0.2);
	}
}

function solvePhysics(state: BattleState, troop: Troop, dt: number) {
	const speed = Math.hypot(troop.vx, troop.vy);
	if (speed > 0.01) {
		troop.x += troop.vx * dt;
		troop.y += troop.vy * dt;
		settleTroop(state, troop);
		const drag = Math.exp(-TROOP.drag * dt);
		troop.vx *= drag;
		troop.vy *= drag;
	} else {
		troop.vx = 0;
		troop.vy = 0;
	}
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

function damageTroop(
	state: BattleState,
	troop: Troop,
	amount: number,
	fromX: number,
	fromY: number,
	splash: number
) {
	troop.hp = Math.max(0, troop.hp - Math.round(amount));
	troop.flashMs = 130;
	if (splash > 0) applyBlast(troop, fromX, fromY);
}

function woundWithSplash(
	state: BattleState,
	target: Troop,
	damage: number,
	fromX: number,
	fromY: number,
	splash: number
) {
	damageTroop(state, target, damage, fromX, fromY, splash);
	for (const other of state.troops) {
		if (other.id === target.id || other.hp <= 0) continue;
		if (Math.hypot(other.x - target.x, other.y - target.y) > splash) continue;
		damageTroop(state, other, damage * 0.6, fromX, fromY, splash);
	}
}

function landProjectile(state: BattleState, projectile: Projectile) {
	const radius = Math.max(0.35, projectile.splash);
	if (projectile.friendly) {
		// A tank shell, mortar bomb or drone strike: damage the buildings around the impact
		let hits = 0;
		for (const building of state.buildings) {
			if (building.destroyed || building.hp <= 0) continue;
			const primary = building.id === projectile.targetId;
			if (
				rectDistance(projectile.x, projectile.y, building) > (primary ? radius : projectile.splash)
			) {
				continue;
			}
			building.hp = Math.max(0, building.hp - Math.round(projectile.damage * (primary ? 1 : 0.6)));
			building.flashMs = 130;
			hits += 1;
		}
		state.events.push({
			kind: 'projectile-impact',
			projectileKind: projectile.kind,
			x: projectile.x,
			y: projectile.y,
			radius,
			hits
		});
		return;
	}
	let hits = 0;
	for (const troop of state.troops) {
		if (troop.hp <= 0) continue;
		const distance = Math.hypot(troop.x - projectile.x, troop.y - projectile.y);
		const primary = troop.id === projectile.targetId;
		if (distance > (primary ? radius : projectile.splash)) continue;
		// A shell aimed at a spot can miss; a homing rocket or drone follows its target
		if (primary && projectile.splash <= 0 && distance > radius) continue;
		damageTroop(
			state,
			troop,
			projectile.damage * (primary ? 1 : 0.6),
			projectile.x,
			projectile.y,
			projectile.splash
		);
		hits += 1;
	}
	state.events.push({
		kind: 'projectile-impact',
		projectileKind: projectile.kind,
		x: projectile.x,
		y: projectile.y,
		radius,
		hits
	});
}

function stepProjectiles(state: BattleState, frameMs: number) {
	const flying: Projectile[] = [];
	for (const projectile of state.projectiles) {
		projectile.ageMs += frameMs;
		const target = state.troops.find((troop) => troop.id === projectile.targetId && troop.hp > 0);
		if (projectile.homing && target) {
			projectile.toX = target.x;
			projectile.toY = target.y;
		}
		const progress = Math.min(1, projectile.ageMs / projectile.flightMs);
		projectile.x = projectile.fromX + (projectile.toX - projectile.fromX) * progress;
		projectile.y = projectile.fromY + (projectile.toY - projectile.fromY) * progress;
		if (projectile.ageMs >= projectile.flightMs) landProjectile(state, projectile);
		else flying.push(projectile);
	}
	state.projectiles = flying;
}

function stepSkillStrikes(state: BattleState, frameMs: number) {
	const waiting: SkillStrike[] = [];
	for (const strike of state.strikes) {
		strike.ageMs += frameMs;
		if (strike.ageMs < strike.delayMs) {
			waiting.push(strike);
			continue;
		}
		let hits = 0;
		for (const building of state.buildings) {
			if (building.destroyed || building.hp <= 0) continue;
			if (rectDistance(strike.x, strike.y, building) > strike.radius) continue;
			building.hp = Math.max(0, building.hp - Math.round(strike.damage));
			building.flashMs = 130;
			hits += 1;
		}
		state.events.push({
			kind: 'skill-impact',
			skill: strike.skill,
			x: strike.x,
			y: strike.y,
			radius: strike.radius,
			hits
		});
	}
	state.strikes = waiting;
}

function stepSkillZones(state: BattleState, frameMs: number) {
	const tick = (zone: SkillZone | null): SkillZone | null => {
		if (!zone) return null;
		zone.remainingMs -= frameMs;
		return zone.remainingMs > 0 ? zone : null;
	};
	state.flare = tick(state.flare);
	state.smoke = tick(state.smoke);
	state.heal = tick(state.heal);

	if (!state.heal) return;
	const healing = (SKILLS.heal.healPerSecond ?? 0) * (frameMs / 1000);
	if (healing <= 0) return;
	for (const troop of state.troops) {
		if (troop.hp <= 0 || !insideZone(state.heal, troop.x, troop.y)) continue;
		troop.hp = Math.min(troop.maxHp, troop.hp + healing);
	}
}

/** The next free id for a troop that lands or is dropped mid-battle */
function nextTroopId(state: BattleState): number {
	return state.troops.reduce((highest, troop) => Math.max(highest, troop.id), -1) + 1;
}

/** One reinforcement as the M113 drops it: the spawned kind at its base stats */
function spawnedTroop(state: BattleState, source: Troop, kind: TroopKind, index: number): Troop {
	const stats = TROOPS[kind];
	const angle = (index / 4) * Math.PI * 2 + source.id;
	return {
		kind,
		hp: stats.hp,
		maxHp: stats.hp,
		damage: stats.damage,
		range: stats.range,
		speed: stats.speed,
		attackMs: stats.attackMs,
		projectile: stats.projectile,
		projectileSpeed: stats.projectileSpeed,
		splash: stats.splash,
		homing: stats.homing,
		scatter: stats.scatter,
		spawnKind: stats.spawnKind,
		spawnEveryMs: stats.spawnEveryMs,
		spawnCap: stats.spawnCap,
		healRadius: stats.healRadius,
		healAmount: stats.healAmount,
		healEveryMs: stats.healEveryMs,
		healCooldownMs: 0,
		spawnCooldownMs: 0,
		spawnedBy: source.id,
		id: nextTroopId(state) + index,
		x: clamp(source.x + Math.cos(angle) * 0.3, LANDING_X, COLUMNS - 0.3),
		y: clamp(source.y + Math.sin(angle) * 0.3, 0.3, ROWS - 0.3),
		cooldownMs: index * 90,
		targetId: null,
		flashMs: 0,
		vx: 0,
		vy: 0,
		stunMs: 0,
		muzzleMs: 0,
		aimX: 1,
		aimY: 0,
		walkPhase: index * 1.3,
		moving: false
	};
}

/** APCs keep spawning reinforcements up to their cap while they are alive */
function stepTroopSpawning(state: BattleState, frameMs: number) {
	for (const troop of state.troops) {
		if (troop.hp <= 0 || !troop.spawnKind || !troop.spawnEveryMs) continue;
		troop.spawnCooldownMs -= frameMs;
		if (troop.spawnCooldownMs > 0) continue;
		troop.spawnCooldownMs += troop.spawnEveryMs;
		const alive = state.troops.filter(
			(candidate) => candidate.hp > 0 && candidate.spawnedBy === troop.id
		).length;
		if (alive >= (troop.spawnCap ?? 0)) continue;
		const spawn = spawnedTroop(state, troop, troop.spawnKind, alive);
		state.troops.push(spawn);
		state.deployed += 1;
		state.deployedHp += spawn.maxHp;
		state.events.push({
			kind: 'troop-spawn',
			x: spawn.x,
			y: spawn.y,
			troopKind: spawn.kind
		});
	}
}

function stepTroopHealing(state: BattleState, frameMs: number) {
	for (const troop of state.troops) {
		if (troop.hp <= 0 || !troop.healRadius || !troop.healAmount || !troop.healEveryMs) continue;
		troop.healCooldownMs -= frameMs;
		if (troop.healCooldownMs > 0) continue;
		troop.healCooldownMs += troop.healEveryMs;
		let healed = 0;
		for (const ally of state.troops) {
			if (ally.hp <= 0 || ally.hp >= ally.maxHp) continue;
			if (Math.hypot(ally.x - troop.x, ally.y - troop.y) > troop.healRadius) continue;
			const amount = Math.min(ally.maxHp - ally.hp, troop.healAmount);
			ally.hp += amount;
			healed += amount;
		}
		if (healed < 1) continue;
		state.events.push({
			kind: 'troop-heal',
			x: troop.x,
			y: troop.y,
			amount: Math.round(healed),
			hero: troop.kind === 'hero'
		});
	}
}

export function stepBattle(state: BattleState, dtMs: number) {
	if (state.status !== 'playing' || dtMs <= 0) return;
	const frameMs = Math.min(dtMs, 100);
	const dt = frameMs / 1000;
	state.timeMs += frameMs;

	stepSkillZones(state, frameMs);
	stepSkillStrikes(state, frameMs);
	stepProjectiles(state, frameMs);

	const buildings = new Map(state.buildings.map((building) => [building.id, building]));

	for (const troop of state.troops) {
		if (troop.hp <= 0) continue;
		troop.cooldownMs = Math.max(0, troop.cooldownMs - frameMs);
		troop.flashMs = Math.max(0, troop.flashMs - frameMs);
		troop.muzzleMs = Math.max(0, troop.muzzleMs - frameMs);
		troop.stunMs = Math.max(0, troop.stunMs - frameMs);
		troop.moving = false;

		// Blast velocity moves the soldier even while stunned, then the drag takes over
		solvePhysics(state, troop, dt);
		if (troop.stunMs > 0) continue;

		// A flare is a movement order: walk to the marker, but still shoot anything in range
		let marchingToFlare = false;
		if (state.flare) {
			const dx = state.flare.x - troop.x;
			const dy = state.flare.y - troop.y;
			const length = Math.hypot(dx, dy);
			if (length > 0.35) {
				const step = Math.min(troop.speed * dt, length);
				troop.x += (dx / length) * step;
				troop.y += (dy / length) * step;
				troop.walkPhase += dt * 12;
				troop.moving = step > 0;
				marchingToFlare = true;
				aimAt(troop, state.flare.x, state.flare.y);
				settleTroop(state, troop);
			}
		}

		let target = troop.targetId === null ? undefined : buildings.get(troop.targetId);
		if (!target || target.destroyed) {
			troop.targetId = chooseTarget(state, troop);
			target = troop.targetId === null ? undefined : buildings.get(troop.targetId);
		}
		if (!target) continue;

		let distance = rectDistance(troop.x, troop.y, target);
		if (!marchingToFlare && distance > troop.range) {
			const point = nearestPointOn(troop.x, troop.y, target);
			const dx = point.x - troop.x;
			const dy = point.y - troop.y;
			const length = Math.hypot(dx, dy) || 1;
			const step = Math.min(troop.speed * dt, Math.max(0, distance - troop.range));
			troop.x += (dx / length) * step;
			troop.y += (dy / length) * step;
			troop.walkPhase += dt * 12;
			troop.moving = step > 0;
			aimAt(troop, point.x, point.y);
			settleTroop(state, troop);
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

		const point = nearestPointOn(troop.x, troop.y, target);
		aimAt(troop, point.x, point.y);
		if (distance <= troop.range + 0.01 && troop.cooldownMs <= 0) {
			troop.cooldownMs = troop.attackMs;
			troop.muzzleMs = TROOP.muzzleMs;
			if (troop.projectile) {
				// Inaccurate artillery lands around the aim point rather than on it
				const scatter = troop.scatter ?? 0;
				const wander = state.timeMs * 0.0011 + troop.id * 2.399;
				const impactX =
					scatter === 0
						? point.x
						: clamp(
								point.x +
									Math.cos(wander) * scatter * (0.4 + 0.6 * Math.abs(Math.sin(wander * 1.7))),
								0.15,
								COLUMNS - 0.15
							);
				const impactY =
					scatter === 0
						? point.y
						: clamp(
								point.y +
									Math.sin(wander) * scatter * (0.4 + 0.6 * Math.abs(Math.cos(wander * 1.3))),
								0.15,
								ROWS - 0.15
							);
				const flightMs = Math.round(
					clamp((distance / (troop.projectileSpeed ?? 9)) * 1000, 220, 900)
				);
				state.projectiles.push({
					id:
						state.projectiles.reduce((highest, projectile) => Math.max(highest, projectile.id), 0) +
						1,
					kind: troop.projectile,
					friendly: true,
					sourceId: troop.id,
					targetId: target.id,
					fromX: troop.x + troop.aimX * 0.22,
					fromY: troop.y + troop.aimY * 0.22,
					toX: impactX,
					toY: impactY,
					x: troop.x + troop.aimX * 0.22,
					y: troop.y + troop.aimY * 0.22,
					ageMs: 0,
					flightMs,
					damage: troop.damage,
					splash: troop.splash ?? 0,
					homing: troop.homing ?? false
				});
				state.events.push({
					kind: 'troop-shot',
					troopId: troop.id,
					buildingId: target.id,
					fromX: troop.x + troop.aimX * 0.22,
					fromY: troop.y + troop.aimY * 0.22,
					toX: impactX,
					toY: impactY,
					troopKind: troop.kind,
					flightMs
				});
			} else {
				target.hp = Math.max(0, target.hp - troop.damage);
				target.flashMs = 130;
				state.events.push({
					kind: 'troop-shot',
					troopId: troop.id,
					buildingId: target.id,
					fromX: troop.x + troop.aimX * 0.22,
					fromY: troop.y + troop.aimY * 0.22,
					toX: point.x,
					toY: point.y,
					troopKind: troop.kind
				});
			}
		}
	}

	stepTroopSpawning(state, frameMs);
	stepTroopHealing(state, frameMs);

	for (const building of state.buildings) {
		building.flashMs = Math.max(0, building.flashMs - frameMs);
		building.recoilMs = Math.max(0, building.recoilMs - frameMs);
		if (building.destroyed || building.hp <= 0) continue;
		const stats = BUILDINGS[building.kind];
		if (stats.damage <= 0) continue;
		building.cooldownMs = Math.max(0, building.cooldownMs - frameMs);
		if (building.cooldownMs > 0) continue;

		const minRange = stats.minRange ?? 0;
		const targeting = stats.targeting ?? 'nearest';
		let target: Troop | null = null;
		// "weakest" compares health, the distance modes compare range to the building
		let bestValue = targeting === 'farthest' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
		for (const troop of state.troops) {
			if (troop.hp <= 0) continue;
			// A smoke screen hides every soldier inside it from the defenders
			if (insideZone(state.smoke, troop.x, troop.y)) continue;
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

		const centerX = building.x + building.width / 2;
		const centerY = building.y + building.height / 2;
		building.recoilMs = 170;
		const event = {
			kind: 'defense-shot' as const,
			buildingId: building.id,
			troopId: target.id,
			fromX: centerX,
			fromY: centerY,
			toX: target.x,
			toY: target.y,
			weapon: building.kind
		};

		if (stats.projectile) {
			const distance = Math.hypot(target.x - centerX, target.y - centerY);
			const flightMs = Math.round(
				clamp((distance / (stats.projectileSpeed ?? 10)) * 1000, 220, 900)
			);
			state.projectiles.push({
				id:
					state.projectiles.reduce((highest, projectile) => Math.max(highest, projectile.id), 0) +
					1,
				kind: stats.projectile,
				friendly: false,
				sourceId: building.id,
				targetId: target.id,
				fromX: centerX,
				fromY: centerY,
				toX: target.x,
				toY: target.y,
				x: centerX,
				y: centerY,
				ageMs: 0,
				flightMs,
				damage: stats.damage,
				splash: stats.splash,
				homing: stats.homing ?? false
			});
			state.events.push({ ...event, flightMs });
		} else {
			woundWithSplash(state, target, stats.damage, centerX, centerY, stats.splash);
			state.events.push(event);
		}
		building.cooldownMs = stats.reloadMs;
	}

	for (const troop of state.troops) {
		if (troop.hp > 0) continue;
		state.events.push({ kind: 'troop-down', x: troop.x, y: troop.y });
	}
	state.troops = state.troops.filter((troop) => troop.hp > 0);

	for (const building of state.buildings) {
		if (building.destroyed || building.hp > 0) continue;
		building.destroyed = true;
		// Wrecking a structure recharges the support skills a little, so a long assault can keep going
		state.energy = Math.min(SKILL_ENERGY.max, state.energy + SKILL_ENERGY.rewardPerBuilding);
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
	const share = state.deployedHp > 0 ? remaining / state.deployedHp : 0;
	if (share >= 0.5) return 3;
	if (share >= 0.25) return 2;
	return 1;
}

/** Troops still on the beach, for the HUD */
export function troopsAlive(state: BattleState): number {
	return state.troops.filter((troop) => troop.hp > 0).length;
}

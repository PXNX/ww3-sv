/*
 * War Room rules as a plain turn-based state machine. A day is one production step and one round
 * of orders: income and factories run, training advances, morale recovers, then the Pact moves.
 * Combat is one exchange of dice between two stacks; terrain, morale and supply decide it.
 */
import type { Random } from '#lib/game/random.js';
import {
	AI_ATTACK_RATIO,
	COMBAT_LUCK,
	ENEMY_MAX_DIVISIONS,
	ENEMY_REINFORCE_EVERY,
	MAX_DAYS,
	EXP_COMBAT_BONUS,
	EXP_GAIN_PER_DAY,
	EXP_MAX,
	EXERCISE_EXP_GAIN,
	EXERCISE_MORALE_LOSS,
	EXERCISE_SUPPLY_COST,
	MORALE_REGEN,
	MORALE_REGEN_LOW,
	REGION_IDS,
	SCORE_DAY_BONUS,
	SCORE_LOSS_PENALTY,
	SCORE_PER_KILL,
	SCORE_PER_REGION,
	SCORE_WIN_BONUS,
	START_DIVISIONS,
	START_EQUIPMENT,
	START_OWNER,
	START_RESOURCES,
	SUPPLY_CUT,
	SUPPLY_DISTANCE_PENALTY,
	SUPPLY_FLOOR,
	TERRAIN_DEFENCE,
	areNeighbors,
	factoryDef,
	regionDef,
	templateDef,
	type FactoryId,
	type Owner,
	type RegionId,
	type TemplateId
} from './config.js';
import type { Division, Outcome, TrainingItem, WarRoomEvent, WarRoomState } from './types.js';

function emptyDivisions(): Record<RegionId, Division[]> {
	const divisions = {} as Record<RegionId, Division[]>;
	for (const id of REGION_IDS) divisions[id] = [];
	return divisions;
}

/** A brand-new campaign, with the starting divisions already in place */
export function createWarRoom(): WarRoomState {
	const state: WarRoomState = {
		day: 1,
		owner: { ...START_OWNER },
		divisions: emptyDivisions(),
		buildings: [],
		resources: { ...START_RESOURCES },
		equipment: { ...START_EQUIPMENT },
		training: [],
		moved: [],
		nextId: 1,
		kills: 0,
		losses: 0,
		outcome: null,
		score: 0
	};
	for (const seed of START_DIVISIONS) {
		state.divisions[seed.region].push({
			id: state.nextId++,
			template: seed.template,
			morale: templateDef(seed.template).morale,
			experience: 1
		});
	}
	return state;
}

export function regionsOwnedBy(state: WarRoomState, owner: Owner): RegionId[] {
	return REGION_IDS.filter((id) => state.owner[id] === owner);
}

export function heldRegions(state: WarRoomState): number {
	return regionsOwnedBy(state, 'player').length;
}

export function totalDivisions(state: WarRoomState, owner: Owner): number {
	return regionsOwnedBy(state, owner).reduce((sum, id) => sum + state.divisions[id].length, 0);
}

export function demandIn(state: WarRoomState, region: RegionId): number {
	return state.divisions[region].reduce(
		(sum, division) => sum + templateDef(division.template).supplyUse,
		0
	);
}

/**
 * Supply in every region: distance from the capital through friendly territory decides the base,
 * and a region carrying more divisions than its capacity cuts everyone there short.
 */
export function supplyMap(state: WarRoomState): Record<RegionId, number> {
	const result = Object.fromEntries(REGION_IDS.map((id) => [id, 0])) as Record<RegionId, number>;
	for (const owner of ['player', 'enemy'] as const) {
		const capital: RegionId = owner === 'player' ? 'capital' : 'redcapital';
		const distance = new Map<RegionId, number>();
		if (state.owner[capital] === owner) {
			distance.set(capital, 0);
			const queue: RegionId[] = [capital];
			while (queue.length > 0) {
				const current = queue.shift()!;
				const steps = distance.get(current)!;
				for (const neighbor of regionDef(current).neighbors) {
					if (state.owner[neighbor] !== owner || distance.has(neighbor)) continue;
					distance.set(neighbor, steps + 1);
					queue.push(neighbor);
				}
			}
		}
		for (const region of REGION_IDS) {
			if (state.owner[region] !== owner) continue;
			const steps = distance.get(region);
			const base =
				steps === undefined
					? SUPPLY_CUT
					: Math.max(SUPPLY_FLOOR, 100 - SUPPLY_DISTANCE_PENALTY * steps);
			const demand = demandIn(state, region);
			const capacity = demand > 0 ? Math.min(1, regionDef(region).supplyCap / demand) : 1;
			result[region] = Math.round(base * capacity);
		}
	}
	return result;
}

export function supplyAt(state: WarRoomState, region: RegionId): number {
	return supplyMap(state)[region];
}

/** Combat value of a stack: attack or defence, scaled by morale, supply and (on defence) terrain */
export function stackStrength(
	state: WarRoomState,
	region: RegionId,
	mode: 'attack' | 'defence',
	supply: number
): number {
	const terrain = mode === 'defence' ? TERRAIN_DEFENCE[regionDef(region).terrain] : 1;
	return state.divisions[region].reduce((sum, division) => {
		const template = templateDef(division.template);
		const base = mode === 'attack' ? template.attack : template.defence;
		const expFactor = 1 + ((division.experience ?? 1) - 1) * EXP_COMBAT_BONUS;
		return sum + base * expFactor * (division.morale / 100) * (supply / 100) * terrain;
	}, 0);
}

export interface BattlePreview {
	/** The attacking stack's strength, defender's strength */
	attack: number;
	defence: number;
	attackerCount: number;
	defenderCount: number;
	/** Attack divided by defence; Infinity when the target is empty */
	ratio: number;
	terrain: number;
}

/** What an attack from `from` on `to` would look like right now; used by the map and the Pact */
export function battlePreview(state: WarRoomState, from: RegionId, to: RegionId): BattlePreview {
	const supplies = supplyMap(state);
	const attack = stackStrength(state, from, 'attack', supplies[from]);
	const defence = stackStrength(state, to, 'defence', supplies[to]);
	return {
		attack,
		defence,
		attackerCount: state.divisions[from].length,
		defenderCount: state.divisions[to].length,
		ratio: defence > 0 ? attack / defence : Number.POSITIVE_INFINITY,
		terrain: TERRAIN_DEFENCE[regionDef(to).terrain]
	};
}

export function canOrder(state: WarRoomState, from: RegionId, to: RegionId): boolean {
	return (
		state.outcome === null &&
		state.owner[from] === 'player' &&
		state.divisions[from].length > 0 &&
		!state.moved.includes(from) &&
		areNeighbors(from, to)
	);
}

function markMoved(state: WarRoomState, region: RegionId) {
	if (!state.moved.includes(region)) state.moved.push(region);
}

/** One roll of the dice; both sides get their own */
function roll(random: Random): number {
	return 1 + (random() - 0.5) * 2 * COMBAT_LUCK;
}

function removeLosses(divisions: Division[], count: number): number {
	let removed = 0;
	while (removed < count && divisions.length > 0) {
		divisions.pop();
		removed += 1;
	}
	return removed;
}

function recordLosses(state: WarRoomState, owner: Owner, count: number) {
	if (owner === 'player') state.losses += count;
	else state.kills += count;
}

/** Removes a region from the loser and takes its factories with it */
function capture(state: WarRoomState, region: RegionId, owner: Owner) {
	state.owner[region] = owner;
	state.buildings = state.buildings.filter((building) => building.region !== region);
}

/**
 * A defeated defender retreats into a friendly neighbour when there is one; a stack with nowhere
 * to go is destroyed. Returns how many were destroyed.
 */
function retreat(state: WarRoomState, from: RegionId, owner: Owner): number {
	const defenders = state.divisions[from];
	if (defenders.length === 0) return 0;
	const candidates = regionDef(from)
		.neighbors.filter((neighbor) => state.owner[neighbor] === owner)
		.sort(
			(a, b) =>
				regionDef(b).supplyCap - demandIn(state, b) - (regionDef(a).supplyCap - demandIn(state, a))
		);
	const target = candidates[0];
	if (!target) {
		const destroyed = defenders.length;
		state.divisions[from] = [];
		return destroyed;
	}
	state.divisions[target].push(...defenders);
	state.divisions[from] = [];
	return 0;
}

/** Resolves one attack, attacker against the whole defending stack */
function fight(
	state: WarRoomState,
	attacker: Owner,
	from: RegionId,
	to: RegionId,
	random: Random
): WarRoomEvent[] {
	const events: WarRoomEvent[] = [];
	const attackerDivisions = state.divisions[from];
	const defenderDivisions = state.divisions[to];

	if (defenderDivisions.length === 0) {
		const moving = state.divisions[from];
		state.divisions[to] = moving;
		state.divisions[from] = [];
		capture(state, to, attacker);
		events.push({ type: 'captured', region: to, by: attacker });
		events.push({
			type: 'battle',
			region: to,
			attacker,
			won: true,
			attack: 0,
			defence: 0,
			attackerLosses: 0,
			defenderLosses: 0
		});
		return events;
	}

	const supplies = supplyMap(state);
	const attack = stackStrength(state, from, 'attack', supplies[from]);
	const defence = stackStrength(state, to, 'defence', supplies[to]);
	const attackerWins = attack * roll(random) > defence * roll(random);

	if (attackerWins) {
		const defenderLosses = removeLosses(
			defenderDivisions,
			Math.min(defenderDivisions.length, Math.max(1, Math.ceil(defenderDivisions.length * 0.5)))
		);
		const destroyed = retreat(state, to, attacker === 'player' ? 'enemy' : 'player');
		recordLosses(state, attacker === 'player' ? 'enemy' : 'player', defenderLosses + destroyed);

		const attackerLosses = removeLosses(
			attackerDivisions,
			Math.min(
				Math.max(0, attackerDivisions.length - 1),
				Math.floor(attackerDivisions.length * 0.25 * (defence / Math.max(1, attack)))
			)
		);
		recordLosses(state, attacker, attackerLosses);

		for (const division of attackerDivisions) {
			division.morale = Math.max(10, division.morale - 15);
		}
		const moving = state.divisions[from];
		state.divisions[to] = moving;
		state.divisions[from] = [];
		capture(state, to, attacker);
		events.push({
			type: 'battle',
			region: to,
			attacker,
			won: true,
			attack: Math.round(attack),
			defence: Math.round(defence),
			attackerLosses,
			defenderLosses: defenderLosses + destroyed
		});
		events.push({ type: 'captured', region: to, by: attacker });
		return events;
	}

	const attackerLosses = removeLosses(
		attackerDivisions,
		Math.min(
			attackerDivisions.length,
			Math.max(1, Math.ceil(attackerDivisions.length * 0.4 * (defence / Math.max(1, attack))))
		)
	);
	const defenderLosses = removeLosses(
		defenderDivisions,
		Math.min(defenderDivisions.length, Math.floor(defenderDivisions.length * 0.2))
	);
	recordLosses(state, attacker, attackerLosses);
	recordLosses(state, attacker === 'player' ? 'enemy' : 'player', defenderLosses);

	for (const division of attackerDivisions) {
		division.morale = Math.max(10, division.morale - 30);
	}
	for (const division of defenderDivisions) {
		division.morale = Math.max(10, division.morale - 15);
	}
	events.push({
		type: 'battle',
		region: to,
		attacker,
		won: false,
		attack: Math.round(attack),
		defence: Math.round(defence),
		attackerLosses,
		defenderLosses
	});
	return events;
}

/** Sends the whole stack of `from` to `to`: a march when it is ours, an attack when it is not */
export function orderStack(
	state: WarRoomState,
	from: RegionId,
	to: RegionId,
	random: Random
): WarRoomEvent[] {
	if (!canOrder(state, from, to)) return [{ type: 'blocked' }];

	const events: WarRoomEvent[] =
		state.owner[to] === 'player'
			? [{ type: 'move', count: state.divisions[from].length, to }]
			: fight(state, 'player', from, to, random);

	if (state.owner[to] === 'player') {
		if (state.owner[from] === 'player' && state.divisions[from].length > 0) {
			state.divisions[to].push(...state.divisions[from]);
			state.divisions[from] = [];
		}
		markMoved(state, to);
	}
	markMoved(state, from);

	const settled = settle(state);
	if (settled) events.push(settled);
	return events;
}

export function slotsUsed(state: WarRoomState, region: RegionId): number {
	return state.buildings.filter((building) => building.region === region).length;
}

function canAfford<K extends string>(
	stock: Record<K, number>,
	cost: Partial<Record<K, number>>
): boolean {
	const entries = Object.entries(cost) as [K, number][];
	return entries.every(([id, amount]) => stock[id] >= amount);
}

function pay<K extends string>(stock: Record<K, number>, cost: Partial<Record<K, number>>) {
	const entries = Object.entries(cost) as [K, number][];
	for (const [id, amount] of entries) {
		stock[id] -= amount;
	}
}

export function canBuild(state: WarRoomState, region: RegionId, factory: FactoryId): boolean {
	return (
		state.outcome === null &&
		state.owner[region] === 'player' &&
		slotsUsed(state, region) < regionDef(region).slots &&
		canAfford(state.resources, factoryDef(factory).cost)
	);
}

/** Builds a factory in a region of ours if there is a free slot and the resources are there */
export function buildFactory(state: WarRoomState, region: RegionId, factory: FactoryId): boolean {
	if (!canBuild(state, region, factory)) return false;
	pay(state.resources, factoryDef(factory).cost);
	state.buildings.push({ id: state.nextId++, region, factory });
	return true;
}

export function canTrain(state: WarRoomState, template: TemplateId): boolean {
	return state.outcome === null && canAfford(state.equipment, templateDef(template).cost);
}

/** Spends equipment on a division that appears in the capital when its training days are over */
export function train(state: WarRoomState, template: TemplateId): boolean {
	if (!canTrain(state, template)) return false;
	pay(state.equipment, templateDef(template).cost);
	state.training.push({
		id: state.nextId++,
		template,
		daysLeft: templateDef(template).trainDays
	});
	return true;
}

/** Every division recovers morale and gains experience when well supplied */
function regenMorale(state: WarRoomState) {
	const supplies = supplyMap(state);
	for (const region of REGION_IDS) {
		const gain = supplies[region] >= 60 ? MORALE_REGEN : MORALE_REGEN_LOW;
		for (const division of state.divisions[region]) {
			division.morale = Math.min(100, division.morale + gain);
			if (supplies[region] >= 60)
				division.experience = Math.min(EXP_MAX, division.experience + EXP_GAIN_PER_DAY);
		}
	}
}

/**
 * The Pact: trains a division every other day, feeds its front from the capital and attacks
 * wherever its stack looks clearly stronger than the defender. It leaves one division at home.
 */
function pactTurn(state: WarRoomState, random: Random): WarRoomEvent[] {
	const events: WarRoomEvent[] = [];
	if (state.owner.redcapital !== 'enemy') return events;

	const enemyTotal = totalDivisions(state, 'enemy');
	if (
		state.day % ENEMY_REINFORCE_EVERY === 0 &&
		enemyTotal < ENEMY_MAX_DIVISIONS &&
		state.owner.redcapital === 'enemy'
	) {
		state.divisions.redcapital.push({
			id: state.nextId++,
			template: 'infantry',
			morale: 70,
			experience: 1
		});
	}

	const capitalStack = state.divisions.redcapital;
	if (capitalStack.length > 1) {
		const fronts = (['plains', 'foundry', 'wells'] as RegionId[])
			.filter((id) => state.owner[id] === 'enemy')
			.sort((a, b) => state.divisions[a].length - state.divisions[b].length);
		const front = fronts[0];
		if (front) state.divisions[front].push(capitalStack.pop()!);
	}

	const candidates: { from: RegionId; to: RegionId; ratio: number }[] = [];
	for (const from of REGION_IDS) {
		if (state.owner[from] !== 'enemy' || state.divisions[from].length === 0) continue;
		for (const to of regionDef(from).neighbors) {
			if (state.owner[to] !== 'player') continue;
			const preview = battlePreview(state, from, to);
			if (preview.ratio >= AI_ATTACK_RATIO) {
				candidates.push({ from, to, ratio: preview.ratio });
			}
		}
	}
	candidates.sort((a, b) => b.ratio - a.ratio);

	let attacksLeft = state.day >= 10 ? 2 : 1;
	for (const candidate of candidates) {
		if (attacksLeft <= 0) break;
		if (
			state.owner[candidate.from] !== 'enemy' ||
			state.owner[candidate.to] !== 'player' ||
			state.divisions[candidate.from].length === 0
		) {
			continue;
		}
		events.push(...fight(state, 'enemy', candidate.from, candidate.to, random));
		attacksLeft -= 1;
		if (state.owner.capital === 'enemy') break;
	}
	return events;
}

/** Income, factories, training, morale and the Pact's turn, then the calendar moves on */
export function endTurn(state: WarRoomState, random: Random): WarRoomEvent[] {
	if (state.outcome) return [];
	const events: WarRoomEvent[] = [];

	for (const region of REGION_IDS) {
		if (state.owner[region] !== 'player') continue;
		const income = regionDef(region).income;
		state.resources[income.resource] += income.amount;
	}

	for (const building of [...state.buildings]) {
		if (state.owner[building.region] !== 'player') continue;
		const def = factoryDef(building.factory);
		if (!canAfford(state.resources, def.input)) {
			events.push({ type: 'starved', factory: def.id });
			continue;
		}
		pay(state.resources, def.input);
		state.equipment[def.output.equipment] += def.output.amount;
	}

	const stillTraining: TrainingItem[] = [];
	for (const item of state.training) {
		item.daysLeft -= 1;
		if (item.daysLeft > 0) {
			stillTraining.push(item);
			continue;
		}
		state.divisions.capital.push({
			id: state.nextId++,
			template: item.template,
			morale: templateDef(item.template).morale,
			experience: 1
		});
		events.push({ type: 'trained', template: item.template });
	}
	state.training = stillTraining;

	regenMorale(state);
	events.push(...pactTurn(state, random));

	state.day += 1;
	state.moved = [];
	events.push({ type: 'day', day: state.day });

	const settled = settle(state);
	if (settled) events.push(settled);
	return events;
}

/** Days until the armistice freezes the front */
export function armisticeDays(state: WarRoomState): number {
	return Math.max(0, MAX_DAYS + 1 - state.day);
}

export function finalScore(state: WarRoomState, outcome: Outcome | null = state.outcome): number {
	const regions = heldRegions(state) * SCORE_PER_REGION;
	const kills = state.kills * SCORE_PER_KILL;
	const losses = state.losses * SCORE_LOSS_PENALTY;
	let score = regions + kills - losses;
	if (outcome === 'won') {
		score += SCORE_WIN_BONUS + Math.max(0, MAX_DAYS - state.day) * SCORE_DAY_BONUS;
	}
	return Math.max(0, Math.round(score));
}

/** Exercising lowers morale (organization) and spends grain on supplies, but raises experience */
export function exerciseDivision(state: WarRoomState, region: RegionId): boolean {
	if (!canExercise(state, region)) return false;
	state.resources.grain -= EXERCISE_SUPPLY_COST;
	for (const division of state.divisions[region]) {
		division.morale = Math.max(10, division.morale - EXERCISE_MORALE_LOSS);
		division.experience = Math.min(EXP_MAX, division.experience + EXERCISE_EXP_GAIN);
	}
	return true;
}

export function canExercise(state: WarRoomState, region: RegionId): boolean {
	return (
		state.outcome === null &&
		state.owner[region] === 'player' &&
		state.divisions[region].length > 0 &&
		state.resources.grain >= EXERCISE_SUPPLY_COST
	);
}

/** Ends the campaign when a capital falls or the armistice day arrives */
function settle(state: WarRoomState): WarRoomEvent | null {
	if (state.outcome) return null;
	const outcome: Outcome | null =
		state.owner.redcapital === 'player'
			? 'won'
			: state.owner.capital === 'enemy'
				? 'lost'
				: state.day > MAX_DAYS
					? 'armistice'
					: null;
	if (!outcome) return null;
	state.outcome = outcome;
	state.score = finalScore(state, outcome);
	return { type: 'over', outcome, score: state.score };
}

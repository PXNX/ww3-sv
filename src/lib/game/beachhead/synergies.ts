/*
 * Squad synergies: the landing party is stronger when a boat carries units that cover each other.
 * A synergy needs every `kinds` entry in the same squad; the bonus applies only to the listed
 * `boost` kinds. This is pure data over the squad composition, so the same rules are used for the
 * battle stats and for the badge shown on the landing plan.
 */
import type { SquadTroop } from './battle.js';
import type { TroopKind } from './config.js';

export interface SynergyDef {
	id: string;
	/** Message key suffix under `beachhead_synergy_*` */
	name: string;
	/** All of these must be present in one squad */
	kinds: readonly TroopKind[];
	/** Only these get the bonus; omitted means every unit in the squad */
	boost?: readonly TroopKind[];
	damage?: number;
	hp?: number;
	speed?: number;
	splash?: number;
	heal?: number;
	scatter?: number;
}

export const SYNERGIES: readonly SynergyDef[] = [
	{
		id: 'combined-arms',
		name: 'combined_arms',
		kinds: ['assault', 'tank'],
		boost: ['tank', 'assault'],
		damage: 0.2,
		hp: 0.1
	},
	{
		id: 'fire-support',
		name: 'fire_support',
		kinds: ['drone', 'mortar'],
		boost: ['mortar', 'artillery'],
		damage: 0.15,
		scatter: 0.5
	},
	{
		id: 'field-medic',
		name: 'field_medic',
		kinds: ['medic', 'apc'],
		boost: ['medic'],
		heal: 0.3
	},
	{
		id: 'breach-and-clear',
		name: 'breach_and_clear',
		kinds: ['demo', 'assault'],
		boost: ['demo', 'assault'],
		splash: 0.25,
		speed: 0.1
	}
];

/** Which synergies a squad earns */
export function squadSynergies(squad: readonly SquadTroop[]): SynergyDef[] {
	const present = new Set(squad.map((troop) => troop.kind));
	return SYNERGIES.filter((synergy) => synergy.kinds.every((kind) => present.has(kind)));
}

const scale = (value: number | undefined, factor: number | undefined): number | undefined =>
	value === undefined || factor === undefined
		? value
		: Math.round(value * (1 + factor) * 100) / 100;

/** Applies every earned synergy to a copy of the squad, never mutating the input */
export function boostSquad(squad: readonly SquadTroop[]): SquadTroop[] {
	const synergies = squadSynergies(squad);
	return squad.map((troop) => {
		let boosted = { ...troop };
		for (const synergy of synergies) {
			if (synergy.boost && !synergy.boost.includes(troop.kind)) continue;
			boosted = {
				...boosted,
				damage: scale(boosted.damage, synergy.damage) ?? boosted.damage,
				hp: scale(boosted.hp, synergy.hp) ?? boosted.hp,
				speed: scale(boosted.speed, synergy.speed) ?? boosted.speed,
				splash: scale(boosted.splash, synergy.splash) ?? boosted.splash,
				healAmount: scale(boosted.healAmount, synergy.heal) ?? boosted.healAmount,
				scatter:
					scale(boosted.scatter, synergy.scatter ? -synergy.scatter : undefined) ?? boosted.scatter
			};
		}
		return boosted;
	});
}

/** Applies the squad synergies to every boat in the landing plan */
export function boostLandingPlan(squads: readonly (readonly SquadTroop[])[]): SquadTroop[][] {
	return squads.map(boostSquad);
}

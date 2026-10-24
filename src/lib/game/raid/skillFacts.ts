/*
 * The numbers behind each skill, for the weapon details: how hard it hits (as a multiple of the
 * weapon's shot), how far it reaches, how long it lasts and how many of something it makes.
 */
import {
	BARRAGE_ROCKETS,
	BLAST_DAMAGE_FACTOR,
	BLAST_RADIUS,
	DASH_MS,
	FLASHPOINT_CRIT_MULTIPLIER,
	FLASHPOINT_DAMAGE_FACTOR,
	FLASHPOINT_RANGE,
	FOCUS_SHOTS,
	GRENADE_DAMAGE_FACTOR,
	GRENADE_RADIUS,
	MAX_MINES,
	MINE_DAMAGE_FACTOR,
	MINE_RADIUS,
	NAPALM_MS,
	NAPALM_RADIUS,
	NOVA_BULLETS,
	NOVA_DAMAGE_FACTOR,
	OVERCLOCK_MS,
	OVERDRIVE_MS,
	RAILSHOT_DAMAGE_FACTOR,
	RAILSHOT_RANGE,
	SWARM_DRONES,
	type SkillId
} from './config';

export interface SkillFacts {
	/** Damage as a multiple of one shot of the weapon */
	damage?: number;
	radius?: number;
	durationMs?: number;
	count?: number;
}

export const SKILL_FACTS: Record<SkillId, SkillFacts> = {
	heal: {},
	grenade: { damage: GRENADE_DAMAGE_FACTOR, radius: GRENADE_RADIUS },
	focus: { count: FOCUS_SHOTS },
	railshot: { damage: RAILSHOT_DAMAGE_FACTOR, radius: RAILSHOT_RANGE },
	dash: { durationMs: DASH_MS },
	blast: { damage: BLAST_DAMAGE_FACTOR, radius: BLAST_RADIUS },
	overdrive: { durationMs: OVERDRIVE_MS },
	nova: { damage: NOVA_DAMAGE_FACTOR, count: NOVA_BULLETS },
	barrage: { count: BARRAGE_ROCKETS },
	mine: { damage: MINE_DAMAGE_FACTOR, radius: MINE_RADIUS, count: MAX_MINES },
	flashpoint: {
		damage: FLASHPOINT_DAMAGE_FACTOR * FLASHPOINT_CRIT_MULTIPLIER,
		radius: FLASHPOINT_RANGE
	},
	napalm: { radius: NAPALM_RADIUS, durationMs: NAPALM_MS },
	swarm: { count: SWARM_DRONES },
	overclock: { durationMs: OVERCLOCK_MS }
};

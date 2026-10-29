/*
 * The numbers behind each skill, for the weapon details: how hard it hits (as a multiple of the
 * weapon's shot), how far it reaches, how long it lasts and how many of something it makes.
 */
import {
	BARRAGE_ROCKETS,
	BLAST_DAMAGE_FACTOR,
	BLAST_RADIUS,
	DASH_MS,
	ECHO_RETURN_MS,
	SMOKE_MS,
	SPIN_BULLETS,
	SMOKE_SIGHT,
	TOWER_LIFETIME_MS,
	TOWER_RADIUS,
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
	QUAKE_DAMAGE_FACTOR,
	QUAKE_RADIUS,
	WARCRY_MS,
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
	overclock: { durationMs: OVERCLOCK_MS },
	quake: { damage: QUAKE_DAMAGE_FACTOR, radius: QUAKE_RADIUS },
	warcry: { durationMs: WARCRY_MS },
	tower: { durationMs: TOWER_LIFETIME_MS, radius: TOWER_RADIUS },
	echo: { damage: 0.8, durationMs: ECHO_RETURN_MS },
	smoke: { durationMs: SMOKE_MS, radius: SMOKE_SIGHT },
	spin: { damage: 0.7, count: SPIN_BULLETS },
	flip: { damage: 2.5, radius: 60 }
};

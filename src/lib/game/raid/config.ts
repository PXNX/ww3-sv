/*
 * Raid tuning: the weapon and armour catalogue, rarities, the enemy archetypes and their super
 * and mega variants, and how the threat (and with it the rewards) climbs the longer a raid lasts.
 * Everything is in world units (one unit is roughly one CSS pixel at the default zoom) and
 * milliseconds.
 */

export const MAP_IDS = ['sunflower', 'strait', 'arctic'] as const;
export type MapId = (typeof MAP_IDS)[number];

export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 230;
export const PLAYER_BASE_HP = 100;
/** Extra maximum health per player level above 1 */
export const HP_PER_LEVEL = 4;
/** Extra weapon damage per player level above 1, as a share */
export const DAMAGE_PER_LEVEL = 0.02;
/** One self-revive per raid; the next knock-out ends the raid */
export const REVIVES_PER_RAID = 1;
export const REVIVE_HEALTH_SHARE = 0.6;
export const REVIVE_INVULNERABLE_MS = 2500;
export const REVIVE_BLAST_RADIUS = 240;
/** Short invulnerability after a hit, so a crowd cannot drain the bar in a single frame */
export const HIT_GRACE_MS = 350;
/** Walking speed while shooting (and for a moment after each shot), as a share */
export const SHOOTING_SPEED = 0.6;
export const SHOOTING_SLOW_MS = 250;
/** Sprint: a burst forwards on its own button, untouchable while it lasts */
export const SPRINT_MS = 240;
export const SPRINT_SPEED = 780;
export const SPRINT_COOLDOWN_MS = 6000;

// ---------------------------------------------------------------------------------------------
// Live events: every ten minutes of real time, one of them runs for a minute

export const LIVE_EVENTS = ['double-xp', 'elite-surge', 'rapid-skills', 'gold-rush'] as const;
export type LiveEvent = (typeof LIVE_EVENTS)[number];
export const LIVE_EVENT_EVERY_MS = 10 * 60_000;
export const LIVE_EVENT_MS = 60_000;
/** Elite surge: super and mega enemies turn up this many times as often */
export const SURGE_FACTOR = 3;
/** Rapid skills: cooldowns run down this many times as fast */
export const RAPID_SKILLS_FACTOR = 2;

/** World units of height the camera shows in landscape; the width follows the screen */
export const VIEW_HEIGHT = 500;
/** The camera never shows more than this many units across */
export const VIEW_MAX_WIDTH = 940;

// ---------------------------------------------------------------------------------------------
// Rarity

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_POWER: Record<Rarity, number> = {
	common: 1,
	uncommon: 1.2,
	rare: 1.45,
	epic: 1.75,
	legendary: 2.2
};

export const RARITY_COLOR: Record<Rarity, string> = {
	common: '#9aa1a8',
	uncommon: '#4caf50',
	rare: '#3d8bfd',
	epic: '#a64dff',
	legendary: '#ff9f1a'
};

export const MAX_ITEM_LEVEL = 20;
/** Extra power per item level above 1, as a share */
export const POWER_PER_ITEM_LEVEL = 0.1;

// ---------------------------------------------------------------------------------------------
// Weapons

export const WEAPON_KINDS = [
	'rifle',
	'marksman',
	'shotgun',
	'smg',
	'launcher',
	'flamethrower',
	'dronenest',
	'hammer'
] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

/** Every weapon brings two skills, shown on the buttons around the attack button */
export const SKILL_IDS = [
	'heal',
	'grenade',
	'focus',
	'railshot',
	'dash',
	'blast',
	'overdrive',
	'nova',
	'barrage',
	'mine',
	'flashpoint',
	'napalm',
	'swarm',
	'overclock',
	'quake',
	'warcry'
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export interface WeaponSpec {
	/** Damage per projectile at common rarity, level 1 */
	damage: number;
	/** Time between shots */
	fireMs: number;
	/** Auto-aim reach */
	range: number;
	projectileSpeed: number;
	pellets: number;
	/** Total spread of the pellets in radians, or the random wobble of a single shot */
	spread: number;
	critChance: number;
	critMultiplier: number;
	/** Splash radius on impact, 0 for none */
	splash: number;
	/** How many enemies one projectile passes through after the first */
	pierce: number;
	/** How long a hit sets the enemy on fire, 0 for weapons that do not burn */
	burnMs: number;
	/** The two skills on the buttons around the attack button while this weapon is held */
	skills: readonly [SkillId, SkillId];
}

export const WEAPONS: Record<WeaponKind, WeaponSpec> = {
	// The all-rounder: steady base attack plus a heal and an area grenade
	rifle: {
		damage: 11,
		fireMs: 300,
		range: 330,
		projectileSpeed: 900,
		pellets: 1,
		spread: 0.05,
		critChance: 0.06,
		critMultiplier: 1.6,
		splash: 0,
		pierce: 0,
		burnMs: 0,
		skills: ['heal', 'grenade']
	},
	// Slow and precise: nearly every other shot is a critical hit
	marksman: {
		damage: 26,
		fireMs: 820,
		range: 480,
		projectileSpeed: 1500,
		pellets: 1,
		spread: 0,
		critChance: 0.45,
		critMultiplier: 2.6,
		splash: 0,
		pierce: 1,
		burnMs: 0,
		skills: ['focus', 'railshot']
	},
	shotgun: {
		damage: 8,
		fireMs: 720,
		range: 220,
		projectileSpeed: 800,
		pellets: 5,
		spread: 0.55,
		critChance: 0.08,
		critMultiplier: 1.6,
		splash: 0,
		pierce: 0,
		burnMs: 0,
		skills: ['dash', 'blast']
	},
	smg: {
		damage: 4.5,
		fireMs: 105,
		range: 260,
		projectileSpeed: 950,
		pellets: 1,
		spread: 0.16,
		critChance: 0.06,
		critMultiplier: 1.6,
		splash: 0,
		pierce: 0,
		burnMs: 0,
		skills: ['overdrive', 'nova']
	},
	launcher: {
		damage: 24,
		fireMs: 1150,
		range: 380,
		projectileSpeed: 560,
		pellets: 1,
		spread: 0,
		critChance: 0.06,
		critMultiplier: 1.6,
		splash: 85,
		pierce: 0,
		burnMs: 0,
		skills: ['barrage', 'mine']
	},
	// Short reach, a steady stream of flames that pass through and set everything on fire
	flamethrower: {
		damage: 3.2,
		fireMs: 80,
		range: 175,
		projectileSpeed: 430,
		pellets: 1,
		spread: 0.32,
		critChance: 0.05,
		critMultiplier: 1.6,
		splash: 0,
		pierce: 2,
		burnMs: 2600,
		skills: ['flashpoint', 'napalm']
	},
	// Fires nothing itself: each attack builds an FPV drone nest that sends kamikaze drones at
	// whatever comes into its range. Damage, speed and splash are those of one drone
	dronenest: {
		damage: 20,
		fireMs: 1900,
		range: 380,
		projectileSpeed: 380,
		pellets: 1,
		spread: 0,
		critChance: 0.08,
		critMultiplier: 1.8,
		splash: 60,
		pierce: 0,
		burnMs: 0,
		skills: ['swarm', 'overclock']
	},
	// Prigozhin's Hammer: no shots, a wide swing at everything in front within arm's reach. Every
	// swing that lands charges the hammer; a full charge turns the next swing into a Hammer Fall
	hammer: {
		damage: 30,
		fireMs: 620,
		range: 95,
		projectileSpeed: 0,
		pellets: 1,
		spread: 0,
		critChance: 0.08,
		critMultiplier: 1.8,
		splash: 0,
		pierce: 0,
		burnMs: 0,
		skills: ['quake', 'warcry']
	}
};

export const SKILL_COOLDOWN_MS: Record<SkillId, number> = {
	heal: 14000,
	grenade: 9000,
	focus: 10000,
	railshot: 8000,
	dash: 5000,
	blast: 8000,
	overdrive: 13000,
	nova: 8000,
	barrage: 11000,
	mine: 6000,
	flashpoint: 9000,
	napalm: 10000,
	swarm: 10000,
	overclock: 14000,
	quake: 8000,
	warcry: 15000
};

// ---------------------------------------------------------------------------------------------
// The weapon charge, the thin bar under the player's health

/** Flamethrower: every flame heats it up, it cools while not firing */
export const FLAME_HEAT_PER_SHOT = 0.02;
export const FLAME_COOL_PER_SECOND = 0.4;
/** Overheated: the player stands stunned for this long and loses a share of maximum health */
export const OVERHEAT_STUN_MS = 1600;
export const OVERHEAT_DAMAGE_SHARE = 0.1;

/** Hammer: the swing's width in radians, and how much a swing that lands charges it */
export const HAMMER_ARC = 2.2;
export const HAMMER_CHARGE_PER_HIT = 0.14;
/** Hammer Fall, the fully charged swing: a big hit all around, healing the player and squad */
export const HAMMER_FALL_RADIUS = 170;
export const HAMMER_FALL_DAMAGE_FACTOR = 4;
export const HAMMER_FALL_HEAL_SHARE = 0.25;
/** Quake (hammer): a slam that hurts and shoves everything around */
export const QUAKE_RADIUS = 150;
export const QUAKE_DAMAGE_FACTOR = 1.8;
export const QUAKE_PUSH = 110;
/** War cry (hammer): half the damage taken for a while, and a little health back */
export const WARCRY_MS = 5000;
export const WARCRY_DAMAGE_TAKEN = 0.5;
export const WARCRY_HEAL_SHARE = 0.1;

/** Field medkit (rifle): heals a share of maximum health */
export const HEAL_SHARE = 0.35;
/** Frag grenade (rifle): thrown at the nearest enemy (or straight ahead), bursts after a fuse */
export const GRENADE_RADIUS = 125;
export const GRENADE_FUSE_MS = 650;
export const GRENADE_THROW_RANGE = 380;
/** Grenade damage as a multiple of the held weapon's shot damage */
export const GRENADE_DAMAGE_FACTOR = 5;
/** Focus (marksman): the next shots are all critical hits */
export const FOCUS_SHOTS = 3;
/** Rail shot (marksman): one long shot through every enemy in its path */
export const RAILSHOT_DAMAGE_FACTOR = 4;
export const RAILSHOT_RANGE = 760;
/** Dash (shotgun): a quick, untouchable dodge */
export const DASH_MS = 190;
export const DASH_SPEED = 900;
/** Point-blank blast (shotgun): a cone that hurts and shoves everything in front */
export const BLAST_RADIUS = 175;
export const BLAST_ANGLE = Math.PI / 2;
export const BLAST_DAMAGE_FACTOR = 7;
export const BLAST_PUSH = 130;
/** Overdrive (SMG): fires much faster for a while */
export const OVERDRIVE_MS = 5000;
export const OVERDRIVE_FIRE_FACTOR = 0.4;
/** Bullet nova (SMG): a ring of bullets in every direction */
export const NOVA_BULLETS = 24;
export const NOVA_DAMAGE_FACTOR = 2.5;
/** Barrage (launcher): a rocket at each of the nearest enemies */
export const BARRAGE_ROCKETS = 5;
export const BARRAGE_RANGE = 460;
/** Landmine (launcher): arms after a moment and goes off when an enemy steps close */
export const MINE_ARM_MS = 400;
export const MINE_TRIGGER_RADIUS = 34;
export const MINE_RADIUS = 120;
export const MINE_DAMAGE_FACTOR = 4;
export const MINE_LIFETIME_MS = 30_000;
export const MAX_MINES = 3;
/** Flashpoint (flamethrower): every burning enemy in reach takes a huge critical hit */
export const FLASHPOINT_RANGE = 560;
export const FLASHPOINT_DAMAGE_FACTOR = 10;
export const FLASHPOINT_CRIT_MULTIPLIER = 3;
/** Napalm (flamethrower): a pool of fire that sets everything walking through it alight */
export const NAPALM_RADIUS = 95;
export const NAPALM_MS = 4500;
export const NAPALM_THROW_RANGE = 380;
/** Drone nests: how many stand at once, how long they last and how often they launch a drone */
export const MAX_NESTS = 3;
export const NEST_LIFETIME_MS = 22_000;
export const NEST_LAUNCH_MS = 1500;
/** A friendly drone that finds nothing to hit explodes after this long */
export const DRONE_LIFETIME_MS = 3500;
/** Swarm (drone nest): every nest launches this many drones at once, the player two more */
export const SWARM_DRONES = 3;
/** Overclock (drone nest): nests launch this much more often for a while */
export const OVERCLOCK_MS = 6000;
export const OVERCLOCK_LAUNCH_FACTOR = 0.4;

// ---------------------------------------------------------------------------------------------
// Burning

/** Burning enemies take damage in ticks: this multiple of the weapon's shot damage per second */
export const BURN_DPS_FACTOR = 3;
export const BURN_TICK_MS = 500;

// ---------------------------------------------------------------------------------------------
// Armour

export const ARMOR_SLOTS = ['helmet', 'vest', 'boots'] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];

/** A helmet adds maximum health */
export const HELMET_HP = 22;
/** A vest adds armour: damage taken is scaled by 100 / (100 + armour) */
export const VEST_ARMOR = 14;
/** Boots add walking speed, as a share */
export const BOOTS_SPEED = 0.04;

/**
 * Some armour comes with a perk. Each slot has its own: a jammer helmet that throws drones off
 * course, a spiked vest that hurts whoever hits it up close, boots that leave a burning trail or
 * make you sprint.
 */
export const ARMOR_PERKS = ['jammer', 'spikes', 'trail', 'sprint'] as const;
export type ArmorPerk = (typeof ARMOR_PERKS)[number];

export const SLOT_PERKS: Record<ArmorSlot, readonly ArmorPerk[]> = {
	helmet: ['jammer'],
	vest: ['spikes'],
	boots: ['trail', 'sprint']
};

/** Chance that a dropped piece of armour has its slot's perk; the rarer, the likelier */
export const PERK_CHANCE: Record<Rarity, number> = {
	common: 0.08,
	uncommon: 0.18,
	rare: 0.35,
	epic: 0.6,
	legendary: 1
};

/** Jammer: a drone that comes this close is thrown off course and crashes; one every so often */
export const JAMMER_RADIUS = 170;
export const JAMMER_COOLDOWN_MS = 1400;
/** Spikes: melee attackers take this multiple of the hit they land (before the player's armour) */
export const SPIKES_REFLECT = 2.5;
/** Fire trail: a patch of fire left every so often while walking */
export const TRAIL_EVERY_MS = 240;
export const TRAIL_RADIUS = 30;
export const TRAIL_MS = 2200;
export const TRAIL_BURN_MS = 1800;
/** Burn damage per second of the trail, per player level */
export const TRAIL_DPS = 6;
export const TRAIL_DPS_PER_LEVEL = 0.6;
/** Sprint boots: extra walking speed */
export const SPRINT_BOOTS_SPEED = 0.22;

// ---------------------------------------------------------------------------------------------
// Terrain: ice and oil slicks make everything that walks slide, mud slows it down

export const TERRAIN_KINDS = ['ice', 'mud', 'oil'] as const;
export type TerrainKind = (typeof TERRAIN_KINDS)[number];

/** On ice and oil a walker only turns its speed towards where it wants to go this fast, per second */
export const SLIPPERY_GRIP = 1.6;
export const MUD_SPEED = 0.55;
/** How long an entity must stay on ice before freezing */
export const ICE_FREEZE_MS = 2500;

// ---------------------------------------------------------------------------------------------
// Enemies

export const ARCHETYPES = [
	'grunt',
	'fast',
	'heavy',
	'ranged',
	'drone',
	'medic',
	'mortar',
	'artillery',
	'pion',
	'boss'
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** Elite enemies: one of a kind, never super or mega, marked orange on the map */
export const ELITE_ARCHETYPES: readonly Archetype[] = ['pion'];
export const isElite = (archetype: Archetype) => ELITE_ARCHETYPES.includes(archetype);

export interface ArchetypeSpec {
	hp: number;
	speed: number;
	/** Contact damage per hit, or projectile damage for the ranged ones */
	damage: number;
	radius: number;
	xp: number;
	/** Gold dropped on top of any loot */
	gold: number;
	/** Chance to drop a loot item */
	dropChance: number;
	/** Loot luck bonus, see loot.ts */
	luck: number;
	/** Cooldown between contact hits or shots */
	attackMs: number;
	/** Enemies that fight from afar hold this distance from the player */
	keepDistance: number;
}

export const ARCHETYPE_SPECS: Record<Archetype, ArchetypeSpec> = {
	grunt: {
		hp: 30,
		speed: 88,
		damage: 6,
		radius: 18,
		xp: 6,
		gold: 1,
		dropChance: 0.12,
		luck: 0,
		attackMs: 900,
		keepDistance: 0
	},
	fast: {
		hp: 15,
		speed: 165,
		damage: 4,
		radius: 13,
		xp: 5,
		gold: 1,
		dropChance: 0.08,
		luck: 0,
		attackMs: 650,
		keepDistance: 0
	},
	heavy: {
		hp: 150,
		speed: 58,
		damage: 14,
		radius: 30,
		xp: 22,
		gold: 4,
		dropChance: 0.3,
		luck: 0.35,
		attackMs: 1100,
		keepDistance: 0
	},
	ranged: {
		hp: 34,
		speed: 80,
		damage: 7,
		radius: 18,
		xp: 10,
		gold: 2,
		dropChance: 0.16,
		luck: 0.1,
		attackMs: 1900,
		keepDistance: 270
	},
	// Kamikaze FPV drones: fly straight over all cover and blow up on the player
	drone: {
		hp: 12,
		speed: 150,
		damage: 11,
		radius: 14,
		xp: 5,
		gold: 1,
		dropChance: 0.05,
		luck: 0,
		attackMs: 0,
		keepDistance: 0
	},
	// Medics stay back and heal every enemy around them in pulses: take them out first
	medic: {
		hp: 40,
		speed: 82,
		damage: 4,
		radius: 18,
		xp: 14,
		gold: 2,
		dropChance: 0.14,
		luck: 0.15,
		attackMs: 2600,
		keepDistance: 230
	},
	// Mortar crews lob shells at where the player stands; the target is marked on the ground
	mortar: {
		hp: 45,
		speed: 70,
		damage: 13,
		radius: 20,
		xp: 14,
		gold: 2,
		dropChance: 0.14,
		luck: 0.15,
		attackMs: 3400,
		keepDistance: 400
	},
	// Pion self-propelled guns: tough, slow, and fire salvos from beyond the edge of the screen
	artillery: {
		hp: 260,
		speed: 40,
		damage: 20,
		radius: 32,
		xp: 40,
		gold: 6,
		dropChance: 0.3,
		luck: 0.4,
		attackMs: 6500,
		keepDistance: 560
	},
	// The elite Pion tank: a slow heavy that shells from mid range, and its shells leave the ground
	// burning for a while, so standing still is not an option
	pion: {
		hp: 900,
		speed: 34,
		damage: 16,
		radius: 40,
		xp: 120,
		gold: 25,
		dropChance: 1,
		luck: 1.2,
		attackMs: 3800,
		keepDistance: 420
	},
	boss: {
		hp: 1700,
		speed: 66,
		damage: 24,
		radius: 56,
		xp: 260,
		gold: 40,
		dropChance: 1,
		luck: 1.6,
		attackMs: 1200,
		keepDistance: 0
	}
};

export const ENEMY_BULLET_SPEED = 330;
/** Boss slam: a ring telegraphed on the ground, then a burst */
export const BOSS_SLAM_EVERY_MS = 5200;
export const BOSS_SLAM_WINDUP_MS = 1000;
export const BOSS_SLAM_RADIUS = 160;
/** Boss volley: a ring of slow bullets */
export const BOSS_VOLLEY_EVERY_MS = 3300;
export const BOSS_VOLLEY_BULLETS = 12;
/** Kamikaze drones blow up in this radius when they reach the player */
export const DRONE_BLAST_RADIUS = 50;
/** Medic pulse: heals this share of every nearby enemy's maximum health (much less for bosses) */
export const MEDIC_HEAL_RADIUS = 220;
export const MEDIC_HEAL_SHARE = 0.18;
export const MEDIC_BOSS_HEAL_SHARE = 0.02;
/** Mortar shells land on a marked spot after a flight */
export const MORTAR_RADIUS = 70;
export const MORTAR_FLIGHT_MS = 1200;
/** Artillery salvos: several bigger, slower shells scattered around the player */
export const ARTILLERY_SHELLS = 3;
export const ARTILLERY_RADIUS = 95;
export const ARTILLERY_FLIGHT_MS = 1700;
export const ARTILLERY_SCATTER = 110;
/** The elite Pion's fire shells: they burst, then the ground burns for five seconds */
export const PION_SHELL_RADIUS = 80;
export const PION_FLIGHT_MS = 1100;
export const PION_SCATTER = 40;
export const PION_FIRE_MS = 5000;
/** Burning ground hurts whoever stands in it this often, for this share of the shell's damage */
export const PION_FIRE_TICK_MS = 500;
export const PION_FIRE_DAMAGE_SHARE = 0.35;

export const VARIANTS = ['normal', 'super', 'mega'] as const;
export type Variant = (typeof VARIANTS)[number];

export interface VariantSpec {
	hp: number;
	damage: number;
	speed: number;
	radius: number;
	/** XP and gold multiplier */
	reward: number;
	/** Extra drop chance and extra items */
	dropBonus: number;
	extraDrops: number;
	/** Added to the loot luck */
	luck: number;
}

export const VARIANT_SPECS: Record<Variant, VariantSpec> = {
	normal: {
		hp: 1,
		damage: 1,
		speed: 1,
		radius: 1,
		reward: 1,
		dropBonus: 0,
		extraDrops: 0,
		luck: 0
	},
	super: {
		hp: 3,
		damage: 1.4,
		speed: 1.1,
		radius: 1.18,
		reward: 4,
		dropBonus: 0.5,
		extraDrops: 0,
		luck: 1.1
	},
	mega: {
		hp: 8,
		damage: 1.8,
		speed: 1.15,
		radius: 1.38,
		reward: 12,
		dropBonus: 1,
		extraDrops: 1,
		luck: 2.6
	}
};

// ---------------------------------------------------------------------------------------------
// Threat: everything grows with the minutes survived

/** Enemy health multiplier after this many minutes */
export function threatHp(minutes: number): number {
	return 1 + 0.2 * minutes;
}

export function threatDamage(minutes: number): number {
	return 1 + 0.08 * minutes;
}

/** XP and gold multiplier: surviving longer pays more */
export function rewardMultiplier(minutes: number): number {
	return 1 + 0.25 * minutes;
}

/** Shown in the HUD: 1 at the start, one more every 5 minutes */
export function threatLevel(minutes: number): number {
	return 1 + Math.floor((minutes * 60) / 300);
}

export function spawnIntervalMs(minutes: number): number {
	return Math.max(320, 1900 - 160 * minutes);
}

export function maxEnemies(minutes: number): number {
	return Math.min(48, 9 + Math.floor(5 * minutes));
}

export function superChance(minutes: number): number {
	return Math.min(0.2, 0.04 + 0.012 * minutes);
}

export function megaChance(minutes: number): number {
	return Math.min(0.08, 0.006 + 0.005 * minutes);
}

/**
 * The ways to play a battlefield: the endless hunt (survive, bosses come every few minutes), the
 * boss fight (the battlefield's boss turns up at once; bring it down before the clock runs out, as
 * fast as possible) and the defense (hold a command post against waves for a growing reward pot)
 */
export const RAID_MODES = ['hunt', 'boss', 'defense'] as const;
export type RaidMode = (typeof RAID_MODES)[number];
/** Time to bring the boss down in a boss fight */
export const BOSS_FIGHT_MS = 180_000;
/** The boss shows up this long after a boss fight starts */
export const BOSS_FIGHT_SPAWN_MS = 1500;
/** At most this many regular enemies keep the boss company */
export const BOSS_FIGHT_ADDS = 6;
/** After the boss falls, its loot flies to the player for this long before the results */
export const VICTORY_MS = 2400;
/**
 * Boss fight stars: one for every 20 seconds still on the clock when the boss falls (any win
 * earns at least one), up to five. Each star reached on a map for the first time pays XP once.
 */
export const BOSS_STAR_MS = 20_000;
export const BOSS_MAX_STARS = 5;
export const BOSS_STAR_XP = 150;

/** The stars a boss fight earned: 0 unless the boss fell before the clock ran out */
export function bossStars(won: boolean, timeLeftMs: number): number {
	if (!won) return 0;
	return Math.max(1, Math.min(BOSS_MAX_STARS, Math.ceil(timeLeftMs / BOSS_STAR_MS)));
}

/** Defense: the command post the enemies go for, in the middle of the battlefield */
export const OBJECTIVE_HP = 2400;
export const OBJECTIVE_RADIUS = 44;
/** Enemies go for the command post unless the player comes this close to them */
export const OBJECTIVE_AGGRO = 210;
export const DEFENSE_FIRST_WAVE_MS = 3000;
/** The pause between two waves */
export const DEFENSE_BREAK_MS = 5000;
/** Every this many waves the squad votes whether to cash out the pot; those waves bring a boss */
export const DEFENSE_CHECKPOINT = 5;
/** How long the vote stays open; when it closes the majority wins, a tie cashes out */
export const VOTE_MS = 12_000;
/** Once everyone has voted, the vote still stays open this long, so a mind can still change */
export const VOTE_SETTLE_MS = 1400;
/** Enemies of a wave are as tough as in a hunt this many minutes in, per wave */
export const DEFENSE_MINUTES_PER_WAVE = 0.6;

/** Enemies in a wave */
export function waveSize(wave: number): number {
	return 5 + wave * 3;
}

/** What clearing a wave adds to the pot */
export function wavePot(wave: number): { xp: number; gold: number; scrap: number } {
	return { xp: 80 + 45 * wave, gold: 30 + 15 * wave, scrap: 6 + 3 * wave };
}

/** The first boss arrives after two minutes, then one every two and a half */
export const FIRST_BOSS_MS = 120_000;
export const BOSS_EVERY_MS = 150_000;

/** Archetype weights for regular spawns; the tougher ones get more common over time */
export function archetypeWeights(minutes: number): { item: Archetype; weight: number }[] {
	return [
		{ item: 'grunt', weight: 10 },
		{ item: 'fast', weight: 4 + minutes },
		{ item: 'ranged', weight: minutes < 0.5 ? 0 : 3 + minutes * 0.8 },
		{ item: 'heavy', weight: minutes < 1 ? 0 : 1.5 + minutes * 0.7 },
		{ item: 'drone', weight: minutes < 0.75 ? 0 : 2 + minutes * 0.6 },
		{ item: 'mortar', weight: minutes < 1 ? 0 : 1.2 + minutes * 0.45 },
		{ item: 'medic', weight: minutes < 1.5 ? 0 : 1 + minutes * 0.35 },
		{ item: 'artillery', weight: minutes < 3 ? 0 : 0.5 + minutes * 0.2 },
		{ item: 'pion', weight: minutes < 2.5 ? 0 : 0.3 + minutes * 0.1 }
	];
}

/** At most this many of each support enemy on the field at once */
export const ARCHETYPE_CAP: Partial<Record<Archetype, number>> = {
	medic: 3,
	mortar: 4,
	artillery: 2,
	pion: 1
};

// ---------------------------------------------------------------------------------------------
// Assault squad

/**
 * Helpers of the player's own: every so often a little wooden crate drops nearby and a frail
 * soldier climbs out. They hunt the closest enemy, hit it in melee, and die quickly once the
 * enemies turn on them, so they are a hand now and then rather than a second army.
 */
export const ALLY_MAX = 3;
/** The first crate lands after this long, then one every ALLY_SPAWN_MS or so */
export const ALLY_FIRST_MS = 20_000;
export const ALLY_SPAWN_MS = 18_000;
export const ALLY_HP = 14;
export const ALLY_SPEED = 175;
export const ALLY_DAMAGE = 9;
export const ALLY_ATTACK_MS = 700;
export const ALLY_RADIUS = 9;
/** They fall apart after this long, even if nothing touched them */
export const ALLY_LIFETIME_MS = 45_000;
/** The furthest they run from the player to chase an enemy */
export const ALLY_HUNT_RANGE = 420;
/** How long the crate stays visible while they climb out */
export const ALLY_CRATE_MS = 900;
/** A hit from an enemy: share of its damage, and the wait until the next one can land */
export const ALLY_HURT_SHARE = 0.5;
export const ALLY_HURT_MS = 900;

/** Spawns appear just outside the camera, at this distance from the player */
export const SPAWN_DISTANCE_MIN = 620;
export const SPAWN_DISTANCE_MAX = 820;

// ---------------------------------------------------------------------------------------------
// Pickups

/** Gold, scrap, crystals, medkits and upgrade kits fly to the player from this far */
export const MAGNET_RADIUS = 95;
export const PICKUP_RADIUS = 26;
/** Gear (weapons and armour) waits on the ground until the player walks over it */
export const GEAR_PICKUP_RADIUS = 34;
export const MEDKIT_HEAL_SHARE = 0.25;
/** Loot left on the ground disappears after a while, so the map does not fill up */
export const LOOT_LIFETIME_MS = 45_000;

// ---------------------------------------------------------------------------------------------
// Crystals: socketed into weapons, each kind improves one stat, more the rarer it is

export const CRYSTAL_KINDS = ['damage', 'crit', 'fire', 'status'] as const;
export type CrystalKind = (typeof CRYSTAL_KINDS)[number];

/** What a crystal adds, by rarity from common to legendary */
export const CRYSTAL_BONUS: Record<CrystalKind, readonly number[]> = {
	// Extra base damage, as a share
	damage: [0.05, 0.1, 0.16, 0.24, 0.35],
	// Extra critical hit chance, added
	crit: [0.02, 0.04, 0.07, 0.1, 0.15],
	// Extra fire rate, as a share (the time between shots is divided by 1 + this)
	fire: [0.04, 0.08, 0.12, 0.17, 0.24],
	// Longer status effects such as burning, as a share
	status: [0.2, 0.4, 0.7, 1, 1.5]
};

/** A status crystal on a weapon that does not burn gives its shots this chance to set a fire */
export const CRYSTAL_IGNITE_CHANCE: readonly number[] = [0.03, 0.05, 0.08, 0.12, 0.18];
/** Fires set by a crystal are shorter and weaker than the flamethrower's */
export const CRYSTAL_IGNITE_MS = 1600;
export const CRYSTAL_IGNITE_DPS_SHARE = 0.25;

export const CRYSTAL_COLOR: Record<CrystalKind, string> = {
	damage: '#e5484d',
	crit: '#f5c83a',
	fire: '#3dc9f5',
	status: '#ff8a2b'
};

/** Crystal sockets per weapon rarity */
export const CRYSTAL_SOCKETS: Record<Rarity, number> = {
	common: 1,
	uncommon: 1,
	rare: 2,
	epic: 2,
	legendary: 3
};

/** Five crystals of one kind and rarity, plus scrap, make one of the next rarity */
export const CRYSTAL_COMBINE_COUNT = 5;
/** Scrap to combine into uncommon, rare, epic and legendary */
export const CRYSTAL_COMBINE_SCRAP: readonly number[] = [15, 40, 100, 250];

/** Regular enemies drop crystals rarely, and only common and uncommon ones */
export const CRYSTAL_ENEMY_CHANCE: Record<Variant, number> = {
	normal: 0.012,
	super: 0.06,
	mega: 0.15
};
export const CRYSTAL_ENEMY_WEIGHTS: readonly number[] = [85, 15, 0, 0, 0];
/** Bosses always drop crystals: how many (fewest and most) and how rare, by variant */
export const CRYSTAL_BOSS_COUNT: Record<Variant, readonly [number, number]> = {
	normal: [1, 2],
	super: [2, 3],
	mega: [3, 5]
};
export const CRYSTAL_BOSS_WEIGHTS: Record<Variant, readonly number[]> = {
	normal: [50, 32, 14, 3.5, 0.5],
	super: [30, 34, 24, 10, 2],
	mega: [12, 28, 32, 21, 7]
};

// ---------------------------------------------------------------------------------------------
// Season: raid XP fills a monthly track of rewards

export const SEASON_TIERS = 30;
export const SEASON_XP_PER_TIER = 600;

// ---------------------------------------------------------------------------------------------
// Profile

/** Stash slots between raids; extra gear is salvaged into gold when a raid ends */
export const STASH_SIZE = 40;

/** Score: ten points per second survived plus the XP earned */
export const SCORE_PER_SECOND = 10;

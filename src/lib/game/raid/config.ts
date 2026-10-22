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

export const WEAPON_KINDS = ['rifle', 'marksman', 'shotgun', 'smg', 'launcher'] as const;
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
	'mine'
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
		skills: ['barrage', 'mine']
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
	mine: 6000
};

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

// ---------------------------------------------------------------------------------------------
// Armour

export const ARMOR_SLOTS = ['helmet', 'vest'] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];

/** A helmet adds maximum health */
export const HELMET_HP = 22;
/** A vest adds armour: damage taken is scaled by 100 / (100 + armour) */
export const VEST_ARMOR = 14;

// ---------------------------------------------------------------------------------------------
// Enemies

export const ARCHETYPES = ['grunt', 'fast', 'heavy', 'ranged', 'boss'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

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
	/** Ranged enemies hold this distance and shoot from it */
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

/** Shown in the HUD: 1 at the start, one more every 45 seconds */
export function threatLevel(minutes: number): number {
	return 1 + Math.floor((minutes * 60) / 45);
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

/** The first boss arrives after two minutes, then one every two and a half */
export const FIRST_BOSS_MS = 120_000;
export const BOSS_EVERY_MS = 150_000;

/** Archetype weights for regular spawns; the tougher ones get more common over time */
export function archetypeWeights(minutes: number): { item: Archetype; weight: number }[] {
	return [
		{ item: 'grunt', weight: 10 },
		{ item: 'fast', weight: 4 + minutes },
		{ item: 'ranged', weight: minutes < 0.5 ? 0 : 3 + minutes * 0.8 },
		{ item: 'heavy', weight: minutes < 1 ? 0 : 1.5 + minutes * 0.7 }
	];
}

/** Spawns appear just outside the camera, at this distance from the player */
export const SPAWN_DISTANCE_MIN = 620;
export const SPAWN_DISTANCE_MAX = 820;

// ---------------------------------------------------------------------------------------------
// Pickups

/** Gold, medkits and upgrade kits fly to the player from this far */
export const MAGNET_RADIUS = 95;
export const PICKUP_RADIUS = 26;
/** Gear (weapons and armour) waits on the ground until the player walks over it */
export const GEAR_PICKUP_RADIUS = 34;
export const MEDKIT_HEAL_SHARE = 0.25;
/** Loot left on the ground disappears after a while, so the map does not fill up */
export const LOOT_LIFETIME_MS = 45_000;

// ---------------------------------------------------------------------------------------------
// Profile

export const MAX_PLAYER_LEVEL = 50;
/** Stash slots between raids; extra gear is salvaged into gold when a raid ends */
export const STASH_SIZE = 40;

/** Score: ten points per second survived plus the XP earned */
export const SCORE_PER_SECOND = 10;

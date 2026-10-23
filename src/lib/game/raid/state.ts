/*
 * The raid simulation: one plain state object that stepRaid advances in fixed steps and the
 * renderer reads. The player walks with a stick or the keys and attacks by tapping or holding the
 * weapon button; every shot aims itself at the closest enemy in sight (as in mo.co). Each weapon
 * brings two skills; they, the weapon swap and the revive are commands. Enemies stream in from
 * beyond the camera, tougher and more often the longer the raid lasts, and every defeat can drop
 * loot and, rarely (from bosses always), crystals. Drones fly over cover and crash into the
 * player, medics heal, mortars and artillery shell marked spots. Ice and oil make everyone slide,
 * mud slows them. Each step returns events for sounds and effects.
 */
import { pickWeighted, randomInt, type Random } from '#lib/game/random.js';
import {
	ARCHETYPE_CAP,
	ARCHETYPE_SPECS,
	ARTILLERY_FLIGHT_MS,
	ARTILLERY_RADIUS,
	ARTILLERY_SCATTER,
	ARTILLERY_SHELLS,
	BARRAGE_RANGE,
	BARRAGE_ROCKETS,
	BLAST_ANGLE,
	BLAST_DAMAGE_FACTOR,
	BLAST_PUSH,
	BLAST_RADIUS,
	BOSS_EVERY_MS,
	BOSS_SLAM_EVERY_MS,
	BOSS_SLAM_RADIUS,
	BOSS_SLAM_WINDUP_MS,
	BOSS_VOLLEY_BULLETS,
	BOSS_VOLLEY_EVERY_MS,
	BURN_TICK_MS,
	DASH_MS,
	DASH_SPEED,
	DRONE_BLAST_RADIUS,
	DRONE_LIFETIME_MS,
	ENEMY_BULLET_SPEED,
	FIRST_BOSS_MS,
	FLASHPOINT_CRIT_MULTIPLIER,
	FLASHPOINT_DAMAGE_FACTOR,
	FLASHPOINT_RANGE,
	FOCUS_SHOTS,
	GEAR_PICKUP_RADIUS,
	GRENADE_DAMAGE_FACTOR,
	GRENADE_FUSE_MS,
	GRENADE_RADIUS,
	GRENADE_THROW_RANGE,
	HEAL_SHARE,
	HIT_GRACE_MS,
	JAMMER_COOLDOWN_MS,
	JAMMER_RADIUS,
	LOOT_LIFETIME_MS,
	MAGNET_RADIUS,
	MAX_ITEM_LEVEL,
	MAX_MINES,
	MAX_NESTS,
	MEDIC_BOSS_HEAL_SHARE,
	MEDIC_HEAL_RADIUS,
	MEDIC_HEAL_SHARE,
	MEDKIT_HEAL_SHARE,
	MINE_ARM_MS,
	MINE_DAMAGE_FACTOR,
	MINE_LIFETIME_MS,
	MINE_RADIUS,
	MINE_TRIGGER_RADIUS,
	MORTAR_FLIGHT_MS,
	MORTAR_RADIUS,
	MUD_SPEED,
	NAPALM_MS,
	NAPALM_RADIUS,
	NAPALM_THROW_RANGE,
	NEST_LAUNCH_MS,
	NEST_LIFETIME_MS,
	NOVA_BULLETS,
	NOVA_DAMAGE_FACTOR,
	OVERCLOCK_LAUNCH_FACTOR,
	OVERCLOCK_MS,
	OVERDRIVE_FIRE_FACTOR,
	OVERDRIVE_MS,
	PICKUP_RADIUS,
	PLAYER_RADIUS,
	PLAYER_SPEED,
	RAILSHOT_DAMAGE_FACTOR,
	RAILSHOT_RANGE,
	REVIVE_BLAST_RADIUS,
	REVIVE_HEALTH_SHARE,
	REVIVE_INVULNERABLE_MS,
	REVIVES_PER_RAID,
	SCORE_PER_SECOND,
	SKILL_COOLDOWN_MS,
	SKILL_IDS,
	SLIPPERY_GRIP,
	SPAWN_DISTANCE_MAX,
	SPAWN_DISTANCE_MIN,
	SPIKES_REFLECT,
	SWARM_DRONES,
	TRAIL_BURN_MS,
	TRAIL_DPS,
	TRAIL_DPS_PER_LEVEL,
	TRAIL_EVERY_MS,
	TRAIL_MS,
	TRAIL_RADIUS,
	VARIANT_SPECS,
	WEAPONS,
	archetypeWeights,
	maxEnemies,
	megaChance,
	rewardMultiplier,
	spawnIntervalMs,
	superChance,
	threatDamage,
	threatHp,
	threatLevel,
	type Archetype,
	type ArmorSlot,
	type MapId,
	type SkillId,
	type Variant,
	type WeaponKind
} from './config';
import { blocked, lineOfSight, resolveCircle, segmentDistance, steer } from './geometry';
import {
	bootsSpeed,
	damageTakenFactor,
	makeArmor,
	perkOf,
	rollCrystals,
	rollLoot,
	upgraded,
	weaponDamage,
	weaponStats,
	type Crystal,
	type GearItem,
	type LootDrop,
	type WeaponStats
} from './items';
import { raidMap, terrainAt, type RaidMap } from './maps';
import { armorFor, maxHpFor, type Loadout, type WeaponSlot } from './profile';

export type { WeaponSlot };

export interface Player {
	x: number;
	y: number;
	/** Current velocity; on ice and oil it only slowly follows the stick */
	vx: number;
	vy: number;
	hp: number;
	maxHp: number;
	armor: number;
	/** Where the weapon points, in radians */
	aim: number;
	/** The player is walking this step (for the walk animation) */
	moving: boolean;
	held: WeaponSlot;
	/** The attack button is held down */
	firing: boolean;
	/** A tap that came in during the reload, fired as soon as the weapon is ready */
	fireQueued: boolean;
	fireMs: number;
	/** Cooldown left per skill */
	skillMs: Record<SkillId, number>;
	/** Focus: this many coming shots are certain critical hits */
	focusShots: number;
	/** Overdrive: faster fire while above 0 */
	overdriveMs: number;
	/** Overclock: drone nests launch faster while above 0 */
	overclockMs: number;
	/** Dash: time left and direction */
	dashMs: number;
	dashX: number;
	dashY: number;
	graceMs: number;
	invulnerableMs: number;
	/** Counts up while walking, drives the walk cycle */
	stepPhase: number;
	/** Fire trail boots: time to the next patch of fire */
	trailMs: number;
	/** Jammer helmet: time until it can throw the next drone off course */
	jammerMs: number;
}

export interface Enemy {
	id: number;
	archetype: Archetype;
	variant: Variant;
	x: number;
	y: number;
	vx: number;
	vy: number;
	hp: number;
	maxHp: number;
	speed: number;
	damage: number;
	radius: number;
	attackMs: number;
	/** Counts down after a hit, for the white flash */
	flashMs: number;
	facing: number;
	/** Bosses: time to the next slam and volley; windup > 0 while a slam is coming */
	slamMs: number;
	slamWindupMs: number;
	volleyMs: number;
	/** Enemies that keep their distance circle the player in this direction (1 or -1) */
	strafe: number;
	/** Walk cycle */
	phase: number;
	/** Drones fly over all cover */
	flying: boolean;
	/** A drone thrown off course by the jammer: it flies at this enemy (or nowhere) and crashes */
	jammed: boolean;
	jamTargetId: number | null;
	jamMs: number;
	/** Burning: time left, damage per second and time to the next tick */
	burnMs: number;
	burnDps: number;
	burnTickMs: number;
}

export interface Bullet {
	x: number;
	y: number;
	vx: number;
	vy: number;
	damage: number;
	crit: boolean;
	rangeLeft: number;
	pierceLeft: number;
	splash: number;
	kind: WeaponKind;
	/** A rail shot: drawn as a long beam */
	rail: boolean;
	/** A puff of flame from the flamethrower */
	flame: boolean;
	/** A hit sets the enemy on fire for this long (0 for none) at this damage per second */
	burnMs: number;
	burnDps: number;
	/** Enemies this bullet already hit, so a piercing shot hits each one once */
	hit: number[];
}

export interface EnemyBullet {
	x: number;
	y: number;
	vx: number;
	vy: number;
	damage: number;
	lifeMs: number;
	big: boolean;
}

/** A mortar or artillery shell on its way to a marked spot */
export interface Shell {
	id: number;
	fromX: number;
	fromY: number;
	x: number;
	y: number;
	ageMs: number;
	flightMs: number;
	radius: number;
	damage: number;
	big: boolean;
}

export interface Grenade {
	fromX: number;
	fromY: number;
	x: number;
	y: number;
	ageMs: number;
	damage: number;
}

export interface Mine {
	id: number;
	x: number;
	y: number;
	ageMs: number;
	damage: number;
}

/** A drone nest built by the player: it sends kamikaze drones at enemies in reach */
export interface Nest {
	id: number;
	x: number;
	y: number;
	ageMs: number;
	launchMs: number;
	/** The drone weapon's stats when it was built */
	damage: number;
	critChance: number;
	critMultiplier: number;
}

/** One of the player's kamikaze drones, homing in on an enemy */
export interface FriendlyDrone {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	targetId: number | null;
	lifeMs: number;
	damage: number;
	crit: boolean;
}

/** Fire on the ground (napalm or the trail of fire boots) that sets enemies walking in it alight */
export interface FirePool {
	id: number;
	x: number;
	y: number;
	radius: number;
	ageMs: number;
	lifeMs: number;
	burnMs: number;
	burnDps: number;
	trail: boolean;
}

export interface Loot {
	id: number;
	x: number;
	y: number;
	drop: LootDrop;
	ageMs: number;
}

export interface MoveInput {
	/** Stick direction, each in -1..1; the length (up to 1) is the speed */
	x: number;
	y: number;
}

export interface RaidState {
	mapId: MapId;
	map: RaidMap;
	timeMs: number;
	playerLevel: number;
	player: Player;
	loadout: Loadout;
	enemies: Enemy[];
	bullets: Bullet[];
	enemyBullets: EnemyBullet[];
	shells: Shell[];
	grenades: Grenade[];
	mines: Mine[];
	nests: Nest[];
	drones: FriendlyDrone[];
	fires: FirePool[];
	loot: Loot[];
	input: MoveInput;
	spawnMs: number;
	nextBossMs: number;
	revivesLeft: number;
	/** Knocked out and waiting for the revive decision: the world stands still */
	down: boolean;
	over: boolean;
	threat: number;
	kills: number;
	/** Defeated enemies by archetype, for the results */
	killsBy: Record<Archetype, number>;
	bossKills: number;
	superKills: number;
	megaKills: number;
	damageDealt: number;
	biggestHit: number;
	xp: number;
	gold: number;
	scrap: number;
	/** Gear picked up this raid, including anything swapped out of the loadout */
	haul: GearItem[];
	/** Crystals picked up this raid */
	crystals: Crystal[];
	nextId: number;
}

export type RaidEvent =
	| { type: 'shot'; kind: WeaponKind }
	| { type: 'hit'; x: number; y: number; damage: number; crit: boolean; burn: boolean }
	| { type: 'splash'; x: number; y: number; radius: number }
	| {
			type: 'kill';
			x: number;
			y: number;
			archetype: Archetype;
			variant: Variant;
			xp: number;
	  }
	| { type: 'player-hit'; damage: number }
	| { type: 'enemy-shot'; x: number; y: number }
	| { type: 'heal'; amount: number; source: 'ability' | 'medkit' }
	| { type: 'skill'; skill: SkillId }
	| { type: 'blast'; x: number; y: number; angle: number }
	| { type: 'mine-burst'; x: number; y: number }
	| { type: 'grenade-burst'; x: number; y: number }
	| { type: 'boss-spawn'; variant: Variant }
	| { type: 'boss-windup'; x: number; y: number }
	| { type: 'boss-slam'; x: number; y: number }
	| { type: 'drone-crash'; x: number; y: number }
	| { type: 'shell-launch'; x: number; y: number; big: boolean }
	| { type: 'shell-burst'; x: number; y: number; radius: number }
	| { type: 'medic-heal'; x: number; y: number }
	| { type: 'nest'; x: number; y: number }
	| { type: 'nest-launch' }
	| { type: 'flare'; x: number; y: number }
	| { type: 'napalm'; x: number; y: number }
	| { type: 'jammed'; x: number; y: number }
	| { type: 'spikes'; x: number; y: number }
	| { type: 'gold'; amount: number; x: number; y: number }
	| { type: 'scrap'; amount: number; x: number; y: number }
	| { type: 'crystal'; crystal: Crystal; x: number; y: number }
	| { type: 'gear'; item: GearItem }
	| { type: 'weapon-kit'; kind: WeaponKind; level: number; maxed: boolean }
	| { type: 'armor-kit'; slot: ArmorSlot; level: number; fresh: boolean }
	| { type: 'swap'; kind: WeaponKind }
	| { type: 'equip'; item: GearItem }
	| { type: 'threat'; level: number }
	| { type: 'down' }
	| { type: 'revive'; x: number; y: number }
	| { type: 'over' };

export function minutesOf(state: RaidState): number {
	return state.timeMs / 60000;
}

export function heldWeapon(state: RaidState) {
	return state.loadout[state.player.held];
}

/** The two skills of the held weapon */
export function heldSkills(state: RaidState): readonly [SkillId, SkillId] {
	return WEAPONS[heldWeapon(state).kind].skills;
}

const readySkills = () =>
	Object.fromEntries(SKILL_IDS.map((skill) => [skill, 0])) as Record<SkillId, number>;

const noKills = () =>
	Object.fromEntries(Object.keys(ARCHETYPE_SPECS).map((archetype) => [archetype, 0])) as Record<
		Archetype,
		number
	>;

export function scoreOf(state: RaidState): number {
	return Math.floor(state.timeMs / 1000) * SCORE_PER_SECOND + Math.floor(state.xp);
}

export function createRaid(mapId: MapId, loadout: Loadout, playerLevel: number): RaidState {
	const map = raidMap(mapId);
	const maxHp = maxHpFor(playerLevel, loadout.helmet);
	return {
		mapId,
		map,
		timeMs: 0,
		playerLevel,
		player: {
			x: map.spawn.x,
			y: map.spawn.y,
			vx: 0,
			vy: 0,
			hp: maxHp,
			maxHp,
			armor: armorFor(loadout.vest),
			aim: 0,
			moving: false,
			held: 'primary',
			firing: false,
			fireQueued: false,
			fireMs: 0,
			skillMs: readySkills(),
			focusShots: 0,
			overdriveMs: 0,
			overclockMs: 0,
			dashMs: 0,
			dashX: 0,
			dashY: 0,
			graceMs: 0,
			invulnerableMs: 0,
			stepPhase: 0,
			trailMs: 0,
			jammerMs: 0
		},
		loadout: { ...structuredClone(loadout), boots: loadout.boots ?? null },
		enemies: [],
		bullets: [],
		enemyBullets: [],
		shells: [],
		grenades: [],
		mines: [],
		nests: [],
		drones: [],
		fires: [],
		loot: [],
		input: { x: 0, y: 0 },
		spawnMs: 900,
		nextBossMs: FIRST_BOSS_MS,
		revivesLeft: REVIVES_PER_RAID,
		down: false,
		over: false,
		threat: 1,
		kills: 0,
		killsBy: noKills(),
		bossKills: 0,
		superKills: 0,
		megaKills: 0,
		damageDealt: 0,
		biggestHit: 0,
		xp: 0,
		gold: 0,
		scrap: 0,
		haul: [],
		crystals: [],
		nextId: 1
	};
}

const active = (state: RaidState) => !state.down && !state.over;

// ---------------------------------------------------------------------------------------------
// Commands

export function setMove(state: RaidState, x: number, y: number) {
	const length = Math.hypot(x, y);
	state.input = length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/** Attack button pressed (true) or released (false); a press always fires at least once */
export function setFiring(state: RaidState, on: boolean) {
	state.player.firing = on && active(state);
	if (on && active(state)) state.player.fireQueued = true;
}

export function swapWeapon(state: RaidState): RaidEvent[] {
	if (!active(state)) return [];
	state.player.held = state.player.held === 'primary' ? 'secondary' : 'primary';
	// A short draw delay, so swapping cannot skip a slow weapon's reload
	state.player.fireMs = Math.max(state.player.fireMs, 220);
	return [{ type: 'swap', kind: heldWeapon(state).kind }];
}

/** Fires one of the held weapon's two skills (0 or 1) if it is off cooldown */
export function useSkill(state: RaidState, slot: 0 | 1): RaidEvent[] {
	const skill = heldSkills(state)[slot];
	if (!active(state) || state.player.skillMs[skill] > 0) return [];
	const events: RaidEvent[] = [{ type: 'skill', skill }];
	SKILLS[skill](state, events);
	state.player.skillMs[skill] = SKILL_COOLDOWN_MS[skill];
	return events;
}

/** Everything the held weapon does, crystals included */
const heldStats = (state: RaidState) => weaponStats(heldWeapon(state), state.playerLevel);

/** Shot damage of the held weapon, the base the skills scale from */
const heldDamage = (state: RaidState) => weaponDamage(heldWeapon(state), state.playerLevel);

/** Where the player aims a skill: the nearest enemy in sight, or straight ahead */
function aimAngle(state: RaidState, range: number): number {
	const { player } = state;
	const target = nearestEnemy(state, range);
	return target ? Math.atan2(target.y - player.y, target.x - player.x) : player.aim;
}

function pushBullet(
	state: RaidState,
	angle: number,
	speed: number,
	fields: Partial<Bullet> & Pick<Bullet, 'damage' | 'rangeLeft'>
) {
	const { player } = state;
	state.bullets.push({
		x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 6),
		y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 6),
		vx: Math.cos(angle) * speed,
		vy: Math.sin(angle) * speed,
		crit: false,
		pierceLeft: 0,
		splash: 0,
		kind: heldWeapon(state).kind,
		rail: false,
		flame: false,
		burnMs: 0,
		burnDps: 0,
		hit: [],
		...fields
	});
}

/** A spot on the ground at a target (or ahead of the player), inside the map */
function throwSpot(state: RaidState, target: Enemy | null, ahead = 200) {
	const { player, map } = state;
	const x = target ? target.x : player.x + Math.cos(player.aim) * ahead;
	const y = target ? target.y : player.y + Math.sin(player.aim) * ahead;
	return { x: Math.max(0, Math.min(map.width, x)), y: Math.max(0, Math.min(map.height, y)) };
}

/** What each skill does */
const SKILLS: Record<SkillId, (state: RaidState, events: RaidEvent[]) => void> = {
	// Service Rifle: field medkit and frag grenade
	heal(state, events) {
		const { player } = state;
		const amount = Math.min(player.maxHp - player.hp, Math.round(player.maxHp * HEAL_SHARE));
		player.hp += amount;
		events.push({ type: 'heal', amount, source: 'ability' });
	},
	grenade(state) {
		const { player } = state;
		const spot = throwSpot(state, nearestEnemy(state, GRENADE_THROW_RANGE, false));
		state.grenades.push({
			fromX: player.x,
			fromY: player.y,
			x: spot.x,
			y: spot.y,
			ageMs: 0,
			damage: heldDamage(state) * GRENADE_DAMAGE_FACTOR
		});
	},
	// Marksman Rifle: certain crits for a few shots, and one beam through everything in line
	focus(state) {
		state.player.focusShots = FOCUS_SHOTS;
		state.player.fireMs = 0;
	},
	railshot(state, events) {
		const stats = heldStats(state);
		const angle = aimAngle(state, RAILSHOT_RANGE);
		state.player.aim = angle;
		pushBullet(state, angle, 2600, {
			damage: stats.damage * RAILSHOT_DAMAGE_FACTOR * stats.critMultiplier,
			crit: true,
			rangeLeft: RAILSHOT_RANGE,
			pierceLeft: 99,
			rail: true
		});
		events.push({ type: 'shot', kind: heldWeapon(state).kind });
	},
	// Shotgun: an untouchable dodge, and a cone that hurts and shoves
	dash(state) {
		const { player, input } = state;
		const moving = Math.hypot(input.x, input.y) > 0.05;
		const angle = moving ? Math.atan2(input.y, input.x) : player.aim;
		player.dashX = Math.cos(angle);
		player.dashY = Math.sin(angle);
		player.dashMs = DASH_MS;
		player.invulnerableMs = Math.max(player.invulnerableMs, DASH_MS + 80);
	},
	blast(state, events) {
		const { player } = state;
		const angle = aimAngle(state, BLAST_RADIUS + 60);
		player.aim = angle;
		events.push({ type: 'blast', x: player.x, y: player.y, angle });
		const damage = heldDamage(state) * BLAST_DAMAGE_FACTOR;
		for (const enemy of state.enemies) {
			const dx = enemy.x - player.x;
			const dy = enemy.y - player.y;
			const distance = Math.hypot(dx, dy);
			if (distance > BLAST_RADIUS + enemy.radius) continue;
			let off = Math.abs(Math.atan2(dy, dx) - angle) % (Math.PI * 2);
			if (off > Math.PI) off = Math.PI * 2 - off;
			// Anything pressed right against the player is hit whichever way it stands
			if (off > BLAST_ANGLE / 2 && distance > enemy.radius + PLAYER_RADIUS + 10) continue;
			if (distance > 0.001 && enemy.archetype !== 'boss') {
				enemy.x += (dx / distance) * BLAST_PUSH;
				enemy.y += (dy / distance) * BLAST_PUSH;
				keepInside(state, enemy);
			}
			damageEnemy(state, enemy, damage, false, events);
		}
		state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
	},
	// SMG: much faster fire for a while, and a ring of bullets in every direction
	overdrive(state) {
		state.player.overdriveMs = OVERDRIVE_MS;
	},
	nova(state, events) {
		const damage = heldDamage(state) * NOVA_DAMAGE_FACTOR;
		for (let i = 0; i < NOVA_BULLETS; i++) {
			pushBullet(state, state.player.aim + (i / NOVA_BULLETS) * Math.PI * 2, 900, {
				damage,
				rangeLeft: 320
			});
		}
		events.push({ type: 'shot', kind: heldWeapon(state).kind });
	},
	// Rocket Launcher: a rocket at each of the nearest enemies, and landmines
	barrage(state, events) {
		const { player } = state;
		const splash = WEAPONS[heldWeapon(state).kind].splash || 80;
		const targets = state.enemies
			.map((enemy) => ({ enemy, distance: Math.hypot(enemy.x - player.x, enemy.y - player.y) }))
			.filter(({ distance }) => distance < BARRAGE_RANGE)
			.sort((a, b) => a.distance - b.distance)
			.slice(0, BARRAGE_ROCKETS);
		for (let i = 0; i < BARRAGE_ROCKETS; i++) {
			const target = targets.length > 0 ? targets[i % targets.length] : null;
			const spreadOut = (i - (BARRAGE_ROCKETS - 1) / 2) * (target ? 0.05 : 0.3);
			const angle =
				(target ? Math.atan2(target.enemy.y - player.y, target.enemy.x - player.x) : player.aim) +
				spreadOut;
			pushBullet(state, angle, 620, {
				damage: heldDamage(state),
				rangeLeft: target ? target.distance + 10 : BARRAGE_RANGE,
				splash
			});
		}
		events.push({ type: 'shot', kind: heldWeapon(state).kind });
	},
	mine(state) {
		const { player } = state;
		if (state.mines.length >= MAX_MINES) state.mines.shift();
		state.mines.push({
			id: state.nextId++,
			x: player.x,
			y: player.y,
			ageMs: 0,
			damage: heldDamage(state) * MINE_DAMAGE_FACTOR
		});
	},
	// Flamethrower: a huge critical hit on every burning enemy, and a pool of napalm
	flashpoint(state, events) {
		const { player } = state;
		const stats = heldStats(state);
		const damage =
			stats.damage *
			FLASHPOINT_DAMAGE_FACTOR *
			Math.max(stats.critMultiplier, FLASHPOINT_CRIT_MULTIPLIER);
		for (const enemy of state.enemies) {
			if (enemy.burnMs <= 0) continue;
			if (Math.hypot(enemy.x - player.x, enemy.y - player.y) > FLASHPOINT_RANGE) continue;
			events.push({ type: 'flare', x: enemy.x, y: enemy.y });
			damageEnemy(state, enemy, damage, true, events);
		}
		state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
	},
	napalm(state, events) {
		const stats = heldStats(state);
		const spot = throwSpot(state, nearestEnemy(state, NAPALM_THROW_RANGE, false), 160);
		state.fires.push({
			id: state.nextId++,
			x: spot.x,
			y: spot.y,
			radius: NAPALM_RADIUS,
			ageMs: 0,
			lifeMs: NAPALM_MS,
			burnMs: Math.max(stats.burnMs, WEAPONS.flamethrower.burnMs * stats.statusFactor),
			burnDps: stats.burnDps,
			trail: false
		});
		events.push({ type: 'napalm', x: spot.x, y: spot.y });
	},
	// Drone nest: every nest (and the player) sends a swarm, and nests launch faster for a while
	swarm(state, events) {
		const { player } = state;
		const stats = heldStats(state);
		const launchers = [
			...state.nests.map((nest) => ({ x: nest.x, y: nest.y, count: SWARM_DRONES })),
			{ x: player.x, y: player.y, count: 2 }
		];
		for (const from of launchers) {
			const targets = enemiesByDistance(state, from.x, from.y, WEAPONS.dronenest.range * 1.3);
			for (let i = 0; i < from.count; i++) {
				const target = targets.length > 0 ? targets[i % targets.length] : null;
				launchDrone(state, from.x, from.y, stats, target, player.aim + (i - 1) * 0.5);
			}
		}
		events.push({ type: 'nest-launch' });
	},
	overclock(state) {
		state.player.overclockMs = OVERCLOCK_MS;
	}
};

/** Gets back up once per raid, with a shockwave that clears some room */
export function revive(state: RaidState): RaidEvent[] {
	if (!state.down || state.revivesLeft <= 0) return [];
	const { player } = state;
	state.down = false;
	state.revivesLeft -= 1;
	player.hp = Math.round(player.maxHp * REVIVE_HEALTH_SHARE);
	player.invulnerableMs = REVIVE_INVULNERABLE_MS;
	state.enemyBullets = [];
	state.shells = [];
	const events: RaidEvent[] = [{ type: 'revive', x: player.x, y: player.y }];
	for (const enemy of [...state.enemies]) {
		const dx = enemy.x - player.x;
		const dy = enemy.y - player.y;
		const distance = Math.hypot(dx, dy);
		if (distance > REVIVE_BLAST_RADIUS) continue;
		const push = REVIVE_BLAST_RADIUS - distance + 40;
		if (distance > 0.001) {
			enemy.x += (dx / distance) * push;
			enemy.y += (dy / distance) * push;
			keepInside(state, enemy);
		}
		const share = enemy.archetype === 'boss' ? 0.05 : 0.4;
		damageEnemy(state, enemy, enemy.maxHp * share, false, events);
	}
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
	return events;
}

/** Ends the raid instead of using the revive */
export function giveUp(state: RaidState): RaidEvent[] {
	if (!state.down) return [];
	state.down = false;
	state.over = true;
	return [{ type: 'over' }];
}

/** Puts a piece of gear from the haul on: weapons replace the held one */
export function equipFromHaul(state: RaidState, itemId: string): RaidEvent[] {
	if (state.over) return [];
	const index = state.haul.findIndex((item) => item.id === itemId);
	if (index < 0) return [];
	const item = state.haul[index];
	const { loadout, player } = state;
	state.haul.splice(index, 1);
	if (item.type === 'weapon') {
		state.haul.push(loadout[player.held]);
		loadout[player.held] = item;
		player.fireMs = Math.max(player.fireMs, 220);
	} else {
		const previous = loadout[item.slot];
		if (previous) state.haul.push(previous);
		loadout[item.slot] = item;
		refreshStats(state);
	}
	return [{ type: 'equip', item }];
}

/** Recomputes health and armour after an armour change, keeping the health share */
function refreshStats(state: RaidState) {
	const { player, loadout } = state;
	const share = player.maxHp > 0 ? player.hp / player.maxHp : 1;
	player.maxHp = maxHpFor(state.playerLevel, loadout.helmet);
	player.hp = Math.max(1, Math.round(player.maxHp * share));
	player.armor = armorFor(loadout.vest);
}

// ---------------------------------------------------------------------------------------------
// Step

export function stepRaid(state: RaidState, random: Random, dtMs: number): RaidEvent[] {
	if (!active(state)) return [];
	const events: RaidEvent[] = [];
	const dt = dtMs / 1000;
	state.timeMs += dtMs;

	const threat = threatLevel(minutesOf(state));
	if (threat !== state.threat) {
		state.threat = threat;
		events.push({ type: 'threat', level: threat });
	}

	movePlayer(state, dtMs);
	tickCooldowns(state, dtMs);
	firePlayer(state, random, events);
	moveBullets(state, dt, events);
	updateGrenades(state, dtMs, events);
	updateMines(state, dtMs, events);
	updateNests(state, dtMs, events);
	updateDrones(state, dtMs, events);
	updateFires(state, dtMs);
	updateBurning(state, dtMs, events);
	updateJammer(state, random, events);
	updateEnemies(state, random, dtMs, events);
	moveEnemyBullets(state, dtMs, events);
	updateShells(state, dtMs, events);
	updateLoot(state, dtMs, events);
	spawn(state, random, dtMs, events);
	return events;
}

/**
 * Turns a walker's velocity towards where it wants to go: at once on firm ground, slowly on ice
 * and oil (so it slides). Mud slows the wanted speed.
 */
function walk(
	state: RaidState,
	body: { x: number; y: number; vx: number; vy: number },
	wantX: number,
	wantY: number,
	dt: number
) {
	const ground = terrainAt(state.map, body.x, body.y);
	const slow = ground === 'mud' ? MUD_SPEED : 1;
	if (ground === 'ice' || ground === 'oil') {
		const k = Math.min(1, SLIPPERY_GRIP * dt);
		body.vx += (wantX * slow - body.vx) * k;
		body.vy += (wantY * slow - body.vy) * k;
	} else {
		body.vx = wantX * slow;
		body.vy = wantY * slow;
	}
	body.x += body.vx * dt;
	body.y += body.vy * dt;
}

/** Walking speed with the boots on */
export function playerSpeed(state: RaidState): number {
	return PLAYER_SPEED * (1 + bootsSpeed(state.loadout.boots));
}

function movePlayer(state: RaidState, dtMs: number) {
	const { player, input, map } = state;
	const dt = dtMs / 1000;
	if (player.dashMs > 0) {
		player.moving = true;
		player.x += player.dashX * DASH_SPEED * dt;
		player.y += player.dashY * DASH_SPEED * dt;
		player.vx = player.dashX * PLAYER_SPEED;
		player.vy = player.dashY * PLAYER_SPEED;
		resolveCircle(player, PLAYER_RADIUS, map.obstacles, map.width, map.height);
		return;
	}
	const speed = Math.hypot(input.x, input.y);
	const walking = speed > 0.05;
	const wanted = walking ? playerSpeed(state) : 0;
	walk(state, player, walking ? input.x * wanted : 0, walking ? input.y * wanted : 0, dt);
	player.moving = walking || Math.hypot(player.vx, player.vy) > 20;
	if (walking) player.stepPhase += speed * dt * 9;
	resolveCircle(player, PLAYER_RADIUS, map.obstacles, map.width, map.height);
	// Fire boots leave a burning trail behind while walking
	if (walking && perkOf(state.loadout.boots) === 'trail') {
		player.trailMs -= dtMs;
		if (player.trailMs <= 0) {
			player.trailMs = TRAIL_EVERY_MS;
			state.fires.push({
				id: state.nextId++,
				x: player.x,
				y: player.y,
				radius: TRAIL_RADIUS,
				ageMs: 0,
				lifeMs: TRAIL_MS,
				burnMs: TRAIL_BURN_MS,
				burnDps: TRAIL_DPS + TRAIL_DPS_PER_LEVEL * state.playerLevel,
				trail: true
			});
		}
	}
}

function tickCooldowns(state: RaidState, dtMs: number) {
	const { player } = state;
	player.fireMs = Math.max(0, player.fireMs - dtMs);
	for (const skill of SKILL_IDS) {
		player.skillMs[skill] = Math.max(0, player.skillMs[skill] - dtMs);
	}
	player.overdriveMs = Math.max(0, player.overdriveMs - dtMs);
	player.overclockMs = Math.max(0, player.overclockMs - dtMs);
	player.dashMs = Math.max(0, player.dashMs - dtMs);
	player.graceMs = Math.max(0, player.graceMs - dtMs);
	player.invulnerableMs = Math.max(0, player.invulnerableMs - dtMs);
	player.jammerMs = Math.max(0, player.jammerMs - dtMs);
}

/** The nearest enemy within reach, optionally only one the player can see (drones always are) */
export function nearestEnemy(state: RaidState, range: number, needSight = true): Enemy | null {
	const { player, map } = state;
	let best: Enemy | null = null;
	let bestDistance = Infinity;
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y) - enemy.radius;
		if (distance > range || distance >= bestDistance) continue;
		if (
			needSight &&
			!enemy.flying &&
			!lineOfSight(map.obstacles, player.x, player.y, enemy.x, enemy.y)
		)
			continue;
		best = enemy;
		bestDistance = distance;
	}
	return best;
}

/** Living enemies within reach of a spot, nearest first */
function enemiesByDistance(state: RaidState, x: number, y: number, range: number): Enemy[] {
	return state.enemies
		.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) < range)
		.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}

function firePlayer(state: RaidState, random: Random, events: RaidEvent[]) {
	const { player } = state;
	const weapon = heldWeapon(state);
	const spec = WEAPONS[weapon.kind];
	const target = nearestEnemy(state, spec.range);
	if (target) player.aim = Math.atan2(target.y - player.y, target.x - player.x);
	else if (Math.hypot(state.input.x, state.input.y) > 0.05)
		player.aim = Math.atan2(state.input.y, state.input.x);
	// Only the attack button fires: with nobody in reach the shot goes where the player faces
	if (!(player.firing || player.fireQueued) || player.fireMs > 0) return;

	const stats = weaponStats(weapon, state.playerLevel);
	player.fireQueued = false;
	player.fireMs = stats.fireMs * (player.overdriveMs > 0 ? OVERDRIVE_FIRE_FACTOR : 1);
	if (weapon.kind === 'dronenest') {
		buildNest(state, stats, events);
		return;
	}
	const focused = player.focusShots > 0;
	if (focused) player.focusShots -= 1;
	for (let i = 0; i < spec.pellets; i++) {
		const offset =
			spec.pellets > 1
				? -spec.spread / 2 + (spec.spread * i) / (spec.pellets - 1) + (random() - 0.5) * 0.08
				: (random() - 0.5) * spec.spread;
		const angle = player.aim + offset;
		const crit = focused || random() < stats.critChance;
		// Only a chance below 1 (a status crystal) rolls, so plain weapons keep their random stream
		const burns = stats.burnMs > 0 && (stats.burnChance >= 1 || random() < stats.burnChance);
		state.bullets.push({
			x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 6),
			y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 6),
			vx: Math.cos(angle) * spec.projectileSpeed,
			vy: Math.sin(angle) * spec.projectileSpeed,
			damage: crit ? stats.damage * stats.critMultiplier : stats.damage,
			crit,
			rangeLeft: spec.range * 1.2,
			pierceLeft: spec.pierce,
			splash: spec.splash,
			kind: weapon.kind,
			rail: false,
			flame: weapon.kind === 'flamethrower',
			burnMs: burns ? stats.burnMs : 0,
			burnDps: burns ? stats.burnDps : 0,
			hit: []
		});
	}
	events.push({ type: 'shot', kind: weapon.kind });
}

/** The drone nest weapon's attack: a nest a step ahead; the oldest goes when there are too many */
function buildNest(state: RaidState, stats: WeaponStats, events: RaidEvent[]) {
	const { player, map } = state;
	const spot = {
		x: player.x + Math.cos(player.aim) * (PLAYER_RADIUS + 14),
		y: player.y + Math.sin(player.aim) * (PLAYER_RADIUS + 14)
	};
	resolveCircle(spot, 16, map.obstacles, map.width, map.height);
	if (state.nests.length >= MAX_NESTS) state.nests.shift();
	state.nests.push({
		id: state.nextId++,
		x: spot.x,
		y: spot.y,
		ageMs: 0,
		launchMs: 350,
		damage: stats.damage,
		critChance: stats.critChance,
		critMultiplier: stats.critMultiplier
	});
	events.push({ type: 'nest', x: spot.x, y: spot.y });
}

/** Sends one kamikaze drone from a spot at a target (or off in a direction) */
function launchDrone(
	state: RaidState,
	x: number,
	y: number,
	stats: Pick<WeaponStats, 'damage' | 'critChance' | 'critMultiplier'>,
	target: Enemy | null,
	fallbackAngle: number
) {
	const angle = target ? Math.atan2(target.y - y, target.x - x) : fallbackAngle;
	const speed = WEAPONS.dronenest.projectileSpeed;
	// Crits are decided by the drone's id, so drones do not shift the step's random stream
	const crit = ((state.nextId * 2654435761) >>> 0) / 4294967296 < stats.critChance;
	state.drones.push({
		id: state.nextId++,
		x,
		y,
		vx: Math.cos(angle) * speed,
		vy: Math.sin(angle) * speed,
		targetId: target?.id ?? null,
		lifeMs: target ? DRONE_LIFETIME_MS : 900,
		damage: crit ? stats.damage * stats.critMultiplier : stats.damage,
		crit
	});
}

function updateNests(state: RaidState, dtMs: number, events: RaidEvent[]) {
	const speedUp = state.player.overclockMs > 0 ? 1 / OVERCLOCK_LAUNCH_FACTOR : 1;
	const kept: Nest[] = [];
	for (const nest of state.nests) {
		nest.ageMs += dtMs;
		if (nest.ageMs > NEST_LIFETIME_MS) continue;
		kept.push(nest);
		nest.launchMs -= dtMs * speedUp;
		if (nest.launchMs > 0) continue;
		const target = enemiesByDistance(state, nest.x, nest.y, WEAPONS.dronenest.range)[0];
		if (!target) {
			nest.launchMs = 0;
			continue;
		}
		nest.launchMs = NEST_LAUNCH_MS;
		launchDrone(state, nest.x, nest.y, nest, target, 0);
		events.push({ type: 'nest-launch' });
	}
	state.nests = kept;
}

function updateDrones(state: RaidState, dtMs: number, events: RaidEvent[]) {
	const dt = dtMs / 1000;
	const speed = WEAPONS.dronenest.projectileSpeed;
	const splash = WEAPONS.dronenest.splash;
	const kept: FriendlyDrone[] = [];
	for (const drone of state.drones) {
		drone.lifeMs -= dtMs;
		let target = state.enemies.find((enemy) => enemy.id === drone.targetId && enemy.hp > 0);
		if (!target && drone.targetId !== null) {
			target = enemiesByDistance(state, drone.x, drone.y, 500)[0];
			drone.targetId = target?.id ?? null;
		}
		if (target) {
			// Homing: the velocity turns towards the target, the speed stays the same
			const dx = target.x - drone.x;
			const dy = target.y - drone.y;
			const distance = Math.hypot(dx, dy) || 1;
			const k = Math.min(1, dt * 7);
			drone.vx += ((dx / distance) * speed - drone.vx) * k;
			drone.vy += ((dy / distance) * speed - drone.vy) * k;
			const length = Math.hypot(drone.vx, drone.vy) || 1;
			drone.vx = (drone.vx / length) * speed;
			drone.vy = (drone.vy / length) * speed;
		}
		drone.x += drone.vx * dt;
		drone.y += drone.vy * dt;
		const arrived =
			target && Math.hypot(target.x - drone.x, target.y - drone.y) < target.radius + 8;
		if (arrived || drone.lifeMs <= 0) {
			explode(state, drone.x, drone.y, splash, drone.damage, drone.crit, events);
			continue;
		}
		kept.push(drone);
	}
	state.drones = kept;
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function moveBullets(state: RaidState, dt: number, events: RaidEvent[]) {
	const { map } = state;
	const kept: Bullet[] = [];
	for (const bullet of state.bullets) {
		const fromX = bullet.x;
		const fromY = bullet.y;
		bullet.x += bullet.vx * dt;
		bullet.y += bullet.vy * dt;
		bullet.rangeLeft -= Math.hypot(bullet.vx, bullet.vy) * dt;
		const spent = bullet.rangeLeft <= 0;
		let alive = true;

		for (const enemy of state.enemies) {
			if (enemy.hp <= 0 || bullet.hit.includes(enemy.id)) continue;
			// Flames swell as they travel, so they catch a little more off to the side
			const reach = enemy.radius + (bullet.flame ? 14 : 4);
			if (segmentDistance(fromX, fromY, bullet.x, bullet.y, enemy.x, enemy.y) > reach) continue;
			bullet.hit.push(enemy.id);
			if (bullet.splash > 0) {
				explode(state, enemy.x, enemy.y, bullet.splash, bullet.damage, bullet.crit, events);
				alive = false;
				break;
			}
			damageEnemy(state, enemy, bullet.damage, bullet.crit, events);
			if (bullet.burnMs > 0) ignite(enemy, bullet.burnMs, bullet.burnDps);
			if (bullet.pierceLeft <= 0) {
				alive = false;
				break;
			}
			bullet.pierceLeft -= 1;
		}
		if (alive && !lineOfSight(map.obstacles, fromX, fromY, bullet.x, bullet.y)) {
			if (bullet.splash > 0)
				explode(state, bullet.x, bullet.y, bullet.splash, bullet.damage, bullet.crit, events);
			alive = false;
		}
		// Rockets that reach the end of their flight still go off
		if (alive && spent) {
			if (bullet.splash > 0) {
				explode(state, bullet.x, bullet.y, bullet.splash, bullet.damage, bullet.crit, events);
			}
			alive = false;
		}
		if (alive) kept.push(bullet);
	}
	state.bullets = kept;
	// Damage can remove enemies mid-loop; drop the defeated ones once at the end
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function explode(
	state: RaidState,
	x: number,
	y: number,
	radius: number,
	damage: number,
	crit: boolean,
	events: RaidEvent[]
) {
	events.push({ type: 'splash', x, y, radius });
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		if (Math.hypot(enemy.x - x, enemy.y - y) > radius + enemy.radius) continue;
		damageEnemy(state, enemy, damage, crit, events);
	}
}

function updateGrenades(state: RaidState, dtMs: number, events: RaidEvent[]) {
	const kept: Grenade[] = [];
	for (const grenade of state.grenades) {
		grenade.ageMs += dtMs;
		if (grenade.ageMs < GRENADE_FUSE_MS) {
			kept.push(grenade);
			continue;
		}
		events.push({ type: 'grenade-burst', x: grenade.x, y: grenade.y });
		explode(state, grenade.x, grenade.y, GRENADE_RADIUS, grenade.damage, false, events);
	}
	state.grenades = kept;
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function updateMines(state: RaidState, dtMs: number, events: RaidEvent[]) {
	const kept: Mine[] = [];
	for (const mine of state.mines) {
		mine.ageMs += dtMs;
		if (mine.ageMs > MINE_LIFETIME_MS) continue;
		const triggered =
			mine.ageMs >= MINE_ARM_MS &&
			state.enemies.some(
				(enemy) =>
					!enemy.flying &&
					Math.hypot(enemy.x - mine.x, enemy.y - mine.y) < enemy.radius + MINE_TRIGGER_RADIUS
			);
		if (!triggered) {
			kept.push(mine);
			continue;
		}
		events.push({ type: 'mine-burst', x: mine.x, y: mine.y });
		explode(state, mine.x, mine.y, MINE_RADIUS, mine.damage, false, events);
	}
	state.mines = kept;
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

// ---------------------------------------------------------------------------------------------
// Burning

/** Sets an enemy on fire, or keeps it burning longer and hotter */
export function ignite(enemy: Enemy, ms: number, dps: number) {
	if (enemy.hp <= 0 || ms <= 0) return;
	if (enemy.burnMs <= 0) enemy.burnTickMs = BURN_TICK_MS;
	enemy.burnMs = Math.max(enemy.burnMs, ms);
	enemy.burnDps = Math.max(enemy.burnDps, dps);
}

/** Napalm and fire trails set every walking enemy in them alight */
function updateFires(state: RaidState, dtMs: number) {
	const kept: FirePool[] = [];
	for (const fire of state.fires) {
		fire.ageMs += dtMs;
		if (fire.ageMs > fire.lifeMs) continue;
		kept.push(fire);
		for (const enemy of state.enemies) {
			if (enemy.flying) continue;
			if (Math.hypot(enemy.x - fire.x, enemy.y - fire.y) > fire.radius + enemy.radius * 0.6)
				continue;
			ignite(enemy, fire.burnMs, fire.burnDps);
		}
	}
	// A long walk in fire boots leaves only its newest patches burning
	state.fires = kept.length > 60 ? kept.slice(-60) : kept;
}

function updateBurning(state: RaidState, dtMs: number, events: RaidEvent[]) {
	for (const enemy of state.enemies) {
		if (enemy.burnMs <= 0 || enemy.hp <= 0) continue;
		enemy.burnMs -= dtMs;
		enemy.burnTickMs -= dtMs;
		if (enemy.burnTickMs <= 0) {
			enemy.burnTickMs += BURN_TICK_MS;
			damageEnemy(state, enemy, (enemy.burnDps * BURN_TICK_MS) / 1000, false, events, true);
		}
		if (enemy.burnMs <= 0) {
			enemy.burnMs = 0;
			enemy.burnDps = 0;
		}
	}
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

// ---------------------------------------------------------------------------------------------
// Damage and defeat

function damageEnemy(
	state: RaidState,
	enemy: Enemy,
	damage: number,
	crit: boolean,
	events: RaidEvent[],
	burn = false
) {
	if (enemy.hp <= 0) return;
	state.damageDealt += Math.min(enemy.hp, damage);
	if (!burn) state.biggestHit = Math.max(state.biggestHit, damage);
	enemy.hp -= damage;
	enemy.flashMs = 90;
	events.push({ type: 'hit', x: enemy.x, y: enemy.y - enemy.radius, damage, crit, burn });
	if (enemy.hp <= 0) defeat(state, enemy, events);
}

function defeat(state: RaidState, enemy: Enemy, events: RaidEvent[]) {
	const spec = ARCHETYPE_SPECS[enemy.archetype];
	const variant = VARIANT_SPECS[enemy.variant];
	const minutes = minutesOf(state);
	const reward = rewardMultiplier(minutes) * state.map.reward * variant.reward;
	const xp = spec.xp * reward;
	state.xp += xp;
	state.kills += 1;
	state.killsBy[enemy.archetype] += 1;
	if (enemy.archetype === 'boss') state.bossKills += 1;
	if (enemy.variant === 'super') state.superKills += 1;
	if (enemy.variant === 'mega') state.megaKills += 1;
	events.push({
		type: 'kill',
		x: enemy.x,
		y: enemy.y,
		archetype: enemy.archetype,
		variant: enemy.variant,
		xp
	});

	const boss = enemy.archetype === 'boss';
	const random = lootRandom(state, enemy);
	const drops = rollLoot(random, {
		dropChance: spec.dropChance + variant.dropBonus,
		extraDrops: variant.extraDrops + (boss ? 2 : 0),
		luck: spec.luck + variant.luck + minutes * 0.15 + (state.map.reward - 1),
		gold: spec.gold * reward,
		itemLevel: Math.min(MAX_ITEM_LEVEL, 1 + Math.floor(minutes / 1.5) + state.map.itemLevelBonus),
		// Only bosses are sure to drop gear; for everyone else it is a rare find
		guaranteedGear: boss,
		floor: boss ? (enemy.variant === 'normal' ? 'rare' : 'epic') : undefined
	});
	for (const crystal of rollCrystals(random, boss, enemy.variant)) {
		drops.push({ type: 'crystal', crystal });
	}
	drops.forEach((drop, index) => {
		const angle = (index / Math.max(1, drops.length)) * Math.PI * 2 + enemy.id;
		const spread = drops.length > 1 ? enemy.radius * 0.6 + 26 : 0;
		const spot = { x: enemy.x + Math.cos(angle) * spread, y: enemy.y + Math.sin(angle) * spread };
		resolveCircle(spot, 10, state.map.obstacles, state.map.width, state.map.height);
		state.loot.push({ id: state.nextId++, x: spot.x, y: spot.y, drop, ageMs: 0 });
	});
}

/**
 * Loot gets its own random stream per enemy, so whether it drops does not shift the spawns and
 * aim wobble that follow (and tests can count on the same enemies appearing).
 */
function lootRandom(state: RaidState, enemy: Enemy): Random {
	let seed = (enemy.id * 2654435761 + Math.floor(state.timeMs)) >>> 0;
	return () => {
		seed = (seed + 0x6d2b79f5) >>> 0;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Hurts the player; returns the damage that got through (0 while untouchable) */
function hurtPlayer(state: RaidState, raw: number, events: RaidEvent[]): number {
	const { player } = state;
	if (player.invulnerableMs > 0 || player.graceMs > 0 || !active(state)) return 0;
	const damage = Math.max(
		1,
		Math.round(
			raw * threatDamage(minutesOf(state)) * state.map.difficulty * damageTakenFactor(player.armor)
		)
	);
	player.hp = Math.max(0, player.hp - damage);
	player.graceMs = HIT_GRACE_MS;
	events.push({ type: 'player-hit', damage });
	if (player.hp > 0) return damage;
	if (state.revivesLeft > 0) {
		state.down = true;
		state.input = { x: 0, y: 0 };
		player.firing = false;
		player.fireQueued = false;
		events.push({ type: 'down' });
	} else {
		state.over = true;
		events.push({ type: 'over' });
	}
	return damage;
}

// ---------------------------------------------------------------------------------------------
// Enemies

/** Back inside the map and, unless it flies, out of the cover */
function keepInside(state: RaidState, enemy: Enemy) {
	const { map } = state;
	resolveCircle(enemy, enemy.radius, enemy.flying ? [] : map.obstacles, map.width, map.height);
}

/**
 * Jammer helmet: every so often the nearest drone in range is thrown off course. It turns on the
 * nearest other enemy and crashes into it, or spins away and crashes on its own.
 */
function updateJammer(state: RaidState, random: Random, events: RaidEvent[]) {
	const { player } = state;
	if (perkOf(state.loadout.helmet) !== 'jammer' || player.jammerMs > 0) return;
	let drone: Enemy | null = null;
	let best = JAMMER_RADIUS;
	for (const enemy of state.enemies) {
		if (!enemy.flying || enemy.jammed || enemy.hp <= 0) continue;
		const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
		if (distance < best) {
			best = distance;
			drone = enemy;
		}
	}
	if (!drone) return;
	player.jammerMs = JAMMER_COOLDOWN_MS;
	drone.jammed = true;
	const victim = state.enemies.find(
		(enemy) =>
			!enemy.flying && enemy.hp > 0 && Math.hypot(enemy.x - drone.x, enemy.y - drone.y) < 420
	);
	drone.jamTargetId = victim?.id ?? null;
	drone.jamMs = 1100;
	// With nobody to crash into it veers off sideways, away from the player
	drone.facing += (random() < 0.5 ? 1 : -1) * (Math.PI * 0.6 + random() * 0.4);
	events.push({ type: 'jammed', x: drone.x, y: drone.y });
}

/** A kamikaze drone blows up; a jammed one takes the enemies around it along */
function crashDrone(state: RaidState, drone: Enemy, events: RaidEvent[]) {
	const { player } = state;
	events.push({ type: 'drone-crash', x: drone.x, y: drone.y });
	if (drone.jammed) {
		// Counts as the player's kill: the jammer brought it down
		damageEnemy(state, drone, drone.hp, false, events);
		for (const enemy of state.enemies) {
			if (enemy === drone || enemy.hp <= 0) continue;
			if (Math.hypot(enemy.x - drone.x, enemy.y - drone.y) > DRONE_BLAST_RADIUS + enemy.radius)
				continue;
			damageEnemy(state, enemy, drone.damage * 4, false, events);
		}
		return;
	}
	drone.hp = 0;
	if (Math.hypot(player.x - drone.x, player.y - drone.y) < DRONE_BLAST_RADIUS + PLAYER_RADIUS) {
		hurtPlayer(state, drone.damage, events);
	}
}

function flyDrone(
	state: RaidState,
	drone: Enemy,
	dt: number,
	distance: number,
	events: RaidEvent[]
) {
	const { player } = state;
	drone.phase += dt * 30;
	if (drone.jammed) {
		drone.jamMs -= dt * 1000;
		const victim = state.enemies.find((enemy) => enemy.id === drone.jamTargetId && enemy.hp > 0);
		if (victim) drone.facing = Math.atan2(victim.y - drone.y, victim.x - drone.x);
		else drone.facing += dt * 5;
		drone.x += Math.cos(drone.facing) * drone.speed * 1.3 * dt;
		drone.y += Math.sin(drone.facing) * drone.speed * 1.3 * dt;
		const hit =
			victim && Math.hypot(victim.x - drone.x, victim.y - drone.y) < victim.radius + drone.radius;
		if (hit || drone.jamMs <= 0) crashDrone(state, drone, events);
		return;
	}
	drone.facing = Math.atan2(player.y - drone.y, player.x - drone.x);
	drone.x += Math.cos(drone.facing) * drone.speed * dt;
	drone.y += Math.sin(drone.facing) * drone.speed * dt;
	if (distance < drone.radius + PLAYER_RADIUS + 4) crashDrone(state, drone, events);
}

function updateEnemies(state: RaidState, random: Random, dtMs: number, events: RaidEvent[]) {
	const { player, map } = state;
	const dt = dtMs / 1000;
	for (const enemy of state.enemies) {
		if (!active(state)) break;
		if (enemy.hp <= 0) continue;
		enemy.attackMs = Math.max(0, enemy.attackMs - dtMs);
		enemy.flashMs = Math.max(0, enemy.flashMs - dtMs);
		const dx = player.x - enemy.x;
		const dy = player.y - enemy.y;
		const distance = Math.hypot(dx, dy) || 1;
		const toX = dx / distance;
		const toY = dy / distance;

		if (enemy.flying) {
			flyDrone(state, enemy, dt, distance, events);
			continue;
		}
		enemy.facing = Math.atan2(dy, dx);

		const spec = ARCHETYPE_SPECS[enemy.archetype];
		let wantX = toX;
		let wantY = toY;
		let speed = enemy.speed;

		// Enemies that fight from afar hold their distance and circle the player
		if (spec.keepDistance > 0) {
			const keep = spec.keepDistance;
			const tangentX = -toY * enemy.strafe;
			const tangentY = toX * enemy.strafe;
			if (distance > keep + 40) {
				wantX = toX * 0.9 + tangentX * 0.3;
				wantY = toY * 0.9 + tangentY * 0.3;
			} else if (distance < keep - 50) {
				wantX = -toX * 0.9 + tangentX * 0.3;
				wantY = -toY * 0.9 + tangentY * 0.3;
			} else {
				wantX = tangentX;
				wantY = tangentY;
				speed *= 0.5;
			}
			if (enemy.attackMs <= 0) rangedAttack(state, random, enemy, distance, toX, toY, events);
		}

		if (enemy.archetype === 'boss') {
			speed = updateBoss(state, enemy, dtMs, events) ? 0 : speed;
		}

		const direction =
			speed > 0 ? steer(map.obstacles, enemy.x, enemy.y, enemy.radius, wantX, wantY) : null;
		walk(
			state,
			enemy,
			direction ? direction.x * speed : 0,
			direction ? direction.y * speed : 0,
			dt
		);
		enemy.phase += dt * Math.hypot(enemy.vx, enemy.vy) * 0.06;

		// Contact damage for everyone that walks into the player; spikes hurt them back
		if (
			spec.keepDistance === 0 &&
			enemy.attackMs <= 0 &&
			distance < enemy.radius + PLAYER_RADIUS + 4
		) {
			enemy.attackMs = spec.attackMs;
			const dealt = hurtPlayer(state, enemy.damage, events);
			if (dealt > 0 && perkOf(state.loadout.vest) === 'spikes') {
				events.push({ type: 'spikes', x: enemy.x, y: enemy.y });
				const reflect =
					enemy.damage * SPIKES_REFLECT * threatDamage(minutesOf(state)) * state.map.difficulty;
				damageEnemy(state, enemy, reflect, false, events);
			}
		}
	}
	state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
	separate(state);
}

/** The attacks of the enemies that keep their distance: shots, heals and shells */
function rangedAttack(
	state: RaidState,
	random: Random,
	enemy: Enemy,
	distance: number,
	toX: number,
	toY: number,
	events: RaidEvent[]
) {
	const { player, map } = state;
	const spec = ARCHETYPE_SPECS[enemy.archetype];
	const keep = spec.keepDistance;
	const reload = () => (enemy.attackMs = spec.attackMs * (0.85 + random() * 0.3));
	switch (enemy.archetype) {
		case 'ranged':
			if (
				distance < keep + 140 &&
				lineOfSight(map.obstacles, enemy.x, enemy.y, player.x, player.y)
			) {
				reload();
				state.enemyBullets.push({
					x: enemy.x + toX * enemy.radius,
					y: enemy.y + toY * enemy.radius,
					vx: toX * ENEMY_BULLET_SPEED,
					vy: toY * ENEMY_BULLET_SPEED,
					damage: enemy.damage,
					lifeMs: 2400,
					big: enemy.variant !== 'normal'
				});
				events.push({ type: 'enemy-shot', x: enemy.x, y: enemy.y });
			}
			return;
		case 'medic': {
			// A pulse only when someone nearby needs it
			const patients = state.enemies.filter(
				(other) =>
					other !== enemy &&
					other.hp > 0 &&
					other.hp < other.maxHp &&
					Math.hypot(other.x - enemy.x, other.y - enemy.y) < MEDIC_HEAL_RADIUS + other.radius
			);
			if (patients.length === 0) {
				enemy.attackMs = 400;
				return;
			}
			reload();
			for (const other of patients) {
				const share = other.archetype === 'boss' ? MEDIC_BOSS_HEAL_SHARE : MEDIC_HEAL_SHARE;
				other.hp = Math.min(other.maxHp, other.hp + other.maxHp * share);
			}
			events.push({ type: 'medic-heal', x: enemy.x, y: enemy.y });
			return;
		}
		case 'mortar':
			if (distance > keep + 160) return;
			reload();
			lobShell(state, random, enemy, 30, MORTAR_RADIUS, MORTAR_FLIGHT_MS, false);
			events.push({ type: 'shell-launch', x: enemy.x, y: enemy.y, big: false });
			return;
		case 'artillery':
			if (distance > keep + 240) return;
			reload();
			for (let i = 0; i < ARTILLERY_SHELLS; i++) {
				lobShell(
					state,
					random,
					enemy,
					i === 0 ? 20 : ARTILLERY_SCATTER,
					ARTILLERY_RADIUS,
					ARTILLERY_FLIGHT_MS + i * 160,
					true
				);
			}
			events.push({ type: 'shell-launch', x: enemy.x, y: enemy.y, big: true });
			return;
	}
}

/** Fires a shell at the player's spot, give or take some scatter */
function lobShell(
	state: RaidState,
	random: Random,
	from: Enemy,
	scatter: number,
	radius: number,
	flightMs: number,
	big: boolean
) {
	const { player, map } = state;
	const angle = random() * Math.PI * 2;
	const off = random() * scatter;
	state.shells.push({
		id: state.nextId++,
		fromX: from.x,
		fromY: from.y,
		x: Math.max(0, Math.min(map.width, player.x + Math.cos(angle) * off)),
		y: Math.max(0, Math.min(map.height, player.y + Math.sin(angle) * off)),
		ageMs: 0,
		flightMs,
		radius,
		damage: from.damage,
		big
	});
}

function updateShells(state: RaidState, dtMs: number, events: RaidEvent[]) {
	const { player } = state;
	const kept: Shell[] = [];
	for (const shell of state.shells) {
		if (!active(state)) {
			kept.push(shell);
			continue;
		}
		shell.ageMs += dtMs;
		if (shell.ageMs < shell.flightMs) {
			kept.push(shell);
			continue;
		}
		events.push({ type: 'shell-burst', x: shell.x, y: shell.y, radius: shell.radius });
		if (Math.hypot(player.x - shell.x, player.y - shell.y) < shell.radius + PLAYER_RADIUS * 0.5) {
			hurtPlayer(state, shell.damage, events);
		}
	}
	state.shells = kept;
}

/** Runs the boss's slam and volley; true while it stands still winding up */
function updateBoss(state: RaidState, boss: Enemy, dtMs: number, events: RaidEvent[]): boolean {
	const { player } = state;
	if (boss.slamWindupMs > 0) {
		boss.slamWindupMs -= dtMs;
		if (boss.slamWindupMs <= 0) {
			boss.slamWindupMs = 0;
			events.push({ type: 'boss-slam', x: boss.x, y: boss.y });
			if (Math.hypot(player.x - boss.x, player.y - boss.y) < BOSS_SLAM_RADIUS + PLAYER_RADIUS) {
				hurtPlayer(state, boss.damage * 1.4, events);
			}
		}
		return true;
	}
	boss.slamMs -= dtMs;
	boss.volleyMs -= dtMs;
	const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
	if (boss.slamMs <= 0 && distance < BOSS_SLAM_RADIUS * 1.6) {
		boss.slamMs = BOSS_SLAM_EVERY_MS;
		boss.slamWindupMs = BOSS_SLAM_WINDUP_MS;
		events.push({ type: 'boss-windup', x: boss.x, y: boss.y });
		return true;
	}
	if (boss.volleyMs <= 0) {
		boss.volleyMs = BOSS_VOLLEY_EVERY_MS;
		const start = Math.atan2(player.y - boss.y, player.x - boss.x);
		for (let i = 0; i < BOSS_VOLLEY_BULLETS; i++) {
			const angle = start + (i / BOSS_VOLLEY_BULLETS) * Math.PI * 2;
			state.enemyBullets.push({
				x: boss.x + Math.cos(angle) * boss.radius,
				y: boss.y + Math.sin(angle) * boss.radius,
				vx: Math.cos(angle) * ENEMY_BULLET_SPEED * 0.7,
				vy: Math.sin(angle) * ENEMY_BULLET_SPEED * 0.7,
				damage: boss.damage * 0.5,
				lifeMs: 3200,
				big: true
			});
		}
		events.push({ type: 'enemy-shot', x: boss.x, y: boss.y });
	}
	return false;
}

/** Keeps enemies from stacking on one spot, and out of the cover (drones fly over it) */
function separate(state: RaidState) {
	const { enemies } = state;
	for (let i = 0; i < enemies.length; i++) {
		const a = enemies[i];
		for (let j = i + 1; j < enemies.length; j++) {
			const b = enemies[j];
			// Drones fly over the heads of those on the ground
			if (a.flying !== b.flying) continue;
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const min = a.radius + b.radius;
			const distanceSquared = dx * dx + dy * dy;
			if (distanceSquared >= min * min || distanceSquared < 0.0001) continue;
			const distance = Math.sqrt(distanceSquared);
			const push = (min - distance) / 2;
			// Bosses barely budge
			const shareA = a.archetype === 'boss' ? 0.1 : b.archetype === 'boss' ? 1.9 : 1;
			const shareB = 2 - shareA;
			a.x -= (dx / distance) * push * shareA;
			a.y -= (dy / distance) * push * shareA;
			b.x += (dx / distance) * push * shareB;
			b.y += (dy / distance) * push * shareB;
		}
		keepInside(state, a);
	}
}

function moveEnemyBullets(state: RaidState, dtMs: number, events: RaidEvent[]) {
	const { player, map } = state;
	const dt = dtMs / 1000;
	const kept: EnemyBullet[] = [];
	for (const bullet of state.enemyBullets) {
		const fromX = bullet.x;
		const fromY = bullet.y;
		bullet.x += bullet.vx * dt;
		bullet.y += bullet.vy * dt;
		bullet.lifeMs -= dtMs;
		if (bullet.lifeMs <= 0) continue;
		if (!lineOfSight(map.obstacles, fromX, fromY, bullet.x, bullet.y)) continue;
		const reach = PLAYER_RADIUS + (bullet.big ? 9 : 6);
		if (segmentDistance(fromX, fromY, bullet.x, bullet.y, player.x, player.y) < reach) {
			hurtPlayer(state, bullet.damage, events);
			if (!active(state)) return;
			continue;
		}
		kept.push(bullet);
	}
	state.enemyBullets = kept;
}

// ---------------------------------------------------------------------------------------------
// Loot

function updateLoot(state: RaidState, dtMs: number, events: RaidEvent[]) {
	const { player } = state;
	const dt = dtMs / 1000;
	const kept: Loot[] = [];
	for (const loot of state.loot) {
		loot.ageMs += dtMs;
		const gear = loot.drop.type === 'gear';
		// Gear and crystals stay until picked up; the small stuff fades after a while
		const lasting = gear || loot.drop.type === 'crystal';
		if (!lasting && loot.ageMs > LOOT_LIFETIME_MS) continue;
		const dx = player.x - loot.x;
		const dy = player.y - loot.y;
		const distance = Math.hypot(dx, dy);
		if (gear) {
			if (distance < GEAR_PICKUP_RADIUS + PLAYER_RADIUS) {
				collect(state, loot, events);
				continue;
			}
		} else {
			if (distance < PICKUP_RADIUS + PLAYER_RADIUS) {
				collect(state, loot, events);
				continue;
			}
			if (distance < MAGNET_RADIUS + PLAYER_RADIUS) {
				const pull = Math.min(distance, 520 * dt);
				loot.x += (dx / distance) * pull;
				loot.y += (dy / distance) * pull;
			}
		}
		kept.push(loot);
	}
	state.loot = kept;
}

function collect(state: RaidState, loot: Loot, events: RaidEvent[]) {
	const { player, loadout } = state;
	const { drop } = loot;
	switch (drop.type) {
		case 'gold':
			state.gold += drop.amount;
			events.push({ type: 'gold', amount: drop.amount, x: loot.x, y: loot.y });
			break;
		case 'scrap':
			state.scrap += drop.amount;
			events.push({ type: 'scrap', amount: drop.amount, x: loot.x, y: loot.y });
			break;
		case 'crystal':
			state.crystals.push(drop.crystal);
			events.push({ type: 'crystal', crystal: drop.crystal, x: loot.x, y: loot.y });
			break;
		case 'medkit': {
			const amount = Math.min(
				player.maxHp - player.hp,
				Math.round(player.maxHp * MEDKIT_HEAL_SHARE)
			);
			player.hp += amount;
			events.push({ type: 'heal', amount, source: 'medkit' });
			break;
		}
		case 'weapon-kit': {
			const weapon = loadout[player.held];
			const maxed = weapon.level >= MAX_ITEM_LEVEL;
			if (maxed) state.gold += 25;
			else loadout[player.held] = upgraded(weapon);
			events.push({
				type: 'weapon-kit',
				kind: weapon.kind,
				level: loadout[player.held].level,
				maxed
			});
			break;
		}
		case 'armor-kit': {
			// Hands out a fresh vest, helmet or boots if one is missing, else upgrades the weakest
			const missing = (['vest', 'helmet', 'boots'] as const).find((slot) => !loadout[slot]);
			let slot: ArmorSlot;
			let fresh = false;
			if (missing) {
				slot = missing;
				loadout[slot] = makeArmor(slot);
				fresh = true;
			} else {
				slot = (['helmet', 'vest', 'boots'] as const).reduce((weakest, candidate) =>
					loadout[candidate]!.level < loadout[weakest]!.level ? candidate : weakest
				);
				loadout[slot] = upgraded(loadout[slot]!);
			}
			refreshStats(state);
			events.push({ type: 'armor-kit', slot, level: loadout[slot]!.level, fresh });
			break;
		}
		case 'gear':
			state.haul.push(drop.item);
			events.push({ type: 'gear', item: drop.item });
			break;
	}
}

// ---------------------------------------------------------------------------------------------
// Spawning

function spawn(state: RaidState, random: Random, dtMs: number, events: RaidEvent[]) {
	const minutes = minutesOf(state);
	if (state.timeMs >= state.nextBossMs) {
		state.nextBossMs += BOSS_EVERY_MS;
		const boss = spawnEnemy(state, random, 'boss', rollVariant(random, minutes));
		if (boss) events.push({ type: 'boss-spawn', variant: boss.variant });
	}
	state.spawnMs -= dtMs;
	if (state.spawnMs > 0) return;
	state.spawnMs = spawnIntervalMs(minutes) * (0.7 + random() * 0.6);
	const regular = state.enemies.filter((enemy) => enemy.archetype !== 'boss').length;
	if (regular >= maxEnemies(minutes)) return;
	let archetype = pickWeighted(random, archetypeWeights(minutes));
	// Support enemies are capped, so a raid never turns into a wall of artillery
	const cap = ARCHETYPE_CAP[archetype];
	if (cap !== undefined && state.enemies.filter((e) => e.archetype === archetype).length >= cap) {
		archetype = 'grunt';
	}
	const variant = rollVariant(random, minutes);
	// Fast ones and drones come in small packs
	const pack = (archetype === 'fast' || archetype === 'drone') && variant === 'normal';
	const count = pack ? randomInt(random, 2, 4) : 1;
	const first = spawnEnemy(state, random, archetype, variant);
	if (!first) return;
	for (let i = 1; i < count; i++) {
		spawnEnemy(state, random, archetype, 'normal', {
			x: first.x + (i * 30 - 30),
			y: first.y + 24 * i
		});
	}
}

export function rollVariant(random: Random, minutes: number): Variant {
	const roll = random();
	if (roll < megaChance(minutes)) return 'mega';
	if (roll < megaChance(minutes) + superChance(minutes)) return 'super';
	return 'normal';
}

/** Adds an enemy out of sight (or at a given spot); null if no free spot was found */
export function spawnEnemy(
	state: RaidState,
	random: Random,
	archetype: Archetype,
	variant: Variant,
	at?: { x: number; y: number }
): Enemy | null {
	const { map, player } = state;
	const spec = ARCHETYPE_SPECS[archetype];
	const variantSpec = VARIANT_SPECS[variant];
	const radius = spec.radius * variantSpec.radius;
	const flying = archetype === 'drone';
	let spot = at ? { ...at } : null;
	for (let attempt = 0; !spot && attempt < 10; attempt++) {
		const angle = random() * Math.PI * 2;
		const distance = SPAWN_DISTANCE_MIN + random() * (SPAWN_DISTANCE_MAX - SPAWN_DISTANCE_MIN);
		const x = player.x + Math.cos(angle) * distance;
		const y = player.y + Math.sin(angle) * distance;
		if (x < radius || y < radius || x > map.width - radius || y > map.height - radius) continue;
		if (!flying && blocked(map.obstacles, x, y, radius)) continue;
		spot = { x, y };
	}
	if (!spot) return null;
	resolveCircle(spot, radius, flying ? [] : map.obstacles, map.width, map.height);
	const minutes = minutesOf(state);
	const hp = spec.hp * variantSpec.hp * threatHp(minutes) * map.difficulty;
	const enemy: Enemy = {
		id: state.nextId++,
		archetype,
		variant,
		x: spot.x,
		y: spot.y,
		vx: 0,
		vy: 0,
		hp,
		maxHp: hp,
		speed: spec.speed * variantSpec.speed,
		damage: spec.damage * variantSpec.damage,
		radius,
		attackMs: 600,
		flashMs: 0,
		facing: Math.atan2(player.y - spot.y, player.x - spot.x),
		slamMs: BOSS_SLAM_EVERY_MS * 0.6,
		slamWindupMs: 0,
		volleyMs: BOSS_VOLLEY_EVERY_MS,
		strafe: random() < 0.5 ? 1 : -1,
		phase: random() * 10,
		flying,
		jammed: false,
		jamTargetId: null,
		jamMs: 0,
		burnMs: 0,
		burnDps: 0,
		burnTickMs: 0
	};
	state.enemies.push(enemy);
	return enemy;
}

/** The boss currently on the field, for the boss health bar */
export function currentBoss(state: RaidState): Enemy | null {
	return state.enemies.find((enemy) => enemy.archetype === 'boss') ?? null;
}

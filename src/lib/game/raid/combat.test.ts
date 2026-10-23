import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	CRYSTAL_BOSS_COUNT,
	MEDIC_HEAL_SHARE,
	PLAYER_SPEED,
	WEAPON_KINDS,
	WEAPONS,
	type Archetype,
	type WeaponKind
} from './config';
import { createDemo, DEMO_MS, stepDemo } from './demo';
import { makeArmor, makeWeapon, rollCrystals, rollLoot } from './items';
import { newProfile } from './profile';
import {
	createRaid,
	setFiring,
	setMove,
	spawnEnemy,
	stepRaid,
	useSkill,
	type RaidEvent,
	type RaidState
} from './state';

const STEP = 1000 / 60;

function quietRaid(weapon?: WeaponKind, map: 'sunflower' | 'arctic' = 'sunflower'): RaidState {
	const loadout = newProfile().loadout;
	if (weapon) loadout.primary = makeWeapon(weapon);
	const state = createRaid(map, loadout, 1);
	state.spawnMs = Infinity;
	state.nextBossMs = Infinity;
	return state;
}

function run(state: RaidState, ms: number, seed = 1): RaidEvent[] {
	const random = createRandom(seed);
	const events: RaidEvent[] = [];
	for (let t = 0; t < ms; t += STEP) events.push(...stepRaid(state, random, STEP));
	return events;
}

function place(state: RaidState, archetype: Archetype, dx: number, dy = 0) {
	return spawnEnemy(state, createRandom(3), archetype, 'normal', {
		x: state.player.x + dx,
		y: state.player.y + dy
	})!;
}

const count = (events: RaidEvent[], type: RaidEvent['type']) =>
	events.filter((event) => event.type === type).length;

describe('kamikaze drones', () => {
	it('fly straight over cover and blow up on the player', () => {
		const state = quietRaid();
		const rock = state.map.obstacles[0];
		// The player stands right behind a piece of cover, the drone right in front of it
		state.player.x = rock.x + rock.r + 30;
		state.player.y = rock.y;
		const drone = place(state, 'drone', -(rock.r * 2 + 80));
		const events = run(state, 3000);
		expect(count(events, 'drone-crash')).toBe(1);
		expect(count(events, 'player-hit')).toBe(1);
		expect(state.enemies).not.toContain(drone);
		// Blowing up on the player is no defeat: no XP for it
		expect(state.kills).toBe(0);
	});

	it('are thrown off course by a jammer helmet and crash into other enemies', () => {
		const state = quietRaid();
		state.loadout.helmet = makeArmor('helmet', 'rare', 1, 'jammer');
		const grunt = place(state, 'grunt', 160, 120);
		grunt.speed = 0;
		place(state, 'drone', 160);
		const events = run(state, 3000);
		expect(count(events, 'jammed')).toBe(1);
		expect(count(events, 'player-hit')).toBe(0);
		expect(grunt.hp).toBeLessThan(grunt.maxHp);
		expect(state.killsBy.drone).toBe(1);
	});
});

describe('support enemies', () => {
	it('medics heal the wounded around them', () => {
		const state = quietRaid();
		const medic = place(state, 'medic', 400);
		const grunt = place(state, 'grunt', 430, 40);
		medic.speed = 0;
		grunt.speed = 0;
		grunt.hp = grunt.maxHp * 0.5;
		const events = run(state, 1500);
		expect(count(events, 'medic-heal')).toBeGreaterThan(0);
		expect(grunt.hp).toBeCloseTo(grunt.maxHp * (0.5 + MEDIC_HEAL_SHARE), 3);
	});

	it('mortars mark a spot and the shell lands there later', () => {
		const state = quietRaid();
		const mortar = place(state, 'mortar', 420);
		mortar.speed = 0;
		const launched = run(state, 700);
		expect(count(launched, 'shell-launch')).toBe(1);
		expect(state.shells).toHaveLength(1);
		// Walking out of the marked spot dodges it
		setMove(state, -1, 0);
		const landed = run(state, 1500);
		expect(count(landed, 'shell-burst')).toBe(1);
		expect(count(landed, 'player-hit')).toBe(0);
	});

	it('Pion guns fire a salvo from far beyond the edge of the screen', () => {
		const state = quietRaid();
		const gun = place(state, 'artillery', 0, -620);
		gun.speed = 0;
		run(state, 700);
		expect(state.shells.length).toBe(3);
	});
});

describe('flamethrower', () => {
	it('sets enemies on fire and the fire keeps hurting them', () => {
		const state = quietRaid('flamethrower');
		const grunt = place(state, 'grunt', 90);
		grunt.speed = 0;
		grunt.hp = grunt.maxHp = 1e6;
		setFiring(state, true);
		run(state, 200);
		setFiring(state, false);
		expect(grunt.burnMs).toBeGreaterThan(0);
		const hp = grunt.hp;
		const events = run(state, 1500);
		expect(grunt.hp).toBeLessThan(hp);
		expect(events.some((event) => event.type === 'hit' && event.burn)).toBe(true);
	});

	it('flashpoint lands a huge critical hit on every burning enemy, and only on those', () => {
		const state = quietRaid('flamethrower');
		const burning = place(state, 'grunt', 300);
		const cold = place(state, 'grunt', 300, 100);
		for (const enemy of [burning, cold]) {
			enemy.speed = 0;
			enemy.hp = enemy.maxHp = 1e6;
		}
		burning.burnMs = 2000;
		burning.burnDps = 1;
		const events = useSkill(state, 0);
		const hits = events.filter((event) => event.type === 'hit');
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ crit: true });
		expect(cold.hp).toBe(cold.maxHp);
		expect(1e6 - burning.hp).toBeGreaterThan(WEAPONS.flamethrower.damage * 20);
	});

	it('napalm leaves a pool that sets walkers alight', () => {
		const state = quietRaid('flamethrower');
		const grunt = place(state, 'grunt', 200);
		grunt.speed = 0;
		useSkill(state, 1);
		run(state, 100);
		expect(state.fires).toHaveLength(1);
		expect(grunt.burnMs).toBeGreaterThan(0);
	});
});

describe('drone nests', () => {
	it('each attack builds a nest that sends drones at enemies in reach', () => {
		const state = quietRaid('dronenest');
		const grunt = place(state, 'grunt', 300);
		grunt.speed = 0;
		grunt.hp = grunt.maxHp = 1e6;
		setFiring(state, true);
		run(state, 100);
		setFiring(state, false);
		expect(state.nests).toHaveLength(1);
		const events = run(state, 3000);
		expect(count(events, 'nest-launch')).toBeGreaterThan(0);
		expect(count(events, 'splash')).toBeGreaterThan(0);
		expect(grunt.hp).toBeLessThan(grunt.maxHp);
	});

	it('swarm launches drones from every nest at once', () => {
		const state = quietRaid('dronenest');
		place(state, 'grunt', 250).speed = 0;
		setFiring(state, true);
		run(state, 50);
		setFiring(state, false);
		const before = state.drones.length;
		useSkill(state, 0);
		expect(state.drones.length - before).toBe(3 + 2);
	});
});

describe('armour perks', () => {
	it('spikes hurt the enemies that hit the player up close', () => {
		const state = quietRaid();
		state.loadout.vest = makeArmor('vest', 'rare', 1, 'spikes');
		const grunt = place(state, 'grunt', 30);
		grunt.speed = 0;
		const events = run(state, 1000);
		expect(count(events, 'spikes')).toBeGreaterThan(0);
		expect(grunt.hp).toBeLessThan(grunt.maxHp);
	});

	it('fire trail boots leave burning patches behind', () => {
		const state = quietRaid();
		state.loadout.boots = makeArmor('boots', 'rare', 1, 'trail');
		setMove(state, 1, 0);
		run(state, 1000);
		expect(state.fires.length).toBeGreaterThan(2);
		expect(state.fires.every((fire) => fire.trail)).toBe(true);
	});

	it('sprint boots make the player much faster', () => {
		const state = quietRaid();
		state.loadout.boots = makeArmor('boots', 'common', 1, 'sprint');
		const startX = state.player.x;
		setMove(state, 1, 0);
		run(state, 1000);
		expect(state.player.x - startX).toBeGreaterThan(PLAYER_SPEED * 1.2);
	});
});

describe('terrain', () => {
	it('mud slows walking down', () => {
		const state = quietRaid();
		const mud = state.map.terrain.find((patch) => patch.kind === 'mud')!;
		state.player.x = mud.x;
		state.player.y = mud.y;
		setMove(state, 1, 0);
		run(state, 200);
		expect(state.player.x - mud.x).toBeLessThan(PLAYER_SPEED * 0.2 * 0.7);
	});

	it('ice keeps the player sliding after letting go of the stick', () => {
		const state = quietRaid(undefined, 'arctic');
		const ice = state.map.terrain.find((patch) => patch.kind === 'ice')!;
		state.player.x = ice.x - ice.r * 0.6;
		state.player.y = ice.y;
		setMove(state, 1, 0);
		run(state, 1000);
		setMove(state, 0, 0);
		const stoppedAt = state.player.x;
		run(state, 200);
		expect(state.player.x - stoppedAt).toBeGreaterThan(10);
	});
});

describe('drops', () => {
	it('gear is a rare find from regular enemies', () => {
		const random = createRandom(5);
		let gear = 0;
		for (let i = 0; i < 2000; i++) {
			const drops = rollLoot(random, {
				dropChance: 0.12,
				extraDrops: 0,
				luck: 0,
				gold: 1,
				itemLevel: 1,
				guaranteedGear: false
			});
			gear += drops.filter((drop) => drop.type === 'gear').length;
		}
		expect(gear / 2000).toBeLessThan(0.02);
	});

	it('bosses always drop crystals, mega bosses more and rarer ones; others never drop rare ones', () => {
		const random = createRandom(9);
		const rare = (rarity: string) => ['rare', 'epic', 'legendary'].includes(rarity);
		let normalRare = 0;
		let megaRare = 0;
		let megaCount = 0;
		for (let i = 0; i < 500; i++) {
			const normal = rollCrystals(random, true, 'normal');
			const mega = rollCrystals(random, true, 'mega');
			expect(normal.length).toBeGreaterThanOrEqual(CRYSTAL_BOSS_COUNT.normal[0]);
			normalRare += normal.filter((crystal) => rare(crystal.rarity)).length;
			megaRare += mega.filter((crystal) => rare(crystal.rarity)).length;
			megaCount += mega.length;
			for (const crystal of rollCrystals(random, false, 'mega')) {
				expect(rare(crystal.rarity)).toBe(false);
			}
		}
		expect(megaCount).toBeGreaterThan(500 * 3);
		expect(megaRare).toBeGreaterThan(normalRare * 3);
	});
});

describe('weapon demos', () => {
	it('every attack and skill of every weapon shows something happening', () => {
		for (const kind of WEAPON_KINDS) {
			for (const action of ['attack', 0, 1] as const) {
				const demo = createDemo(kind, action);
				const hp = () => demo.state.enemies.reduce((sum, enemy) => sum + enemy.hp, 0);
				const before = hp() + demo.state.player.hp;
				for (let t = STEP; t <= DEMO_MS; t += STEP) stepDemo(demo, STEP, t);
				const after = hp() + demo.state.player.hp;
				// Either enemies got hurt, or (the medkit) the player got healed
				expect(after, `${kind} ${action}`).not.toBe(before);
			}
		}
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	FIRST_BOSS_MS,
	HEAL_COOLDOWN_MS,
	PLAYER_SPEED,
	REVIVE_HEALTH_SHARE,
	WEAPONS,
	rewardMultiplier,
	threatHp
} from './config';
import { makeArmor, makeWeapon } from './items';
import { newProfile } from './profile';
import {
	createRaid,
	equipFromHaul,
	giveUp,
	revive,
	scoreOf,
	setFiring,
	setMove,
	spawnEnemy,
	stepRaid,
	swapWeapon,
	useGrenade,
	useHeal,
	type RaidEvent,
	type RaidState
} from './state';

const STEP = 1000 / 60;

/** A raid where nothing spawns unless the test places it */
function quietRaid(level = 1): RaidState {
	const state = createRaid('sunflower', newProfile().loadout, level);
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

/** An enemy right next to the player, in the open */
function placeEnemy(
	state: RaidState,
	dx: number,
	dy = 0,
	variant: 'normal' | 'super' | 'mega' = 'normal'
) {
	const enemy = spawnEnemy(state, createRandom(3), 'grunt', variant, {
		x: state.player.x + dx,
		y: state.player.y + dy
	})!;
	enemy.speed = 0;
	return enemy;
}

const count = (events: RaidEvent[], type: RaidEvent['type']) =>
	events.filter((event) => event.type === type).length;

describe('walking', () => {
	it('moves with the stick at full speed and stops at the map edge', () => {
		const state = quietRaid();
		const startX = state.player.x;
		setMove(state, 1, 0);
		run(state, 1000);
		expect(state.player.x - startX).toBeCloseTo(PLAYER_SPEED, -1);
		setMove(state, 0, -5);
		run(state, 10_000);
		expect(state.player.y).toBeGreaterThan(0);
		expect(state.input.y).toBe(-1);
	});
});

describe('attacking', () => {
	it('never fires on its own, only from the attack button', () => {
		const state = quietRaid();
		placeEnemy(state, 150);
		expect(count(run(state, 2000), 'shot')).toBe(0);
	});

	it('fires once per tap and keeps firing while held, aimed at the closest enemy', () => {
		const state = quietRaid();
		const far = placeEnemy(state, 0, -250);
		const near = placeEnemy(state, 120, 0);
		far.hp = far.maxHp = 1e6;
		near.hp = near.maxHp = 1e6;
		setFiring(state, true);
		setFiring(state, false);
		const tap = run(state, 100);
		expect(count(tap, 'shot')).toBe(1);
		expect(state.player.aim).toBeCloseTo(0, 1);

		setFiring(state, true);
		const held = run(state, 3000);
		expect(count(held, 'shot')).toBeGreaterThanOrEqual(Math.floor(3000 / WEAPONS.rifle.fireMs) - 1);
		expect(near.hp).toBeLessThan(near.maxHp);
		expect(far.hp).toBe(far.maxHp);
	});

	it('defeats enemies for XP, and a super one is worth far more', () => {
		const normal = quietRaid();
		placeEnemy(normal, 100);
		setFiring(normal, true);
		run(normal, 4000);
		const special = quietRaid();
		placeEnemy(special, 100, 0, 'super');
		setFiring(special, true);
		run(special, 8000);
		expect(normal.kills).toBe(1);
		expect(special.kills).toBe(1);
		expect(special.superKills).toBe(1);
		expect(special.xp).toBeGreaterThan(normal.xp * 3);
	});

	it('lands critical hits far more often with the marksman rifle', () => {
		const crits = (swap: boolean) => {
			const state = quietRaid();
			if (swap) swapWeapon(state);
			const target = placeEnemy(state, 140);
			target.hp = target.maxHp = 1e9;
			setFiring(state, true);
			const hits = run(state, 30_000).filter((event) => event.type === 'hit');
			return hits.filter((event) => event.type === 'hit' && event.crit).length / hits.length;
		};
		expect(crits(true)).toBeGreaterThan(0.3);
		expect(crits(false)).toBeLessThan(0.15);
	});
});

describe('skills', () => {
	it('heals with the rifle only, then waits for the cooldown', () => {
		const state = quietRaid();
		state.player.hp = 20;
		expect(useHeal(state)).toHaveLength(1);
		expect(state.player.hp).toBeGreaterThan(20);
		expect(useHeal(state)).toEqual([]);
		run(state, HEAL_COOLDOWN_MS + 50);
		swapWeapon(state);
		expect(useHeal(state)).toEqual([]);
	});

	it('throws a grenade that hurts everything in the blast', () => {
		const state = quietRaid();
		const a = placeEnemy(state, 200, 0);
		const b = placeEnemy(state, 230, 40);
		expect(count(useGrenade(state), 'grenade-throw')).toBe(1);
		const events = run(state, 1000);
		expect(count(events, 'grenade-burst')).toBe(1);
		expect(a.hp).toBeLessThan(a.maxHp);
		expect(b.hp).toBeLessThan(b.maxHp);
	});
});

describe('loot', () => {
	it('picks up gold and upgrade kits, and offers gear for equipping', () => {
		const state = quietRaid();
		const { x, y } = state.player;
		const shotgun = makeWeapon('shotgun', 'epic', 3);
		state.loot.push(
			{ id: 1, x: x + 30, y, drop: { type: 'gold', amount: 7 }, ageMs: 0 },
			{ id: 2, x: x - 30, y, drop: { type: 'weapon-kit' }, ageMs: 0 },
			{ id: 3, x, y: y + 30, drop: { type: 'armor-kit' }, ageMs: 0 },
			{ id: 4, x, y: y - 30, drop: { type: 'gear', item: shotgun }, ageMs: 0 }
		);
		const events = run(state, 500);
		expect(state.loot).toEqual([]);
		expect(state.gold).toBe(7);
		expect(state.loadout.primary.level).toBe(2);
		expect(state.loadout.vest?.level).toBe(1);
		expect(state.player.armor).toBeGreaterThan(0);
		expect(state.haul).toEqual([shotgun]);
		expect(count(events, 'gear')).toBe(1);

		const rifle = state.loadout.primary;
		equipFromHaul(state, shotgun.id);
		expect(state.loadout.primary).toBe(shotgun);
		expect(state.haul).toEqual([rifle]);
	});

	it('keeps health in proportion when a helmet goes on', () => {
		const state = quietRaid();
		state.player.hp = state.player.maxHp / 2;
		const helmet = makeArmor('helmet', 'legendary', 5);
		state.haul.push(helmet);
		equipFromHaul(state, helmet.id);
		expect(state.player.maxHp).toBeGreaterThan(100);
		expect(state.player.hp / state.player.maxHp).toBeCloseTo(0.5, 1);
	});
});

describe('going down', () => {
	it('allows one revive, and the next knock-out ends the raid', () => {
		const state = quietRaid();
		const enemy = placeEnemy(state, 30);
		enemy.damage = 1e4;
		const first = run(state, 1500);
		expect(count(first, 'down')).toBe(1);
		expect(state.down).toBe(true);
		// The world stands still while waiting for the decision
		const frozen = state.timeMs;
		run(state, 500);
		expect(state.timeMs).toBe(frozen);

		expect(count(revive(state), 'revive')).toBe(1);
		expect(state.player.hp).toBe(Math.round(state.player.maxHp * REVIVE_HEALTH_SHARE));
		expect(state.revivesLeft).toBe(0);
		const blasted = state.enemies[0];
		if (blasted) {
			blasted.x = state.player.x + 30;
			blasted.y = state.player.y;
		} else placeEnemy(state, 30).damage = 1e4;
		const second = run(state, 6000);
		expect(count(second, 'over')).toBe(1);
		expect(state.over).toBe(true);
		expect(revive(state)).toEqual([]);
	});

	it('can end the raid instead of reviving', () => {
		const state = quietRaid();
		state.down = true;
		expect(count(giveUp(state), 'over')).toBe(1);
		expect(state.over).toBe(true);
	});
});

describe('the longer the raid', () => {
	it('sends a boss after two minutes', () => {
		const state = createRaid('arctic', newProfile().loadout, 1);
		state.spawnMs = Infinity;
		state.player.invulnerableMs = Infinity;
		const events = run(state, FIRST_BOSS_MS + 100);
		expect(count(events, 'boss-spawn')).toBe(1);
		expect(state.enemies.some((enemy) => enemy.archetype === 'boss')).toBe(true);
	});

	it('spawns tougher enemies and pays more', () => {
		expect(threatHp(5)).toBeGreaterThan(threatHp(0));
		expect(rewardMultiplier(5)).toBeGreaterThan(rewardMultiplier(0) * 2);
		const state = createRaid('sunflower', newProfile().loadout, 1);
		state.player.invulnerableMs = Infinity;
		state.nextBossMs = Infinity;
		const events = run(state, 60_000);
		expect(state.enemies.length).toBeGreaterThan(5);
		expect(count(events, 'threat')).toBeGreaterThan(0);
		expect(scoreOf(state)).toBeGreaterThanOrEqual(600);
	});

	it('plays the same raid from the same seed', () => {
		const a = createRaid('strait', newProfile().loadout, 1);
		const b = createRaid('strait', newProfile().loadout, 1);
		for (const state of [a, b]) {
			setMove(state, 0.5, 0.3);
			setFiring(state, true);
		}
		run(a, 20_000, 42);
		run(b, 20_000, 42);
		expect(b.player.x).toBeCloseTo(a.player.x);
		expect(b.enemies.length).toBe(a.enemies.length);
		expect(b.kills).toBe(a.kills);
	});
});

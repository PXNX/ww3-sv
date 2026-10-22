import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	DASH_MS,
	DASH_SPEED,
	FIRST_BOSS_MS,
	MAX_MINES,
	MINE_ARM_MS,
	NOVA_BULLETS,
	PLAYER_SPEED,
	REVIVE_HEALTH_SHARE,
	WEAPONS,
	SKILL_COOLDOWN_MS,
	rewardMultiplier,
	threatHp,
	type WeaponKind
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
	useSkill,
	type RaidEvent,
	type RaidState
} from './state';

const STEP = 1000 / 60;

/** A raid where nothing spawns unless the test places it, optionally holding another weapon */
function quietRaid(level = 1, weapon?: WeaponKind): RaidState {
	const loadout = newProfile().loadout;
	if (weapon) loadout.primary = makeWeapon(weapon);
	const state = createRaid('sunflower', loadout, level);
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
	it("uses the held weapon's skills, each with its own cooldown", () => {
		const state = quietRaid();
		state.player.hp = 20;
		expect(count(useSkill(state, 0), 'heal')).toBe(1);
		expect(state.player.hp).toBeGreaterThan(20);
		expect(useSkill(state, 0)).toEqual([]);
		run(state, SKILL_COOLDOWN_MS.heal + 50);
		expect(useSkill(state, 0)).toHaveLength(2);
		// The marksman rifle brings other skills on the same buttons
		swapWeapon(state);
		expect(useSkill(state, 0)[0]).toEqual({ type: 'skill', skill: 'focus' });
	});

	it('throws a grenade that hurts everything in the blast', () => {
		const state = quietRaid();
		const a = placeEnemy(state, 200, 0);
		const b = placeEnemy(state, 230, 40);
		expect(useSkill(state, 1)[0]).toEqual({ type: 'skill', skill: 'grenade' });
		const events = run(state, 1000);
		expect(count(events, 'grenade-burst')).toBe(1);
		expect(a.hp).toBeLessThan(a.maxHp);
		expect(b.hp).toBeLessThan(b.maxHp);
	});
});

describe('weapon skills', () => {
	const tough = (state: RaidState, dx: number, dy = 0) => {
		const enemy = placeEnemy(state, dx, dy);
		enemy.hp = enemy.maxHp = 1e6;
		return enemy;
	};

	it('focus makes the next three shots certain critical hits', () => {
		const state = quietRaid(1, 'marksman');
		tough(state, 150);
		useSkill(state, 0);
		setFiring(state, true);
		const hits = run(state, 2600).filter((event) => event.type === 'hit');
		expect(hits.slice(0, 3).every((event) => event.type === 'hit' && event.crit)).toBe(true);
		expect(state.player.focusShots).toBe(0);
	});

	it('rail shot pierces every enemy in the line', () => {
		const state = quietRaid(1, 'marksman');
		const enemies = [90, 140, 190].map((dx) => tough(state, dx));
		useSkill(state, 1);
		run(state, 500);
		for (const enemy of enemies) expect(enemy.hp).toBeLessThan(enemy.maxHp);
	});

	it('dash covers ground fast and nothing can hit during it', () => {
		const state = quietRaid(1, 'shotgun');
		const startX = state.player.x;
		setMove(state, 1, 0);
		useSkill(state, 0);
		expect(state.player.invulnerableMs).toBeGreaterThan(DASH_MS);
		run(state, DASH_MS);
		expect(state.player.x - startX).toBeGreaterThan(DASH_SPEED * (DASH_MS / 1000) * 0.8);
	});

	it('blast hurts and shoves what is in front, but not what is behind', () => {
		const state = quietRaid(1, 'shotgun');
		const front = tough(state, 110);
		const behind = tough(state, -140);
		const before = front.x;
		const events = useSkill(state, 1);
		expect(count(events, 'blast')).toBe(1);
		expect(front.hp).toBeLessThan(front.maxHp);
		expect(front.x).toBeGreaterThan(before);
		expect(behind.hp).toBe(behind.maxHp);
	});

	it('overdrive fires the SMG much faster', () => {
		const shots = (overdrive: boolean) => {
			const state = quietRaid(1, 'smg');
			tough(state, 150);
			if (overdrive) useSkill(state, 0);
			setFiring(state, true);
			return count(run(state, 3000), 'shot');
		};
		expect(shots(true)).toBeGreaterThan(shots(false) * 2);
	});

	it('nova sends a ring of bullets in every direction', () => {
		const state = quietRaid(1, 'smg');
		const around = [
			[150, 0],
			[-150, 0],
			[0, 150],
			[0, -150]
		].map(([dx, dy]) => tough(state, dx, dy));
		useSkill(state, 1);
		expect(state.bullets).toHaveLength(NOVA_BULLETS);
		run(state, 500);
		for (const enemy of around) expect(enemy.hp).toBeLessThan(enemy.maxHp);
	});

	it('barrage sends a rocket at each nearby enemy', () => {
		const state = quietRaid(1, 'launcher');
		const targets = [
			[200, 0],
			[-200, 40],
			[0, 220]
		].map(([dx, dy]) => tough(state, dx, dy));
		useSkill(state, 0);
		run(state, 1200);
		for (const enemy of targets) expect(enemy.hp).toBeLessThan(enemy.maxHp);
	});

	it('mines arm, wait for an enemy, explode, and never pile up past the limit', () => {
		const state = quietRaid(1, 'launcher');
		useSkill(state, 1);
		expect(state.mines).toHaveLength(1);
		const mine = state.mines[0];
		run(state, MINE_ARM_MS + 100);
		expect(state.mines).toHaveLength(1);
		const enemy = tough(state, 0, 0);
		enemy.x = mine.x + 10;
		enemy.y = mine.y;
		const events = run(state, 50);
		expect(count(events, 'mine-burst')).toBe(1);
		expect(enemy.hp).toBeLessThan(enemy.maxHp);
		expect(state.mines).toHaveLength(0);

		for (let i = 0; i < MAX_MINES + 2; i++) {
			state.player.skillMs.mine = 0;
			state.player.x += 60;
			useSkill(state, 1);
		}
		expect(state.mines).toHaveLength(MAX_MINES);
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

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { ARCHETYPES, BOSS_STAR_XP, bossStars, type Archetype, type MapId } from './config';
import { bankHaul, newProfile, weaponStarCount, type RaidHaul } from './profile';
import { TORNADO_FIRST_MS, TORNADO_TRAP_MS } from './sandstorm';
import { createRaid, stepRaid } from './state';

const STEP = 1000 / 60;

function bossHaul(map: MapId, stars: number): RaidHaul {
	const profile = newProfile();
	return {
		map,
		timeMs: 100_000,
		xp: 0,
		gold: 0,
		scrap: 0,
		gear: [],
		crystals: [],
		loadout: profile.loadout,
		stats: {
			map,
			timeMs: 0,
			kills: 0,
			killsBy: Object.fromEntries(ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>,
			bossKills: 1,
			crystals: 0,
			damage: 0,
			skillsUsed: 0
		},
		mode: 'boss',
		bossStars: stars,
		starWeapon: 'rifle'
	};
}

describe('boss fight stars', () => {
	it('gives one star per 20 seconds left, at least one for a win, at most five', () => {
		expect(bossStars(false, 170_000)).toBe(0);
		expect(bossStars(true, 1000)).toBe(1);
		expect(bossStars(true, 40_000)).toBe(2);
		expect(bossStars(true, 41_000)).toBe(3);
		expect(bossStars(true, 170_000)).toBe(5);
	});

	it('pays XP only for stars reached on a map for the first time', () => {
		const first = bankHaul(newProfile(), bossHaul('strait', 3));
		expect(first.newStars).toBe(3);
		expect(first.starXp).toBe(3 * BOSS_STAR_XP);
		expect(first.profile.bossStars.strait).toBe(3);

		const again = bankHaul(first.profile, bossHaul('strait', 2));
		expect(again.newStars).toBe(0);
		expect(again.profile.bossStars.strait).toBe(3);

		const better = bankHaul(again.profile, bossHaul('strait', 4));
		expect(better.newStars).toBe(1);
		// Another map starts from nothing
		expect(bankHaul(better.profile, bossHaul('arctic', 1)).newStars).toBe(1);
	});

	it('adds the stars up per weapon as its star stat', () => {
		let profile = bankHaul(newProfile(), bossHaul('strait', 3)).profile;
		profile = bankHaul(profile, bossHaul('arctic', 2)).profile;
		expect(weaponStarCount(profile, 'rifle')).toBe(5);
		expect(weaponStarCount(profile, 'shotgun')).toBe(0);
	});
});

describe('dust devils', () => {
	it('rise only on the desert map, catch the player, and spit them out', () => {
		const random = createRandom(3);
		const state = createRaid('strait', newProfile().loadout, 1);
		state.spawnMs = Infinity;
		state.nextBossMs = Infinity;
		state.timeMs = TORNADO_FIRST_MS;
		for (let t = 0; t < 2000; t += STEP) stepRaid(state, random, STEP);
		expect(state.tornadoes.length).toBeGreaterThan(0);

		// Walk the player into one
		const tornado = state.tornadoes[0];
		state.player.x = tornado.x;
		state.player.y = tornado.y;
		let caught = false;
		let spat = false;
		for (let t = 0; t < TORNADO_TRAP_MS + 1500; t += STEP) {
			for (const event of stepRaid(state, random, STEP)) {
				if (event.type === 'tornado-catch' && event.player) caught = true;
				if (event.type === 'tornado-spit' && event.player) spat = true;
			}
		}
		expect(caught).toBe(true);
		expect(spat).toBe(true);
		expect(Math.hypot(state.player.x - tornado.x, state.player.y - tornado.y)).toBeGreaterThan(40);

		const meadow = createRaid('sunflower', newProfile().loadout, 1);
		meadow.spawnMs = Infinity;
		meadow.nextBossMs = Infinity;
		meadow.timeMs = TORNADO_FIRST_MS;
		for (let t = 0; t < 4000; t += STEP) stepRaid(meadow, random, STEP);
		expect(meadow.tornadoes).toHaveLength(0);
	});
});

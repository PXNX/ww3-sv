import { describe, expect, it } from 'vitest';
import {
	CRYSTAL_COMBINE_COUNT,
	CRYSTAL_COMBINE_SCRAP,
	MAX_PLAYER_LEVEL,
	PLAYER_BASE_HP,
	SEASON_XP_PER_TIER,
	STASH_SIZE
} from './config';
import {
	makeArmor,
	makeWeapon,
	salvageScrap,
	salvageValue,
	upgradeCost,
	weaponStats,
	type Crystal
} from './items';
import {
	addXp,
	bankHaul,
	claimSeasonRewards,
	combineCrystals,
	crystalCount,
	equipFromStash,
	isProfile,
	maxHpFor,
	newProfile,
	parseProfile,
	salvage,
	socketCrystal,
	unsocketCrystal,
	swapWeapons,
	unequipArmor,
	upgradeSlot,
	xpToNext
} from './profile';

describe('a new profile', () => {
	it('starts at level 1 with the rifle and the marksman rifle and no armour', () => {
		const profile = newProfile();
		expect(profile.level).toBe(1);
		expect(profile.loadout.primary.kind).toBe('rifle');
		expect(profile.loadout.secondary.kind).toBe('marksman');
		expect(profile.loadout.helmet).toBeNull();
		expect(maxHpFor(1, null)).toBe(PLAYER_BASE_HP);
		expect(isProfile(profile)).toBe(true);
	});
});

describe('XP', () => {
	it('carries leftover XP over several level-ups', () => {
		const result = addXp(1, 0, xpToNext(1) + xpToNext(2) + 5);
		expect(result).toEqual({ level: 3, xp: 5, levelsGained: 2 });
	});

	it('stops at the level cap', () => {
		expect(addXp(MAX_PLAYER_LEVEL, 0, 1e9).level).toBe(MAX_PLAYER_LEVEL);
	});
});

describe('banking a raid', () => {
	it('adds XP, gold, the field loadout, the gear and the best time', () => {
		const profile = newProfile();
		const loadout = { ...profile.loadout, vest: makeArmor('vest', 'rare') };
		const found = makeWeapon('shotgun', 'epic', 4);
		const { profile: next, levelsGained } = bankHaul(profile, {
			map: 'strait',
			timeMs: 90_000,
			xp: xpToNext(1),
			gold: 33,
			scrap: 7,
			gear: [found],
			crystals: [{ kind: 'crit', rarity: 'rare' }],
			loadout
		});
		expect(levelsGained).toBe(1);
		expect(next.gold).toBe(33);
		expect(next.loadout.vest?.rarity).toBe('rare');
		expect(next.stash).toEqual([found]);
		expect(next.bestTimeMs.strait).toBe(90_000);
		expect(next.raids).toBe(1);
		expect(next.scrap).toBe(7);
		expect(crystalCount(next.crystals, { kind: 'crit', rarity: 'rare' })).toBe(1);
		expect(next.season.xp).toBe(xpToNext(1));
		expect(isProfile(next)).toBe(true);
	});

	it('salvages what does not fit, keeping the best gear', () => {
		const profile = {
			...newProfile(),
			stash: Array.from({ length: STASH_SIZE - 1 }, () => makeWeapon('smg'))
		};
		const best = makeWeapon('launcher', 'legendary');
		const worst = makeArmor('helmet');
		const result = bankHaul(profile, {
			map: 'sunflower',
			timeMs: 1000,
			xp: 0,
			gold: 0,
			scrap: 0,
			gear: [worst, best],
			crystals: [],
			loadout: profile.loadout
		});
		expect(result.profile.stash).toContain(best);
		expect(result.profile.stash).not.toContain(worst);
		expect(result.salvaged).toBe(1);
		expect(result.profile.gold).toBe(salvageValue(worst));
		expect(result.profile.scrap).toBe(salvageScrap(worst));
	});
});

describe('lobby actions', () => {
	it('equips from the stash and puts the old piece back', () => {
		const shotgun = makeWeapon('shotgun', 'rare');
		const profile = { ...newProfile(), stash: [shotgun] };
		const oldPrimary = profile.loadout.primary;
		const next = equipFromStash(profile, shotgun.id, 'primary');
		expect(next.loadout.primary).toBe(shotgun);
		expect(next.stash).toEqual([oldPrimary]);
		// A helmet never goes into a weapon slot
		const helmet = makeArmor('helmet');
		const withHelmet = { ...profile, stash: [helmet] };
		expect(equipFromStash(withHelmet, helmet.id, 'primary')).toBe(withHelmet);
		expect(equipFromStash(withHelmet, helmet.id, 'helmet').loadout.helmet).toBe(helmet);
	});

	it('takes armour off, swaps weapons and salvages', () => {
		const vest = makeArmor('vest');
		const profile = { ...newProfile(), loadout: { ...newProfile().loadout, vest } };
		expect(unequipArmor(profile, 'vest').stash).toEqual([vest]);
		const swapped = swapWeapons(profile);
		expect(swapped.loadout.primary).toBe(profile.loadout.secondary);
		const withStash = { ...profile, stash: [vest] };
		expect(salvage(withStash, vest.id)).toMatchObject({ stash: [], gold: salvageValue(vest) });
	});

	it('upgrades only with enough gold', () => {
		const profile = newProfile();
		const cost = upgradeCost(profile.loadout.primary)!;
		expect(upgradeSlot(profile, 'primary')).toBe(profile);
		const rich = { ...profile, gold: cost + 5 };
		const next = upgradeSlot(rich, 'primary');
		expect(next.loadout.primary.level).toBe(2);
		expect(next.gold).toBe(5);
	});
});

describe('stored profiles', () => {
	it('rejects broken or foreign data', () => {
		expect(isProfile(null)).toBe(false);
		expect(isProfile({ ...newProfile(), version: 2 })).toBe(false);
		expect(isProfile({ ...newProfile(), level: 0 })).toBe(false);
		const bad = newProfile();
		expect(isProfile({ ...bad, loadout: { ...bad.loadout, helmet: makeArmor('vest') } })).toBe(
			false
		);
		expect(isProfile({ ...bad, stash: [{ type: 'weapon', kind: 'laser' }] })).toBe(false);
		expect(isProfile(JSON.parse(JSON.stringify(bad)))).toBe(true);
	});
});

describe('crystals', () => {
	const rareCrit: Crystal = { kind: 'crit', rarity: 'rare' };

	it('socket into a free slot of a weapon and come back out into the stock', () => {
		const profile = { ...newProfile(), crystals: { 'crit:rare': 2 } };
		const before = weaponStats(profile.loadout.primary).critChance;
		const socketed = socketCrystal(profile, 'primary', rareCrit);
		expect(crystalCount(socketed.crystals, rareCrit)).toBe(1);
		expect(weaponStats(socketed.loadout.primary).critChance).toBeGreaterThan(before);
		// A common weapon has a single socket
		expect(socketCrystal(socketed, 'primary', rareCrit)).toBe(socketed);
		const back = unsocketCrystal(socketed, 'primary', 0);
		expect(crystalCount(back.crystals, rareCrit)).toBe(2);
		expect(back.loadout.primary.crystals).toEqual([]);
	});

	it('each kind improves its own stat', () => {
		const plain = makeWeapon('flamethrower', 'legendary');
		const withCrystal = (crystal: Crystal) => ({ ...plain, crystals: [crystal] });
		const base = weaponStats(plain);
		expect(weaponStats(withCrystal({ kind: 'damage', rarity: 'epic' })).damage).toBeGreaterThan(
			base.damage
		);
		expect(weaponStats(withCrystal({ kind: 'fire', rarity: 'epic' })).fireMs).toBeLessThan(
			base.fireMs
		);
		expect(weaponStats(withCrystal({ kind: 'status', rarity: 'epic' })).burnMs).toBeGreaterThan(
			base.burnMs
		);
	});

	it('five of a kind and some scrap combine into one of the next rarity', () => {
		const common: Crystal = { kind: 'fire', rarity: 'common' };
		const profile = {
			...newProfile(),
			scrap: CRYSTAL_COMBINE_SCRAP[0],
			crystals: { 'fire:common': CRYSTAL_COMBINE_COUNT + 1 }
		};
		const next = combineCrystals(profile, common);
		expect(crystalCount(next.crystals, common)).toBe(1);
		expect(crystalCount(next.crystals, { kind: 'fire', rarity: 'uncommon' })).toBe(1);
		expect(next.scrap).toBe(0);
		// Not enough scrap or crystals left
		expect(combineCrystals(next, common)).toBe(next);
	});

	it('salvaging a weapon returns its crystals', () => {
		const weapon = { ...makeWeapon('smg', 'rare'), crystals: [rareCrit] };
		const profile = salvage({ ...newProfile(), stash: [weapon] }, weapon.id);
		expect(crystalCount(profile.crystals, rareCrit)).toBe(1);
		expect(profile.scrap).toBe(salvageScrap(weapon));
	});
});

describe('season', () => {
	const october = new Date(2026, 9, 24);

	it('claims every reached tier once, in order', () => {
		const profile = {
			...newProfile(october),
			season: { id: '2026-10', xp: SEASON_XP_PER_TIER * 3 + 10, claimed: 0 }
		};
		const { profile: claimed, rewards } = claimSeasonRewards(profile);
		expect(rewards).toHaveLength(3);
		expect(claimed.season.claimed).toBe(3);
		expect(claimed.gold + claimed.scrap).toBeGreaterThan(0);
		expect(claimSeasonRewards(claimed).rewards).toEqual([]);
	});

	it('starts over in a new month, handing out what was left unclaimed', () => {
		const profile = {
			...newProfile(october),
			season: { id: '2026-10', xp: SEASON_XP_PER_TIER * 2, claimed: 0 }
		};
		const next = parseProfile(profile, new Date(2026, 10, 2))!;
		expect(next.season).toEqual({ id: '2026-11', xp: 0, claimed: 0 });
		expect(next.gold + next.scrap).toBeGreaterThan(0);
	});

	it('loads saves from before boots, scrap, crystals and seasons', () => {
		const old = JSON.parse(JSON.stringify(newProfile(october)));
		delete old.scrap;
		delete old.crystals;
		delete old.season;
		delete old.loadout.boots;
		const loaded = parseProfile(old, october)!;
		expect(loaded.scrap).toBe(0);
		expect(loaded.crystals).toEqual({});
		expect(loaded.loadout.boots).toBeNull();
		expect(loaded.season.id).toBe('2026-10');
	});
});

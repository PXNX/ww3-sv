import { describe, expect, it } from 'vitest';
import { MAX_PLAYER_LEVEL, PLAYER_BASE_HP, STASH_SIZE } from './config';
import { makeArmor, makeWeapon, salvageValue, upgradeCost } from './items';
import {
	addXp,
	bankHaul,
	equipFromStash,
	isProfile,
	maxHpFor,
	newProfile,
	salvage,
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
			gear: [found],
			loadout
		});
		expect(levelsGained).toBe(1);
		expect(next.gold).toBe(33);
		expect(next.loadout.vest?.rarity).toBe('rare');
		expect(next.stash).toEqual([found]);
		expect(next.bestTimeMs.strait).toBe(90_000);
		expect(next.raids).toBe(1);
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
			gear: [worst, best],
			loadout: profile.loadout
		});
		expect(result.profile.stash).toContain(best);
		expect(result.profile.stash).not.toContain(worst);
		expect(result.salvaged).toBe(1);
		expect(result.profile.gold).toBe(salvageValue(worst));
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

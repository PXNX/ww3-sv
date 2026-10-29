import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LOOK,
	isAvatarLook,
	LOOK_PARTS,
	LOOK_PRESETS,
	randomLook,
	type LookPart
} from './look';
import {
	LOOK_UNLOCKS,
	firstLockedPart,
	isUnlocked,
	nextUnlock,
	requirementMet,
	requirementShare,
	unlockFor,
	unlockProgress,
	unlockableValues,
	unlockedCount,
	type UnlockProgress
} from './unlocks';
import { newCareer } from '#lib/game/career/profile.js';
import {
	loadMessages,
	locales,
	messageFileCount,
	messageKeys,
	messageParameters,
	missingMessages
} from '#lib/testing/messages.js';

/** A player with nothing earned yet, plus whatever the test cares about */
const progress = (overrides: Partial<UnlockProgress> = {}): UnlockProgress => ({
	level: 1,
	bestStreak: 0,
	modes: {},
	...overrides
});

describe('the extra looks', () => {
	it('names a real option of a real part for every unlock', () => {
		for (const unlock of LOOK_UNLOCKS) {
			expect(LOOK_PARTS[unlock.part]).toContain(unlock.value);
		}
		expect(unlockableValues('hat')).toContain('beret');
	});

	it('never lists the same part value or id twice', () => {
		const ids = LOOK_UNLOCKS.map((unlock) => unlock.id);
		const values = LOOK_UNLOCKS.map((unlock) => `${unlock.part}:${unlock.value}`);
		expect(new Set(ids).size).toBe(ids.length);
		expect(new Set(values).size).toBe(values.length);
	});

	it('leaves most options free and opens the extra ones only through progress', () => {
		const start = progress();
		for (const part of Object.keys(LOOK_PARTS) as LookPart[]) {
			for (const value of LOOK_PARTS[part]) {
				const guarded = unlockFor(part, value) !== undefined;
				expect(isUnlocked(part, value, start)).toBe(!guarded);
			}
		}
		expect(unlockedCount(start)).toBe(0);
		expect(
			unlockedCount(
				progress({
					level: 30,
					bestStreak: 7,
					modes: { redsquare: {}, petrobras: {}, runcomrade: {} },
					coins: 120,
					tycoon: ['maxed_all', 'tycoon_king']
				})
			)
		).toBe(LOOK_UNLOCKS.length);
	});

	it('opens a level look at the level, not before', () => {
		const purple = LOOK_UNLOCKS.find((unlock) => unlock.id === 'purple-shirt')!;
		expect(requirementMet(purple.requirement, progress({ level: 2 }))).toBe(false);
		expect(requirementMet(purple.requirement, progress({ level: 3 }))).toBe(true);
		expect(isUnlocked('shirtColor', '#b45cd6', progress({ level: 2 }))).toBe(false);
		expect(isUnlocked('shirtColor', '#b45cd6', progress({ level: 3 }))).toBe(true);
	});

	it('opens a streak look from the best streak ever, not the current one', () => {
		expect(isUnlocked('hat', 'ushanka', progress({ bestStreak: 2 }))).toBe(false);
		expect(isUnlocked('hat', 'ushanka', progress({ bestStreak: 3 }))).toBe(true);
		expect(isUnlocked('shirt', 'tank', progress({ bestStreak: 6 }))).toBe(false);
		expect(isUnlocked('shirt', 'tank', progress({ bestStreak: 7 }))).toBe(true);
	});

	it('opens a game look once that game has been played', () => {
		expect(isUnlocked('eyes', 'shades', progress())).toBe(false);
		expect(isUnlocked('eyes', 'shades', progress({ modes: { petrobras: {} } }))).toBe(true);
		// A different game does not count
		expect(isUnlocked('eyes', 'shades', progress({ modes: { redsquare: {} } }))).toBe(false);
	});

	it('never closes a look again when the player moves on', () => {
		const partly = progress({ level: 10, bestStreak: 7, modes: { redsquare: {} } });
		const later = progress({ level: 30, bestStreak: 30, modes: { redsquare: {}, petrobras: {} } });
		for (const unlock of LOOK_UNLOCKS) {
			if (requirementMet(unlock.requirement, partly)) {
				expect(requirementMet(unlock.requirement, later)).toBe(true);
				expect(isUnlocked(unlock.part, unlock.value, later)).toBe(true);
			}
		}
	});

	it('counts what is collected and points at the closest goal', () => {
		expect(unlockedCount(progress({ level: 10 }))).toBe(3);
		const close = nextUnlock(progress({ level: 4, bestStreak: 2 }));
		expect(close?.id).toBe('helmet');
		expect(requirementShare(close!.requirement, progress({ level: 4 }))).toBeCloseTo(0.8);
		expect(
			nextUnlock(
				progress({
					level: 30,
					bestStreak: 7,
					modes: { redsquare: {}, petrobras: {}, runcomrade: {} },
					coins: 120,
					tycoon: ['maxed_all', 'tycoon_king']
				})
			)
		).toBeNull();
	});

	it('measures how far a requirement is done, between zero and one', () => {
		expect(requirementShare({ kind: 'level', level: 10 }, progress({ level: 0 }))).toBe(0);
		expect(requirementShare({ kind: 'level', level: 10 }, progress({ level: 5 }))).toBe(0.5);
		expect(requirementShare({ kind: 'level', level: 10 }, progress({ level: 20 }))).toBe(1);
		expect(requirementShare({ kind: 'streak', days: 7 }, progress({ bestStreak: 14 }))).toBe(1);
		expect(requirementShare({ kind: 'mode', mode: 'redsquare' }, progress())).toBe(0);
		expect(
			requirementShare({ kind: 'mode', mode: 'redsquare' }, progress({ modes: { redsquare: {} } }))
		).toBe(1);
	});

	it('reads the progress out of a career profile', () => {
		const profile = { ...newCareer(new Date(2026, 9, 27, 12)), bestStreak: 4 };
		expect(unlockProgress(profile, 7)).toEqual({
			level: 7,
			bestStreak: 4,
			modes: profile.modes,
			coins: profile.coins,
			tycoon: []
		});
	});

	it('opens the monocle for maxing every producer and the cylinder for 25 restarts', () => {
		const monocle = unlockFor('hat', 'monocle')!;
		const cylinder = unlockFor('hat', 'cylinder')!;
		expect(monocle.requirement).toEqual({ kind: 'tycoon', achievement: 'maxed_all' });
		expect(cylinder.requirement).toEqual({ kind: 'tycoon', achievement: 'tycoon_king' });
		expect(requirementMet(monocle.requirement, progress())).toBe(false);
		expect(requirementMet(monocle.requirement, progress({ tycoon: ['tycoon_king'] }))).toBe(false);
		expect(requirementMet(monocle.requirement, progress({ tycoon: ['maxed_all'] }))).toBe(true);
		expect(requirementMet(cylinder.requirement, progress({ tycoon: ['tycoon_king'] }))).toBe(true);
		expect(requirementShare(cylinder.requirement, progress())).toBe(0);
	});

	it('opens the Fake News look once enough Fake News is held', () => {
		const lula = unlockFor('hat', 'lula')!;
		expect(lula.requirement.kind).toBe('fakeNews');
		expect(requirementMet(lula.requirement, progress())).toBe(false);
		expect(requirementMet(lula.requirement, progress({ coins: 119 }))).toBe(false);
		expect(requirementMet(lula.requirement, progress({ coins: 120 }))).toBe(true);
		expect(requirementShare(lula.requirement, progress({ coins: 60 }))).toBe(0.5);
	});

	it('leaves locked options out of a surprise look', () => {
		const start = progress();
		const allowed = (part: LookPart, value: string) => isUnlocked(part, value, start);
		for (let seed = 1; seed <= 300; seed++) {
			const look = randomLook(seed, allowed);
			expect(isAvatarLook(look)).toBe(true);
			for (const [part, value] of Object.entries(look)) {
				if (part === 'version') continue;
				expect(isUnlocked(part as LookPart, value as string, start)).toBe(true);
			}
		}
	});

	it('still draws a valid look when every option of a part would be locked', () => {
		const nothingAllowed = () => false;
		expect(isAvatarLook(randomLook(9, nothingAllowed))).toBe(true);
		expect(randomLook(9, nothingAllowed)).toEqual(DEFAULT_LOOK);
	});

	it('names the first locked part of a ready-made look', () => {
		const hitman = LOOK_PRESETS.find((preset) => preset.id === 'agent-47')!;
		const ogre = LOOK_PRESETS.find((preset) => preset.id === 'ogre')!;
		expect(firstLockedPart(hitman.look, progress())?.unlock.id).toBe('suit');
		expect(firstLockedPart(hitman.look, progress({ level: 10 }))).toBeNull();
		expect(firstLockedPart(ogre.look, progress({ level: 10 }))?.unlock.id).toBe('alien-skin');
		expect(firstLockedPart(ogre.look, progress({ level: 30 }))).toBeNull();
	});
});

describe('the extra look messages', () => {
	it('exist in every language', () => {
		expect(messageFileCount()).toBe(locales.length);
		expect(missingMessages(['avatar_'])).toEqual([]);
	});

	it('name the same parameters in every language', () => {
		const keys = messageKeys(['avatar_']);
		expect(keys).toContain('avatar_unlocked_progress');
		for (const locale of locales) {
			const messages = loadMessages(locale);
			for (const key of keys) {
				expect(messageParameters(messages[key])).toEqual(
					messageParameters(loadMessages('en')[key])
				);
			}
		}
	});
});

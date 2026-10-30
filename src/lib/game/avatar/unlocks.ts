/*
 * The extra looks: a small set of avatar parts that are not free from the start. Each one names a
 * single part value and the thing that unlocks it, so the condition stays a plain rule and the
 * editor only has to ask "is this option open yet?". Conditions are all monotonic (career level,
 * best daily streak, a game played at least once), so an unlocked look never locks again.
 */
import type { CareerProfile } from '#lib/game/career/profile.js';
import type { ModeId } from '#lib/modes/registry.js';
import type { GameProgress } from './gameProgress.js';
import { LOOK_PARTS, type AvatarLook, type LookPart } from './look.js';

export type UnlockRequirement =
	| { kind: 'level'; level: number }
	| { kind: 'streak'; days: number }
	| { kind: 'mode'; mode: ModeId }
	/** Every prepared level of Magyar's Birds won */
	| { kind: 'fury' }
	/** The Purr Pentagram ritual completed */
	| { kind: 'purr' }
	/** Every level of El Presidente finished */
	| { kind: 'venezuela' }
	/** A streak of this many in Petrobras */
	| { kind: 'petrobras'; streak: number }
	/** A best score above this in Block Puzzle */
	| { kind: 'blocks'; score: number }
	/** An achievement of the Oil Tycoon, which keeps its own save outside the career */
	| { kind: 'tycoon'; achievement: string }
	/** How many friends joined through the referral link */
	| { kind: 'referral'; count: number };

export interface LookUnlock {
	id: string;
	part: LookPart;
	value: string;
	requirement: UnlockRequirement;
}

/**
 * Ten extra looks across the parts, spread over the three sources: playing a particular game,
 * keeping the daily reward streak, and climbing the career levels. The rest of the catalogue stays
 * free, so a new agent is never stuck with one shirt.
 */
export const LOOK_UNLOCKS: readonly LookUnlock[] = [
	{
		id: 'purple-shirt',
		part: 'shirtColor',
		value: '#b45cd6',
		requirement: { kind: 'level', level: 3 }
	},
	{
		id: 'beret',
		part: 'hat',
		value: 'beret',
		requirement: { kind: 'mode', mode: 'redsquare' }
	},
	{
		id: 'helmet',
		part: 'hat',
		value: 'helmet',
		requirement: { kind: 'level', level: 5 }
	},
	{
		id: 'camo',
		part: 'shirt',
		value: 'camo',
		requirement: { kind: 'mode', mode: 'runcomrade' }
	},
	{
		id: 'shades',
		part: 'eyes',
		value: 'shades',
		requirement: { kind: 'mode', mode: 'petrobras' }
	},
	{
		id: 'ushanka',
		part: 'hat',
		value: 'ushanka',
		requirement: { kind: 'streak', days: 3 }
	},
	{
		id: 'tank',
		part: 'shirt',
		value: 'tank',
		requirement: { kind: 'streak', days: 7 }
	},
	{
		id: 'suit',
		part: 'shirt',
		value: 'suit',
		requirement: { kind: 'level', level: 10 }
	},
	{
		id: 'crown',
		part: 'hat',
		value: 'crown',
		requirement: { kind: 'level', level: 20 }
	},
	{
		id: 'lula-hat',
		part: 'hat',
		value: 'lula',
		requirement: { kind: 'petrobras', streak: 10 }
	},
	{
		id: 'pelican-beak',
		part: 'nose',
		value: 'beak',
		requirement: { kind: 'fury' }
	},
	{
		id: 'cat-ears',
		part: 'hat',
		value: 'cat-ears',
		requirement: { kind: 'purr' }
	},
	{
		id: 'mustache',
		part: 'facial',
		value: 'mustache',
		requirement: { kind: 'venezuela' }
	},
	{
		id: 'trump-suit',
		part: 'shirt',
		value: 'trump-suit',
		// Over 9000
		requirement: { kind: 'blocks', score: 9000 }
	},
	{
		id: 'monocle',
		part: 'hat',
		value: 'monocle',
		// Every producer owned at the most
		requirement: { kind: 'tycoon', achievement: 'maxed_all' }
	},
	{
		id: 'cylinder',
		part: 'hat',
		value: 'cylinder',
		// Nationalized and restarted 25 times
		requirement: { kind: 'tycoon', achievement: 'tycoon_king' }
	},
	{
		id: 'alien-skin',
		part: 'skin',
		value: '#9fd36a',
		requirement: { kind: 'level', level: 30 }
	},
	{
		id: 'afro-hairstyle',
		part: 'hair',
		value: 'afro',
		requirement: { kind: 'referral', count: 10 }
	},
	{
		id: 'propeller-hat',
		part: 'hat',
		value: 'propeller',
		requirement: { kind: 'referral', count: 25 }
	}
];

/** What the unlock rules need to know about the player */
export interface UnlockProgress {
	level: number;
	bestStreak: number;
	/** Modes played at least once; only the keys matter */
	modes: Partial<Record<ModeId, unknown>>;
	/** Ids of the Oil Tycoon achievements earned; none when not given */
	tycoon?: readonly string[];
	/** What the other games have recorded; nothing done when not given */
	games?: GameProgress;
	/** How many friends joined through the referral link */
	referralCount?: number;
}

/**
 * What the player has reached, from the career profile. `tycoon` lists the achievements earned in
 * the Oil Tycoon and `games` what a few other games have recorded; the career tracks neither.
 */
export function unlockProgress(
	profile: CareerProfile,
	level: number,
	tycoon: readonly string[] = [],
	games?: GameProgress,
	referralCount?: number
): UnlockProgress {
	return {
		level,
		bestStreak: profile.bestStreak,
		modes: profile.modes,
		tycoon,
		games,
		referralCount
	};
}

/** The unlock that guards a part value, or undefined when the option is free */
export function unlockFor(part: LookPart, value: string): LookUnlock | undefined {
	return LOOK_UNLOCKS.find((unlock) => unlock.part === part && unlock.value === value);
}

export function requirementMet(requirement: UnlockRequirement, progress: UnlockProgress): boolean {
	switch (requirement.kind) {
		case 'level':
			return progress.level >= requirement.level;
		case 'streak':
			return progress.bestStreak >= requirement.days;
		case 'mode':
			return progress.modes[requirement.mode] !== undefined;
		case 'tycoon':
			return progress.tycoon?.includes(requirement.achievement) ?? false;
		case 'referral':
			return (progress.referralCount ?? 0) >= requirement.count;
		case 'fury':
			return requirementShare(requirement, progress) >= 1;
		case 'venezuela':
			return requirementShare(requirement, progress) >= 1;
		case 'purr':
			return progress.games?.purrSolved ?? false;
		case 'petrobras':
			return (progress.games?.petrobrasStreak ?? 0) >= requirement.streak;
		case 'blocks':
			return (progress.games?.blocksBest ?? 0) > requirement.score;
	}
}

/** True when the part value can be worn right now */
export function isUnlocked(part: LookPart, value: string, progress: UnlockProgress): boolean {
	const unlock = unlockFor(part, value);
	return unlock === undefined || requirementMet(unlock.requirement, progress);
}

export interface BlockedLookPart {
	part: LookPart;
	value: string;
	unlock: LookUnlock;
}

/**
 * The first part of a whole look that is still locked, so a ready-made look can say what it wants
 * instead of silently changing only some of its parts. Null when every part is open.
 */
export function firstLockedPart(
	look: AvatarLook,
	progress: UnlockProgress
): BlockedLookPart | null {
	for (const part of Object.keys(LOOK_PARTS) as LookPart[]) {
		const value = look[part];
		if (isUnlocked(part, value, progress)) continue;
		const unlock = unlockFor(part, value);
		if (unlock) return { part, value, unlock };
	}
	return null;
}

/** How many of the extra looks have been collected */
export function unlockedCount(progress: UnlockProgress): number {
	return LOOK_UNLOCKS.filter((unlock) => requirementMet(unlock.requirement, progress)).length;
}

/** The closest still-locked look, by how much of its requirement is done; null when all are open */
export function nextUnlock(progress: UnlockProgress): LookUnlock | null {
	const locked = LOOK_UNLOCKS.filter((unlock) => !requirementMet(unlock.requirement, progress));
	if (locked.length === 0) return null;
	return locked.reduce((best, unlock) =>
		requirementShare(unlock.requirement, progress) > requirementShare(best.requirement, progress)
			? unlock
			: best
	);
}

/** How far along a requirement is, 0 to 1, for sorting the next goal */
export function requirementShare(requirement: UnlockRequirement, progress: UnlockProgress): number {
	switch (requirement.kind) {
		case 'level':
			return Math.min(1, progress.level / requirement.level);
		case 'streak':
			return Math.min(1, progress.bestStreak / requirement.days);
		case 'mode':
			return progress.modes[requirement.mode] === undefined ? 0 : 1;
		case 'tycoon':
			return progress.tycoon?.includes(requirement.achievement) ? 1 : 0;
		case 'referral':
			return Math.min(1, (progress.referralCount ?? 0) / requirement.count);
		case 'fury': {
			const games = progress.games;
			return games && games.furyTotal > 0 ? Math.min(1, games.furyWon / games.furyTotal) : 0;
		}
		case 'venezuela': {
			const games = progress.games;
			return games && games.venezuelaTotal > 0
				? Math.min(1, games.venezuelaWon / games.venezuelaTotal)
				: 0;
		}
		case 'purr':
			return progress.games?.purrSolved ? 1 : 0;
		case 'petrobras':
			return Math.min(1, (progress.games?.petrobrasStreak ?? 0) / requirement.streak);
		case 'blocks':
			return Math.min(1, (progress.games?.blocksBest ?? 0) / (requirement.score + 1));
	}
}

/** The unlockable part values, for tests and the editor */
export function unlockableValues(part: LookPart): readonly string[] {
	return LOOK_UNLOCKS.filter((unlock) => unlock.part === part).map((unlock) => unlock.value);
}

if (
	LOOK_UNLOCKS.some(
		(unlock) => !(LOOK_PARTS[unlock.part] as readonly string[]).includes(unlock.value)
	)
) {
	throw new Error('unlocks.ts names an avatar option that look.ts does not offer');
}

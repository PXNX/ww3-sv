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
	| { kind: 'referral'; count: number }
	/** An achievement of Beachhead, which keeps its own save outside the career */
	| { kind: 'beachhead'; achievement: string }
	/** Systems of the cast's network found in Hermit Hackers */
	| { kind: 'hackers'; network: number }
	/** A best score above this in any mode that keeps one in the career profile */
	| { kind: 'score'; mode: ModeId; score: number }
	/** Playing any of these modes opens the look */
	| { kind: 'game'; modes: readonly ModeId[] }
	/** Redeemed with a free gift code */
	| { kind: 'gift'; code: string }
	/** Bought with Telegram Stars; the sku is the bot's catalogue entry */
	| { kind: 'stars'; sku: string };

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
	},
	{
		id: 'beachhead-cap',
		part: 'hat',
		value: 'cap',
		// Every island taken at three stars in Beachhead
		requirement: { kind: 'beachhead', achievement: 'all-stars' }
	},
	{
		id: 'beachhead-ogre-ears',
		part: 'hat',
		value: 'ogre-ears',
		// Headquarters, training ground and all eight boats at the top level
		requirement: { kind: 'beachhead', achievement: 'fortress' }
	},
	{
		id: 'matrix-coat',
		part: 'shirt',
		value: 'matrix-coat',
		// Every system of the cast's network found in Hermit Hackers
		requirement: { kind: 'hackers', network: 6 }
	},
	{
		id: 'halo',
		part: 'hat',
		value: 'halo',
		// A high score in Drone Wall: the halo is earned, never bought
		requirement: { kind: 'score', mode: 'dronewall', score: 1500 }
	},
	{
		id: 'star-eyes',
		part: 'eyes',
		value: 'stars',
		requirement: { kind: 'score', mode: 'whack', score: 2500 }
	},
	{
		id: 'play-blocks',
		part: 'face',
		value: 'square',
		// Playing blocks opens one more piece for the agent
		requirement: { kind: 'game', modes: ['blocks'] }
	},
	{
		id: 'play-minefield',
		part: 'face',
		value: 'long',
		// Playing minefield opens one more piece for the agent
		requirement: { kind: 'game', modes: ['minefield'] }
	},
	{
		id: 'play-convoy',
		part: 'nose',
		value: 'potato',
		// Playing convoy opens one more piece for the agent
		requirement: { kind: 'game', modes: ['convoy'] }
	},
	{
		id: 'play-merge',
		part: 'nose',
		value: 'hook',
		// Playing merge opens one more piece for the agent
		requirement: { kind: 'game', modes: ['merge'] }
	},
	{
		id: 'play-shootdown',
		part: 'eyes',
		value: 'sleepy',
		// Playing shootdown opens one more piece for the agent
		requirement: { kind: 'game', modes: ['shootdown'] }
	},
	{
		id: 'play-pipeline',
		part: 'eyes',
		value: 'angry',
		// Playing pipeline opens one more piece for the agent
		requirement: { kind: 'game', modes: ['pipeline'] }
	},
	{
		id: 'play-flamingo',
		part: 'hair',
		value: 'mohawk',
		// Playing flamingo opens one more piece for the agent
		requirement: { kind: 'game', modes: ['flamingo'] }
	},
	{
		id: 'play-fury',
		part: 'hair',
		value: 'bun',
		// Playing fury opens one more piece for the agent
		requirement: { kind: 'game', modes: ['fury'] }
	},
	{
		id: 'play-chess',
		part: 'hair',
		value: 'curly',
		// Playing chess opens one more piece for the agent
		requirement: { kind: 'game', modes: ['chess'] }
	},
	{
		id: 'play-parking',
		part: 'hair',
		value: 'long',
		// Playing parking opens one more piece for the agent
		requirement: { kind: 'game', modes: ['parking'] }
	},
	{
		id: 'play-slice',
		part: 'hair',
		value: 'combover',
		// Playing slice opens one more piece for the agent
		requirement: { kind: 'game', modes: ['slice'] }
	},
	{
		id: 'play-beltroad',
		part: 'skin',
		value: '#e0a878',
		// Playing beltroad opens one more piece for the agent
		requirement: { kind: 'game', modes: ['beltroad'] }
	},
	{
		id: 'play-maze',
		part: 'skin',
		value: '#c58a5a',
		// Playing maze opens one more piece for the agent
		requirement: { kind: 'game', modes: ['maze'] }
	},
	{
		id: 'play-purrpentagram',
		part: 'skin',
		value: '#9b6440',
		// Playing purrpentagram opens one more piece for the agent
		requirement: { kind: 'game', modes: ['purrpentagram'] }
	},
	{
		id: 'play-energiewende',
		part: 'skin',
		value: '#6b4128',
		// Playing energiewende opens one more piece for the agent
		requirement: { kind: 'game', modes: ['energiewende'] }
	},
	{
		id: 'play-centrifuge',
		part: 'shirtColor',
		value: '#f5c83a',
		// Playing centrifuge opens one more piece for the agent
		requirement: { kind: 'game', modes: ['centrifuge'] }
	},
	{
		id: 'play-venezuela',
		part: 'shirtColor',
		value: '#6a7c9b',
		// Playing venezuela opens one more piece for the agent
		requirement: { kind: 'game', modes: ['venezuela'] }
	},
	{
		id: 'play-sondage',
		part: 'shirtColor',
		value: '#111111',
		// Playing sondage opens one more piece for the agent
		requirement: { kind: 'game', modes: ['sondage'] }
	},
	{
		id: 'play-suez',
		part: 'shirtColor',
		value: '#ffffff',
		// Playing suez opens one more piece for the agent
		requirement: { kind: 'game', modes: ['suez'] }
	},
	{
		id: 'play-chipfab',
		part: 'shirtColor',
		value: '#8a5a33',
		// Playing chipfab opens one more piece for the agent
		requirement: { kind: 'game', modes: ['chipfab'] }
	},
	{
		id: 'play-vault',
		part: 'shirtColor',
		value: '#2ecc71',
		// Playing vault opens one more piece for the agent
		requirement: { kind: 'game', modes: ['vault'] }
	},
	{
		id: 'play-veto',
		part: 'shirtColor',
		value: '#9b59b6',
		// Playing veto opens one more piece for the agent
		requirement: { kind: 'game', modes: ['veto'] }
	},
	{
		id: 'play-balloon',
		part: 'shirtColor',
		value: '#1abc9c',
		// Playing balloon opens one more piece for the agent
		requirement: { kind: 'game', modes: ['balloon'] }
	},
	{
		id: 'play-dome',
		part: 'shirtColor',
		value: '#e67e22',
		// Playing dome opens one more piece for the agent
		requirement: { kind: 'game', modes: ['dome'] }
	},
	{
		id: 'play-gpsliar',
		part: 'shirtColor',
		value: '#34495e',
		// Playing gpsliar opens one more piece for the agent
		requirement: { kind: 'game', modes: ['gpsliar'] }
	},
	{
		id: 'play-leakpatrol',
		part: 'shirtColor',
		value: '#fd79a8',
		// Playing leakpatrol opens one more piece for the agent
		requirement: { kind: 'game', modes: ['leakpatrol'] }
	},
	{
		id: 'play-tycoon',
		part: 'shirtColor',
		value: '#00cec9',
		// Playing tycoon opens one more piece for the agent
		requirement: { kind: 'game', modes: ['tycoon'] }
	},
	{
		id: 'play-wordle',
		part: 'shirtColor',
		value: '#6c5ce7',
		// Playing wordle opens one more piece for the agent
		requirement: { kind: 'game', modes: ['wordle'] }
	},
	{
		id: 'play-maple',
		part: 'shirtColor',
		value: '#e84393',
		// Playing maple opens one more piece for the agent
		requirement: { kind: 'game', modes: ['maple'] }
	},
	{
		id: 'play-rareearth',
		part: 'hairColor',
		value: '#a8642e',
		// Playing rareearth opens one more piece for the agent
		requirement: { kind: 'game', modes: ['rareearth'] }
	},
	{
		id: 'play-raid',
		part: 'hairColor',
		value: '#e8c35a',
		// Playing raid opens one more piece for the agent
		requirement: { kind: 'game', modes: ['raid'] }
	},
	{
		id: 'play-fleethunt',
		part: 'hairColor',
		value: '#d9d9d9',
		// Playing fleethunt opens one more piece for the agent
		requirement: { kind: 'game', modes: ['fleethunt'] }
	},
	{
		id: 'play-bordershift',
		part: 'hairColor',
		value: '#e5484d',
		// Playing bordershift opens one more piece for the agent
		requirement: { kind: 'game', modes: ['bordershift'] }
	},
	{
		id: 'play-droneworks',
		part: 'hairColor',
		value: '#4fa8d8',
		// Playing droneworks opens one more piece for the agent
		requirement: { kind: 'game', modes: ['droneworks'] }
	},
	{
		id: 'play-falklands',
		part: 'hairColor',
		value: '#2d3436',
		// Playing falklands opens one more piece for the agent
		requirement: { kind: 'game', modes: ['falklands'] }
	},
	{
		id: 'play-warroom',
		part: 'hairColor',
		value: '#0984e3',
		// Playing warroom opens one more piece for the agent
		requirement: { kind: 'game', modes: ['warroom'] }
	},
	{
		id: 'play-hackers',
		part: 'hairColor',
		value: '#00b894',
		// Playing hackers opens one more piece for the agent
		requirement: { kind: 'game', modes: ['hackers'] }
	},
	{
		id: 'play-recon',
		part: 'hairColor',
		value: '#e17055',
		// Playing recon opens one more piece for the agent
		requirement: { kind: 'game', modes: ['recon'] }
	},
	{
		id: 'play-shuffle',
		part: 'hairColor',
		value: '#fdcb6e',
		// Playing shuffle opens one more piece for the agent
		requirement: { kind: 'game', modes: ['shuffle'] }
	},
	{
		id: 'play-slider',
		part: 'hairColor',
		value: '#a29bfe',
		// Playing slider opens one more piece for the agent
		requirement: { kind: 'game', modes: ['slider'] }
	},
	{
		id: 'play-grain',
		part: 'hairColor',
		value: '#b2bec3',
		// Playing grain opens one more piece for the agent
		requirement: { kind: 'game', modes: ['grain'] }
	},
	{
		id: 'play-curling',
		part: 'hairColor',
		value: '#8e44ad',
		// Playing curling opens one more piece for the agent
		requirement: { kind: 'game', modes: ['curling'] }
	},
	{
		id: 'play-sabotage',
		part: 'hairColor',
		value: '#16a085',
		// Playing sabotage opens one more piece for the agent
		requirement: { kind: 'game', modes: ['sabotage'] }
	},
	{
		id: 'play-killswitch',
		part: 'hairColor',
		value: '#d35400',
		// Playing killswitch opens one more piece for the agent
		requirement: { kind: 'game', modes: ['killswitch'] }
	},
	{
		id: 'play-beachhead',
		part: 'hairColor',
		value: '#7f8c8d',
		// Playing beachhead opens one more piece for the agent
		requirement: { kind: 'game', modes: ['beachhead'] }
	},
	{
		id: 'play-alignment',
		part: 'hairColor',
		value: '#c0392b',
		// Playing alignment opens one more piece for the agent
		requirement: { kind: 'game', modes: ['alignment'] }
	},
	{
		id: 'play-gpugrid',
		part: 'hairColor',
		value: '#2980b9',
		// Playing gpugrid opens one more piece for the agent
		requirement: { kind: 'game', modes: ['gpugrid'] }
	},
	{
		id: 'play-feedtuner',
		part: 'hairColor',
		value: '#27ae60',
		// Playing feedtuner opens one more piece for the agent
		requirement: { kind: 'game', modes: ['feedtuner'] }
	},
	{
		id: 'play-modelhearing',
		part: 'hairColor',
		value: '#f39c12',
		// Playing modelhearing opens one more piece for the agent
		requirement: { kind: 'game', modes: ['modelhearing'] }
	}
];

/**
 * The looks sold for Telegram Stars. They are kept apart from the earned ones above, so the
 * collection a player can finish by playing stays the same; the bot's catalogue names the same
 * part and value under each sku and lists the skus a player owns.
 */
export const PAID_LOOKS: readonly LookUnlock[] = [
	{
		id: 'tinfoil-hat',
		part: 'hat',
		value: 'tinfoil',
		requirement: { kind: 'stars', sku: 'look_tinfoil' }
	},
	{
		id: 'laser-eyes',
		part: 'eyes',
		value: 'laser',
		requirement: { kind: 'stars', sku: 'look_laser' }
	},
	{
		id: 'gold-shirt',
		part: 'shirtColor',
		value: '#d4a017',
		requirement: { kind: 'stars', sku: 'look_gold' }
	},
	{
		id: 'neon-hair',
		part: 'hairColor',
		value: '#ff4fa3',
		requirement: { kind: 'stars', sku: 'look_neon' }
	},
	{
		id: 'cowboy-hat',
		part: 'hat',
		value: 'cowboy',
		requirement: { kind: 'stars', sku: 'look_cowboy' }
	},
	{
		id: 'beard',
		part: 'facial',
		value: 'beard',
		requirement: { kind: 'stars', sku: 'look_beard' }
	},
	{
		id: 'clown-nose',
		part: 'nose',
		value: 'clown',
		requirement: { kind: 'stars', sku: 'look_clown' }
	}
];

/** Four looks given away by free gift codes, kept out of the earned collection */
export const GIFT_LOOKS: readonly LookUnlock[] = [
	{
		id: 'gift-flamingo-suit',
		part: 'shirt',
		value: 'flamingo',
		requirement: { kind: 'gift', code: 'FLAMINGO' }
	},
	{
		id: 'gift-sky-shirt',
		part: 'shirtColor',
		value: '#00a8ff',
		requirement: { kind: 'gift', code: 'SKY' }
	},
	{
		id: 'gift-orange-shirt',
		part: 'shirtColor',
		value: '#fa983a',
		requirement: { kind: 'gift', code: 'ORANGE' }
	},
	{
		id: 'gift-slate-shirt',
		part: 'shirtColor',
		value: '#78909c',
		requirement: { kind: 'gift', code: 'SLATE' }
	}
];

/** The paid look sold under a sku of the bot's catalogue */
export function paidLookFor(sku: string): LookUnlock | undefined {
	return PAID_LOOKS.find(
		(look) => look.requirement.kind === 'stars' && look.requirement.sku === sku
	);
}

/** True for a look that is bought rather than earned */
export function isPaid(unlock: LookUnlock): boolean {
	return unlock.requirement.kind === 'stars';
}

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
	/** Skus of the looks bought with Telegram Stars */
	owned?: readonly string[];
	/** Codes redeemed on this device, for the free gift looks */
	giftCodes?: readonly string[];
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
	referralCount?: number,
	owned: readonly string[] = [],
	giftCodes: readonly string[] = []
): UnlockProgress {
	return {
		level,
		bestStreak: profile.bestStreak,
		modes: profile.modes,
		tycoon,
		games,
		referralCount,
		owned,
		giftCodes
	};
}

/** The unlock that guards a part value, or undefined when the option is free */
export function unlockFor(part: LookPart, value: string): LookUnlock | undefined {
	return [...LOOK_UNLOCKS, ...PAID_LOOKS, ...GIFT_LOOKS].find(
		(unlock) => unlock.part === part && unlock.value === value
	);
}

/** Best score recorded in the career profile for a mode, or zero */
function bestScore(mode: ModeId, progress: UnlockProgress): number {
	const entry = progress.modes[mode] as { best?: unknown } | undefined;
	return typeof entry?.best === 'number' && Number.isFinite(entry.best) ? entry.best : 0;
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
		case 'beachhead':
			return (progress.games?.beachheadAchievements ?? []).includes(requirement.achievement);
		case 'hackers':
			return (progress.games?.hackersNetwork ?? 0) >= requirement.network;
		case 'game':
			return requirement.modes.some((mode) => progress.modes[mode] !== undefined);
		case 'gift':
			return progress.giftCodes?.includes(requirement.code) ?? false;
		case 'score':
			return bestScore(requirement.mode, progress) > requirement.score;
		case 'stars':
			return progress.owned?.includes(requirement.sku) ?? false;
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
		case 'beachhead':
			return (progress.games?.beachheadAchievements ?? []).includes(requirement.achievement)
				? 1
				: 0;
		case 'hackers':
			return Math.min(1, (progress.games?.hackersNetwork ?? 0) / requirement.network);
		case 'game':
			return requirement.modes.some((mode) => progress.modes[mode] !== undefined) ? 1 : 0;
		case 'gift':
			return progress.giftCodes?.includes(requirement.code) ? 1 : 0;
		case 'score':
			return Math.min(1, bestScore(requirement.mode, progress) / (requirement.score + 1));
		case 'stars':
			return progress.owned?.includes(requirement.sku) ? 1 : 0;
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

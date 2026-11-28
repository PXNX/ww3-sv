/*
 * Translated texts for the extra looks: what a lock asks for, in words a player can act on.
 * The mode requirement names the game through the registry, so it follows the language.
 */
import { modeById } from '#lib/modes/registry.js';
import { m } from '#lib/paraglide/messages.js';
import { achievementName as beachheadAchievementName } from './beachheadText.js';
import { achievementName } from './tycoonText.js';
import type { LookUnlock, UnlockRequirement } from '#lib/game/avatar/unlocks.js';

const PAID_NAMES: Record<string, () => string> = {
	look_tinfoil: m.look_tinfoil,
	look_laser: m.look_laser,
	look_gold: m.look_gold,
	look_neon: m.look_neon,
	look_cowboy: m.look_cowboy,
	look_beard: m.look_beard,
	look_clown: m.look_clown,
	FLAMINGO: m.look_flamingo_suit,
	SKY: m.look_sky_shirt,
	ORANGE: m.look_orange_shirt,
	SLATE: m.look_slate_shirt
};

/** The translated name of a look sold for Stars, by its sku */
export function paidLookName(sku: string): string {
	return PAID_NAMES[sku]?.() ?? sku;
}

/** The sku of a look sold for Stars, or null for an earned one */
export function paidSku(unlock: LookUnlock | undefined): string | null {
	return unlock?.requirement.kind === 'stars' ? unlock.requirement.sku : null;
}

/** One sentence naming what unlocks the look, for the editor's lock hints */
export function requirementText(requirement: UnlockRequirement): string {
	switch (requirement.kind) {
		case 'level':
			return m.avatar_unlock_level({ level: requirement.level });
		case 'streak':
			return m.avatar_unlock_streak({ days: requirement.days });
		case 'mode':
			return m.avatar_unlock_mode({ mode: modeById(requirement.mode).name() });
		case 'fury':
			return m.avatar_unlock_fury({ game: modeById('fury').name() });
		case 'purr':
			return m.avatar_unlock_purr({ game: modeById('purrpentagram').name() });
		case 'venezuela':
			return m.avatar_unlock_venezuela({ game: modeById('venezuela').name() });
		case 'petrobras':
			return m.avatar_unlock_petrobras({
				game: modeById('petrobras').name(),
				streak: requirement.streak
			});
		case 'blocks':
			return m.avatar_unlock_blocks({ game: modeById('blocks').name(), score: requirement.score });
		case 'tycoon':
			return m.avatar_unlock_tycoon({
				name: achievementName(requirement.achievement),
				mode: modeById('tycoon').name()
			});
		case 'referral':
			return m.avatar_unlock_referral({ count: requirement.count });
		case 'beachhead':
			return m.avatar_unlock_beachhead({
				game: modeById('beachhead').name(),
				achievement: beachheadAchievementName(requirement.achievement)
			});
		case 'hackers':
			return m.avatar_unlock_hackers({
				game: modeById('hackers').name(),
				count: requirement.network
			});
		case 'score':
			return m.avatar_unlock_score({
				score: requirement.score,
				game: modeById(requirement.mode).name()
			});
		case 'game':
			return m.avatar_unlock_game({
				game: requirement.modes.map((mode) => modeById(mode).name()).join(' / ')
			});
		case 'gift':
			return m.avatar_unlock_gift({ code: requirement.code });
		case 'stars':
			return m.avatar_unlock_stars();
	}
}

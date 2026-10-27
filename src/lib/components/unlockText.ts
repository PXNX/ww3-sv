/*
 * Translated texts for the extra looks: what a lock asks for, in words a player can act on.
 * The mode requirement names the game through the registry, so it follows the language.
 */
import { modeById } from '#lib/modes/registry.js';
import { m } from '#lib/paraglide/messages.js';
import type { UnlockRequirement } from '#lib/game/avatar/unlocks.js';

/** One sentence naming what unlocks the look, for the editor's lock hints */
export function requirementText(requirement: UnlockRequirement): string {
	switch (requirement.kind) {
		case 'level':
			return m.avatar_unlock_level({ level: requirement.level });
		case 'streak':
			return m.avatar_unlock_streak({ days: requirement.days });
		case 'mode':
			return m.avatar_unlock_mode({ mode: modeById(requirement.mode).name() });
	}
}

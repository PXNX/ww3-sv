/* One plain-language "why did that happen?" line per play style, shown on a lost run. */
import { m } from '#lib/paraglide/messages.js';
import { STYLE_OF_MODE, type PlayStyle } from '#lib/modes/styles.js';
import type { ModeId } from '#lib/modes/registry.js';

export const TIP_FOR_STYLE: Record<PlayStyle, () => string> = {
	reaction: m.result_tip_reaction,
	platformer: m.result_tip_platformer,
	shooter: m.result_tip_shooter,
	tactics: m.result_tip_tactics,
	puzzle: m.result_tip_puzzle,
	riddle: m.result_tip_riddle,
	management: m.result_tip_management
};

/** The hint shown after a loss, chosen by the game's play style */
export function resultTip(mode: ModeId): string {
	return TIP_FOR_STYLE[STYLE_OF_MODE[mode]]();
}

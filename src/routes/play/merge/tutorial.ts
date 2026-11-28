import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { MAX_SUBMARINES } from '#lib/game/merge/mergeBoard.js';
import { CHARACTER_NAME } from '#lib/theme/character.js';

const title = m.merge_tutorial_title();
const characterName = CHARACTER_NAME[getLocale()];

export const tutorialSteps: TutorialStep[] = [
	{
		title,
		text: m.merge_instructions(),
	},
	{
		title,
		text: m.merge_mine_rule({ characterName }),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title,
		text: m.merge_tutorial_submarine({ max: MAX_SUBMARINES }),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
];

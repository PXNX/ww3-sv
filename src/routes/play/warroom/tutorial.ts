import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';
import { MAX_DAYS } from '#lib/game/warroom/config.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.warroom_tutorial_title(),
		text: m.warroom_tutorial_goal({ days: MAX_DAYS }),
	},
	{
		title: m.warroom_tutorial_title(),
		text: m.warroom_tutorial_map(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.warroom_tutorial_title(),
		text: m.warroom_tutorial_supply(),
	},
	{
		title: m.warroom_tutorial_title(),
		text: m.warroom_tutorial_industry(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.warroom_tutorial_title(),
		text: m.warroom_tutorial_army(),
	},
	{
		title: m.warroom_tutorial_title(),
		text: m.warroom_tutorial_combat(),
	},
];

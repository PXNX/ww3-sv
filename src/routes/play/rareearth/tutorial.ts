import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.rareearth_tutorial_title(),
		text: m.rareearth_tutorial_goal(),
	},
	{
		title: m.rareearth_tutorial_title(),
		text: m.rareearth_tutorial_route(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.rareearth_tutorial_title(),
		text: m.rareearth_tutorial_rules(),
	},
	{
		title: m.rareearth_tutorial_title(),
		text: m.rareearth_tutorial_hearts(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.rareearth_tutorial_title(),
		text: m.rareearth_tutorial_score(),
	},
	{
		title: m.rareearth_tutorial_title(),
		text: m.rareearth_tutorial_keys(),
	},
];

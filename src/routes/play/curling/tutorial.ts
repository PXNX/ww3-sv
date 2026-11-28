import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.curling_tutorial_title(),
		text: m.curling_tutorial_goal(),
	},
	{
		title: m.curling_tutorial_title(),
		text: m.curling_tutorial_aim(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.curling_tutorial_title(),
		text: m.curling_tutorial_sweep(),
	},
	{
		title: m.curling_tutorial_title(),
		text: m.curling_tutorial_curl(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.curling_tutorial_title(),
		text: m.curling_tutorial_scoring(),
	},
	{
		title: m.curling_tutorial_title(),
		text: m.curling_tutorial_hazards(),
	},
];

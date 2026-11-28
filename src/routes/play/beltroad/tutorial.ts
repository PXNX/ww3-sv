import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.beltroad_tutorial_title(),
		text: m.beltroad_tutorial_goal(),
	},
	{
		title: m.beltroad_tutorial_title(),
		text: m.beltroad_tutorial_draw(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.beltroad_tutorial_title(),
		text: m.beltroad_tutorial_cut(),
	},
	{
		title: m.beltroad_tutorial_title(),
		text: m.beltroad_tutorial_stars(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
];

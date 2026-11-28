import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.chipfab_tutorial_title(),
		text: m.chipfab_tutorial_goal(),
	},
	{
		title: m.chipfab_tutorial_title(),
		text: m.chipfab_tutorial_stack(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.chipfab_tutorial_title(),
		text: m.chipfab_tutorial_merge(),
	},
	{
		title: m.chipfab_tutorial_title(),
		text: m.chipfab_tutorial_shortage(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.chipfab_tutorial_title(),
		text: m.chipfab_tutorial_jacket(),
	},
	{
		title: m.chipfab_tutorial_title(),
		text: m.chipfab_tutorial_score(),
	},
];

import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.centrifuge_tutorial_title(),
		text: m.centrifuge_tutorial_goal(),
	},
	{
		title: m.centrifuge_tutorial_title(),
		text: m.centrifuge_tutorial_dial(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.centrifuge_tutorial_title(),
		text: m.centrifuge_tutorial_scares(),
	},
	{
		title: m.centrifuge_tutorial_title(),
		text: m.centrifuge_tutorial_fix(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.centrifuge_tutorial_title(),
		text: m.centrifuge_tutorial_score(),
	},
];

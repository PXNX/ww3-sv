import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.gpsliar_tutorial_title(),
		text: m.gpsliar_tutorial_goal(),
	},
	{
		title: m.gpsliar_tutorial_title(),
		text: m.gpsliar_tutorial_steer(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.gpsliar_tutorial_title(),
		text: m.gpsliar_tutorial_chart(),
	},
	{
		title: m.gpsliar_tutorial_title(),
		text: m.gpsliar_tutorial_truth(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.gpsliar_tutorial_title(),
		text: m.gpsliar_tutorial_cross_check(),
	},
	{
		title: m.gpsliar_tutorial_title(),
		text: m.gpsliar_tutorial_hazards(),
	},
];

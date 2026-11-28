import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.suez_tutorial_title(),
		text: m.suez_tutorial_goal(),
	},
	{
		title: m.suez_tutorial_title(),
		text: m.suez_tutorial_drag(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.suez_tutorial_title(),
		text: m.suez_tutorial_banks(),
	},
	{
		title: m.suez_tutorial_title(),
		text: m.suez_tutorial_excavator(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.suez_tutorial_title(),
		text: m.suez_tutorial_queue(),
	},
	{
		title: m.suez_tutorial_title(),
		text: m.suez_tutorial_score(),
	},
];

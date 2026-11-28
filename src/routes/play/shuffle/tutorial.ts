import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.shuffle_tutorial_title(),
		text: m.shuffle_tutorial_goal(),
	},
	{
		title: m.shuffle_tutorial_title(),
		text: m.shuffle_tutorial_tricks(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.shuffle_tutorial_title(),
		text: m.shuffle_tutorial_ping(),
	},
	{
		title: m.shuffle_tutorial_title(),
		text: m.shuffle_tutorial_lives(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.shuffle_tutorial_title(),
		text: m.shuffle_tutorial_score(),
	},
];

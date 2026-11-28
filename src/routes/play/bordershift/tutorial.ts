import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.bordershift_tutorial_title(),
		text: m.bordershift_tutorial_goal(),
	},
	{
		title: m.bordershift_tutorial_title(),
		text: m.bordershift_tutorial_destabilisation(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.bordershift_tutorial_title(),
		text: m.bordershift_tutorial_tools(),
	},
	{
		title: m.bordershift_tutorial_title(),
		text: m.bordershift_tutorial_patience(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.bordershift_tutorial_title(),
		text: m.bordershift_tutorial_waves(),
	},
	{
		title: m.bordershift_tutorial_title(),
		text: m.bordershift_tutorial_keys(),
	},
];

import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.leakpatrol_tutorial_title(),
		text: m.leakpatrol_tutorial_goal(),
	},
	{
		title: m.leakpatrol_tutorial_title(),
		text: m.leakpatrol_tutorial_hold(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.leakpatrol_tutorial_title(),
		text: m.leakpatrol_tutorial_tools(),
	},
	{
		title: m.leakpatrol_tutorial_title(),
		text: m.leakpatrol_tutorial_chat(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.leakpatrol_tutorial_title(),
		text: m.leakpatrol_tutorial_keys(),
	},
];

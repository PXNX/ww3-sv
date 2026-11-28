import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.beachhead_tutorial_title(),
		text: m.beachhead_tutorial_goal(),
	},
	{
		title: m.beachhead_tutorial_title(),
		text: m.beachhead_tutorial_deploy(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.beachhead_tutorial_title(),
		text: m.beachhead_tutorial_focus(),
	},
	{
		title: m.beachhead_tutorial_title(),
		text: m.beachhead_tutorial_skills(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.beachhead_tutorial_title(),
		text: m.beachhead_tutorial_base(),
	},
];

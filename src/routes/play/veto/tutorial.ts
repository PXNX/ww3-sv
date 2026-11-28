import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.veto_tutorial_title(),
		text: m.veto_tutorial_goal(),
	},
	{
		title: m.veto_tutorial_title(),
		text: m.veto_tutorial_rules(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.veto_tutorial_title(),
		text: m.veto_tutorial_lives(),
	},
	{
		title: m.veto_tutorial_title(),
		text: m.veto_tutorial_speed(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.veto_tutorial_title(),
		text: m.veto_tutorial_keys(),
	},
];

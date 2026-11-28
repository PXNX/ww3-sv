import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.dome_tutorial_title(),
		text: m.dome_tutorial_goal(),
	},
	{
		title: m.dome_tutorial_title(),
		text: m.dome_tutorial_tap(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.dome_tutorial_title(),
		text: m.dome_tutorial_value(),
	},
	{
		title: m.dome_tutorial_title(),
		text: m.dome_tutorial_harmless(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.dome_tutorial_title(),
		text: m.dome_tutorial_ammo(),
	},
	{
		title: m.dome_tutorial_title(),
		text: m.dome_tutorial_power(),
	},
];

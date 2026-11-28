import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.fleethunt_tutorial_title(),
		text: m.fleethunt_tutorial_goal(),
	},
	{
		title: m.fleethunt_tutorial_title(),
		text: m.fleethunt_tutorial_weapons(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.fleethunt_tutorial_title(),
		text: m.fleethunt_tutorial_arsenal(),
	},
	{
		title: m.fleethunt_tutorial_title(),
		text: m.fleethunt_tutorial_fog(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.fleethunt_tutorial_title(),
		text: m.fleethunt_tutorial_tricks(),
	},
];

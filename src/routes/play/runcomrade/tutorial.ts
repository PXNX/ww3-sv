import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.runcomrade_tutorial_title(),
		text: m.runcomrade_tutorial_goal(),
	},
	{
		title: m.runcomrade_tutorial_title(),
		text: m.runcomrade_tutorial_controls(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.runcomrade_tutorial_title(),
		text: m.runcomrade_tutorial_obstacles(),
	},
	{
		title: m.runcomrade_tutorial_title(),
		text: m.runcomrade_tutorial_drone(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.runcomrade_tutorial_title(),
		text: m.runcomrade_tutorial_pickups(),
	},
	{
		title: m.runcomrade_tutorial_title(),
		text: m.runcomrade_tutorial_field(),
	},
];

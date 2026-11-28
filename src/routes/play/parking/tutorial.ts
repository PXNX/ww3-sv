import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.parking_tutorial_title(),
		text: m.parking_tutorial_goal(),
	},
	{
		title: m.parking_tutorial_title(),
		text: m.parking_tutorial_drag(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.parking_tutorial_title(),
		text: m.parking_tutorial_stars(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
];

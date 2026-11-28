import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.maple_tutorial_title(),
		text: m.maple_tutorial_goal(),
	},
	{
		title: m.maple_tutorial_title(),
		text: m.maple_tutorial_steer(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.maple_tutorial_title(),
		text: m.maple_tutorial_cart(),
	},
	{
		title: m.maple_tutorial_title(),
		text: m.maple_tutorial_guards(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.maple_tutorial_title(),
		text: m.maple_tutorial_routines(),
	},
	{
		title: m.maple_tutorial_title(),
		text: m.maple_tutorial_noise(),
	},
];

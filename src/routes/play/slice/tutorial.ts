import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.slice_tutorial_title(),
		text: m.slice_tutorial_goal(),
	},
	{
		title: m.slice_tutorial_title(),
		text: m.slice_tutorial_miss(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.slice_tutorial_title(),
		text: m.slice_tutorial_armor(),
	},
	{
		title: m.slice_tutorial_title(),
		text: m.slice_tutorial_split(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.slice_tutorial_title(),
		text: m.slice_tutorial_decoys(),
	},
	{
		title: m.slice_tutorial_title(),
		text: m.slice_tutorial_mine(),
	},
];

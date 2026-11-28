import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.wordle_tutorial_title(),
		text: m.wordle_tutorial_goal(),
	},
	{
		title: m.wordle_tutorial_title(),
		text: m.wordle_tutorial_colors(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.wordle_tutorial_title(),
		text: m.wordle_tutorial_duplicates(),
	},
	{
		title: m.wordle_tutorial_title(),
		text: m.wordle_tutorial_daily(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.wordle_tutorial_title(),
		text: m.wordle_tutorial_share(),
	},
	{
		title: m.wordle_tutorial_title(),
		text: m.wordle_tutorial_keys(),
	},
];

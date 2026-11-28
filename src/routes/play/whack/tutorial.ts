import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.whack_tutorial_title(),
		text: m.whack_tutorial_goal(),
	},
	{
		title: m.whack_tutorial_title(),
		text: m.whack_tutorial_statement(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.whack_tutorial_title(),
		text: m.whack_tutorial_categories(),
	},
	{
		title: m.whack_tutorial_title(),
		text: m.whack_tutorial_decoys(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.whack_tutorial_title(),
		text: m.whack_tutorial_combo(),
	},
	{
		title: m.whack_tutorial_title(),
		text: m.whack_tutorial_boards(),
	},
];

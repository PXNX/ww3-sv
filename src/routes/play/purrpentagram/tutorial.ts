import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.purr_tutorial_title(),
		text: m.purr_tutorial_goal(),
	},
	{
		title: m.purr_tutorial_title(),
		text: m.purr_tutorial_petting(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.purr_tutorial_title(),
		text: m.purr_tutorial_clues(),
	},
	{
		title: m.purr_tutorial_title(),
		text: m.purr_tutorial_star(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.purr_tutorial_title(),
		text: m.purr_tutorial_room(),
	},
	{
		title: m.purr_tutorial_title(),
		text: m.purr_tutorial_calm(),
	},
];

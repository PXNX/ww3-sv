import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.sondage_tutorial_title(),
		text: m.sondage_tutorial_goal(),
	},
	{
		title: m.sondage_tutorial_title(),
		text: m.sondage_tutorial_rally(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.sondage_tutorial_title(),
		text: m.sondage_tutorial_flip(),
	},
	{
		title: m.sondage_tutorial_title(),
		text: m.sondage_tutorial_rival(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.sondage_tutorial_title(),
		text: m.sondage_tutorial_events(),
	},
	{
		title: m.sondage_tutorial_title(),
		text: m.sondage_tutorial_win(),
	},
];

import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.sondage_tutorial_title(),
			text: m.sondage_tutorial_goal()
		},
		{
			title: m.sondage_tutorial_title(),
			text: m.sondage_tutorial_rally(),
			target: '[data-tutorial="board"]',
			action: 'tap'
		},
		{
			title: m.sondage_tutorial_title(),
			text: m.sondage_tutorial_flip(),
			target: '[data-tutorial="board"]'
		},
		{
			title: m.sondage_tutorial_title(),
			text: m.sondage_tutorial_rival(),
			target: '[data-tutorial="board"]',
			action: 'tap'
		},
		{
			title: m.sondage_tutorial_title(),
			text: m.sondage_tutorial_events(),
			target: '[data-tutorial="status"]'
		},
		{
			title: m.sondage_tutorial_title(),
			text: m.sondage_tutorial_win(),
			target: '[data-tutorial="poll-bar"]'
		}
	];
}

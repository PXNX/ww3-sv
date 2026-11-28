import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.wordle_tutorial_title(),
			text: m.wordle_tutorial_goal(),
			target: '[data-tutorial="keyboard"]',
			action: 'tap'
		},
		{
			title: m.wordle_tutorial_title(),
			text: m.wordle_tutorial_colors(),
			target: '[data-tutorial="board"]'
		},
		{
			title: m.wordle_tutorial_title(),
			text: m.wordle_tutorial_duplicates()
		},
		{
			title: m.wordle_tutorial_title(),
			text: m.wordle_tutorial_daily(),
			target: '[data-tutorial="tab-practice"]',
			action: 'tap'
		},
		{
			title: m.wordle_tutorial_title(),
			text: m.wordle_tutorial_share()
		},
		{
			title: m.wordle_tutorial_title(),
			text: m.wordle_tutorial_keys()
		}
	];
}

import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.shuffle_tutorial_title(),
			text: m.shuffle_tutorial_goal()
		},
		{
			title: m.shuffle_tutorial_title(),
			text: m.shuffle_tutorial_tricks(),
			target: '[data-tutorial="board"]',
			action: 'tap'
		},
		{
			title: m.shuffle_tutorial_title(),
			text: m.shuffle_tutorial_ping(),
			target: '[data-tutorial="ping"]'
		},
		{
			title: m.shuffle_tutorial_title(),
			text: m.shuffle_tutorial_lives(),
			target: '[data-tutorial="hud-lives"]',
			action: 'tap'
		},
		{
			title: m.shuffle_tutorial_title(),
			text: m.shuffle_tutorial_score(),
			target: '[data-tutorial="hud-streak"]'
		}
	];
}

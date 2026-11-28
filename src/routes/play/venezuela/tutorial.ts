import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.venezuela_tutorial_title(),
			text: m.venezuela_tutorial_goal()
		},
		{
			title: m.venezuela_tutorial_title(),
			text: m.venezuela_tutorial_controls(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.venezuela_tutorial_title(),
			text: m.venezuela_tutorial_jump()
		},
		{
			title: m.venezuela_tutorial_title(),
			text: m.venezuela_tutorial_slam(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.venezuela_tutorial_title(),
			text: m.venezuela_tutorial_boosters()
		},
		{
			title: m.venezuela_tutorial_title(),
			text: m.venezuela_tutorial_legend()
		}
	];
}

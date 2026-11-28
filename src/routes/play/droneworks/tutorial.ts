import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.droneworks_tutorial_title(),
			text: m.droneworks_tutorial_goal()
		},
		{
			title: m.droneworks_tutorial_title(),
			text: m.droneworks_tutorial_chain(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.droneworks_tutorial_title(),
			text: m.droneworks_tutorial_budget()
		},
		{
			title: m.droneworks_tutorial_title(),
			text: m.droneworks_tutorial_strikes(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.droneworks_tutorial_title(),
			text: m.droneworks_tutorial_flak()
		},
		{
			title: m.droneworks_tutorial_title(),
			text: m.droneworks_tutorial_keys()
		}
	];
}

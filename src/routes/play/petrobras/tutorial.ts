import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.petrobras_tutorial_title(),
			text: m.petrobras_tutorial_goal()
		},
		{
			title: m.petrobras_tutorial_title(),
			text: m.petrobras_tutorial_fronts(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.petrobras_tutorial_title(),
			text: m.petrobras_tutorial_neglect(),
			target: '[data-tutorial="hud"]'
		},
		{
			title: m.petrobras_tutorial_title(),
			text: m.petrobras_tutorial_boss(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.petrobras_tutorial_title(),
			text: m.petrobras_tutorial_keys()
		}
	];
}

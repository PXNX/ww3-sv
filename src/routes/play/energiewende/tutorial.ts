import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.energiewende_tutorial_title(),
			text: m.energiewende_tutorial_goal()
		},
		{
			title: m.energiewende_tutorial_title(),
			text: m.energiewende_tutorial_sliders(),
			target: '[data-tutorial="sources"]',
			action: 'tap'
		},
		{
			title: m.energiewende_tutorial_title(),
			text: m.energiewende_tutorial_cold(),
			target: '[data-tutorial="hud"]'
		},
		{
			title: m.energiewende_tutorial_title(),
			text: m.energiewende_tutorial_stress(),
			target: '[data-tutorial="sources"]',
			action: 'tap'
		},
		{
			title: m.energiewende_tutorial_title(),
			text: m.energiewende_tutorial_events()
		},
		{
			title: m.energiewende_tutorial_title(),
			text: m.energiewende_tutorial_critics()
		}
	];
}

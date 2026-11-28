import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.chipfab_tutorial_title(),
			text: m.chipfab_tutorial_goal()
		},
		{
			title: m.chipfab_tutorial_title(),
			text: m.chipfab_tutorial_stack(),
			target: '[data-tutorial="board"]',
			action: 'tap'
		},
		{
			title: m.chipfab_tutorial_title(),
			text: m.chipfab_tutorial_merge(),
			target: '[data-tutorial="hud-top"]'
		},
		{
			title: m.chipfab_tutorial_title(),
			text: m.chipfab_tutorial_shortage(),
			target: '[data-tutorial="board"]',
			action: 'tap'
		},
		{
			title: m.chipfab_tutorial_title(),
			text: m.chipfab_tutorial_jacket(),
			target: '[data-tutorial="hud"]'
		},
		{
			title: m.chipfab_tutorial_title(),
			text: m.chipfab_tutorial_score()
		}
	];
}

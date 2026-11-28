import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.redsquare_tutorial_title(),
			text: m.redsquare_tutorial_goal()
		},
		{
			title: m.redsquare_tutorial_title(),
			text: m.redsquare_tutorial_rules(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.redsquare_tutorial_title(),
			text: m.redsquare_tutorial_mood(),
			target: '[data-tutorial="hud-mood"]'
		},
		{
			title: m.redsquare_tutorial_title(),
			text: m.redsquare_tutorial_waves(),
			target: '[data-tutorial="hud-wave"]'
		},
		{
			title: m.redsquare_tutorial_title(),
			text: m.redsquare_tutorial_air(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.redsquare_tutorial_title(),
			text: m.redsquare_tutorial_keys()
		}
	];
}

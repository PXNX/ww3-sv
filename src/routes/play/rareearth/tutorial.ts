import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.rareearth_tutorial_title(),
			text: m.rareearth_tutorial_goal()
		},
		{
			title: m.rareearth_tutorial_title(),
			text: m.rareearth_tutorial_route(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.rareearth_tutorial_title(),
			text: m.rareearth_tutorial_rules()
		},
		{
			title: m.rareearth_tutorial_title(),
			text: m.rareearth_tutorial_hearts(),
			target: '[data-tutorial="hud-lives"]'
		},
		{
			title: m.rareearth_tutorial_title(),
			text: m.rareearth_tutorial_score(),
			target: '[data-tutorial="hud-combo"]'
		},
		{
			title: m.rareearth_tutorial_title(),
			text: m.rareearth_tutorial_keys(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		}
	];
}

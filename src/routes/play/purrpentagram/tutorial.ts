import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.purr_tutorial_title(),
			text: m.purr_tutorial_goal(),
			target: '[data-tutorial="hud-lives"]'
		},
		{
			title: m.purr_tutorial_title(),
			text: m.purr_tutorial_petting(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.purr_tutorial_title(),
			text: m.purr_tutorial_clues()
		},
		{
			title: m.purr_tutorial_title(),
			text: m.purr_tutorial_star(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.purr_tutorial_title(),
			text: m.purr_tutorial_room(),
			target: '[data-tutorial="hud-notice"]'
		},
		{
			title: m.purr_tutorial_title(),
			text: m.purr_tutorial_calm()
		}
	];
}

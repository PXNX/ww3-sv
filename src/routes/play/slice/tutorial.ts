import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

// Targets exist on the ready screen and while playing: the HUD lives counter and the playfield
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.slice_tutorial_title(),
			text: m.slice_tutorial_goal()
		},
		{
			title: m.slice_tutorial_title(),
			text: m.slice_tutorial_miss(),
			target: '[data-tutorial="hud-lives"]'
		},
		{
			title: m.slice_tutorial_title(),
			text: m.slice_tutorial_armor()
		},
		{
			title: m.slice_tutorial_title(),
			text: m.slice_tutorial_split(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.slice_tutorial_title(),
			text: m.slice_tutorial_decoys(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.slice_tutorial_title(),
			text: m.slice_tutorial_mine()
		}
	];
}

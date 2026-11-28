import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

// The playfield canvas is the only control in the game (swipe or tap), so the tap steps point at
// the playfield section. The hearts are a HUD counter present on both the ready and the playing screen.
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.runcomrade_tutorial_title(),
			text: m.runcomrade_tutorial_goal()
		},
		{
			title: m.runcomrade_tutorial_title(),
			text: m.runcomrade_tutorial_controls(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.runcomrade_tutorial_title(),
			text: m.runcomrade_tutorial_obstacles(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.runcomrade_tutorial_title(),
			text: m.runcomrade_tutorial_drone(),
			target: '[data-tutorial="lives"]'
		},
		{
			title: m.runcomrade_tutorial_title(),
			text: m.runcomrade_tutorial_pickups()
		},
		{
			title: m.runcomrade_tutorial_title(),
			text: m.runcomrade_tutorial_field()
		}
	];
}

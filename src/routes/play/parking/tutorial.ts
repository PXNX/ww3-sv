import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

/** Harbor tutorial: the playfield wrapper exists on both the level select and the play screen */
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.parking_tutorial_title(),
			text: m.parking_tutorial_goal()
		},
		{
			title: m.parking_tutorial_title(),
			text: m.parking_tutorial_drag(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.parking_tutorial_title(),
			text: m.parking_tutorial_stars(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		}
	];
}

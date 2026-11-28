import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

// The wizard can open from the level select screen or from the playing screen,
// so every target must exist on both. The playfield wrapper is the only such element
// that the page controls, and the tap steps point at it.
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.beltroad_tutorial_title(),
			text: m.beltroad_tutorial_goal()
		},
		{
			title: m.beltroad_tutorial_title(),
			text: m.beltroad_tutorial_draw(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.beltroad_tutorial_title(),
			text: m.beltroad_tutorial_cut()
		},
		{
			title: m.beltroad_tutorial_title(),
			text: m.beltroad_tutorial_stars(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		}
	];
}

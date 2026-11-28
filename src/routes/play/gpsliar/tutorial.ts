import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

/**
 * Steps for the interactive tutorial. Built on each call so the translated text follows the
 * current locale. The steer steps point at whichever sea surface is on screen: the level select
 * on the first visit, the playfield while sailing.
 */
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.gpsliar_tutorial_title(),
			text: m.gpsliar_tutorial_goal()
		},
		{
			title: m.gpsliar_tutorial_title(),
			text: m.gpsliar_tutorial_steer(),
			target: '[data-tutorial="levels"], [data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.gpsliar_tutorial_title(),
			text: m.gpsliar_tutorial_chart(),
			target: '[data-tutorial="levels"], [data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.gpsliar_tutorial_title(),
			text: m.gpsliar_tutorial_truth()
		},
		{
			title: m.gpsliar_tutorial_title(),
			text: m.gpsliar_tutorial_cross_check()
		},
		{
			title: m.gpsliar_tutorial_title(),
			text: m.gpsliar_tutorial_hazards()
		}
	];
}

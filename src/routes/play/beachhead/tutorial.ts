import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

// The tutorial opens on the shore base (first play and the help button), so only
// controls that exist there can be spotlighted. Playfield and skill-bar copy stays
// out of this wizard because those controls are not on screen while it is open.
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.beachhead_tutorial_title(),
			text: m.beachhead_tutorial_goal()
		},
		{
			title: m.beachhead_tutorial_title(),
			text: m.beachhead_tutorial_base(),
			target: '[data-tutorial="base"]',
			action: 'tap'
		},
		{
			title: m.beachhead_tutorial_title(),
			text: m.beachhead_tutorial_map()
		},
		{
			title: m.beachhead_tutorial_title(),
			text: m.beachhead_tutorial_stars(),
			target: '[data-tutorial="base"]',
			action: 'tap'
		},
		{
			title: m.beachhead_tutorial_title(),
			text: m.beachhead_tutorial_landscape()
		}
	];
}

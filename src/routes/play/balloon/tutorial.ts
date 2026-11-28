import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	const title = m.balloon_tutorial_title();
	return [
		{
			title,
			text: m.balloon_tutorial_goal()
		},
		{
			title,
			text: m.balloon_tutorial_burner(),
			target: '[data-tutorial="burner"]',
			action: 'tap'
		},
		{
			title,
			text: m.balloon_tutorial_wind()
		},
		{
			title,
			text: m.balloon_tutorial_hazards(),
			target: '[data-tutorial="lives"]',
			action: 'tap'
		},
		{
			title,
			text: m.balloon_tutorial_photos(),
			target: '[data-tutorial="photos"]',
			action: 'tap'
		},
		{
			title,
			text: m.balloon_tutorial_coast()
		}
	];
}

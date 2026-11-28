import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

/**
 * Steps of the raid tutorial. A function, so the translated strings follow the active locale
 * every time the wizard renders. Tap steps target the battlefield: it is the same element on the
 * lobby and the raid screen, so the spotlight always has a real target while the wizard is open.
 */
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.raid_tutorial_title(),
			text: m.raid_tutorial_goal()
		},
		{
			title: m.raid_tutorial_title(),
			text: m.raid_tutorial_controls(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.raid_tutorial_title(),
			text: m.raid_tutorial_sprint()
		},
		{
			title: m.raid_tutorial_title(),
			text: m.raid_tutorial_weapons(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.raid_tutorial_title(),
			text: m.raid_tutorial_variants()
		},
		{
			title: m.raid_tutorial_title(),
			text: m.raid_tutorial_enemies()
		}
	];
}

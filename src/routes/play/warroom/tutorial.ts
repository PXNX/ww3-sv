import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';
import { MAX_DAYS } from '#lib/game/warroom/config.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.warroom_tutorial_title(),
			text: m.warroom_tutorial_goal({ days: MAX_DAYS })
		},
		{
			title: m.warroom_tutorial_title(),
			text: m.warroom_tutorial_map(),
			target: '[data-tutorial="map"]',
			action: 'tap'
		},
		{
			title: m.warroom_tutorial_title(),
			text: m.warroom_tutorial_supply(),
			target: '[data-tutorial="hud"]'
		},
		{
			title: m.warroom_tutorial_title(),
			text: m.warroom_tutorial_industry(),
			target: '[data-tutorial="tab-industry"]',
			action: 'tap'
		},
		{
			title: m.warroom_tutorial_title(),
			text: m.warroom_tutorial_army(),
			target: '[data-tutorial="tab-army"]',
			action: 'tap'
		},
		{
			title: m.warroom_tutorial_title(),
			text: m.warroom_tutorial_combat(),
			target: '[data-tutorial="end-day"]'
		}
	];
}

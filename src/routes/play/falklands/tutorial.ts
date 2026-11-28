import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.falklands_tutorial_title(),
			text: m.falklands_tutorial_goal()
		},
		{
			title: m.falklands_tutorial_title(),
			text: m.falklands_tutorial_speeds(),
			target: '[data-tutorial="hud-day"]',
			action: 'tap'
		},
		{
			title: m.falklands_tutorial_title(),
			text: m.falklands_tutorial_weather()
		},
		{
			title: m.falklands_tutorial_title(),
			text: m.falklands_tutorial_enemy()
		},
		{
			title: m.falklands_tutorial_title(),
			text: m.falklands_tutorial_peace(),
			target: '[data-tutorial="hud-talks"]',
			action: 'tap'
		},
		{
			title: m.falklands_tutorial_title(),
			text: m.falklands_tutorial_hazards()
		}
	];
}

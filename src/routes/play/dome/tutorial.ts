import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.dome_tutorial_title(),
			text: m.dome_tutorial_goal()
		},
		{
			title: m.dome_tutorial_title(),
			text: m.dome_tutorial_tap(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.dome_tutorial_title(),
			text: m.dome_tutorial_value()
		},
		{
			title: m.dome_tutorial_title(),
			text: m.dome_tutorial_harmless()
		},
		{
			title: m.dome_tutorial_title(),
			text: m.dome_tutorial_ammo(),
			target: '[data-tutorial="hud-ammo"]'
		},
		{
			title: m.dome_tutorial_title(),
			text: m.dome_tutorial_combo(),
			target: '[data-tutorial="hud-combo"]',
			action: 'tap'
		}
	];
}

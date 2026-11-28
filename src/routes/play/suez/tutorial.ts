import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.suez_tutorial_title(),
			text: m.suez_tutorial_goal()
		},
		{
			title: m.suez_tutorial_title(),
			text: m.suez_tutorial_drag(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.suez_tutorial_title(),
			text: m.suez_tutorial_banks(),
			target: '[data-tutorial="hud-stuck"]'
		},
		{
			title: m.suez_tutorial_title(),
			text: m.suez_tutorial_excavator(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.suez_tutorial_title(),
			text: m.suez_tutorial_queue(),
			target: '[data-tutorial="hud-queue"]'
		},
		{
			title: m.suez_tutorial_title(),
			text: m.suez_tutorial_score()
		}
	];
}

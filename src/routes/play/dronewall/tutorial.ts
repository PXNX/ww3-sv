import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

/**
 * The how-to-play wizard. Every target is a real control that is in the DOM on both the
 * start screen and while a wave runs, so the spotlight always has something to cut around.
 */
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.dronewall_tutorial_title(),
			text: m.dronewall_tutorial_goal()
		},
		{
			title: m.dronewall_tutorial_title(),
			text: m.dronewall_tutorial_build(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.dronewall_tutorial_title(),
			text: m.dronewall_tutorial_speed(),
			target: '[data-tutorial="speed"]',
			action: 'tap'
		},
		{
			title: m.dronewall_tutorial_title(),
			text: m.dronewall_tutorial_helmets()
		},
		{
			title: m.dronewall_tutorial_title(),
			text: m.dronewall_tutorial_weather(),
			target: '[data-tutorial="hud-weather"]'
		},
		{
			title: m.dronewall_tutorial_title(),
			text: m.dronewall_tutorial_powers(),
			target: '[data-tutorial="powers"]'
		}
	];
}

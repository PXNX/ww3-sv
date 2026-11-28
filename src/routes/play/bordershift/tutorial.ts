import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

// Steps spotlight the HUD counters on both the ready and the playing screen. The papers, camera,
// ground and wave/turn-back controls live inside BorderShiftField, so the two "use it" steps fall
// back to the playfield section, which contains them.
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.bordershift_tutorial_title(),
			text: m.bordershift_tutorial_goal()
		},
		{
			title: m.bordershift_tutorial_title(),
			text: m.bordershift_tutorial_destabilisation(),
			target: '[data-tutorial="hud-destabilisation"]'
		},
		{
			title: m.bordershift_tutorial_title(),
			text: m.bordershift_tutorial_tools(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.bordershift_tutorial_title(),
			text: m.bordershift_tutorial_patience(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.bordershift_tutorial_title(),
			text: m.bordershift_tutorial_waves(),
			target: '[data-tutorial="hud-wave"]'
		},
		{
			title: m.bordershift_tutorial_title(),
			text: m.bordershift_tutorial_keys()
		}
	];
}

import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.leakpatrol_tutorial_title(),
			text: m.leakpatrol_tutorial_goal(),
			target: '[data-tutorial="hud-lives"]'
		},
		{
			title: m.leakpatrol_tutorial_title(),
			text: m.leakpatrol_tutorial_hold(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.leakpatrol_tutorial_title(),
			text: m.leakpatrol_tutorial_tools()
		},
		{
			title: m.leakpatrol_tutorial_title(),
			text: m.leakpatrol_tutorial_chat(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.leakpatrol_tutorial_title(),
			text: m.leakpatrol_tutorial_keys()
		}
	];
}

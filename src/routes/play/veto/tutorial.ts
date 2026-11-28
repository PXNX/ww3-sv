import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.veto_tutorial_title(),
			text: m.veto_tutorial_goal()
		},
		{
			title: m.veto_tutorial_title(),
			text: m.veto_tutorial_rules(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.veto_tutorial_title(),
			text: m.veto_tutorial_lives(),
			target: '[data-tutorial="hud-lives"]'
		},
		{
			title: m.veto_tutorial_title(),
			text: m.veto_tutorial_speed(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.veto_tutorial_title(),
			text: m.veto_tutorial_keys()
		}
	];
}

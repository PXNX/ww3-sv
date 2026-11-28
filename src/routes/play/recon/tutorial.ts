import type { TutorialStep } from '#lib/services/tutorial.js';
import { RECON_TEXT } from '#lib/game/recon/text.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: RECON_TEXT.tutorial.title,
			text: RECON_TEXT.tutorial.goal
		},
		{
			title: RECON_TEXT.tutorial.title,
			text: RECON_TEXT.tutorial.controls,
			target: '[data-tutorial="scope"]',
			action: 'tap'
		},
		{
			title: RECON_TEXT.tutorial.title,
			text: RECON_TEXT.tutorial.sensors,
			target: '[data-tutorial="sensors"]'
		},
		{
			title: RECON_TEXT.tutorial.title,
			text: RECON_TEXT.tutorial.rules,
			target: '[data-tutorial="scope"]',
			action: 'tap'
		},
		{
			title: RECON_TEXT.tutorial.title,
			text: RECON_TEXT.tutorial.verdict,
			target: '[data-tutorial="hud"]'
		}
	];
}

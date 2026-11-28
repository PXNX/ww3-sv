import type { TutorialStep } from '#lib/services/tutorial.js';
import { RECON_TEXT } from '#lib/game/recon/text.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: RECON_TEXT.tutorial.title,
		text: RECON_TEXT.tutorial.goal,
	},
	{
		title: RECON_TEXT.tutorial.title,
		text: RECON_TEXT.tutorial.controls,
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: RECON_TEXT.tutorial.title,
		text: RECON_TEXT.tutorial.sensors,
	},
	{
		title: RECON_TEXT.tutorial.title,
		text: RECON_TEXT.tutorial.rules,
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: RECON_TEXT.tutorial.title,
		text: RECON_TEXT.tutorial.verdict,
	},
];

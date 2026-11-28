import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.vault_tutorial_title(),
		text: m.vault_tutorial_goal(),
	},
	{
		title: m.vault_tutorial_title(),
		text: m.vault_tutorial_special(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.vault_tutorial_title(),
		text: m.vault_tutorial_banker(),
	},
	{
		title: m.vault_tutorial_title(),
		text: m.vault_tutorial_phone(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.vault_tutorial_title(),
		text: m.vault_tutorial_score(),
	},
];

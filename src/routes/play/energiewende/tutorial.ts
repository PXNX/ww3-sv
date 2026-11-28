import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.energiewende_tutorial_title(),
		text: m.energiewende_tutorial_goal(),
	},
	{
		title: m.energiewende_tutorial_title(),
		text: m.energiewende_tutorial_sliders(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.energiewende_tutorial_title(),
		text: m.energiewende_tutorial_cold(),
	},
	{
		title: m.energiewende_tutorial_title(),
		text: m.energiewende_tutorial_stress(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.energiewende_tutorial_title(),
		text: m.energiewende_tutorial_events(),
	},
	{
		title: m.energiewende_tutorial_title(),
		text: m.energiewende_tutorial_critics(),
	},
];

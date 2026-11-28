import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

const title = m.fury_tutorial_title();

export const tutorialSteps: TutorialStep[] = [
	{
		title,
		text: m.fury_intro(),
	},
	{
		title,
		text: m.fury_controls_hint(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title,
		text: m.fury_tutorial_birds(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title,
		text: m.fury_keyboard_hint(),
	},
];

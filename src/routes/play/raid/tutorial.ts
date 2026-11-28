import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.raid_tutorial_title(),
		text: m.raid_tutorial_goal(),
	},
	{
		title: m.raid_tutorial_title(),
		text: m.raid_tutorial_controls(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.raid_tutorial_title(),
		text: m.raid_tutorial_sprint(),
	},
	{
		title: m.raid_tutorial_title(),
		text: m.raid_tutorial_weapons(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.raid_tutorial_title(),
		text: m.raid_tutorial_variants(),
	},
	{
		title: m.raid_tutorial_title(),
		text: m.raid_tutorial_enemies(),
	},
];

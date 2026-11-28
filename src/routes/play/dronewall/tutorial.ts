import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.dronewall_tutorial_title(),
		text: m.dronewall_tutorial_goal(),
	},
	{
		title: m.dronewall_tutorial_title(),
		text: m.dronewall_tutorial_build(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.dronewall_tutorial_title(),
		text: m.dronewall_tutorial_helmets(),
	},
	{
		title: m.dronewall_tutorial_title(),
		text: m.dronewall_tutorial_air(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.dronewall_tutorial_title(),
		text: m.dronewall_tutorial_armor(),
	},
	{
		title: m.dronewall_tutorial_title(),
		text: m.dronewall_tutorial_attackers(),
	},
];

import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.falklands_tutorial_title(),
		text: m.falklands_tutorial_goal(),
	},
	{
		title: m.falklands_tutorial_title(),
		text: m.falklands_tutorial_speeds(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.falklands_tutorial_title(),
		text: m.falklands_tutorial_weather(),
	},
	{
		title: m.falklands_tutorial_title(),
		text: m.falklands_tutorial_enemy(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.falklands_tutorial_title(),
		text: m.falklands_tutorial_hazards(),
	},
	{
		title: m.falklands_tutorial_title(),
		text: m.falklands_tutorial_pickups(),
	},
];

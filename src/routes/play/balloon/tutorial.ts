import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.balloon_tutorial_title(),
		text: m.balloon_tutorial_goal(),
	},
	{
		title: m.balloon_tutorial_burner(),
		text: m.balloon_tutorial_burner(),
		target: '[data-tutorial="burner"]',
		action: 'tap',
	},
	{
		title: m.balloon_tutorial_wind(),
		text: m.balloon_tutorial_wind(),
	},
	{
		title: m.balloon_tutorial_hazards(),
		text: m.balloon_tutorial_hazards(),
		target: '[data-tutorial="hazard"]',
		action: 'tap',
	},
	{
		title: m.balloon_tutorial_photos(),
		text: m.balloon_tutorial_photos(),
		target: '[data-tutorial="photo"]',
		action: 'tap',
	},
];
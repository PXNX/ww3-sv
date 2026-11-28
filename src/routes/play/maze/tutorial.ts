import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.maze_tutorial_title(),
		text: m.maze_tutorial_goal(),
	},
	{
		title: m.maze_tutorial_title(),
		text: m.maze_tutorial_move(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.maze_tutorial_title(),
		text: m.maze_tutorial_doors(),
	},
	{
		title: m.maze_tutorial_title(),
		text: m.maze_tutorial_closed(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.maze_tutorial_title(),
		text: m.maze_tutorial_steps(),
	},
];

import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';

// The playfield wrapper exists on the size picker and on the maze itself, so the wizard can
// open on either screen without a missing target. The HUD only exists while a maze is running,
// so the steps about it are plain explanation steps.
export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: m.maze_tutorial_title(),
			text: m.maze_tutorial_goal()
		},
		{
			title: m.maze_tutorial_title(),
			text: m.maze_tutorial_move(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.maze_tutorial_title(),
			text: m.maze_tutorial_doors()
		},
		{
			title: m.maze_tutorial_title(),
			text: m.maze_tutorial_closed(),
			target: '[data-tutorial="playfield"]',
			action: 'tap'
		},
		{
			title: m.maze_tutorial_title(),
			text: m.maze_tutorial_steps()
		}
	];
}

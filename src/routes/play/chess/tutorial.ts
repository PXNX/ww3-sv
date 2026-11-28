import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';
import { VANCE_CHANCE } from '#lib/stores/chessGame.svelte.js';

const title = m.chess_tutorial_title();

export const tutorialSteps: TutorialStep[] = [
	{
		title,
		text: m.chess_instructions(),
	},
	{
		title,
		text: m.chess_tutorial_cards(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title,
		text: m.chess_tutorial_vance({ percent: Math.round(VANCE_CHANCE * 100) }),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title,
		text: m.chess_tutorial_putin(),
	},
];

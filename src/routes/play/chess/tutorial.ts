import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';
import { VANCE_CHANCE } from '#lib/stores/chessGame.svelte.js';

export function tutorialSteps(): TutorialStep[] {
	const title = m.chess_tutorial_title();
	return [
		{
			title,
			text: m.chess_instructions(),
			target: '[data-tutorial="board"]',
			action: 'tap'
		},
		{
			title,
			text: m.chess_tutorial_cards(),
			target: '[data-tutorial="cards"]',
			action: 'tap'
		},
		{
			title,
			text: m.chess_tutorial_vance({ percent: Math.round(VANCE_CHANCE * 100) })
		},
		{
			title,
			text: m.chess_tutorial_putin(),
			target: '[data-tutorial="putin"]'
		}
	];
}

import type { TutorialStep } from '#lib/services/tutorial.js';
import { SABOTAGE_TEXT } from '#lib/game/sabotage/text.js';

export function tutorialSteps(): TutorialStep[] {
	return [
		{
			title: SABOTAGE_TEXT.tutorialTitle,
			text: SABOTAGE_TEXT.tutorialGoal,
			target: '[data-tutorial="start"]',
			action: 'tap'
		},
		{
			title: SABOTAGE_TEXT.tutorialTitle,
			text: `${SABOTAGE_TEXT.tutorialMove} ${SABOTAGE_TEXT.tutorialNoise}`,
			target: '[data-tutorial="pad"]',
			action: 'tap'
		},
		{
			title: SABOTAGE_TEXT.tutorialTitle,
			text: SABOTAGE_TEXT.tutorialWatch,
			target: '[data-tutorial="hud-suspicion"]'
		},
		{
			title: SABOTAGE_TEXT.tutorialTitle,
			text: SABOTAGE_TEXT.tutorialSabotage,
			target: '[data-tutorial="pad"]'
		},
		{
			title: SABOTAGE_TEXT.tutorialTitle,
			text: SABOTAGE_TEXT.tutorialPhone,
			target: '[data-tutorial="pad"]'
		},
		{
			title: SABOTAGE_TEXT.tutorialTitle,
			text: SABOTAGE_TEXT.tutorialStars
		}
	];
}

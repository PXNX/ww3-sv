import type { TutorialStep } from '#lib/services/tutorial.js';
import { SABOTAGE_TEXT } from '#lib/game/sabotage/text.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: SABOTAGE_TEXT.tutorialTitle,
		text: SABOTAGE_TEXT.tutorialGoal,
	},
	{
		title: SABOTAGE_TEXT.tutorialTitle,
		text: SABOTAGE_TEXT.tutorialMove,
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: SABOTAGE_TEXT.tutorialTitle,
		text: SABOTAGE_TEXT.tutorialWatch,
	},
	{
		title: SABOTAGE_TEXT.tutorialTitle,
		text: SABOTAGE_TEXT.tutorialNoise,
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: SABOTAGE_TEXT.tutorialTitle,
		text: SABOTAGE_TEXT.tutorialSabotage,
	},
	{
		title: SABOTAGE_TEXT.tutorialTitle,
		text: SABOTAGE_TEXT.tutorialPhone,
	},
	{
		title: SABOTAGE_TEXT.tutorialTitle,
		text: SABOTAGE_TEXT.tutorialStars,
	},
];

import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';
import {
	COUNTER_GAIN,
	DECOY_PENALTY,
	PRESS_COOLDOWN,
	RESIGN_LINE,
	WEEKS_TOTAL
} from '#lib/game/slider/state.js';

export const tutorialSteps: TutorialStep[] = [
	{
		title: m.slider_tutorial_title(),
		text: m.slider_tutorial_goal({ weeks: WEEKS_TOTAL, resign: RESIGN_LINE }),
	},
	{
		title: m.slider_tutorial_title(),
		text: m.slider_tutorial_rally(),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.slider_tutorial_title(),
		text: m.slider_tutorial_scandal({ gain: COUNTER_GAIN }),
	},
	{
		title: m.slider_tutorial_title(),
		text: m.slider_tutorial_decoy({ penalty: DECOY_PENALTY }),
		target: '[data-tutorial="playfield"]',
		action: 'tap',
	},
	{
		title: m.slider_tutorial_title(),
		text: m.slider_tutorial_combo(),
	},
	{
		title: m.slider_tutorial_title(),
		text: m.slider_tutorial_press({ seconds: PRESS_COOLDOWN }),
	},
];

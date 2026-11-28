import type { TutorialStep } from '#lib/services/tutorial.js';
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { formatCount } from '#lib/game/tycoon/format.js';
import {
	COST_GROWTH,
	OFFLINE_CAP_MS,
	OFFLINE_EFFICIENCY,
	PRESTIGE_BONUS
} from '#lib/game/tycoon/config.js';

export function tutorialSteps(): TutorialStep[] {
	const locale = getLocale();
	const count = (value: number) => formatCount(value, locale);

	return [
		{
			title: m.tycoon_tutorial_title(),
			text: m.tycoon_tutorial_goal({ percent: count((COST_GROWTH - 1) * 100) }),
			target: '[data-tutorial="hud-barrels"]'
		},
		{
			title: m.tycoon_tutorial_title(),
			text: m.tycoon_tutorial_upgrades(),
			target: '[data-tutorial="tab-upgrades"]',
			action: 'tap'
		},
		{
			title: m.tycoon_tutorial_title(),
			text: m.tycoon_tutorial_crises()
		},
		{
			title: m.tycoon_tutorial_title(),
			text: m.tycoon_tutorial_offline({
				hours: count(OFFLINE_CAP_MS / 3_600_000),
				percent: count(OFFLINE_EFFICIENCY * 100)
			})
		},
		{
			title: m.tycoon_tutorial_title(),
			text: m.tycoon_tutorial_prestige({ percent: count(PRESTIGE_BONUS * 100) }),
			target: '[data-tutorial="tab-prestige"]',
			action: 'tap'
		}
	];
}

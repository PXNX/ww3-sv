/* Translated texts of Petrobras: the two fronts, their two calls and the jokes */
import { m } from '#lib/paraglide/messages.js';
import type { Choice, Front } from '#lib/game/petrobras/scenarios.js';

const FRONT_NAMES: Record<Front, () => string> = {
	board: m.petrobras_front_board,
	society: m.petrobras_front_society,
	boss: m.petrobras_front_boss
};

export function frontName(front: Front): string {
	return FRONT_NAMES[front]();
}

const CHOICE_NAMES: Record<Front, Record<Choice, () => string>> = {
	board: { firm: m.petrobras_choice_board_firm, loose: m.petrobras_choice_board_loose },
	society: { firm: m.petrobras_choice_society_firm, loose: m.petrobras_choice_society_loose },
	boss: { firm: m.petrobras_choice_boss_firm, loose: m.petrobras_choice_boss_loose }
};

export function choiceName(front: Front, choice: Choice): string {
	return CHOICE_NAMES[front][choice]();
}

const BOARD_TEXTS: readonly (() => string)[] = [
	m.petrobras_board_0,
	m.petrobras_board_1,
	m.petrobras_board_2,
	m.petrobras_board_3,
	m.petrobras_board_4
];

const SOCIETY_TEXTS: readonly (() => string)[] = [
	m.petrobras_society_0,
	m.petrobras_society_1,
	m.petrobras_society_2,
	m.petrobras_society_3,
	m.petrobras_society_4
];

const BOSS_TEXTS: readonly (() => string)[] = [
	m.petrobras_boss_0,
	m.petrobras_boss_1,
	m.petrobras_boss_2
];

const TEXTS: Record<Front, readonly (() => string)[]> = {
	board: BOARD_TEXTS,
	society: SOCIETY_TEXTS,
	boss: BOSS_TEXTS
};

export function scenarioText(front: Front, index: number): string {
	const texts = TEXTS[front];
	return (texts[index] ?? texts[0])();
}

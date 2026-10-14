/* Translated texts of the Security Council Veto game: the silly draft resolutions, the seats, cards and actions */
import { RESOLUTION_COUNT } from '#lib/game/veto/resolutions.js';
import type { Action, Stance } from '#lib/game/veto/vote.js';
import { m } from '#lib/paraglide/messages.js';
import type { SeatId } from '#lib/game/veto/seats.js';

const RESOLUTIONS: readonly (() => string)[] = [
	m.veto_res_01,
	m.veto_res_02,
	m.veto_res_03,
	m.veto_res_04,
	m.veto_res_05,
	m.veto_res_06,
	m.veto_res_07,
	m.veto_res_08,
	m.veto_res_09,
	m.veto_res_10,
	m.veto_res_11,
	m.veto_res_12,
	m.veto_res_13,
	m.veto_res_14,
	m.veto_res_15,
	m.veto_res_16,
	m.veto_res_17,
	m.veto_res_18,
	m.veto_res_19,
	m.veto_res_20,
	m.veto_res_21,
	m.veto_res_22,
	m.veto_res_23,
	m.veto_res_24,
	m.veto_res_25,
	m.veto_res_26,
	m.veto_res_27,
	m.veto_res_28,
	m.veto_res_29,
	m.veto_res_30,
	m.veto_res_31,
	m.veto_res_32,
	m.veto_res_33,
	m.veto_res_34,
	m.veto_res_35,
	m.veto_res_36
];

if (RESOLUTIONS.length !== RESOLUTION_COUNT) {
	throw new Error('vetoText.ts and RESOLUTION_COUNT disagree about the number of resolutions');
}

export function resolutionText(index: number): string {
	return RESOLUTIONS[index]();
}

const SEAT_NAMES: Record<SeatId, () => string> = {
	us: m.veto_seat_us,
	gb: m.veto_seat_gb,
	fr: m.veto_seat_fr,
	ru: m.veto_seat_ru,
	cn: m.veto_seat_cn
};

export function seatName(seat: SeatId): string {
	return SEAT_NAMES[seat]();
}

const CARD_NAMES: Record<Stance, () => string> = {
	aye: m.veto_card_aye,
	nay: m.veto_card_nay,
	meh: m.veto_card_meh
};

export function cardName(stance: Stance): string {
	return CARD_NAMES[stance]();
}

const ACTION_NAMES: Record<Action, () => string> = {
	yes: m.veto_action_yes,
	abstain: m.veto_action_abstain,
	veto: m.veto_action_veto
};

export function actionName(action: Action): string {
	return ACTION_NAMES[action]();
}

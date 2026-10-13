/*
 * Lookups from Sondage Surge state to translated text and colors, so the page and the
 * components stay free of long switches. Messages are functions, which pick the active language
 * when they are called.
 */
import type { Side } from '#lib/game/sondage/board.js';
import type { CandidateMood } from '#lib/game/sondage/candidate.js';
import type { Outcome } from '#lib/game/sondage/rules.js';
import { m } from '#lib/paraglide/messages.js';
import type { ActionView, CellView, EventView } from '#lib/stores/sondageGame.svelte.js';

/** Tile and poll colors: you are red, La Candidate's bloc is navy, undecided tiles are paper */
export const SIDE_BACKGROUND: Record<Side | 'free', string> = {
	you: 'bg-tie-red text-ink',
	rival: 'bg-[#1f3a6e] text-paper',
	free: 'bg-paper text-ink'
};

export const STRIKE_ROUNDS_TEXT = 2;

export function candidateName(): string {
	return m.sondage_candidate_name();
}

export function candidateAlt(mood: CandidateMood): string {
	switch (mood) {
		case 'smug':
			return m.sondage_candidate_alt_smug();
		case 'defeated':
			return m.sondage_candidate_alt_defeated();
		default:
			return m.sondage_candidate_alt_neutral();
	}
}

/** One of two quotes per poll mood; `seed` (the round) alternates between them */
export function candidateQuote(mood: CandidateMood | 'worried', seed: number): string {
	const first = seed % 2 === 0;
	switch (mood) {
		case 'smug':
			return first ? m.sondage_quote_smug_1() : m.sondage_quote_smug_2();
		case 'worried':
		case 'defeated':
			return first ? m.sondage_quote_worried_1() : m.sondage_quote_worried_2();
		default:
			return first ? m.sondage_quote_neutral_1() : m.sondage_quote_neutral_2();
	}
}

export function tileState(cell: CellView): string {
	if (cell.blocked) return m.sondage_state_blocked();
	if (cell.frozen) return m.sondage_state_frozen();
	if (cell.owner === 'you') return m.sondage_state_you();
	if (cell.owner === 'rival') return m.sondage_state_rival();
	return m.sondage_state_free();
}

export function tileLabel(cell: CellView, hint: number): string {
	const name = cell.name ?? '';
	const state = tileState(cell);
	return hint > 0
		? m.sondage_tile_label_flips({ name, state, count: hint })
		: m.sondage_tile_label({ name, state });
}

export function eventText(event: EventView): string {
	if (event.kind === 'strike') {
		return m.sondage_event_strike({ name: event.name, rounds: STRIKE_ROUNDS_TEXT });
	}
	return event.side === 'rival'
		? m.sondage_event_scandal_rival({ name: event.name })
		: m.sondage_event_scandal_you({ name: event.name });
}

export function actionText(action: ActionView): string {
	if (action.gaffe) return m.sondage_action_gaffe({ name: action.name });
	if (action.side === 'you') {
		return action.flips > 0
			? m.sondage_action_you_flip({ name: action.name, count: action.flips })
			: m.sondage_action_you_none({ name: action.name });
	}
	return action.flips > 0
		? m.sondage_action_rival_flip({ name: action.name, count: action.flips })
		: m.sondage_action_rival_none({ name: action.name });
}

/** Why the election was called, for the result screen */
export function reasonText(outcome: Outcome, round: number, you: number, rival: number): string {
	if (outcome.reason === 'final') return m.sondage_result_reason_final({ you, rival });
	if (outcome.winner === 'you') return m.sondage_result_reason_you_majority({ round });
	return outcome.early
		? m.sondage_result_reason_rival_early({ round })
		: m.sondage_result_reason_rival_majority({ round });
}

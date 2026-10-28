import { m } from '#lib/paraglide/messages.js';
import type { CareerRankId } from './config.js';

const RANK_LABELS: Record<CareerRankId, () => string> = {
	intern: m.career_rank_intern,
	lobbyist: m.career_rank_lobbyist,
	fixer: m.career_rank_fixer,
	broker: m.career_rank_broker,
	tycoon: m.career_rank_tycoon,
	oligarch: m.career_rank_oligarch,
	shadow: m.career_rank_shadow,
	survivor: m.career_rank_survivor
};

/** The translated name of a career rank, for the career strip and the profile badge */
export function rankLabel(rank: CareerRankId): string {
	return RANK_LABELS[rank]();
}

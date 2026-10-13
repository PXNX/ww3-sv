/*
 * La Candidate, the rival bloc's leader: an original caricature with a navy sash. Her mood follows
 * the poll, so the HUD cameo smirks when she leads and sweats when she trails.
 */
import type { Tally } from './board.js';
import type { Outcome } from './rules.js';

export type CandidateMood = 'neutral' | 'smug' | 'defeated';

/** The poll mood while the race is on: 'defeated' is reserved for a lost election */
export function pollMood(counts: Pick<Tally, 'you' | 'rival'>): 'neutral' | 'smug' | 'worried' {
	if (counts.rival > counts.you + 1) return 'smug';
	if (counts.you > counts.rival + 1) return 'worried';
	return 'neutral';
}

/** The cameo pose for a mood: worried is the neutral portrait with a drop of sweat in the quote */
export function candidatePose(mood: 'neutral' | 'smug' | 'worried' | 'defeated'): CandidateMood {
	return mood === 'worried' ? 'neutral' : mood;
}

/** The pose on the election result: she gloats when she wins and sulks when she loses */
export function resultPose(outcome: Outcome): CandidateMood {
	return outcome.winner === 'rival' ? 'smug' : 'defeated';
}

export function candidateFile(mood: CandidateMood): string {
	return `sondage-candidate-${mood}.svg`;
}

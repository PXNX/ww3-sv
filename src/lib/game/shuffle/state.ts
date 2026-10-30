/*
 * Shadow Fleet Shuffle — fully engaging shell-game tracker.
 * 3 cards shake; player taps the tanker card. Wrong tap = miss; correct = point + streak.
 * Animation via CSS transitions on cards.
 */
export const CARD_COUNT = 3;
export interface ShuffleState {
	positions: number[]; // card index -> visual position 0..2
	tankerIdx: number;   // which card is the tanker
	shuffles: number;
	streak: number;
	score: number;
	over: boolean;
	lastTapped: number | null;
}
export function createShuffle(): ShuffleState {
	return { positions: [0,1,2], tankerIdx: 1, shuffles: 0, streak: 0, score: 0, over: false, lastTapped: null };
}
export function shuffle(s: ShuffleState): ShuffleState {
	if (s.over) return s;
	s.shuffles += 1;
	// Random permutation
	const p = [...s.positions];
	for (let i = p.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[p[i], p[j]] = [p[j], p[i]];
	}
	s.positions = p;
	s.tankerIdx = Math.floor(Math.random() * CARD_COUNT);
	s.lastTapped = null;
	return s;
}
export function tap(s: ShuffleState, idx: number): number {
	if (s.over) return 0;
	s.lastTapped = idx;
	if (idx === s.tankerIdx) {
		s.streak += 1;
		s.score += 50 + 20 * s.streak;
		if (s.streak >= 5) { s.over = true; s.score += 200; }
	} else {
		s.streak = 0;
		s.score = Math.max(0, s.score - 30);
	}
	return idx === s.tankerIdx ? 1 : 0;
}

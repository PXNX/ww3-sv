/*
 * Shadow Fleet Shuffle — shell game tracking a sanctioned tanker.
 * 3 cards move; the tanker moves behind them. Player taps the correct card.
 */
export interface ShuffleState {
	cards: number[]; // 0=loader, 1=tanker, 2=other
	tankerPos: number; // 0..2
	shuffles: number;
	score: number;
	over: boolean;
}
export function createShuffle(): ShuffleState {
	return { cards: [0,1,2], tankerPos: 1, shuffles: 0, score: 0, over: false };
}
export function shuffleCards(s: ShuffleState) {
	s.cards = [Math.floor(Math.random()*3), Math.floor(Math.random()*3), Math.floor(Math.random()*3)];
	s.tankerPos = Math.floor(Math.random()*3);
	s.shuffles++;
}

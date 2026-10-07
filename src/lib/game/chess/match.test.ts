import { describe, expect, it } from 'vitest';
import { moveFromText } from './chess';
import {
	createMatch,
	finalScore,
	liveScore,
	material,
	matchStatus,
	playCard,
	playMove,
	replayMatch,
	stealCard,
	type MatchState
} from './match';
import type { CardId } from './cards';

const HAND: CardId[] = ['plague', 'gotcha-ball', 'bear-hug'];

const move = (match: MatchState, text: string) =>
	playMove(match, moveFromText(match.position, text)!);

describe('match', () => {
	it('starts with White to move and the full hand', () => {
		const match = createMatch(HAND);
		expect(match.position.turn).toBe('w');
		expect(match.hand).toEqual(HAND);
		expect(material(match.position.board, 'w')).toBe(39);
	});

	it('uses a card instead of a move, once, and only from the hand', () => {
		let match = createMatch(HAND);
		expect(playCard(match, { id: 'marriage-crisis' })).toBeNull();
		match = playCard(match, { id: 'gotcha-ball', param: 'a7' })!;
		expect(match.hand).toEqual(['plague', 'bear-hug']);
		expect(match.position.turn).toBe('b');
		expect(match.actions).toEqual(['c:gotcha-ball:a7']);
		expect(match.lastMove).toBeNull();
		expect(liveScore(match)).toBe(10);
		expect(playCard(match, { id: 'gotcha-ball', param: 'b7' })).toBeNull();
	});

	it('lets Vance take a card away without using the turn', () => {
		const match = stealCard(createMatch(HAND), 'plague');
		expect(match.hand).toEqual(['gotcha-ball', 'bear-hug']);
		expect(match.position.turn).toBe('w');
		expect(match.actions).toEqual(['v:plague']);
	});

	it('replays a saved match exactly, and rejects a corrupt one', () => {
		let match = createMatch(HAND);
		match = move(match, 'e2e4');
		match = move(match, 'e7e5');
		match = stealCard(match, 'plague');
		match = playCard(match, { id: 'gotcha-ball', param: 'a7' })!;
		match = move(match, 'b8c6');

		const replayed = replayMatch(HAND, match.actions)!;
		expect(replayed.position).toEqual(match.position);
		expect(replayed.hand).toEqual(match.hand);
		expect(replayed.history).toEqual(match.history);

		expect(replayMatch(HAND, ['e2e5'])).toBeNull();
		expect(replayMatch(HAND, ['v:master-ball'])).toBeNull();
		expect(replayMatch(HAND, ['c:plague'])).toBeNull();
	});

	it('scores material taken, plus bonuses for the result', () => {
		let match = createMatch(HAND);
		for (const text of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) match = move(match, text);
		expect(matchStatus(match)).toEqual({ kind: 'checkmate', winner: 'b' });
		expect(finalScore(match, matchStatus(match))).toBe(0);

		expect(finalScore(match, { kind: 'checkmate', winner: 'w' })).toBe(
			500 + (50 - 3) * 10 + 3 * 50
		);
		expect(finalScore(match, { kind: 'draw', reason: 'stalemate' })).toBe(100);
	});
});

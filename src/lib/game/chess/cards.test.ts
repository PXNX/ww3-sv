import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { initialPosition, parseSquare, positionFromRows, type Piece, type Position } from './chess';
import {
	applyCard,
	CARDS,
	cardPlayFromText,
	cardPlayToText,
	cardTargets,
	dealHand,
	HAND_SIZE,
	rollCardParam
} from './cards';

const count = (position: Position, type: Piece['type'], color: Piece['color']) =>
	position.board.filter((piece) => piece?.type === type && piece.color === color).length;

const at = (name: string) => parseSquare(name)!;

describe('dealHand', () => {
	it('deals three different cards, and eventually every card', () => {
		const random = createRandom(2);
		const seen = new Set<string>();
		for (let i = 0; i < 300; i++) {
			const hand = dealHand(random);
			expect(hand).toHaveLength(HAND_SIZE);
			expect(new Set(hand).size).toBe(HAND_SIZE);
			hand.forEach((id) => seen.add(id));
		}
		expect(seen.size).toBe(CARDS.length);
	});
});

describe('card text', () => {
	it('round-trips with and without a parameter', () => {
		expect(cardPlayToText({ id: 'plague', param: 'b' })).toBe('c:plague:b');
		expect(cardPlayFromText('c:plague:b')).toEqual({ id: 'plague', param: 'b' });
		expect(cardPlayFromText('c:bear-hug')).toEqual({ id: 'bear-hug' });
		expect(cardPlayFromText('c:nonsense')).toBeNull();
		expect(cardPlayFromText('e2e4')).toBeNull();
	});

	it('rolls a team only for the plague', () => {
		const start = initialPosition();
		expect(rollCardParam('plague', () => 0.1, start)).toBe('w');
		expect(rollCardParam('plague', () => 0.9, start)).toBe('b');
		expect(rollCardParam('bear-hug', () => 0.1, start)).toBeUndefined();
	});

	it('rolls the Bayraktar target among enemy knights and bishops only', () => {
		const start = initialPosition();
		// Four knights and bishops in a8-h8 order b8, c8, f8, g8
		expect(rollCardParam('bayraktar', () => 0, start)).toBe('b8');
		expect(rollCardParam('bayraktar', () => 0.99, start)).toBe('g8');
		const bare = positionFromRows([
			'....k...',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........',
			'....K...'
		]);
		expect(rollCardParam('bayraktar', () => 0, bare)).toBeUndefined();
	});
});

describe('cards', () => {
	const start = initialPosition();

	it('plague removes all pawns of one team and hands the turn over', () => {
		const next = applyCard(start, { id: 'plague', param: 'b' })!;
		expect(count(next, 'p', 'b')).toBe(0);
		expect(count(next, 'p', 'w')).toBe(8);
		expect(next.turn).toBe('b');
		expect(applyCard(start, { id: 'plague' })).toBeNull();
	});

	it('marriage crisis removes both queens', () => {
		const next = applyCard(start, { id: 'marriage-crisis' })!;
		expect(count(next, 'q', 'w') + count(next, 'q', 'b')).toBe(0);
	});

	it('refuses a card that would change nothing', () => {
		const noQueens = applyCard(start, { id: 'marriage-crisis' })!;
		expect(applyCard({ ...noQueens, turn: 'w' }, { id: 'marriage-crisis' })).toBeNull();
	});

	it('balls turn an enemy piece up to their strength into one of ours, in place', () => {
		expect(cardTargets(start, 'gotcha-ball').every((square) => square >> 3 === 1)).toBe(true);
		expect(cardTargets(start, 'gotcha-ball')).toHaveLength(8);
		expect(applyCard(start, { id: 'gotcha-ball', param: 'a7' })!.board[at('a7')]).toEqual({
			type: 'p',
			color: 'w'
		});

		expect(applyCard(start, { id: 'ultra-ball', param: 'd8' })).toBeNull();
		expect(cardTargets(start, 'master-ball')).toContain(at('d8'));
		expect(applyCard(start, { id: 'master-ball', param: 'd8' })!.board[at('d8')]).toEqual({
			type: 'q',
			color: 'w'
		});
		// A king can never be caught, and neither can our own pieces
		expect(applyCard(start, { id: 'master-ball', param: 'e8' })).toBeNull();
		expect(applyCard(start, { id: 'master-ball', param: 'd1' })).toBeNull();
	});

	it('pawn net converts the three enemy pawns closest to promotion', () => {
		const position = positionFromRows([
			'....k...',
			'pp.p....',
			'........',
			'........',
			'.p......',
			'..p.....',
			'p.......',
			'....K...'
		]);
		const next = applyCard(position, { id: 'pawn-net' })!;
		expect(count(next, 'p', 'w')).toBe(3);
		for (const name of ['a2', 'c3', 'b4']) {
			expect(next.board[at(name)]).toEqual({ type: 'p', color: 'w' });
		}
		expect(count(next, 'p', 'b')).toBe(3);
	});

	it('farmer revolution adds eight pawns in front of our army', () => {
		const next = applyCard(start, { id: 'farmer-revolution' })!;
		expect(count(next, 'p', 'w')).toBe(16);
		expect(count(next, 'p', 'b')).toBe(8);
		expect(next.board.slice(40, 48).every((piece) => piece?.type === 'p')).toBe(true);
	});

	it('mercenaries trade the queen for two knights', () => {
		const next = applyCard(start, { id: 'mercenaries' })!;
		expect(count(next, 'q', 'w')).toBe(0);
		expect(count(next, 'n', 'w')).toBe(4);
		expect(count(next, 'q', 'b')).toBe(1);
	});

	it('rigged election makes a queen of the most advanced pawn and gives the enemy a knight', () => {
		const position = positionFromRows([
			'....k...',
			'........',
			'........',
			'........',
			'..P.....',
			'........',
			'P.......',
			'....K...'
		]);
		const next = applyCard(position, { id: 'rigged-election' })!;
		expect(next.board[at('c4')]).toEqual({ type: 'q', color: 'w' });
		expect(next.board[at('a2')]).toEqual({ type: 'p', color: 'w' });
		expect(count(next, 'n', 'b')).toBe(1);
	});

	it('bear hug crushes the enemy queen at the price of our rooks', () => {
		const next = applyCard(start, { id: 'bear-hug' })!;
		expect(count(next, 'q', 'b')).toBe(0);
		expect(count(next, 'r', 'w')).toBe(0);
		expect(count(next, 'r', 'b')).toBe(2);
	});

	it('refuses a card that leaves our own king in check', () => {
		// The pawn on e2 shields our king from the rook on e8
		const position = positionFromRows([
			'....r..k',
			'........',
			'........',
			'........',
			'........',
			'........',
			'....P...',
			'....K...'
		]);
		expect(applyCard(position, { id: 'plague', param: 'w' })).toBeNull();
	});

	it('lets a ball save a king in check by catching the attacker', () => {
		const position = positionFromRows([
			'....k...',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........',
			'r...K...'
		]);
		expect(applyCard(position, { id: 'ultra-ball', param: 'a1' })).not.toBeNull();
		expect(applyCard(position, { id: 'plague', param: 'b' })).toBeNull();
	});

	it('drops castling rights when a card removes the rook', () => {
		const next = applyCard(start, { id: 'bear-hug' })!;
		expect(next.castling.wK).toBe(false);
		expect(next.castling.wQ).toBe(false);
		expect(next.castling.bK).toBe(true);
	});
});

describe('Ukraine cards', () => {
	const start = initialPosition();

	it('javelin destroys any enemy piece up to a rook, but not the queen or king', () => {
		expect(cardTargets(start, 'javelin')).not.toContain(at('d8'));
		expect(cardTargets(start, 'javelin')).not.toContain(at('e8'));
		expect(cardTargets(start, 'javelin')).toContain(at('a8'));
		const next = applyCard(start, { id: 'javelin', param: 'a8' })!;
		expect(next.board[at('a8')]).toBeNull();
		expect(count(next, 'r', 'b')).toBe(1);
		expect(next.turn).toBe('b');
		expect(applyCard(start, { id: 'javelin', param: 'd8' })).toBeNull();
		expect(applyCard(start, { id: 'javelin', param: 'a1' })).toBeNull();
	});

	it('bayraktar destroys the rolled knight or bishop and refuses any other square', () => {
		const next = applyCard(start, { id: 'bayraktar', param: 'g8' })!;
		expect(next.board[at('g8')]).toBeNull();
		expect(count(next, 'n', 'b')).toBe(1);
		expect(applyCard(start, { id: 'bayraktar', param: 'a8' })).toBeNull();
		expect(applyCard(start, { id: 'bayraktar' })).toBeNull();
	});

	it('himars destroys the target and the enemy pieces next to it, never a king', () => {
		const next = applyCard(start, { id: 'himars', param: 'd8' })!;
		// d8 queen, c8 bishop, c7 d7 e7 pawns; the king on e8 stays
		for (const name of ['d8', 'c8', 'c7', 'd7', 'e7']) expect(next.board[at(name)]).toBeNull();
		expect(next.board[at('e8')]).toEqual({ type: 'k', color: 'b' });
		expect(next.board[at('b8')]).not.toBeNull();
		expect(count(next, 'p', 'b')).toBe(5);
		expect(applyCard(start, { id: 'himars', param: 'e8' })).toBeNull();
	});

	it('grain corridor moves every free pawn one step but not onto the last row', () => {
		const position = positionFromRows([
			'....k...',
			'P.......',
			'........',
			'........',
			'...p....',
			'...P....',
			'.P......',
			'....K...'
		]);
		const next = applyCard(position, { id: 'grain-corridor' })!;
		// a7 would reach the last row, d3 is blocked by the black pawn on d4
		expect(next.board[at('a7')]).toEqual({ type: 'p', color: 'w' });
		expect(next.board[at('d3')]).toEqual({ type: 'p', color: 'w' });
		expect(next.board[at('b3')]).toEqual({ type: 'p', color: 'w' });
		expect(next.board[at('b2')]).toBeNull();
		expect(applyCard(start, { id: 'grain-corridor' })).not.toBeNull();
	});
});

describe('USA cards', () => {
	const start = initialPosition();

	it('lend-lease brings a rook and costs the two most advanced pawns', () => {
		const position = positionFromRows([
			'....k...',
			'........',
			'........',
			'........',
			'..P.....',
			'.P......',
			'P.......',
			'....K...'
		]);
		const next = applyCard(position, { id: 'lend-lease' })!;
		expect(count(next, 'r', 'w')).toBe(1);
		expect(next.board[at('c4')]).toBeNull();
		// The rook takes the first free square, the one the pawn on b3 just left
		expect(next.board[at('b3')]).toEqual({ type: 'r', color: 'w' });
		expect(count(next, 'p', 'w')).toBe(1);
		expect(next.board[at('a2')]).toEqual({ type: 'p', color: 'w' });
		const onePawn = positionFromRows([
			'....k...',
			'........',
			'........',
			'........',
			'........',
			'........',
			'P.......',
			'....K...'
		]);
		expect(applyCard(onePawn, { id: 'lend-lease' })).toBeNull();
	});

	it('frozen assets freezes Putin’s rooks and sanctions our bishops', () => {
		const next = applyCard(start, { id: 'frozen-assets' })!;
		expect(count(next, 'r', 'b')).toBe(0);
		expect(count(next, 'r', 'w')).toBe(2);
		expect(count(next, 'b', 'w')).toBe(0);
		expect(count(next, 'b', 'b')).toBe(2);
	});

	it('trade war removes every knight and bishop of both teams', () => {
		const next = applyCard(start, { id: 'trade-war' })!;
		for (const type of ['n', 'b'] as const) {
			expect(count(next, type, 'w') + count(next, type, 'b')).toBe(0);
		}
		expect(count(next, 'r', 'w')).toBe(2);
	});

	it('art of the deal flips every rook and refuses when there are none', () => {
		const next = applyCard(start, { id: 'art-of-the-deal' })!;
		expect(next.board[at('a1')]).toEqual({ type: 'r', color: 'b' });
		expect(next.board[at('h8')]).toEqual({ type: 'r', color: 'w' });
		expect(count(next, 'r', 'w')).toBe(2);
		expect(next.castling).toEqual({ wK: false, wQ: false, bK: false, bQ: false });
		const noRooks = positionFromRows([
			'....k...',
			'........',
			'........',
			'........',
			'........',
			'........',
			'P.......',
			'....K...'
		]);
		expect(applyCard(noRooks, { id: 'art-of-the-deal' })).toBeNull();
	});
});

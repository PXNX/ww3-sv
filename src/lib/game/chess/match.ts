/*
 * One 4D Chess match as plain data: the position, the cards still in hand, and the list of actions
 * so far. Every action has a short text form, so a match is saved as its action list and replayed
 * on load (see replayMatch). The player is White; Putin plays Black through the same functions.
 */
import {
	applyMove,
	gameStatus,
	initialPosition,
	moveFromText,
	moveToText,
	opposite,
	PIECE_VALUE,
	positionKey,
	type Board,
	type Color,
	type GameStatus,
	type Move,
	type Position,
	type Square
} from './chess';
import {
	applyCard,
	cardPlayFromText,
	cardPlayToText,
	isCardId,
	type CardId,
	type CardPlay
} from './cards';

export interface MatchState {
	position: Position;
	/** Cards the player can still play */
	hand: CardId[];
	/** Keys of every position reached so far, for the threefold repetition rule */
	history: string[];
	/** Text of every action in order: a move ('e2e4'), a card ('c:plague:b') or a stolen card ('v:plague') */
	actions: string[];
	lastMove: { from: Square; to: Square } | null;
}

/** Points per pawn's worth of material taken from Putin, and the bonuses for finishing the match */
const POINTS_PER_PAWN = 10;
const WIN_BONUS = 500;
const DRAW_BONUS = 100;
const SPEED_BONUS_PER_MOVE = 10;
const SPEED_BONUS_MOVES = 50;
const UNUSED_CARD_BONUS = 50;
/** Material of a full army without the king, in pawns */
const FULL_ARMY = 39;

export function createMatch(hand: readonly CardId[]): MatchState {
	const position = initialPosition();
	return {
		position,
		hand: [...hand],
		history: [positionKey(position)],
		actions: [],
		lastMove: null
	};
}

function advance(
	state: MatchState,
	position: Position,
	action: string,
	extra: Partial<MatchState>
) {
	return {
		...state,
		...extra,
		position,
		history: [...state.history, positionKey(position)],
		actions: [...state.actions, action]
	};
}

/** Plays a legal move for the side to move */
export function playMove(state: MatchState, move: Move): MatchState {
	return advance(state, applyMove(state.position, move), moveToText(move), {
		lastMove: { from: move.from, to: move.to }
	});
}

/** Plays a card from the hand, or returns null when it is not in the hand or the card is refused */
export function playCard(state: MatchState, play: CardPlay): MatchState | null {
	if (!state.hand.includes(play.id)) return null;
	const position = applyCard(state.position, play);
	if (!position) return null;
	const hand = state.hand.slice();
	hand.splice(hand.indexOf(play.id), 1);
	return advance(state, position, cardPlayToText(play), { hand, lastMove: null });
}

/**
 * JD Vance bursts in and "finds" the card to be gone: it leaves the hand without any effect, and
 * the turn stays with the player (so it can never leave a king in check).
 */
export function stealCard(state: MatchState, id: CardId): MatchState {
	const hand = state.hand.slice();
	const index = hand.indexOf(id);
	if (index >= 0) hand.splice(index, 1);
	return { ...state, hand, actions: [...state.actions, `v:${id}`] };
}

export function matchStatus(state: MatchState): GameStatus {
	return gameStatus(state.position, state.history);
}

/** Rebuilds a match from its first hand and saved actions; null when any of them is not valid */
export function replayMatch(
	hand: readonly CardId[],
	actions: readonly string[]
): MatchState | null {
	let state = createMatch(hand);
	for (const text of actions) {
		if (text.startsWith('v:')) {
			const id = text.slice(2);
			if (!isCardId(id) || !state.hand.includes(id)) return null;
			state = stealCard(state, id);
		} else if (text.startsWith('c:')) {
			const play = cardPlayFromText(text);
			const next = play && playCard(state, play);
			if (!next) return null;
			state = next;
		} else {
			const move = moveFromText(state.position, text);
			if (!move) return null;
			state = playMove(state, move);
		}
	}
	return state;
}

/** Material of one team in pawns, not counting the king */
export function material(board: Board, color: Color): number {
	return board.reduce(
		(sum, piece) => (piece?.color === color ? sum + PIECE_VALUE[piece.type] : sum),
		0
	);
}

/** Score while playing: how much of Putin's army is gone, in points */
export function liveScore(state: MatchState): number {
	return Math.max(0, FULL_ARMY - material(state.position.board, 'b')) * POINTS_PER_PAWN;
}

/** Final score once the match is over: material taken, plus a bonus for the result and for speed */
export function finalScore(state: MatchState, status: GameStatus): number {
	let score = liveScore(state);
	if (status.kind === 'checkmate' && status.winner === 'w') {
		const fast = Math.max(0, SPEED_BONUS_MOVES - state.position.fullmove) * SPEED_BONUS_PER_MOVE;
		score += WIN_BONUS + fast + state.hand.length * UNUSED_CARD_BONUS;
	} else if (status.kind === 'draw') {
		score += DRAW_BONUS;
	}
	return score;
}

export const playerColor: Color = 'w';
export const putinColor: Color = opposite(playerColor);

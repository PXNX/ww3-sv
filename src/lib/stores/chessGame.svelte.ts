/*
 * 4D Chess game state for the view: wraps the pure rules in src/lib/game/chess with selection,
 * card playing, Putin's thinking time, his remarks, JD Vance's interruptions and personal bests.
 * The match is saved as its list of actions, so a reload picks the game up where it was.
 */
import {
	cardDefinition,
	cardTargets,
	dealHand,
	HAND_SIZE,
	isCardId,
	rollCardParam,
	type CardId,
	type CardPlay
} from '#lib/game/chess/cards.js';
import {
	legalMoves,
	squareName,
	type GameStatus,
	type Move,
	type PromotionType,
	type Square
} from '#lib/game/chess/chess.js';
import {
	createMatch,
	finalScore,
	liveScore,
	matchStatus,
	playCard,
	playMove,
	replayMatch,
	stealCard,
	type MatchState
} from '#lib/game/chess/match.js';
import { choosePutinMove } from '#lib/game/chess/putin.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import { m } from '#lib/paraglide/messages.js';

const SAVE_KEY = 'chess:game';
const SCORE_BEST = ['chess', 'score'];
/** How long Putin "thinks" before he moves */
const PUTIN_DELAY_MS = 800;
/** Chance that JD Vance bursts in and takes the card the player just tried to play */
export const VANCE_CHANCE = 0.2;
/** Chance of a remark after an ordinary move */
const CALM_REMARK_CHANCE = 0.3;

interface SavedChess {
	hand: CardId[];
	actions: string[];
}

function isSavedChess(value: unknown): value is SavedChess {
	if (typeof value !== 'object' || value === null) return false;
	const { hand, actions } = value as Partial<SavedChess>;
	return (
		Array.isArray(hand) &&
		hand.length === HAND_SIZE &&
		hand.every(isCardId) &&
		Array.isArray(actions) &&
		actions.every((action) => typeof action === 'string')
	);
}

export type QuipKind = 'greeting' | 'calm' | 'blunder' | 'check' | 'takes' | 'loses-piece' | 'card';

const QUIPS: Record<QuipKind, (() => string)[]> = {
	greeting: [m.chess_quip_greeting_1],
	calm: [m.chess_quip_calm_1, m.chess_quip_calm_2],
	blunder: [
		m.chess_quip_blunder_1,
		m.chess_quip_blunder_2,
		m.chess_quip_blunder_3,
		m.chess_quip_blunder_4,
		m.chess_quip_blunder_5,
		m.chess_quip_blunder_6
	],
	check: [m.chess_quip_check_1, m.chess_quip_check_2, m.chess_quip_check_3],
	takes: [m.chess_quip_takes_1, m.chess_quip_takes_2, m.chess_quip_takes_3, m.chess_quip_takes_4],
	'loses-piece': [
		m.chess_quip_loses_piece_1,
		m.chess_quip_loses_piece_2,
		m.chess_quip_loses_piece_3,
		m.chess_quip_loses_piece_4
	],
	card: [m.chess_quip_card_1, m.chess_quip_card_2, m.chess_quip_card_3]
};

/** Something Putin says, as a kind and a variant; the id lets the view replay the pop-in */
export interface Quip {
	id: number;
	kind: QuipKind;
	variant: number;
}

export const quipText = ({ kind, variant }: Quip): string => QUIPS[kind][variant]();

export type ChessNotice =
	{ kind: 'card'; id: CardId; param?: string } | { kind: 'refused'; id: CardId };

const CARD_TEXT: Record<
	CardId,
	{ name: () => string; description: () => string; played: () => string }
> = {
	plague: {
		name: m.chess_card_plague_name,
		description: m.chess_card_plague_description,
		played: m.chess_card_plague_played_you
	},
	'marriage-crisis': {
		name: m.chess_card_marriage_crisis_name,
		description: m.chess_card_marriage_crisis_description,
		played: m.chess_card_marriage_crisis_played
	},
	'gotcha-ball': {
		name: m.chess_card_gotcha_ball_name,
		description: m.chess_card_gotcha_ball_description,
		played: m.chess_card_gotcha_ball_played
	},
	'great-ball': {
		name: m.chess_card_great_ball_name,
		description: m.chess_card_great_ball_description,
		played: m.chess_card_great_ball_played
	},
	'ultra-ball': {
		name: m.chess_card_ultra_ball_name,
		description: m.chess_card_ultra_ball_description,
		played: m.chess_card_ultra_ball_played
	},
	'master-ball': {
		name: m.chess_card_master_ball_name,
		description: m.chess_card_master_ball_description,
		played: m.chess_card_master_ball_played
	},
	'pawn-net': {
		name: m.chess_card_pawn_net_name,
		description: m.chess_card_pawn_net_description,
		played: m.chess_card_pawn_net_played
	},
	'farmer-revolution': {
		name: m.chess_card_farmer_revolution_name,
		description: m.chess_card_farmer_revolution_description,
		played: m.chess_card_farmer_revolution_played
	},
	mercenaries: {
		name: m.chess_card_mercenaries_name,
		description: m.chess_card_mercenaries_description,
		played: m.chess_card_mercenaries_played
	},
	'rigged-election': {
		name: m.chess_card_rigged_election_name,
		description: m.chess_card_rigged_election_description,
		played: m.chess_card_rigged_election_played
	},
	'bear-hug': {
		name: m.chess_card_bear_hug_name,
		description: m.chess_card_bear_hug_description,
		played: m.chess_card_bear_hug_played
	},
	javelin: {
		name: m.chess_card_javelin_name,
		description: m.chess_card_javelin_description,
		played: m.chess_card_javelin_played
	},
	bayraktar: {
		name: m.chess_card_bayraktar_name,
		description: m.chess_card_bayraktar_description,
		played: m.chess_card_bayraktar_played
	},
	himars: {
		name: m.chess_card_himars_name,
		description: m.chess_card_himars_description,
		played: m.chess_card_himars_played
	},
	'grain-corridor': {
		name: m.chess_card_grain_corridor_name,
		description: m.chess_card_grain_corridor_description,
		played: m.chess_card_grain_corridor_played
	},
	'lend-lease': {
		name: m.chess_card_lend_lease_name,
		description: m.chess_card_lend_lease_description,
		played: m.chess_card_lend_lease_played
	},
	'frozen-assets': {
		name: m.chess_card_frozen_assets_name,
		description: m.chess_card_frozen_assets_description,
		played: m.chess_card_frozen_assets_played
	},
	'trade-war': {
		name: m.chess_card_trade_war_name,
		description: m.chess_card_trade_war_description,
		played: m.chess_card_trade_war_played
	},
	'art-of-the-deal': {
		name: m.chess_card_art_of_the_deal_name,
		description: m.chess_card_art_of_the_deal_description,
		played: m.chess_card_art_of_the_deal_played
	}
};

export const cardName = (id: CardId): string => CARD_TEXT[id].name();
export const cardDescription = (id: CardId): string => CARD_TEXT[id].description();

/** Localized text for the notice shown below the board */
export function noticeText(notice: ChessNotice): string {
	if (notice.kind === 'refused') return m.chess_card_refused({ card: cardName(notice.id) });
	if (notice.id === 'plague' && notice.param === 'b') return m.chess_card_plague_played_putin();
	return CARD_TEXT[notice.id].played();
}

export interface ChessGameOptions {
	store?: Store;
	scores?: Highscores;
	random?: Random;
	/** Milliseconds Putin takes per move; tests pass 0 */
	putinDelay?: number;
	/** The cards of the first match instead of a random deal; tests use it */
	hand?: CardId[];
}

export class ChessGame {
	match: MatchState = $state.raw(createMatch([]));
	/** The player's piece that is picked up, waiting for a destination */
	selected: Square | null = $state(null);
	/** A card that was tapped; a card without a target is played with the "play" button */
	armedCard: CardId | null = $state(null);
	/** A pawn move to the last row that waits for the player to choose the new piece */
	promotion: { from: Square; to: Square } | null = $state.raw(null);
	thinking = $state(false);
	quip: Quip | null = $state.raw(null);
	notice: ChessNotice | null = $state.raw(null);
	noticeKey = $state(0);
	/** The card JD Vance just took away; he is standing in the way until he is sent off */
	vance: CardId | null = $state(null);
	over = $state(false);
	isNewBest = $state(false);
	best: number | null = $state(null);
	status: GameStatus = $state.raw({ kind: 'playing', check: false });

	private initialHand: CardId[] = [];
	private nextHand: CardId[] | undefined;
	private quipCount = 0;
	private readonly random: Random;
	private readonly store: Store;
	private readonly scores: Highscores;
	private readonly putinDelay: number;
	private putinTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(options: ChessGameOptions = {}) {
		this.store = options.store ?? localStore();
		this.scores = options.scores ?? highscores();
		this.random = options.random ?? createRandom(randomSeed());
		this.putinDelay = options.putinDelay ?? PUTIN_DELAY_MS;
		this.nextHand = options.hand;
		this.best = this.scores.get(SCORE_BEST);

		const saved = this.store.read<SavedChess | null>(SAVE_KEY, null, isSavedChess);
		const resumed = saved ? replayMatch(saved.hand, saved.actions) : null;
		if (saved && resumed && matchStatus(resumed).kind === 'playing') {
			this.initialHand = saved.hand;
			this.match = resumed;
			this.status = matchStatus(resumed);
			this.say('calm');
			this.schedulePutin();
		} else {
			this.start();
		}
	}

	/** The three cards dealt at the start, in their places; a played or stolen card leaves a gap */
	get cardSlots(): (CardId | null)[] {
		return this.initialHand.map((id) => (this.match.hand.includes(id) ? id : null));
	}

	get score(): number {
		return this.over ? finalScore(this.match, this.status) : liveScore(this.match);
	}

	/** It is the player's turn and nothing is in the way */
	get canAct(): boolean {
		return !this.over && !this.thinking && this.vance === null && this.match.position.turn === 'w';
	}

	get moveCount(): number {
		return this.match.actions.length;
	}

	/** Squares the picked-up piece can go to */
	get moveTargets(): Square[] {
		if (this.selected === null) return [];
		return legalMoves(this.match.position, this.selected).map((move) => move.to);
	}

	/** Enemy pieces the armed ball can be thrown at */
	get cardTargets(): Square[] {
		if (!this.armedCard || cardDefinition(this.armedCard).target !== 'piece') return [];
		return cardTargets(this.match.position, this.armedCard);
	}

	/** The square of the king that is in check, if any */
	get checkedKing(): Square | null {
		const { position } = this.match;
		if (this.status.kind !== 'playing' || !this.status.check) return null;
		return position.board.findIndex(
			(piece) => piece?.type === 'k' && piece.color === position.turn
		);
	}

	pressSquare(square: Square) {
		if (!this.canAct || this.promotion) return;

		if (this.armedCard && cardDefinition(this.armedCard).target === 'piece') {
			if (this.cardTargets.includes(square)) this.playCardNow(square);
			else soundManager().play('ui-error');
			return;
		}

		if (this.selected !== null) {
			const options = legalMoves(this.match.position, this.selected).filter(
				(move) => move.to === square
			);
			if (options.length > 0) {
				this.commitMove(options);
				return;
			}
		}

		const piece = this.match.position.board[square];
		if (piece?.color === 'w' && legalMoves(this.match.position, square).length > 0) {
			this.selected = this.selected === square ? null : square;
			soundManager().play('click');
		} else {
			this.selected = null;
		}
	}

	choosePromotion(type: PromotionType) {
		if (!this.promotion) return;
		const { from, to } = this.promotion;
		const move = legalMoves(this.match.position, from).find(
			(candidate) => candidate.to === to && candidate.promotion === type
		);
		this.promotion = null;
		if (move) this.applyPlayerMove(move);
	}

	cancelPromotion() {
		this.promotion = null;
		this.selected = null;
	}

	/** Taps a card: picks it up, or puts it back when it is already picked up */
	armCard(id: CardId) {
		if (!this.canAct || this.promotion) return;
		this.selected = null;
		this.armedCard = this.armedCard === id ? null : id;
		soundManager().play('click');
	}

	disarmCard() {
		this.armedCard = null;
	}

	/** Plays the armed card; `target` is the tapped enemy piece for cards that need one */
	playCardNow(target?: Square) {
		const id = this.armedCard;
		if (!id || !this.canAct) return;
		const definition = cardDefinition(id);
		if (definition.target === 'piece' && target === undefined) return;

		const param =
			definition.target === 'piece'
				? squareName(target!)
				: rollCardParam(id, this.random, this.match.position);
		const play: CardPlay = param ? { id, param } : { id };
		const next = playCard(this.match, play);
		if (!next) {
			this.showNotice({ kind: 'refused', id });
			soundManager().play('ui-error');
			return;
		}

		this.armedCard = null;
		if (this.random() < VANCE_CHANCE) {
			// JD Vance declares the player out of cards, whatever is left in the hand
			this.match = stealCard(this.match, id);
			this.vance = id;
			soundManager().play('alarm');
			this.save();
			return;
		}

		this.match = next;
		this.showNotice({ kind: 'card', id, param });
		this.say('card');
		soundManager().play('sparkle');
		this.afterAction();
	}

	dismissVance() {
		this.vance = null;
	}

	restart() {
		clearTimeout(this.putinTimer);
		this.start();
	}

	destroy() {
		clearTimeout(this.putinTimer);
	}

	private start() {
		this.initialHand = this.nextHand ?? dealHand(this.random);
		this.nextHand = undefined;
		this.match = createMatch(this.initialHand);
		this.selected = null;
		this.armedCard = null;
		this.promotion = null;
		this.thinking = false;
		this.notice = null;
		this.vance = null;
		this.over = false;
		this.isNewBest = false;
		this.status = matchStatus(this.match);
		this.say('greeting');
		this.save();
	}

	private commitMove(options: Move[]) {
		if (options.length > 1 && options.every((move) => move.promotion)) {
			this.promotion = { from: options[0].from, to: options[0].to };
			return;
		}
		this.applyPlayerMove(options[0]);
	}

	private applyPlayerMove(move: Move) {
		this.selected = null;
		this.armedCard = null;
		this.match = playMove(this.match, move);
		const after = matchStatus(this.match);
		if (move.captured) {
			this.say('loses-piece');
			soundManager().play('hit');
		} else {
			soundManager().play('pop');
		}
		if (after.kind === 'playing' && after.check) {
			this.say('check');
			soundManager().play('alarm');
		}
		this.afterAction();
	}

	private afterAction() {
		this.status = matchStatus(this.match);
		if (this.status.kind !== 'playing') {
			this.finish();
			return;
		}
		this.save();
		this.schedulePutin();
	}

	private schedulePutin() {
		if (this.over || this.match.position.turn !== 'b') return;
		this.thinking = true;
		this.putinTimer = setTimeout(() => this.putinMoves(), this.putinDelay);
	}

	private putinMoves() {
		this.thinking = false;
		const choice = choosePutinMove(this.match.position, this.random);
		if (!choice) return;

		this.match = playMove(this.match, choice.move);
		const after = matchStatus(this.match);
		const checksPlayer = after.kind === 'playing' && after.check;

		if (choice.blunder) this.say('blunder');
		else if (checksPlayer || choice.move.captured) this.say('takes');
		else if (this.random() < CALM_REMARK_CHANCE) this.say('calm');

		// Taking a piece is always worth a laugh, whatever else the move did
		if (choice.move.captured) soundManager().play('putin-laugh');
		else soundManager().play(checksPlayer ? 'alarm' : 'pop');
		this.afterAction();
	}

	private finish() {
		this.over = true;
		this.selected = null;
		this.armedCard = null;
		this.promotion = null;
		const result = this.scores.submit(SCORE_BEST, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.store.remove(SAVE_KEY);
	}

	private say(kind: QuipKind) {
		const variants = QUIPS[kind];
		this.quip = {
			id: ++this.quipCount,
			kind,
			variant: Math.floor(this.random() * variants.length)
		};
	}

	private showNotice(notice: ChessNotice) {
		this.notice = notice;
		this.noticeKey++;
	}

	private save() {
		const saved: SavedChess = { hand: this.initialHand, actions: this.match.actions };
		this.store.write(SAVE_KEY, saved);
	}
}

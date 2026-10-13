/*
 * Random events of Sondage Surge. From the second round on, a round may open with one event:
 * a scandal freezes one rally for a round (it cannot anchor or be flipped), a strike blocks a
 * département for two rounds (nobody can rally there, and lines stop at it). A scandal mostly
 * hits whoever leads the map, which keeps the race close.
 */
import { pickOne, type Random } from '#lib/game/random.js';
import { isLand, tally, type Board, type Side } from './board.js';

export type EventKind = 'scandal' | 'strike';

export interface BoardEvent {
	kind: EventKind;
	/** Index of the tile it hits */
	tile: number;
	/** The side whose rally a scandal freezes */
	side?: Side;
}

/** Chance that a round (after the first) opens with an event */
export const EVENT_CHANCE = 0.5;
/** Rounds a scandal freezes a rally and a strike blocks a département */
export const SCANDAL_ROUNDS = 1;
export const STRIKE_ROUNDS = 2;
/** Chance that a scandal hits the side that leads the map */
export const LEADER_SCANDAL_CHANCE = 0.65;

function freeRallies(board: Board, side: Side): number[] {
	const tiles: number[] = [];
	board.cells.forEach((cell, index) => {
		if (cell.owner === side && cell.frozen === 0 && cell.blocked === 0) tiles.push(index);
	});
	return tiles;
}

function strikeTargets(board: Board): number[] {
	const tiles: number[] = [];
	board.cells.forEach((cell, index) => {
		if (isLand(cell) && cell.blocked === 0) tiles.push(index);
	});
	return tiles;
}

/** The side that holds more tiles; the player on a tie */
function leader(board: Board): Side {
	const { you, rival } = tally(board);
	return rival > you ? 'rival' : 'you';
}

/** Rolls the event that opens a round, or null for a quiet round */
export function rollEvent(board: Board, round: number, random: Random): BoardEvent | null {
	if (round < 2 || random() >= EVENT_CHANCE) return null;
	const kind: EventKind = pickOne(random, ['scandal', 'strike'] as const);
	if (kind === 'scandal') {
		const lead = leader(board);
		const side = random() < LEADER_SCANDAL_CHANCE ? lead : lead === 'you' ? 'rival' : 'you';
		const targets = freeRallies(board, side);
		if (targets.length > 0) return { kind, tile: pickOne(random, targets), side };
	}
	const targets = strikeTargets(board);
	return targets.length > 0 ? { kind: 'strike', tile: pickOne(random, targets) } : null;
}

export function applyEvent(board: Board, event: BoardEvent): void {
	const cell = board.cells[event.tile];
	if (event.kind === 'scandal') cell.frozen = SCANDAL_ROUNDS;
	else cell.blocked = STRIKE_ROUNDS;
}

export interface Tick {
	thawed: number[];
	reopened: number[];
}

/** At the end of a round: scandals fade and strikes wear off one round */
export function tickEvents(board: Board): Tick {
	const tick: Tick = { thawed: [], reopened: [] };
	board.cells.forEach((cell, index) => {
		if (cell.frozen > 0) {
			cell.frozen -= 1;
			if (cell.frozen === 0) tick.thawed.push(index);
		}
		if (cell.blocked > 0) {
			cell.blocked -= 1;
			if (cell.blocked === 0) tick.reopened.push(index);
		}
	});
	return tick;
}

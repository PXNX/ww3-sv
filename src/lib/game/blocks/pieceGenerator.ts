/*
 * Offers three pieces per turn. The pick is random, but pieces that fit somewhere on the current
 * board are weighted up, and the fuller the board, the stronger that bias (adaptive difficulty).
 * Pieces that do not fit keep a weight, so trays stay unpredictable and a game can still end.
 */
import { pickWeighted, type Random } from '#lib/game/random.js';
import { fillRatio, fitsAnywhere, type Board } from './board';
import { PIECES, type Piece } from './pieces';

export const TRAY_SIZE = 3;

/** Extra weight a fitting piece gets on a completely full board (scaled down by the fill ratio) */
export const MAX_PLACEABLE_BIAS = 4;

/** Relative weight of a piece that fits, compared with a weight of 1 for a piece that does not */
export function placeableWeight(board: Board): number {
	return 1 + MAX_PLACEABLE_BIAS * fillRatio(board);
}

export function generateTray(
	board: Board,
	random: Random,
	pieces: readonly Piece[] = PIECES
): Piece[] {
	const bias = placeableWeight(board);
	const weighted = pieces.map((piece) => ({
		item: piece,
		weight: fitsAnywhere(board, piece) ? bias : 1
	}));
	return Array.from({ length: TRAY_SIZE }, () => pickWeighted(random, weighted));
}

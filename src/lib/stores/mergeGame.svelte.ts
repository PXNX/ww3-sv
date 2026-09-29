/*
 * Merge Tankers game state for the view: wraps the pure rules in mergeBoard.ts, keeps short-lived
 * "leaving" tiles for the slide and pop animations, records bests, and saves the game in progress
 * locally so a reload does not lose a long run.
 */
import {
	applyMove,
	canMove,
	canUseSubmarine,
	createGame,
	DEFAULT_SIZE,
	emptyCells,
	isGameOver,
	isMergeState,
	MAX_TIER,
	MINE_INTERVAL,
	useSubmarine,
	type Direction,
	type MergeState,
	type Position,
	type Tile
} from '$lib/game/merge/mergeBoard';
import { createRandom, randomSeed, type Random } from '$lib/game/random';
import { prefersReducedMotion } from '$lib/game/loop';
import { highscores } from '$lib/services/highscore';
import { localStore } from '$lib/services/storage';
import { soundManager } from '$lib/sound/soundManager.svelte';
import { m } from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { CHARACTER_NAME, type MascotPose } from '$lib/theme/character';

const SAVE_KEY = 'merge:game';
const SCORE_BEST = ['merge', 'score'];
const TIER_BEST = ['merge', 'tier'];
/** How long merged-away ships and cleared mines stay on screen for their animation */
const LEAVE_MS = 260;
/** Few enough empty cells that the mascot starts sweating */
const CROWDED_CELLS = 3;

const TIER_NAMES = [
	m.merge_tier_rowboat,
	m.merge_tier_fishing_boat,
	m.merge_tier_tugboat,
	m.merge_tier_ferry,
	m.merge_tier_cargo_ship,
	m.merge_tier_oil_tanker,
	m.merge_tier_supertanker
];

/** Localized ship name for a tier; the top tier is named after the mascot */
export function shipName(tier: number): string {
	if (tier >= MAX_TIER) {
		return m.merge_tier_mega_tanker({ characterName: CHARACTER_NAME[getLocale()] });
	}
	return TIER_NAMES[Math.max(tier, 1) - 1]();
}

export type LeavingEffect = 'absorbed' | 'cleared' | 'submarine';

export interface LeavingTile extends Position {
	tile: Tile;
	effect: LeavingEffect;
}

export type MergeNotice =
	| { kind: 'mine-dropped' }
	| { kind: 'mines-cleared'; count: number }
	| { kind: 'combo'; count: number }
	| { kind: 'submarine' }
	| { kind: 'submarine-earned' };

export class MergeGame {
	state: MergeState;
	leaving: LeavingTile[] = $state.raw([]);
	notices: MergeNotice[] = $state.raw([]);
	/** Increases with every new set of notices, so the view can replay its pop-in */
	noticeKey = $state(0);
	targeting = $state(false);
	celebrating = $state(false);
	over = $state(false);
	isNewBest = $state(false);
	best: number | null = $state(null);
	bestTier: number | null = $state(null);
	private mineJustDropped = $state(false);

	// Plain getters over the state stay reactive and are cheap on boards this small
	get movesUntilMine(): number {
		return MINE_INTERVAL - (this.state.moves % MINE_INTERVAL);
	}

	get submarineReady(): boolean {
		return canUseSubmarine(this.state);
	}

	/** No slide is possible; only the submarine can help now */
	get stuck(): boolean {
		return !canMove(this.state.board);
	}

	get mood(): MascotPose {
		if (this.stuck || emptyCells(this.state.board).length <= CROWDED_CELLS) return 'sweating';
		return this.mineJustDropped ? 'smug' : 'idle';
	}

	private readonly size: number;
	private readonly random: Random = createRandom(randomSeed());
	private leaveTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(size = DEFAULT_SIZE) {
		this.size = size;
		this.best = highscores().get(SCORE_BEST);
		this.bestTier = highscores().get(TIER_BEST);
		const resumable = (value: unknown): value is MergeState =>
			isMergeState(value) && value.size === size && !isGameOver(value);
		const saved = localStore().read<MergeState | null>(SAVE_KEY, null, resumable);
		this.state = $state.raw(saved ?? createGame(this.random, size));
		this.save();
	}

	move(direction: Direction): boolean {
		if (this.over) return false;
		const outcome = applyMove(this.state, direction, this.random);
		if (!outcome.changed) return false;

		this.targeting = false;
		this.celebrating = outcome.createdMegaTanker;
		this.mineJustDropped = outcome.droppedMine !== null;
		this.showLeaving([
			...outcome.merges.map((merge) => ({
				tile: { id: merge.absorbedId, kind: 'ship' as const, tier: merge.tier - 1 },
				row: merge.row,
				col: merge.col,
				effect: 'absorbed' as const
			})),
			...outcome.destroyedMines.map((mine) => ({
				tile: { id: mine.id, kind: 'mine' as const },
				row: mine.row,
				col: mine.col,
				effect: 'cleared' as const
			}))
		]);

		const notices: MergeNotice[] = [];
		if (outcome.merges.length > 1) notices.push({ kind: 'combo', count: outcome.merges.length });
		if (outcome.destroyedMines.length > 0) {
			notices.push({ kind: 'mines-cleared', count: outcome.destroyedMines.length });
		}
		if (outcome.earnedSubmarine) notices.push({ kind: 'submarine-earned' });
		if (outcome.droppedMine) notices.push({ kind: 'mine-dropped' });
		this.showNotices(notices);

		if (outcome.createdMegaTanker) soundManager().play('chime-big');
		else if (outcome.merges.length > 1) soundManager().play('chime');
		else if (outcome.merges.length === 1) soundManager().play('pop');
		if (outcome.destroyedMines.length > 0) soundManager().play('sparkle');
		if (outcome.earnedSubmarine) soundManager().play('pickup');
		if (outcome.droppedMine) soundManager().play('alarm');

		this.state = outcome.state;
		this.recordTier();
		this.afterChange();
		return true;
	}

	toggleSubmarine() {
		if (this.over) return;
		this.targeting = !this.targeting && this.submarineReady;
	}

	cancelSubmarine() {
		this.targeting = false;
	}

	removeMine(position: Position) {
		if (!this.targeting) return;
		const tile = this.state.board[position.row]?.[position.col];
		const next = useSubmarine(this.state, position);
		if (!next || !tile) return;
		this.targeting = false;
		this.mineJustDropped = false;
		this.showLeaving([{ tile, ...position, effect: 'submarine' }]);
		this.showNotices([{ kind: 'submarine' }]);
		soundManager().play('zap');
		this.state = next;
		this.afterChange();
	}

	dismissCelebration() {
		this.celebrating = false;
	}

	restart() {
		clearTimeout(this.leaveTimer);
		this.state = createGame(this.random, this.size);
		this.leaving = [];
		this.notices = [];
		this.targeting = false;
		this.celebrating = false;
		this.over = false;
		this.isNewBest = false;
		this.mineJustDropped = false;
		this.save();
	}

	destroy() {
		clearTimeout(this.leaveTimer);
	}

	private afterChange() {
		if (isGameOver(this.state)) {
			this.finish();
		} else {
			this.save();
		}
	}

	private finish() {
		this.over = true;
		this.targeting = false;
		this.celebrating = false;
		this.recordTier();
		const result = highscores().submit(SCORE_BEST, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		localStore().remove(SAVE_KEY);
	}

	private recordTier() {
		if (this.state.highestTier > (this.bestTier ?? 0)) {
			this.bestTier = highscores().submit(TIER_BEST, this.state.highestTier).best;
		}
	}

	private save() {
		localStore().write(SAVE_KEY, this.state);
	}

	private showLeaving(tiles: LeavingTile[]) {
		clearTimeout(this.leaveTimer);
		if (tiles.length === 0 || prefersReducedMotion()) {
			this.leaving = [];
			return;
		}
		this.leaving = tiles;
		this.leaveTimer = setTimeout(() => (this.leaving = []), LEAVE_MS);
	}

	private showNotices(notices: MergeNotice[]) {
		this.notices = notices;
		if (notices.length > 0) this.noticeKey++;
	}
}

/** Localized text for a notice shown next to the mascot */
export function noticeText(notice: MergeNotice): string {
	switch (notice.kind) {
		case 'mine-dropped':
			return m.merge_event_mine_dropped({ characterName: CHARACTER_NAME[getLocale()] });
		case 'mines-cleared':
			return m.merge_event_mines_cleared({ count: notice.count });
		case 'combo':
			return m.merge_event_combo({ count: notice.count });
		case 'submarine':
			return m.merge_event_submarine();
		case 'submarine-earned':
			return m.merge_event_submarine_earned();
	}
}

/*
 * Chip Fab Rush game store: wraps the pure rules with visual effects, Jensen Huang's reactions,
 * sounds and personal bests. The simulation state is a plain object that the stacker canvas reads
 * every frame; only what the page chrome shows (score, hearts, shortage, board) is reactive,
 * synced after each step.
 */
import { STARTING_LIVES } from '#lib/game/chipfab/config.js';
import { CHEER_STREAK, CHEER_TIER, jacketPose, type JacketPose } from '#lib/game/chipfab/jacket.js';
import { moduleLabel, type Board } from '#lib/game/chipfab/ram.js';
import {
	drawScenePreview,
	layerY,
	type Effect,
	type SceneExtras
} from '#lib/game/chipfab/render.js';
import { formatPrice, modulePrice } from '#lib/game/chipfab/price.js';
import { HIGH_TIER } from '#lib/game/chipfab/shortage.js';
import { stackedLayers, type StackerState } from '#lib/game/chipfab/stacker.js';
import {
	createGame,
	dropLayer,
	moveModules,
	shortagePercent,
	stepGame,
	type ChipFabEvent,
	type ChipFabState,
	type Stage
} from '#lib/game/chipfab/state.js';
import type { Direction } from '#lib/game/merge/mergeBoard.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type ChipFabStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['chipfab', 'score'] as const;
export const LEVEL_KEY = ['chipfab', 'level'] as const;

/** Milliseconds a merged-away module stays visible while it slides onto its partner */
const LEAVE_MS = 260;
const TOAST_MS = 1500;
const CHEER_MS = 2800;
const SULK_MS = 3500;
const CUT_MS = 900;
const FLASH_MS = 420;
/** Shortest time between two plays of a frequent sound */
const SOUND_GAP_MS = 120;

export interface LeavingModule {
	tile: { id: number; tier: number };
	row: number;
	col: number;
	ageMs: number;
}

export interface Toast {
	id: number;
	text: string;
}

export interface ChipFabOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class ChipFabGame {
	status = $state<ChipFabStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	level = $state(1);
	stage = $state<Stage>('stack');
	/** The shortage meter as a whole percentage, 0 to 100 */
	shortage = $state(0);
	/** Layers dropped so far and layers needed, in Stage A */
	layers = $state(0);
	layersTarget = $state(0);
	/** Modules still to arrive in Stage B */
	supply = $state(0);
	/** The biggest module tier made in this run, 0 before the first merge */
	topTier = $state(0);
	levelsCleared = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	/** The memory module board of Stage B */
	board = $state.raw<Board>([]);
	/** Modules that were just merged away and are still sliding onto their partner */
	leaving = $state.raw<LeavingModule[]>([]);
	toast = $state.raw<Toast | null>(null);
	/** A recent event Jensen Huang reacts to; null lets the shortage decide his pose */
	reaction = $state<JacketPose | null>(null);
	/** Which of the two sulking lines the game-over cameo uses */
	sulkVariant = $state(0);
	best = $state<number | null>(null);
	bestLevel = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: ChipFabState;
	effects: Effect[] = [];
	/** The last wafer that was finished or fell over, for the share card */
	lastWafer: StackerState | null = null;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#clockMs = 0;
	#reactionMs = 0;
	#toastMs = 0;
	#toastId = 0;
	#lastSound: Partial<Record<SoundId, number>> = {};

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: ChipFabOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#syncChrome();
	}

	/** The pose Jensen Huang shows right now */
	get pose(): JacketPose {
		return jacketPose(this.shortage, this.reaction);
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestLevel = this.#scores().get(LEVEL_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random);
		this.effects = [];
		this.leaving = [];
		this.toast = null;
		this.reaction = null;
		this.lastWafer = null;
		this.isNewBest = false;
		this.#clockMs = 0;
		this.#reactionMs = 0;
		this.#toastMs = 0;
		this.#lastSound = {};
		this.#syncChrome();
		this.status = 'playing';
	}

	pause() {
		if (this.status === 'playing') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** Stage A: drop the sliding layer */
	drop() {
		if (this.status !== 'playing') return;
		for (const event of dropLayer(this.state, this.#random)) this.#handle(event);
		this.#syncChrome();
	}

	/** Stage B: slide the memory modules */
	move(direction: Direction) {
		if (this.status !== 'playing') return;
		for (const event of moveModules(this.state, direction, this.#random)) this.#handle(event);
		this.#syncChrome();
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number) {
		this.#age(dtMs);
		if (this.status !== 'playing') return;
		this.#clockMs += dtMs;
		for (const event of stepGame(this.state, dtMs)) this.#handle(event);
		this.#syncChrome();
	}

	sceneExtras(): SceneExtras {
		return { effects: this.effects, reducedMotion: this.reducedMotion };
	}

	/** Draws the final tower onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const current = this.state.stacker;
		const tower = stackedLayers(current) > 0 ? current : (this.lastWafer ?? current);
		drawScenePreview(context, tower, this.state.highestTier, x, y, size);
	};

	#handle(event: ChipFabEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		switch (event.type) {
			case 'drop': {
				// The tower's new top layer sits at this index; a missed slab hovers one above it
				const index = event.layer;
				const slabIndex = event.kind === 'miss' ? index + 1 : index;
				if (event.cut) {
					this.effects.push({
						kind: 'cut',
						left: event.cut.left,
						width: event.cut.width,
						y: layerY(slabIndex),
						color: slabIndex,
						ageMs: 0,
						durationMs: CUT_MS * short
					});
				}
				if (event.kind === 'perfect') {
					const layer = this.state.stacker.layers[index];
					this.effects.push({
						kind: 'flash',
						left: layer.left,
						width: layer.width,
						y: layerY(index),
						ageMs: 0,
						durationMs: FLASH_MS * short
					});
					this.#showToast(
						event.streak > 1
							? m.chipfab_popup_streak({ count: event.streak })
							: m.chipfab_popup_perfect()
					);
					this.#play('chime', 0);
					if (event.streak >= CHEER_STREAK) this.#react('cheers', CHEER_MS);
				} else if (event.kind === 'trim') {
					this.#play('blocks-place', 0);
				} else {
					this.#showToast(m.chipfab_popup_miss());
					this.#play('ui-error', 0);
				}
				break;
			}
			case 'wafer':
				this.lastWafer = this.state.stacker;
				this.#showToast(
					event.finished
						? m.chipfab_popup_wafer_done({ supply: event.supply })
						: m.chipfab_popup_wafer_fell({ supply: event.supply })
				);
				if (event.finished) {
					this.#play('chime-big', 0);
					this.#react('cheers', CHEER_MS);
				}
				break;
			case 'merge': {
				const big = event.tier >= CHEER_TIER;
				this.leaving = [
					...this.leaving,
					...event.merges.map((merge) => ({
						tile: { id: merge.absorbedId, tier: merge.tier - 1 },
						row: merge.row,
						col: merge.col,
						ageMs: 0
					}))
				];
				if (event.tier > HIGH_TIER) {
					this.#showToast(
						m.chipfab_popup_module({
							size: moduleLabel(event.tier),
							price: formatPrice(modulePrice(event.tier, this.shortage))
						})
					);
				}
				this.#play(big ? 'chime-big' : event.tier >= HIGH_TIER ? 'chime' : 'pop', SOUND_GAP_MS);
				if (big) this.#react('cheers', CHEER_MS);
				break;
			}
			case 'slide':
				this.#play('ui-tap', SOUND_GAP_MS);
				break;
			case 'level':
				this.#showToast(m.chipfab_popup_level({ level: event.level }));
				this.#play('sparkle', 0);
				break;
			case 'stage':
				if (event.stage === 'merge') this.#play('sparkle', 0);
				break;
			case 'shortage-hit':
				this.hurtCount += 1;
				this.#showToast(m.chipfab_popup_shortage());
				this.#react('sulks', SULK_MS);
				this.#play('alarm', 0);
				break;
			case 'game-over':
				this.#finish();
				break;
		}
	}

	#react(pose: JacketPose, ms: number) {
		this.reaction = pose;
		this.#reactionMs = ms;
	}

	#showToast(text: string) {
		this.toast = { id: ++this.#toastId, text };
		this.#toastMs = TOAST_MS * (this.reducedMotion ? 0.7 : 1);
	}

	/** Plays a sound unless the same one played within the gap */
	#play(id: SoundId, gapMs: number) {
		const last = this.#lastSound[id];
		if (last !== undefined && gapMs > 0 && this.#clockMs - last < gapMs) return;
		this.#lastSound[id] = this.#clockMs;
		soundManager().play(id);
	}

	/** Ages effects, toasts and reactions; runs also while the stages are locked */
	#age(dtMs: number) {
		if (this.status !== 'playing') return;
		for (const effect of this.effects) effect.ageMs += dtMs;
		if (this.effects.some((effect) => effect.ageMs >= effect.durationMs)) {
			this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		}
		if (this.leaving.length > 0) {
			for (const item of this.leaving) item.ageMs += dtMs;
			this.leaving = this.leaving.filter((item) => item.ageMs < LEAVE_MS);
		}
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		if (this.reaction && (this.#reactionMs -= dtMs) <= 0) this.reaction = null;
	}

	#syncChrome() {
		const state = this.state;
		this.score = state.score;
		this.lives = state.lives;
		this.level = state.level;
		this.stage = state.stage;
		this.shortage = shortagePercent(state);
		this.layers = stackedLayers(state.stacker);
		this.layersTarget = state.stacker.target;
		this.supply = state.ram.supply;
		this.topTier = state.highestTier;
		this.levelsCleared = state.levelsCleared;
		this.board = state.ram.board;
	}

	#finish() {
		this.#syncChrome();
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const levelResult = this.#scores().submit(LEVEL_KEY, this.state.level);
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestLevel = levelResult.best;
		this.sulkVariant = Math.floor(this.#random() * 2);
		this.status = 'over';
	}
}

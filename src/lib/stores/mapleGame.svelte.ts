/*
 * Maple Reserve Heist store: the level select, the running level, results and the locally stored
 * progress. The game is turn based, so there is no loop: every move or wait runs one tick of the
 * rules in $lib/game/maple. The state is replaced by a copy after every tick so the field and
 * the HUD update; `message` is the short line of news for the last tick.
 */
import { STARTING_HEARTS } from '#lib/game/maple/config.js';
import type { Dir } from '#lib/game/maple/level.js';
import { LEVEL_IDS, levelAt } from '#lib/game/maple/levels.js';
import { drawWarehousePreview } from '#lib/game/maple/preview.js';
import {
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	isMapleProgress,
	isUnlocked,
	recordFinish,
	type MapleProgress
} from '#lib/game/maple/progress.js';
import {
	carried,
	cloneState,
	createGame,
	isHeavy,
	move,
	scoreOf,
	wait,
	type GameState,
	type MapleEvent
} from '#lib/game/maple/state.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type MapleScreen = 'select' | 'play';
export type MapleStatus = 'playing' | 'won' | 'over';

export { LEVEL_IDS };

export function highscoreParts(levelId: string): string[] {
	return ['maple', levelId, 'score'];
}

export interface MapleOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
}

export class MapleGame {
	screen = $state<MapleScreen>('select');
	levelIndex = $state(0);
	/** Replaced by a fresh copy after every tick, so reading it in a template is reactive */
	state = $state.raw<GameState>(createGame(levelAt(0)));
	/** The news of the last tick ("Sorry!", "2 barrels home!"), empty at the start of a level */
	message = $state('');
	/** Counts up whenever a moose spots the cart, so the field can shake */
	hurtCount = $state(0);
	isNewBest = $state(false);
	best = $state<number | null>(null);
	progress = $state<MapleProgress>(EMPTY_PROGRESS);

	readonly reducedMotion: boolean;
	#scores: () => Highscores;
	#store: () => Store;

	constructor({
		reducedMotion = false,
		scores = highscores,
		store = localStore
	}: MapleOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#store = store;
	}

	get status(): MapleStatus {
		return this.state.phase;
	}

	get levelCount(): number {
		return LEVEL_IDS.length;
	}

	get hasNextLevel(): boolean {
		return this.levelIndex + 1 < LEVEL_IDS.length;
	}

	get hearts(): number {
		return this.state.hearts;
	}

	get maxHearts(): number {
		return STARTING_HEARTS;
	}

	get score(): number {
		return scoreOf(this.state);
	}

	get moves(): number {
		return this.state.moves;
	}

	get par(): number {
		return this.state.level.par;
	}

	get delivered(): number {
		return this.state.delivered;
	}

	get totalBarrels(): number {
		return this.state.level.barrels.length;
	}

	get quota(): number {
		return this.state.level.quota;
	}

	/** Barrels in tow right now */
	get inTow(): number {
		return carried(this.state);
	}

	get heavy(): boolean {
		return isHeavy(this.state);
	}

	get spotted(): number {
		return this.state.spotted;
	}

	get stars(): number {
		return this.state.stars;
	}

	/** Reads the stored progress; call in the browser only */
	load() {
		this.progress = this.#store().read(PROGRESS_KEY, EMPTY_PROGRESS, isMapleProgress);
	}

	isUnlocked(index: number): boolean {
		return isUnlocked(this.progress, LEVEL_IDS, index);
	}

	starsFor(levelId: string): number {
		return this.progress.stars[levelId] ?? 0;
	}

	bestFor(levelId: string): number | null {
		return this.#scores().get(highscoreParts(levelId));
	}

	/** Opens a level; locked levels stay shut */
	openLevel(index: number) {
		if (!this.isUnlocked(index) || index < 0 || index >= LEVEL_IDS.length) return;
		const level = levelAt(index);
		this.levelIndex = index;
		this.state = createGame(level);
		this.message = '';
		this.hurtCount = 0;
		this.isNewBest = false;
		this.best = this.bestFor(level.id);
		this.screen = 'play';
	}

	retry() {
		this.openLevel(this.levelIndex);
	}

	nextLevel() {
		if (this.hasNextLevel) this.openLevel(this.levelIndex + 1);
	}

	backToSelect() {
		this.screen = 'select';
	}

	/** Pushes the cart one cell; a shelf or the cart's own barrels in the way cost nothing */
	step(dir: Dir) {
		if (this.screen !== 'play' || this.state.phase !== 'playing') return;
		this.#run(move(this.state, dir));
	}

	/** Lets one tick pass without moving, so the moose walk on */
	waitTick() {
		if (this.screen !== 'play' || this.state.phase !== 'playing') return;
		this.#run(wait(this.state));
	}

	/** Draws the warehouse onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawWarehousePreview(context, this.state, x, y, size);
	};

	#play(id: SoundId, intensity = 1) {
		soundManager().play(id, intensity);
	}

	#run(events: MapleEvent[]) {
		for (const event of events) this.#handle(event);
		// A fresh copy, so everything that reads the state redraws
		this.state = cloneState(this.state);
		if (this.state.phase === 'won') this.#win();
		else if (this.state.phase === 'over') this.#lose();
	}

	#handle(event: MapleEvent) {
		switch (event.type) {
			case 'move':
				this.message = '';
				this.#play('click', 0.5);
				break;
			case 'wait':
				this.message = '';
				this.#play('ui-tap', 0.4);
				break;
			case 'bump':
				this.#play('thud', 0.4);
				break;
			case 'pickup':
				this.message = m.maple_popup_pickup({ count: event.carried });
				this.#play('pickup');
				break;
			case 'deliver':
				this.message = m.maple_popup_deliver({ count: event.count });
				this.#play('chime');
				break;
			case 'creak':
				this.message = m.maple_popup_creak();
				this.#play('thud', 0.6);
				break;
			case 'spotted':
				this.hurtCount += 1;
				this.message = m.maple_sorry();
				this.#play('hit');
				this.#play('alarm', 0.5);
				break;
			case 'win':
				this.#play('chime-big');
				break;
			case 'game-over':
				break;
		}
	}

	#win() {
		const level = levelAt(this.levelIndex);
		this.progress = recordFinish(this.progress, level.id, this.state.stars);
		this.#store().write(PROGRESS_KEY, this.progress);
		this.#submit();
	}

	#lose() {
		this.#submit();
	}

	#submit() {
		const level = levelAt(this.levelIndex);
		const result = this.#scores().submit(highscoreParts(level.id), scoreOf(this.state));
		this.isNewBest = result.isNewBest;
		this.best = result.best;
	}
}

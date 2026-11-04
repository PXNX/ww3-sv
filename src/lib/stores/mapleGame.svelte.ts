/*
 * Maple Reserve Heist store: the level select, the running level, results and the locally stored
 * progress. The game is turn based, so there is no loop: every move or wait runs one tick of the
 * rules in $lib/game/maple. The state is replaced by a copy after every tick so the field and
 * the HUD update; `message` is the short line of news for the last tick.
 */
import { STARTING_HEARTS } from '#lib/game/maple/config.js';
import type { Cell, Dir, GadgetKind } from '#lib/game/maple/level.js';
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
	isTick,
	move,
	rewindsLeft,
	rewound,
	scoreBreakdown,
	scoreOf,
	useGadget,
	wait,
	type GameState,
	type MapleEvent
} from '#lib/game/maple/state.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type MapleScreen = 'select' | 'play';
export type MapleStatus = 'playing' | 'won' | 'over';

/** A short-lived particle for the field: a dust puff, a spark, a coin. It removes itself when its animation ends. */
export interface MapleFx {
	id: number;
	kind: 'dust' | 'spark' | 'coin' | 'pulse';
	cell: Cell;
	/** Where it flies, in cell units, and how high it hops first */
	dx: number;
	up: number;
	fall: number;
	/** The size of a noise pulse in cells */
	radius?: number;
}

/** Rewind snapshots kept per level */
const HISTORY_LIMIT = 300;

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
	/** Counts every cart step, with its direction, so the field can squash and stretch the cart */
	moveSeq = $state(0);
	lastDir = $state<Dir>('right');
	/** Counts up when a moose turns to look at a noise, and when the truck turns out to be locked */
	alertCount = $state(0);
	fx = $state<MapleFx[]>([]);
	#history: GameState[] = [];
	#fxId = 0;

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

	get rewinds(): number {
		return rewindsLeft(this.state);
	}

	get canRewind(): boolean {
		return this.state.phase === 'playing' && this.#history.length > 0 && this.rewinds > 0;
	}

	get gadget(): GadgetKind | null {
		return this.state.gadget;
	}

	get breakdown() {
		return scoreBreakdown(this.state);
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
		this.alertCount = 0;
		this.moveSeq = 0;
		this.fx = [];
		this.#history = [];
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
		this.lastDir = dir;
		const before = cloneState(this.state);
		this.#run(move(this.state, dir), before);
	}

	/** Uses the gadget in hand (coffee freezes the moose, the toque hides the cart); takes a tick */
	useGadget() {
		if (this.screen !== 'play' || this.state.phase !== 'playing') return;
		const before = cloneState(this.state);
		this.#run(useGadget(this.state), before);
	}

	/** Takes back the last tick, a limited number of times per level */
	rewind() {
		if (this.screen !== 'play' || !this.canRewind) return;
		const snapshot = this.#history.pop() as GameState;
		this.state = rewound(this.state, snapshot);
		this.message = m.maple_popup_rewind({ left: this.rewinds });
		this.fx = [];
		this.#play('maple-rewind');
		haptic().play(0.3);
	}

	/** Called by the field when a particle's animation has ended */
	dropFx(id: number) {
		this.fx = this.fx.filter((item) => item.id !== id);
	}

	/** Lets one tick pass without moving, so the moose walk on */
	waitTick() {
		if (this.screen !== 'play' || this.state.phase !== 'playing') return;
		const before = cloneState(this.state);
		this.#run(wait(this.state), before);
	}

	/** Draws the warehouse onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawWarehousePreview(context, this.state, x, y, size);
	};

	#play(id: SoundId, intensity = 1) {
		soundManager().play(id, intensity);
	}

	#spawn(kind: MapleFx['kind'], cell: Cell, count = 1, radius?: number) {
		if (this.reducedMotion) return;
		for (let i = 0; i < count; i++) {
			const side = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2;
			this.fx.push({
				id: ++this.#fxId,
				kind,
				cell,
				dx: side * 1.1 + (Math.random() - 0.5) * 0.3,
				up: 0.5 + Math.random() * 0.7,
				fall: 0.6 + Math.random() * 0.4,
				radius
			});
		}
		if (this.fx.length > 60) this.fx = this.fx.slice(-60);
	}

	/** `before` is a copy of the state from before the tick: what a rewind goes back to */
	#run(events: MapleEvent[], before: GameState) {
		if (events.length === 0) return;
		if (isTick(events)) {
			this.#history.push(before);
			if (this.#history.length > HISTORY_LIMIT) this.#history.shift();
		} else {
			// A bump: no tick, but the cart nudges and thuds
			this.#handle(events[0]);
			return;
		}
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
				this.moveSeq += 1;
				this.#play('click', 0.5);
				this.#spawn('dust', this.state.cart[0], 2);
				break;
			case 'wait':
				this.message = '';
				this.#play('ui-tap', 0.4);
				break;
			case 'bump':
				this.#play('thud', 0.4);
				haptic().play(0.15);
				break;
			case 'pickup':
				this.message = m.maple_popup_pickup({ count: event.carried });
				this.#play(event.golden ? 'sparkle' : 'pickup');
				haptic().play(event.golden ? 0.5 : 0.25);
				this.#spawn('spark', event.cell, event.golden ? 8 : 4);
				break;
			case 'deliver':
				this.message = m.maple_popup_deliver({ count: event.count });
				this.#play('chime');
				haptic().play(0.5);
				this.#spawn('coin', this.state.level.truck, 3 + event.count * 2);
				break;
			case 'locked':
				this.message = m.maple_popup_locked();
				this.#play('ui-error');
				haptic().play(0.3);
				break;
			case 'lever':
				this.message = m.maple_popup_lever();
				this.#play('maple-lever');
				haptic().play(0.6);
				this.#spawn('spark', event.cell, 6);
				break;
			case 'gadget':
				this.message =
					event.kind === 'coffee' ? m.maple_popup_coffee_picked() : m.maple_popup_toque_picked();
				this.#play('maple-gadget');
				haptic().play(0.3);
				this.#spawn('spark', this.state.cart[0], 4);
				break;
			case 'use':
				this.message = event.kind === 'coffee' ? m.maple_popup_coffee() : m.maple_popup_toque();
				this.#play('maple-gadget', 1);
				haptic().play(0.45);
				this.#spawn('spark', this.state.cart[0], 8);
				break;
			case 'noise':
				this.#spawn('pulse', event.cell, 1, event.radius);
				break;
			case 'alert':
				this.alertCount += 1;
				this.#play('maple-alert', 0.8);
				haptic().play(0.2);
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
				haptic().play(0.9);
				break;
			case 'win':
				this.#play('chime-big');
				haptic().play(0.8);
				this.#spawn('coin', this.state.level.truck, 12);
				break;
			case 'game-over':
				haptic().play(1);
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

	/** The back link during a run: ends it as a loss */
	forfeit() {
		if (this.state.phase !== 'playing') return;
		this.state = { ...this.state, phase: 'over' as const };
		this.#lose();
	}

	#submit() {
		const level = levelAt(this.levelIndex);
		const result = this.#scores().submit(highscoreParts(level.id), scoreOf(this.state));
		this.isNewBest = result.isNewBest;
		this.best = result.best;
	}
}

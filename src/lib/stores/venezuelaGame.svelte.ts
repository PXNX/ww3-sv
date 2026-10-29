/*
 * El Presidente store: the level select, the running level, pause, results and the locally stored
 * progress. The simulation (World) is a plain object the canvas reads every frame; only what the
 * page chrome shows (hearts, score, barrels, status) is reactive and copied after each step.
 */
import { followCamera, cameraTarget } from '#lib/game/venezuela/camera.js';
import { noBoosts, type BoosterKind, type Boosts } from '#lib/game/venezuela/boosters.js';
import { STARTING_HEARTS, VIEW_W } from '#lib/game/venezuela/config.js';
import { HeldInput, type Action } from '#lib/game/venezuela/input.js';
import { isSprinting } from '#lib/game/venezuela/player.js';
import { LEVEL_IDS, levelAt } from '#lib/game/venezuela/levels.js';
import {
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	isUnlocked,
	isVenezuelaProgress,
	recordFinish,
	type VenezuelaProgress
} from '#lib/game/venezuela/progress.js';
import { drawPreview, type Effect, type SceneExtras } from '#lib/game/venezuela/render.js';
import {
	createWorld,
	starsFor,
	stepWorld,
	type World,
	type WorldEvent
} from '#lib/game/venezuela/world.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type VenezuelaScreen = 'select' | 'play';
export type VenezuelaStatus = 'ready' | 'playing' | 'paused' | 'won' | 'over';

export { LEVEL_IDS };

function boosterName(kind: BoosterKind): string {
	switch (kind) {
		case 'arepa':
			return m.venezuela_arepa_name();
		case 'turbo':
			return m.venezuela_turbo_name();
		case 'boots':
			return m.venezuela_boots_name();
		case 'star':
			return m.venezuela_star_name();
	}
}

export function highscoreParts(levelId: string): string[] {
	return ['venezuela', levelId, 'score'];
}

/** Seconds between two helicopter rotor sounds */
const BUZZ_EVERY_S = 0.55;
const BUZZ_RANGE = 7;
/** Seconds between two dust puffs behind a sprint */
const DUST_EVERY_S = 0.07;
/** How long and how hard (in tiles) a slam landing shakes the view */
const SLAM_SHAKE_MS = 260;
const SLAM_SHAKE_TILES = 0.12;

export interface VenezuelaOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
}

export class VenezuelaGame {
	screen = $state<VenezuelaScreen>('select');
	status = $state<VenezuelaStatus>('ready');
	levelIndex = $state(0);
	hearts = $state(STARTING_HEARTS);
	score = $state(0);
	barrels = $state(0);
	barrelsTotal = $state(0);
	goons = $state(0);
	stars = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	isNewBest = $state(false);
	best = $state<number | null>(null);
	progress = $state<VenezuelaProgress>(EMPTY_PROGRESS);
	/** Seconds left of each timed booster, for the HUD (updated a few times a second) */
	boosts = $state<Boosts>(noBoosts());

	/** Simulation state, deliberately not reactive */
	world: World;
	camX = 0;
	/** Tiles shown across the view; the canvas sets it from the shape of the screen */
	viewW = VIEW_W;
	effects: Effect[] = [];
	readonly input = new HeldInput();
	readonly reducedMotion: boolean;

	#scores: () => Highscores;
	#store: () => Store;
	#buzz = 0;
	#dust = 0;
	#shakeMs = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		store = localStore
	}: VenezuelaOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#store = store;
		this.world = createWorld(levelAt(0));
	}

	/** The canvas tells how many tiles fit across the screen (more on a wide landscape one) */
	setView(viewW: number) {
		this.viewW = viewW;
	}

	get levelCount(): number {
		return LEVEL_IDS.length;
	}

	get hasNextLevel(): boolean {
		return this.levelIndex + 1 < LEVEL_IDS.length;
	}

	/** Reads the stored progress; call in the browser only */
	load() {
		this.progress = this.#store().read(PROGRESS_KEY, EMPTY_PROGRESS, isVenezuelaProgress);
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

	/** Opens a level on its "ready" screen; locked levels stay shut */
	openLevel(index: number) {
		if (!this.isUnlocked(index) || index < 0 || index >= LEVEL_IDS.length) return;
		const level = levelAt(index);
		this.levelIndex = index;
		this.world = createWorld(level);
		this.camX = cameraTarget(level.start.x + 0.5, 1, level.width, this.viewW);
		this.effects = [];
		this.input.clear();
		this.isNewBest = false;
		this.stars = 0;
		this.#buzz = 0;
		this.#dust = 0;
		this.#shakeMs = 0;
		this.best = this.bestFor(level.id);
		this.screen = 'play';
		this.status = 'ready';
		this.#sync();
	}

	/** The "ready" screen was dismissed: the level starts running */
	start() {
		if (this.status === 'ready') this.status = 'playing';
	}

	retry() {
		this.openLevel(this.levelIndex);
		this.start();
	}

	nextLevel() {
		if (this.hasNextLevel) this.openLevel(this.levelIndex + 1);
	}

	backToSelect() {
		this.input.clear();
		this.screen = 'select';
		this.status = 'ready';
	}

	pause() {
		if (this.status !== 'playing') return;
		this.input.clear();
		this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A key, touch zone or button goes down or up */
	setHeld(source: string, action: Action, down: boolean) {
		if (down && this.status !== 'playing') return;
		this.input.set(source, action, down);
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		if (this.status !== 'playing') return;

		const dt = dtMs / 1000;
		const events = stepWorld(this.world, this.input.read(), dt);
		const { player, level } = this.world;
		this.camX = followCamera(
			this.camX,
			cameraTarget(player.x + player.w / 2, player.facing, level.width, this.viewW),
			dt,
			this.viewW
		);
		for (const event of events) this.#handle(event);
		this.#trail(dt);
		this.#shakeMs = Math.max(0, this.#shakeMs - dtMs);
		this.#sounds(dt);
		this.#sync();

		if (this.world.status === 'won') this.#win();
		else if (this.world.status === 'dead') this.#lose();
	}

	sceneExtras(): SceneExtras {
		return {
			theme: this.levelIndex,
			camX: this.camX,
			viewW: this.viewW,
			effects: this.effects,
			reducedMotion: this.reducedMotion,
			shake: (this.#shakeMs / SLAM_SHAKE_MS) * SLAM_SHAKE_TILES
		};
	}

	/** Draws the final scene onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawPreview(context, this.world, this.camX, this.levelIndex, x, y, size);
	};

	#play(id: SoundId, intensity = 1, pan = 0) {
		soundManager().play(id, intensity, pan);
	}

	#effect(effect: Effect) {
		this.effects.push(effect);
	}

	#handle(event: WorldEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		switch (event.type) {
			case 'jump':
				this.#play('flap', 0.7);
				break;
			case 'airJump':
				this.#play('whoosh', 0.8);
				this.#play('flap', 0.5);
				break;
			case 'sprint':
				this.#play('ability-dash', 0.6);
				break;
			case 'slam':
				this.#play('ability-dive', 0.8);
				break;
			case 'slamLand':
				this.#shakeMs = SLAM_SHAKE_MS;
				this.#effect({
					kind: 'shock',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 420 * short + 60
				});
				this.#play('explosion-small', 0.7);
				break;
			case 'bump':
				this.#play('click');
				break;
			case 'spring':
				this.#play('run-jump', 0.9);
				this.#play('whoosh', 0.6);
				break;
			case 'booster':
				this.#effect({
					kind: 'item',
					booster: event.kind,
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 900 * short + 100
				});
				this.#effect({
					kind: 'popup',
					x: event.x,
					y: event.y - 1.6,
					text: boosterName(event.kind),
					big: true,
					ageMs: 0,
					durationMs: 1100 * short + 100
				});
				this.#play('pop');
				this.#play('sparkle');
				break;
			case 'barrel':
				this.#effect({
					kind: 'popup',
					x: event.x,
					y: event.y,
					text: `+${event.points}`,
					big: false,
					ageMs: 0,
					durationMs: 700 * short + 100
				});
				this.#play('pickup');
				break;
			case 'stomp':
				this.#effect({
					kind: 'popup',
					x: event.x,
					y: event.y - 0.3,
					text: event.combo > 1 ? `×${event.combo} +${event.points}` : `+${event.points}`,
					big: true,
					ageMs: 0,
					durationMs: 800 * short + 100
				});
				this.#effect({
					kind: 'ring',
					x: event.x,
					y: event.y + 0.2,
					ageMs: 0,
					durationMs: 380 * short + 60
				});
				this.#play('explosion-tiny');
				this.#play('ding');
				break;
			case 'hurt':
				this.hurtCount += 1;
				this.#effect({
					kind: 'popup',
					x: event.x,
					y: event.y - 0.2,
					text: '-1 ♥',
					big: true,
					ageMs: 0,
					durationMs: 900 * short + 100
				});
				this.#effect({
					kind: 'ring',
					x: event.x,
					y: event.y + 0.5,
					ageMs: 0,
					durationMs: 450 * short + 60
				});
				this.#play(event.cause === 'fall' ? 'splash' : 'hit');
				this.#play('alarm');
				break;
			case 'checkpoint':
				this.#play('chime');
				break;
			case 'flag':
				this.#play('chime-big');
				break;
			case 'land':
			case 'dead':
				break;
		}
	}

	/** Dust kicked up behind the heels while sprinting */
	#trail(dt: number) {
		const { player } = this.world;
		this.#dust -= dt;
		if (this.reducedMotion || this.#dust > 0 || !player.onGround || !isSprinting(player)) return;
		this.#dust = DUST_EVERY_S;
		this.#effect({
			kind: 'dust',
			x: player.x + player.w / 2 - player.facing * 0.3,
			y: player.y + player.h,
			ageMs: 0,
			durationMs: 380
		});
	}

	/** The rotor of a helicopter nearby, louder the closer it is and panned to its side */
	#sounds(dt: number) {
		this.#buzz -= dt;
		if (this.#buzz > 0) return;
		const { player, helis } = this.world;
		let nearest: { distance: number; side: number } | null = null;
		for (const heli of helis) {
			const dx = heli.x - (player.x + player.w / 2);
			const distance = Math.hypot(dx, heli.y - player.y);
			if (distance < BUZZ_RANGE && (!nearest || distance < nearest.distance)) {
				nearest = { distance, side: dx };
			}
		}
		if (!nearest) return;
		this.#buzz = BUZZ_EVERY_S;
		this.#play(
			'drone-buzz',
			1 - nearest.distance / BUZZ_RANGE,
			Math.max(-1, Math.min(1, nearest.side / BUZZ_RANGE))
		);
	}

	#win() {
		const world = this.world;
		const level = levelAt(this.levelIndex);
		this.stars = starsFor(world);
		this.progress = recordFinish(this.progress, level.id, this.stars);
		this.#store().write(PROGRESS_KEY, this.progress);
		const result = this.#scores().submit(highscoreParts(level.id), world.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.input.clear();
		this.status = 'won';
	}

	#lose() {
		const level = levelAt(this.levelIndex);
		const result = this.#scores().submit(highscoreParts(level.id), this.world.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.input.clear();
		this.status = 'over';
	}

	#sync() {
		const world = this.world;
		// Tenths of a second, so the HUD only updates a few times a second
		for (const kind of ['turbo', 'boots', 'star'] as const) {
			this.boosts[kind] = Math.ceil(world.boosts[kind] * 10) / 10;
		}
		this.hearts = world.hearts;
		this.score = world.score;
		this.barrels = world.barrelsCollected;
		this.barrelsTotal = world.level.barrels.length;
		this.goons = world.goonsStomped;
	}
}

/*
 * Beachhead store: the shore base, the island map, the running assault, pause, results and the
 * locally stored campaign. The battle is a plain object the canvas reads every frame; only the
 * values the page chrome shows (squads, troops, score, supplies, status) are reactive.
 */
import {
	ISLANDS,
	ISLAND_IDS,
	ROWS,
	SHORE_X,
	type BuildingKind,
	type Island
} from '#lib/game/beachhead/config.js';
import {
	createBattle,
	deploy,
	scoreOf,
	setFocus,
	starsOf,
	stepBattle,
	troopsAlive,
	type BattleEvent,
	type BattleState
} from '#lib/game/beachhead/battle.js';
import {
	MAX_UPGRADE,
	SAVE_KEY,
	addSupplies,
	applyUpgrade,
	canUpgrade,
	claimIncome,
	controlIsland,
	controlledCount,
	incomeRate as incomeOf,
	isBeachheadSave,
	isControlled,
	isUnlocked,
	lootFor,
	modifiersFor,
	newSave,
	starsOf as saveStars,
	totalStars,
	upgradeCost,
	upgradeLocked,
	type BeachheadSave,
	type UpgradeKey
} from '#lib/game/beachhead/campaign.js';
import { drawBattlePreview, type Effect, type SceneExtras } from '#lib/game/beachhead/render.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type BeachheadScreen = 'base' | 'map' | 'play';
export type BeachheadStatus = 'playing' | 'paused' | 'won' | 'over';

/** How long the explosions are left to play before the result panel opens */
const RESULT_DELAY_MS = 900;

export function highscoreParts(islandId: string): string[] {
	return ['beachhead', islandId, 'score'];
}

export interface BeachheadOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
	/** Injected for tests; defaults to the wall clock */
	now?: () => number;
}

export class BeachheadGame {
	screen = $state<BeachheadScreen>('base');
	status = $state<BeachheadStatus>('playing');
	islandIndex = $state(0);
	squadsLeft = $state(0);
	troops = $state(0);
	/** Troops landed during this attack, the denominator of the star rating */
	deployed = $state(0);
	buildingsLeft = $state(0);
	buildingsTotal = $state(0);
	score = $state(0);
	stars = $state(0);
	/** Supplies won in the last battle, shown on the result panel */
	loot = $state(0);
	isNewBest = $state(false);
	best = $state<number | null>(null);
	campaign = $state<BeachheadSave>(newSave(0));
	/** The building the troops are focused on, for the HUD; null when they choose their own targets */
	focusKind = $state<BuildingKind | null>(null);

	/** Simulation state, deliberately not reactive */
	battle: BattleState;
	effects: Effect[] = [];
	/** Animation clock for the waves and flags, which keeps running through the result delay */
	timeMs = 0;
	readonly reducedMotion: boolean;

	#scores: () => Highscores;
	#store: () => Store;
	#now: () => number;
	#finishMs = 0;
	#shotSound = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		store = localStore,
		now = Date.now
	}: BeachheadOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#store = store;
		this.#now = now;
		this.battle = createBattle(ISLANDS[0], modifiersFor(this.campaign));
	}

	get island(): Island {
		return ISLANDS[this.islandIndex];
	}

	get islandId(): string {
		return this.island.id;
	}

	get islandCount(): number {
		return ISLAND_IDS.length;
	}

	get hasNextIsland(): boolean {
		return this.islandIndex + 1 < ISLAND_IDS.length;
	}

	get collectedStars(): number {
		return totalStars(this.campaign, ISLAND_IDS);
	}

	get totalAvailableStars(): number {
		return ISLAND_IDS.length * 3;
	}

	get controlled(): number {
		return controlledCount(this.campaign, ISLAND_IDS);
	}

	get incomeRate(): number {
		return incomeOf(this.campaign, ISLAND_IDS);
	}

	get supplies(): number {
		return this.campaign.supplies;
	}

	/** Reads the stored campaign, banks the income earned since the last visit and saves it */
	load() {
		const stored = this.#store().read(SAVE_KEY, null, isBeachheadSave);
		const base = stored ?? newSave(this.#now());
		const claimed = claimIncome(base, ISLAND_IDS, this.#now());
		this.campaign = claimed;
		if (claimed !== base || !stored) this.#store().write(SAVE_KEY, claimed);
	}

	/** Adds the supplies produced since the last tick; harmless to call often */
	collectIncome() {
		const claimed = claimIncome(this.campaign, ISLAND_IDS, this.#now());
		if (claimed === this.campaign) return;
		this.campaign = claimed;
		this.#store().write(SAVE_KEY, claimed);
	}

	isUnlocked(index: number): boolean {
		return isUnlocked(this.campaign, ISLAND_IDS, index);
	}

	isControlled(islandId: string): boolean {
		return isControlled(this.campaign, islandId);
	}

	starsFor(islandId: string): number {
		return saveStars(this.campaign, islandId);
	}

	bestFor(islandId: string): number | null {
		return this.#scores().get(highscoreParts(islandId));
	}

	upgradeCost(key: UpgradeKey): number | null {
		return upgradeCost(this.campaign, key);
	}

	upgradeLocked(key: UpgradeKey): boolean {
		return upgradeLocked(this.campaign, key);
	}

	canUpgrade(key: UpgradeKey): boolean {
		return canUpgrade(this.campaign, key);
	}

	maxUpgrade(key: UpgradeKey): number {
		return MAX_UPGRADE[key];
	}

	/** Buys the next level of an upgrade and saves immediately */
	upgrade(key: UpgradeKey): boolean {
		const next = applyUpgrade(this.campaign, key);
		if (next === this.campaign) return false;
		this.campaign = next;
		this.#store().write(SAVE_KEY, next);
		this.#play('chime', 0.7);
		return true;
	}

	goBase() {
		this.collectIncome();
		this.effects = [];
		this.focusKind = null;
		this.screen = 'base';
		this.status = 'playing';
	}

	goMap() {
		this.collectIncome();
		this.effects = [];
		this.focusKind = null;
		this.screen = 'map';
		this.status = 'playing';
	}

	/** Starts an island; locked islands stay shut */
	openIsland(index: number) {
		if (!this.isUnlocked(index) || index < 0 || index >= ISLAND_IDS.length) return;
		this.islandIndex = index;
		this.battle = createBattle(ISLANDS[index], modifiersFor(this.campaign));
		this.effects = [];
		this.timeMs = 0;
		this.#finishMs = 0;
		this.#shotSound = 0;
		this.isNewBest = false;
		this.loot = 0;
		this.stars = 0;
		this.focusKind = null;
		this.best = this.bestFor(this.islandId);
		this.screen = 'play';
		this.status = 'playing';
		this.#sync();
	}

	retry() {
		this.openIsland(this.islandIndex);
	}

	openNextIsland() {
		if (this.hasNextIsland) this.openIsland(this.islandIndex + 1);
	}

	pause() {
		if (this.status !== 'playing') return;
		this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A tap on the beach lands the next squad there; a tap on a building focuses the troops */
	tap(worldX: number, worldY: number) {
		if (this.screen !== 'play' || this.status !== 'playing') return;
		if (this.battle.status !== 'playing') return;

		if (worldX < SHORE_X) {
			const row = Math.min(ROWS - 1, Math.max(0, Math.floor(worldY)));
			if (deploy(this.battle, row)) this.setFocus(null);
			this.#sync();
			return;
		}

		const building = this.battle.buildings.find(
			(candidate) =>
				!candidate.destroyed &&
				worldX >= candidate.x &&
				worldX <= candidate.x + candidate.width &&
				worldY >= candidate.y &&
				worldY <= candidate.y + candidate.height
		);
		this.setFocus(building?.id ?? null);
		if (building) this.#play('click', 0.5);
	}

	setFocus(buildingId: number | null) {
		setFocus(this.battle, buildingId);
		const building = this.battle.buildings.find(
			(candidate) => candidate.id === this.battle.focusId
		);
		this.focusKind = building?.kind ?? null;
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.timeMs += dtMs;
		this.#shotSound = Math.max(0, this.#shotSound - dtMs);
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);

		if (this.status !== 'playing') return;

		if (this.battle.status === 'playing') {
			stepBattle(this.battle, dtMs);
			const events = this.battle.events;
			this.battle.events = [];
			for (const event of events) this.#handle(event);
			this.#sync();
		}

		if (this.battle.status === 'playing') return;
		this.#finishMs += dtMs;
		if (this.#finishMs >= RESULT_DELAY_MS) this.#finish();
	}

	sceneExtras(): SceneExtras {
		return {
			effects: this.effects,
			timeMs: this.timeMs,
			reducedMotion: this.reducedMotion
		};
	}

	/** Draws the final island onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawBattlePreview(context, x, y, size, this.battle);
	};

	#play(id: SoundId, intensity = 1, pan = 0) {
		soundManager().play(id, intensity, pan);
	}

	#effect(effect: Effect) {
		this.effects.push(effect);
	}

	#playShot(friendly: boolean, x: number) {
		if (this.#shotSound > 0) return;
		this.#shotSound = this.reducedMotion ? 0.18 : 0.09;
		const pan = Math.max(-1, Math.min(1, (x / 12) * 2 - 1));
		this.#play('fire', friendly ? 0.3 : 0.45, pan);
	}

	#handle(event: BattleEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		switch (event.kind) {
			case 'deploy':
				this.#effect({
					kind: 'splash',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 500 * short + 60
				});
				this.#play('splash', 0.6);
				break;
			case 'troop-shot':
				this.#effect({
					kind: 'tracer',
					fromX: event.fromX,
					fromY: event.fromY,
					toX: event.toX,
					toY: event.toY,
					friendly: true,
					ageMs: 0,
					durationMs: 120
				});
				this.#playShot(true, event.fromX);
				break;
			case 'defense-shot':
				this.#effect({
					kind: 'tracer',
					fromX: event.fromX,
					fromY: event.fromY,
					toX: event.toX,
					toY: event.toY,
					friendly: false,
					ageMs: 0,
					durationMs: 140
				});
				this.#playShot(false, event.fromX);
				break;
			case 'building-destroyed':
				if (event.buildingId === this.battle.focusId) this.setFocus(null);
				this.#effect({
					kind: 'explosion',
					x: event.x,
					y: event.y,
					size: event.big ? 1.1 : 0.55,
					ageMs: 0,
					durationMs: (event.big ? 700 : 450) * short + 60
				});
				this.#play(event.big ? 'explosion-big' : 'explosion-small', event.big ? 1 : 0.7);
				break;
			case 'troop-down':
				this.#effect({
					kind: 'down',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 650 * short + 60
				});
				this.#play('explosion-tiny', 0.45);
				break;
			case 'won':
				this.#play('chime-big', 0.8);
				break;
			case 'lost':
				this.#play('game-over', 0.8);
				break;
		}
	}

	#finish() {
		if (this.status !== 'playing') return;

		if (this.battle.status === 'won') {
			this.stars = starsOf(this.battle);
			const first = !isControlled(this.campaign, this.islandId);
			this.loot = lootFor(this.islandIndex, first);
			this.campaign = controlIsland(this.campaign, this.islandId, this.stars);
			this.campaign = addSupplies(this.campaign, this.loot);
			this.#store().write(SAVE_KEY, this.campaign);
			const result = this.#scores().submit(highscoreParts(this.islandId), scoreOf(this.battle));
			this.isNewBest = result.isNewBest;
			this.best = result.best;
			this.status = 'won';
			return;
		}

		const result = this.#scores().submit(highscoreParts(this.islandId), scoreOf(this.battle));
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.status = 'over';
	}

	#sync() {
		const battle = this.battle;
		this.squadsLeft = battle.squadsLeft;
		this.troops = troopsAlive(battle);
		this.deployed = battle.deployed;
		this.buildingsLeft = battle.buildings.filter((building) => !building.destroyed).length;
		this.buildingsTotal = battle.buildings.length;
		this.score = scoreOf(battle);
	}
}

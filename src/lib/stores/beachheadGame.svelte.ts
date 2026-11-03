/*
 * Beachhead store: the shore base, the island map, the running assault, pause, results and the
 * locally stored campaign. The battle is a plain object the canvas reads every frame; only the
 * values the page chrome shows (squads, troops, score, resources, status) are reactive.
 */
import {
	BUILDINGS,
	ISLANDS,
	ISLAND_IDS,
	ROWS,
	SHORE_X,
	SKILL_ENERGY,
	type BuildingKind,
	type Island,
	type SkillId,
	type TroopKind
} from '#lib/game/beachhead/config.js';
import {
	canCastSkill,
	castSkill,
	createBattle,
	deploy,
	scoreOf,
	setFocus,
	skillCost,
	starsOf,
	stepBattle,
	troopsAlive,
	type BattleEvent,
	type BattleState
} from '#lib/game/beachhead/battle.js';
import {
	ACHIEVEMENTS,
	SAVE_KEY,
	addResources,
	applyTroopUpgrade,
	armyCapacity as armyCapacityOf,
	boatLoads as boatLoadsOf,
	buildDurationMs as buildDurationOf,
	builderSlots as builderSlotsFor,
	canAfford,
	canUpgrade as canUpgradeBuilding,
	canUpgradeTroop as canUpgradeTroopAt,
	changeTroop as changeTroopIn,
	chartedCount as chartedCountOf,
	claimAchievements,
	claimIncome,
	constructionOf,
	controlIsland,
	controlledCount,
	capturesOf,
	finishBuilds,
	fortificationScale,
	freeBuilderSlots as freeBuilderSlotsOf,
	incomeRate as incomeOf,
	isCharted as isChartedIn,
	isControlled,
	islandProduction,
	isUnlocked,
	levelOf,
	lootFor,
	maxLevelOf,
	modifiersFor,
	newSave,
	parseSave,
	processTakebacks,
	recordVictory,
	starsOf as saveStars,
	startUpgrade as startUpgradeIn,
	totalStars,
	troopLevel,
	troopStats,
	troopUpgradeCost,
	troopUpgradeLocked,
	upgradeCost as upgradeCostOf,
	upgradeLocked,
	usedArmySpace as usedArmySpaceOf,
	type BeachheadSave,
	type BoatLoad,
	type BuildingKey,
	type CareerStats,
	type Resources
} from '#lib/game/beachhead/campaign.js';
import { career } from '#lib/game/career/store.svelte.js';
import { drawBattlePreview, type Effect, type SceneExtras } from '#lib/game/beachhead/render.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import { telegram } from '#lib/stores/telegram.svelte.js';

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
	/** Injected for tests; defaults to the Pro subscription of the account */
	pro?: () => boolean;
	/** Injected for tests; defaults to Math.random for enemy takebacks */
	random?: () => number;
	/** Injected for tests; defaults to paying Fake News into the career wallet */
	rewardCoins?: (amount: number) => void;
}

/** One line of the achievement list on the base screen */
export interface AchievementRow {
	id: string;
	coins: number;
	earned: boolean;
}

/** A building card on the base screen, with its live build state */
export interface BuildRow {
	key: BuildingKey;
	level: number;
	max: number;
	cost: Resources | null;
	locked: boolean;
	/** Milliseconds left on a build in progress, or null when the builder is free */
	remainingMs: number | null;
	canStart: boolean;
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
	/** Resources won in the last battle, shown on the result panel */
	loot = $state<Resources>({ wood: 0, stone: 0, iron: 0, gold: 0 });
	/** Achievements earned by the last battle, shown on the result panel */
	newAchievements = $state<string[]>([]);
	/** Islands the enemy took back while the player was away, until the notice is dismissed */
	recentTakeovers = $state<string[]>([]);
	isNewBest = $state(false);
	best = $state<number | null>(null);
	campaign = $state<BeachheadSave>(newSave(0));
	/** The building the troops are focused on, for the HUD; null when they choose their own targets */
	focusKind = $state<BuildingKind | null>(null);
	/** Support-skill energy and the price of the next call */
	energy = $state(0);
	skillsUsed = $state(0);
	skillPrice = $state(0);
	/** A skill waiting for a tap on the island, or null */
	selectedSkill = $state<SkillId | null>(null);

	/** Simulation state, deliberately not reactive */
	battle: BattleState;
	effects: Effect[] = [];
	/** Animation clock for the waves and flags, which keeps running through the result delay */
	timeMs = 0;
	/** Screen shake left, in grid cells; it fades out every frame */
	shake = 0;
	readonly reducedMotion: boolean;

	#scores: () => Highscores;
	#store: () => Store;
	#now: () => number;
	#pro: () => boolean;
	#random: () => number;
	#rewardCoins: (amount: number) => void;
	#finishMs = 0;
	#shotSound = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		store = localStore,
		now = Date.now,
		pro = () => telegram().pro,
		random = Math.random,
		rewardCoins = (amount) => {
			career().grantCoins(amount);
		}
	}: BeachheadOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#store = store;
		this.#now = now;
		this.#pro = pro;
		this.#random = random;
		this.#rewardCoins = rewardCoins;
		this.battle = createBattle(ISLANDS[0], modifiersFor(this.campaign));
		this.#sync();
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

	/** How many islands the radar tower has charted */
	get chartedCount(): number {
		return chartedCountOf(this.campaign);
	}

	isCharted(index: number): boolean {
		return isChartedIn(this.campaign, index);
	}

	/** The next island that is open and not already under the player's flag */
	get nextAttackableIndex(): number | null {
		for (let index = 0; index < ISLAND_IDS.length; index++) {
			if (this.isUnlocked(index) && !this.isControlled(ISLAND_IDS[index])) return index;
		}
		return null;
	}

	get hasNextIsland(): boolean {
		return this.nextAttackableIndex !== null;
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

	/** Resources produced each minute by the home shore and the controlled islands */
	get income(): Resources {
		return incomeOf(this.campaign, ISLAND_IDS);
	}

	get resources(): Resources {
		return this.campaign.resources;
	}

	/** The production line of the island in play, with the headquarters bonus applied */
	get islandIncome(): Resources {
		return islandProduction(this.campaign, this.islandIndex);
	}

	/** The production line a single island adds once it is controlled */
	incomeFor(index: number): Resources {
		return islandProduction(this.campaign, index);
	}

	get builderSlots(): number {
		return builderSlotsFor(this.#pro());
	}

	get buildersBusy(): number {
		return this.campaign.builders.length;
	}

	get freeBuilders(): number {
		return freeBuilderSlotsOf(this.campaign, this.builderSlots);
	}

	get isPro(): boolean {
		return this.#pro();
	}

	get boats(): BoatLoad[] {
		return boatLoadsOf(this.campaign);
	}

	get armyCapacity(): number {
		return armyCapacityOf(this.campaign);
	}

	get armyUsed(): number {
		return usedArmySpaceOf(this.campaign);
	}

	get stats(): CareerStats {
		return this.campaign.stats;
	}

	get achievements(): AchievementRow[] {
		return ACHIEVEMENTS.map((achievement) => ({
			id: achievement.id,
			coins: achievement.coins,
			earned: this.campaign.achievements.includes(achievement.id)
		}));
	}

	/** Reads the stored campaign, banks the income earned since the last visit, finishes builds */
	load() {
		const stored = parseSave(this.#store().read<unknown>(SAVE_KEY, null));
		const base = stored ?? newSave(this.#now());
		const finished = finishBuilds(base, this.#now());
		const claimed = claimIncome(finished, ISLAND_IDS, this.#now());
		const takebacks = this.#applyTakebacks(claimed);
		this.campaign = takebacks;
		if (takebacks !== base || !stored) this.#commit(takebacks, { write: true, claim: false });
	}

	/** Finishes any due build and banks production; called often by the base screen */
	tick() {
		const finished = finishBuilds(this.campaign, this.#now());
		const claimed = claimIncome(finished, ISLAND_IDS, this.#now());
		const takebacks = this.#applyTakebacks(claimed);
		if (takebacks !== this.campaign) this.#commit(takebacks, { write: true });
	}

	/** Enemy retakes one controlled island per six-hour interval, oldest interval first */
	#applyTakebacks(save: BeachheadSave): BeachheadSave {
		const result = processTakebacks(save, ISLAND_IDS, this.#now(), this.#random);
		if (result.lost.length > 0) {
			this.recentTakeovers = [...new Set([...this.recentTakeovers, ...result.lost])];
		}
		return result.save;
	}

	/** Adds the resources produced since the last tick; harmless to call often */
	collectIncome() {
		this.tick();
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

	capturesFor(islandId: string): number {
		return capturesOf(this.campaign, islandId);
	}

	/** Extra enemy health and damage as a percentage, from every earlier capture */
	defensePercent(islandId: string): number {
		return Math.round((fortificationScale(this.capturesFor(islandId)) - 1) * 100);
	}

	/** The enemy notice banner, cleared when the player has read it */
	get takeoverNotice(): string[] {
		return this.recentTakeovers;
	}

	dismissTakeovers() {
		this.recentTakeovers = [];
	}

	bestFor(islandId: string): number | null {
		return this.#scores().get(highscoreParts(islandId));
	}

	levelOf(key: BuildingKey): number {
		return levelOf(this.campaign, key);
	}

	maxLevelOf(key: BuildingKey): number {
		return maxLevelOf(key);
	}

	upgradeCost(key: BuildingKey): Resources | null {
		return upgradeCostOf(this.campaign, key);
	}

	upgradeLocked(key: BuildingKey): boolean {
		return upgradeLocked(this.campaign, key);
	}

	buildDuration(key: BuildingKey): number {
		return buildDurationOf(key, levelOf(this.campaign, key));
	}

	constructionOf(key: BuildingKey) {
		return constructionOf(this.campaign, key);
	}

	/** Milliseconds left on a build, or null when that building is not being built */
	buildRemaining(key: BuildingKey): number | null {
		const task = this.constructionOf(key);
		if (!task) return null;
		return Math.max(0, task.endsAt - this.#now());
	}

	canUpgrade(key: BuildingKey): boolean {
		return (
			canUpgradeBuilding(this.campaign, key) &&
			this.freeBuilders > 0 &&
			this.constructionOf(key) === undefined
		);
	}

	/** Starts the next level on a builder and takes the resources at once */
	upgrade(key: BuildingKey): boolean {
		const next = startUpgradeIn(this.campaign, key, this.#now(), this.builderSlots);
		if (!next) return false;
		this.#commit(next);
		this.#play('chime', 0.7);
		return true;
	}

	/** Building cards for the base screen, with cost, lock and timer */
	buildRows(): BuildRow[] {
		const keys: BuildingKey[] = ['hq', 'training', 'radar'];
		for (let index = 0; index < this.campaign.levels.boats.length; index++) {
			keys.push(`boat-${index}` as BuildingKey);
		}
		return keys.map((key) => ({
			key,
			level: this.levelOf(key),
			max: this.maxLevelOf(key),
			cost: this.upgradeCost(key),
			locked: this.upgradeLocked(key),
			remainingMs: this.buildRemaining(key),
			canStart: this.canUpgrade(key)
		}));
	}

	troopLevel(kind: TroopKind): number {
		return troopLevel(this.campaign, kind);
	}

	troopStats(kind: TroopKind) {
		return troopStats(this.campaign, kind);
	}

	troopUpgradeCost(kind: TroopKind): Resources | null {
		return troopUpgradeCost(this.campaign, kind);
	}

	troopUpgradeLocked(kind: TroopKind): boolean {
		return troopUpgradeLocked(this.campaign, kind);
	}

	canUpgradeTroop(kind: TroopKind): boolean {
		return canUpgradeTroopAt(this.campaign, kind);
	}

	/** Trains a troop level at the training ground; it is paid at once and needs no builder */
	upgradeTroop(kind: TroopKind): boolean {
		const next = applyTroopUpgrade(this.campaign, kind);
		if (next === this.campaign) return false;
		this.#commit(next);
		this.#play('chime', 0.6);
		return true;
	}

	/** Adds or removes units from the army, refusing to overload the boats */
	changeTroop(kind: Exclude<TroopKind, 'hero'>, delta: number): boolean {
		const next = changeTroopIn(this.campaign, kind, delta);
		if (next === this.campaign) return false;
		this.#commit(next);
		return true;
	}

	canAfford(cost: Resources): boolean {
		return canAfford(this.campaign, cost);
	}

	goBase() {
		this.tick();
		this.effects = [];
		this.shake = 0;
		this.focusKind = null;
		this.selectedSkill = null;
		this.screen = 'base';
		this.status = 'playing';
	}

	goMap() {
		this.tick();
		this.effects = [];
		this.shake = 0;
		this.focusKind = null;
		this.selectedSkill = null;
		this.screen = 'map';
		this.status = 'playing';
	}

	/** Starts an island; locked islands stay shut and controlled islands are not replayed */
	openIsland(index: number) {
		if (!this.isUnlocked(index) || index < 0 || index >= ISLAND_IDS.length) return;
		if (this.isControlled(ISLAND_IDS[index])) return;
		this.islandIndex = index;
		this.battle = createBattle(ISLANDS[index], modifiersFor(this.campaign, ISLANDS[index].id));
		this.effects = [];
		this.shake = 0;
		this.timeMs = 0;
		this.#finishMs = 0;
		this.#shotSound = 0;
		this.isNewBest = false;
		this.loot = { wood: 0, stone: 0, iron: 0, gold: 0 };
		this.newAchievements = [];
		this.stars = 0;
		this.focusKind = null;
		this.selectedSkill = null;
		this.best = this.bestFor(this.islandId);
		this.screen = 'play';
		this.status = 'playing';
		this.#sync();
	}

	retry() {
		this.openIsland(this.islandIndex);
	}

	openNextIsland() {
		const next = this.nextAttackableIndex;
		if (next !== null) this.openIsland(next);
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

	/** A tap on the beach lands the next boat there; a tap on a building focuses the troops */
	tap(worldX: number, worldY: number) {
		if (this.screen !== 'play' || this.status !== 'playing') return;
		if (this.battle.status !== 'playing') return;

		if (this.selectedSkill) {
			const skill = this.selectedSkill;
			if (castSkill(this.battle, skill, worldX, worldY)) {
				this.selectedSkill = null;
				this.#sync();
			} else {
				this.#play('ui-error', 0.4);
			}
			return;
		}

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

	get canUseSkill(): boolean {
		return this.status === 'playing' && this.energy >= this.skillPrice;
	}

	/** Arms a support skill; the next tap on the island calls it in there */
	chooseSkill(skill: SkillId) {
		if (this.screen !== 'play' || this.status !== 'playing') return;
		if (!canCastSkill(this.battle)) {
			this.#play('ui-error', 0.4);
			return;
		}
		this.selectedSkill = this.selectedSkill === skill ? null : skill;
		this.#play('click', 0.4);
	}

	cancelSkill() {
		this.selectedSkill = null;
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.timeMs += dtMs;
		this.#shotSound = Math.max(0, this.#shotSound - dtMs);
		this.shake = Math.max(0, this.shake - dtMs * 0.0015);
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
			shake: this.shake,
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

	#shakeBy(amount: number) {
		if (this.reducedMotion) return;
		this.shake = Math.max(this.shake, amount);
	}

	/** Stores a new campaign, paying out any achievement that just became reachable */
	#commit(save: BeachheadSave, { write = true, claim = true, announce = false } = {}) {
		const payout = claim ? claimAchievements(save) : { save, earned: [], coins: 0 };
		this.campaign = payout.save;
		if (payout.coins > 0) {
			this.#rewardCoins(payout.coins);
			if (announce) this.newAchievements = [...this.newAchievements, ...payout.earned];
		}
		if (write) this.#store().write(SAVE_KEY, this.campaign);
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
			case 'troop-spawn':
				this.#effect({
					kind: 'ring',
					x: event.x,
					y: event.y,
					radius: 0.7,
					color: '#7c8c5c',
					ageMs: 0,
					durationMs: 420
				});
				this.#effect({
					kind: 'splash',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 380
				});
				this.#play('chime', 0.35);
				break;
			case 'troop-heal':
				this.#effect({
					kind: 'ring',
					x: event.x,
					y: event.y,
					radius: event.hero ? 2.4 : 1.6,
					color: '#3fa65a',
					ageMs: 0,
					durationMs: 520
				});
				if (event.amount >= 20) this.#play('chime', 0.4);
				break;
			case 'defense-shot':
				if (event.weapon === 'flame') {
					this.#effect({
						kind: 'flame',
						fromX: event.fromX,
						fromY: event.fromY,
						toX: event.toX,
						toY: event.toY,
						ageMs: 0,
						durationMs: 240
					});
				} else if (event.flightMs === undefined) {
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
				}
				// Shells, rockets and drones are drawn from the battle state while they fly
				this.#playShot(false, event.fromX);
				break;
			case 'projectile-impact':
				this.#effect({
					kind: 'explosion',
					x: event.x,
					y: event.y,
					size: 0.42 + event.radius * 0.45,
					ageMs: 0,
					durationMs: (event.hits > 0 ? 480 : 360) * short + 60
				});
				this.#play(event.hits > 0 ? 'explosion-small' : 'explosion-tiny', 0.65);
				this.#shakeBy(event.radius > 0.8 ? 0.12 : 0.06);
				break;
			case 'skill-cast': {
				const color =
					event.skill === 'heal' ? '#3fa65a' : event.skill === 'flare' ? '#f28c28' : '#4fa8d8';
				this.#effect({
					kind: 'float',
					x: event.x,
					y: event.y - 0.5,
					text: `-${event.cost}⚡`,
					color,
					ageMs: 0,
					durationMs: 850
				});
				this.#effect({
					kind: 'ring',
					x: event.x,
					y: event.y,
					radius: event.skill === 'smoke' ? 2.3 : event.skill === 'heal' ? 2.2 : 0.7,
					color,
					ageMs: 0,
					durationMs: 520
				});
				if (event.skill === 'heal') this.#play('chime', 0.5);
				else if (event.skill === 'flare') this.#play('zap', 0.5);
				else if (event.skill === 'smoke') this.#play('whoosh', 0.6);
				else this.#play('whoosh', 0.7);
				break;
			}
			case 'skill-impact': {
				const missile = event.skill === 'flamingo';
				this.#effect({
					kind: 'explosion',
					x: event.x,
					y: event.y,
					size: missile ? 1.45 : 0.55,
					ageMs: 0,
					durationMs: (missile ? 640 : 420) * short + 60
				});
				this.#effect({
					kind: 'debris',
					x: event.x,
					y: event.y,
					size: missile ? 1.6 : 0.8,
					seed: event.x * 2.1 + event.y,
					ageMs: 0,
					durationMs: 640 * short + 60
				});
				this.#play(missile ? 'explosion-big' : 'explosion-small', missile ? 1 : 0.6);
				this.#shakeBy(missile ? 0.52 : 0.12);
				break;
			}
			case 'building-destroyed': {
				if (event.buildingId === this.battle.focusId) this.setFocus(null);
				this.#effect({
					kind: 'explosion',
					x: event.x,
					y: event.y,
					size: event.big ? 1.1 : 0.55,
					ageMs: 0,
					durationMs: (event.big ? 700 : 450) * short + 60
				});
				this.#effect({
					kind: 'debris',
					x: event.x,
					y: event.y,
					size: event.big ? 1.4 : 0.9,
					seed: event.buildingId * 1.7,
					ageMs: 0,
					durationMs: 700 * short + 60
				});
				const building = this.battle.buildings.find(
					(candidate) => candidate.id === event.buildingId
				);
				if (building) {
					this.#effect({
						kind: 'float',
						x: event.x,
						y: event.y - 0.4,
						text: `+${BUILDINGS[building.kind].score}`,
						color: 'var(--color-explosion-yellow)',
						ageMs: 0,
						durationMs: 900
					});
				}
				this.#effect({
					kind: 'float',
					x: event.x + 0.6,
					y: event.y - 0.05,
					text: `+${SKILL_ENERGY.rewardPerBuilding}⚡`,
					color: '#4fa8d8',
					ageMs: 0,
					durationMs: 900
				});
				this.#play(event.big ? 'explosion-big' : 'explosion-small', event.big ? 1 : 0.7);
				this.#shakeBy(event.big ? 0.42 : 0.16);
				break;
			}
			case 'troop-down':
				this.#effect({
					kind: 'down',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 650 * short + 60
				});
				this.#play('explosion-tiny', 0.45);
				this.#shakeBy(0.07);
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
			const loot = lootFor(this.islandIndex, first);
			const heroAlive = this.battle.troops.some((troop) => troop.kind === 'hero' && troop.hp > 0);
			let next = controlIsland(this.campaign, this.islandId, this.stars);
			next = addResources(next, loot);
			next = recordVictory(next, {
				stars: this.stars,
				skillsUsed: this.battle.skillsUsed,
				heroAlive
			});
			this.loot = loot;
			this.newAchievements = [];
			this.#commit(next, { announce: true });
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
		this.energy = battle.energy;
		this.skillsUsed = battle.skillsUsed;
		this.skillPrice = skillCost(battle);
	}
}

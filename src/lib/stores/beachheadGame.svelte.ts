/*
 * Beachhead store: the shore base, the island map, the running assault, pause, results and the
 * locally stored campaign. The battle is a plain object the canvas reads every frame; only the
 * values the page chrome shows (squads, troops, score, resources, status) are reactive.
 */
import { haptic } from '#lib/haptic/haptic.svelte.js';
import {
	BUILDINGS,
	ISLANDS,
	ISLAND_IDS,
	ROWS,
	SHORE_X,
	SKILL_ENERGY,
	isScenery,
	type ArmyKind,
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
	giveUp,
	scoreOf,
	setFocus,
	skillCost,
	starsOf,
	stepBattle,
	timeLeftMs,
	troopsAlive,
	type BattleEvent,
	type BattleState
} from '#lib/game/beachhead/battle.js';
import {
	ACHIEVEMENTS,
	SAVE_KEY,
	addResources,
	applyCasualties,
	applyHeroUpgrade,
	applySkillUpgrade,
	applyTroopUpgrade,
	armyCapacity as armyCapacityOf,
	azovCommand,
	boatLoads as boatLoadsOf,
	buyMine as buyMineIn,
	buildDurationMs as buildDurationOf,
	builderSlots as builderSlotsFor,
	canAfford,
	canAffordMine,
	canUpgrade as canUpgradeBuilding,
	canUpgradeHero,
	canUpgradeSupportSkill,
	canUpgradeSkill,
	canUpgradeTroop as canUpgradeTroopAt,
	changeTroop as changeTroopIn,
	chartedCount as chartedCountOf,
	claimAchievements,
	canCutBuild,
	claimIncome,
	cutBuildTime,
	constructionOf,
	controlIsland,
	controlledCount,
	dismissTroop,
	capturesOf,
	finishBuilds,
	finishResearch,
	startSkillResearch,
	researchOf,
	startTroopResearch,
	troopResearchMs,
	fortificationScale,
	freeBuilderSlots as freeBuilderSlotsOf,
	grantHeroCards,
	heroCardCost,
	shardsForWin,
	heroUpgradeCost,
	heroUpgradeLocked,
	incomeRate as incomeOf,
	isCharted as isChartedIn,
	isControlled,
	islandProduction,
	isUnlocked,
	layoutOf,
	lostCount,
	lostOf,
	levelOf,
	lootFor,
	maxLevelOf,
	modifiersFor,
	moveBuildingTo,
	moveMineTo,
	newSave,
	parseSave,
	processTakebacks,
	recordVictory,
	recruitTroop,
	retrainAll as retrainAllIn,
	retrainAllCost,
	retrainCost,
	sellMine as sellMineIn,
	skillCardCost,
	skillUpgradeCost,
	skillUpgradeLocked,
	starsOf as saveStars,
	startUpgrade as startUpgradeIn,
	defenseUpgradeCostOf,
	exposedStock,
	allDefenseUpgrades,
	defenseBusy,
	defenseUpgradeTimeOf,
	singleDefenseUpgrade,
	startDefenseUpgrade,
	securedShare,
	storageCapacities,
	storageCapacity,
	supportSkillCost,
	supportSkillLevel,
	supportSkillLocked,
	totalStars,
	troopLevel,
	troopStats,
	troopUpgradeCost,
	troopUpgradeLocked,
	upgradeCost as upgradeCostOf,
	upgradeLocked,
	usedArmySpace as usedArmySpaceOf,
	WAREHOUSE_KEYS,
	type BeachheadSave,
	type BoatLoad,
	type BuildingKey,
	type CareerStats,
	type ResourceKind,
	type Resources
} from '#lib/game/beachhead/campaign.js';
import type { BaseLayout, Cell, DefenseKind } from '#lib/game/beachhead/baseLayout.js';
import { testIslandOf } from '#lib/game/beachhead/defenseTest.js';
import {
	EXPEDITION_TIERS,
	canStartExpedition,
	claimExpedition,
	expeditionOf,
	expeditionReady,
	startExpedition,
	type ChestRewards
} from '#lib/game/beachhead/expedition.js';
import {
	addCrystals,
	baseEffects,
	baseSlots,
	canMergeCrystal,
	crystalDrop,
	crystalLevel,
	crystalStock,
	crystalsOf,
	mergeCost,
	mergeCrystal,
	overchargeSlots,
	setBaseCrystal,
	setOvercharge,
	usedOverchargeSlots,
	type BaseCrystal,
	type CrystalType,
	type OverchargeCrystal
} from '#lib/game/beachhead/crystals.js';
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
/** A win lasts longer: the loot flies out of the enemy stores before the result opens */
const WIN_DELAY_MS = 3000;

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
	/** Milliseconds left of the three minutes an attack may take */
	timeLeft = $state(0);
	stars = $state(0);
	/** Resources won in the last battle, shown on the result panel */
	loot = $state<Resources>({ wood: 0, stone: 0, iron: 0, gold: 0 });
	/** Troops the last attack killed, shown on the result panel until they are retrained */
	/** What the last chest held, shown until the sheet is closed */
	chest = $state<ChestRewards | null>(null);
	/** The crystal the last victory dropped, if any */
	crystalFound = $state<{ type: CrystalType; count: number } | null>(null);
	/** How many seconds the last attack took */
	lastSeconds = $state(0);
	lastCasualties = $state<Partial<Record<TroopKind, number>>>({});
	/** Loot that has reached the stockpile so far during the win animation */
	lootCollected = $state<Resources>({ wood: 0, stone: 0, iron: 0, gold: 0 });
	/** Achievements earned by the last battle, shown on the result panel */
	newAchievements = $state<string[]>([]);
	/** Azov commander cards found in the last battle, shown on the result panel */
	heroCardsFound = $state(0);
	/** Islands the enemy took back while the player was away, until the notice is dismissed */
	recentTakeovers = $state<string[]>([]);
	/** True while the player attacks their own base to try out its layout; nothing is won or lost */
	testing = $state(false);
	/** True once the attack has been given up and the troops are running for the beach */
	retreating = $state(false);
	/** How fast an attack runs: normal, double, or four times as fast for Pro */
	speed = $state<1 | 2 | 4>(1);
	/** Shown for a few seconds after a free player reaches for the fourfold speed */
	speedProHint = $state(false);
	/** How the last defence test ended: true if the attackers took the headquarters */
	testResult = $state<{ fell: boolean; seconds: number } | null>(null);
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
	#settled = false;
	/** The loot a win will pay, worked out the moment the headquarters falls so it can fly */
	#plannedLoot: Resources = { wood: 0, stone: 0, iron: 0, gold: 0 };
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

	/** How much of each resource the warehouses can hold */
	get capacity(): Resources {
		return storageCapacities(this.campaign);
	}

	storageCapacity(kind: ResourceKind): number {
		return storageCapacity(this.campaign, kind);
	}

	isStorageFull(kind: ResourceKind): boolean {
		return this.campaign.resources[kind] >= this.storageCapacity(kind);
	}

	/** The share of every stockpile the bunker keeps safe from raiders, 0 to 1 */
	get securedShare(): number {
		return securedShare(this.campaign);
	}

	/** What raiders could still take of one resource */
	exposedStock(kind: ResourceKind): number {
		return exposedStock(this.campaign, kind);
	}

	/** The Azov commander's current level, skill and cards, plus what the next level costs */
	get heroLevel(): number {
		return this.campaign.hero.level;
	}

	get heroSkill(): number {
		return this.campaign.hero.skill;
	}

	get heroCards(): number {
		return this.campaign.hero.cards;
	}

	get dojoLevel(): number {
		return this.campaign.levels.dojo;
	}

	get heroAura() {
		return azovCommand(this.campaign);
	}

	heroCardCost(): number | null {
		return heroCardCost(this.campaign);
	}

	heroUpgradeCost(): Resources | null {
		return heroUpgradeCost(this.campaign);
	}

	heroUpgradeLocked(): boolean {
		return heroUpgradeLocked(this.campaign);
	}

	canUpgradeHero(): boolean {
		return canUpgradeHero(this.campaign);
	}

	upgradeHero(): boolean {
		const next = applyHeroUpgrade(this.campaign);
		if (next === this.campaign) return false;
		this.#commit(next, { announce: true });
		return true;
	}

	skillCardCost(): number | null {
		return skillCardCost(this.campaign);
	}

	skillUpgradeCost(): Resources | null {
		return skillUpgradeCost(this.campaign);
	}

	skillUpgradeLocked(): boolean {
		return skillUpgradeLocked(this.campaign);
	}

	canUpgradeSkill(): boolean {
		return canUpgradeSkill(this.campaign);
	}

	upgradeSkill(): boolean {
		const next = applySkillUpgrade(this.campaign);
		if (next === this.campaign) return false;
		this.#commit(next, { announce: true });
		return true;
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
		const finished = finishResearch(finishBuilds(base, this.#now()), this.#now());
		const claimed = claimIncome(finished, ISLAND_IDS, this.#now());
		const takebacks = this.#applyTakebacks(claimed);
		this.campaign = takebacks;
		if (takebacks !== base || !stored) this.#commit(takebacks, { write: true, claim: false });
	}

	/** Finishes any due build and banks production; called often by the base screen */
	tick() {
		const finished = finishResearch(finishBuilds(this.campaign, this.#now()), this.#now());
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

	/** Where everything stands on the home island grid */
	get layout(): BaseLayout {
		return layoutOf(this.campaign);
	}

	/** The card data of one building, for the island panel */
	buildRowFor(key: BuildingKey): BuildRow {
		return this.#buildRow(key);
	}

	/** Moves a building to a new top-left cell of the island grid; false when it does not fit */
	moveBuilding(key: BuildingKey, cell: Cell): boolean {
		const next = moveBuildingTo(this.campaign, key, cell);
		if (!next) return false;
		this.#commit(next, { claim: false });
		this.#play('click', 0.5);
		return true;
	}

	canBuyMine(kind: DefenseKind): boolean {
		return canAffordMine(this.campaign, kind);
	}

	/** Buys a mine and puts it on the first free cell of the island */
	buyMine(kind: DefenseKind): boolean {
		const next = buyMineIn(this.campaign, kind);
		if (!next) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next, { claim: false });
		this.#play('chime', 0.5);
		return true;
	}

	moveMine(id: number, cell: Cell): boolean {
		const next = moveMineTo(this.campaign, id, cell);
		if (!next) return false;
		this.#commit(next, { claim: false });
		this.#play('click', 0.5);
		return true;
	}

	defenseUpgradeCost(id: number): Resources | null {
		return defenseUpgradeCostOf(this.campaign, id);
	}

	/** The placed defences of this kind that can be raised right now, what that costs and how long it takes */
	allDefenseUpgrades(kind: string) {
		return allDefenseUpgrades(this.campaign, kind);
	}

	defenseBusy(id: number): boolean {
		return defenseBusy(this.campaign, id);
	}

	defenseUpgradeTime(id: number): number | null {
		return defenseUpgradeTimeOf(this.campaign, id);
	}

	/** Milliseconds left on the builder raising this defence, or null when none is */
	defenseRemaining(id: number): number | null {
		const task = this.campaign.builders.find((entry) => entry.defenseIds?.includes(id));
		return task ? Math.max(0, task.endsAt - this.#now()) : null;
	}

	canUpgradeDefense(id: number): boolean {
		const plan = singleDefenseUpgrade(this.campaign, id);
		return plan.ids.length > 0 && this.campaign.builders.length < this.builderSlots;
	}

	/** Raises one placed mine, gun or hedgehog a level on a builder; limited by the headquarters level */
	upgradeDefense(id: number): boolean {
		return this.#startDefenses(singleDefenseUpgrade(this.campaign, id));
	}

	/** Raises every placed defence of a kind a level on one builder */
	upgradeAllDefenses(kind: string): boolean {
		return this.#startDefenses(allDefenseUpgrades(this.campaign, kind));
	}

	#startDefenses(plan: ReturnType<typeof allDefenseUpgrades>): boolean {
		const next = startDefenseUpgrade(this.campaign, plan, this.#now(), this.builderSlots);
		if (!next) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next, { claim: false });
		this.#play('chime', 0.6);
		return true;
	}

	sellMine(id: number): boolean {
		const next = sellMineIn(this.campaign, id);
		if (!next) return false;
		this.#commit(next, { claim: false });
		this.#play('click', 0.5);
		return true;
	}

	canCutBuild(key: BuildingKey): boolean {
		return canCutBuild(this.campaign, key);
	}

	/** Cuts a tenth of the total time off a running build, as the reward of an advert */
	cutBuildTime(key: BuildingKey): boolean {
		const next = cutBuildTime(this.campaign, key, this.#now());
		if (!next) return false;
		this.#commit(next, { claim: false });
		this.#play('chime', 0.6);
		return true;
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

	/** Building cards on the base screen, with cost, lock and timer */
	buildRows(): BuildRow[] {
		const keys: BuildingKey[] = ['hq', 'training', 'radar', 'dojo'];
		for (let index = 0; index < this.campaign.levels.boats.length; index++) {
			keys.push(`boat-${index}` as BuildingKey);
		}
		return keys.map((key) => this.#buildRow(key));
	}

	/** The warehouse cards, grouped in the order of WAREHOUSE_KEYS */
	warehouseRows(): BuildRow[] {
		return WAREHOUSE_KEYS.map((key) => this.#buildRow(key));
	}

	#buildRow(key: BuildingKey): BuildRow {
		return {
			key,
			level: this.levelOf(key),
			max: this.maxLevelOf(key),
			cost: this.upgradeCost(key),
			locked: this.upgradeLocked(key),
			remainingMs: this.buildRemaining(key),
			canStart: this.canUpgrade(key)
		};
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
		return this.research === null && canUpgradeTroopAt(this.campaign, kind);
	}

	/** Starts researching the next troop level at the training ground; paid at once, one troop at a time */
	upgradeTroop(kind: TroopKind): boolean {
		const next = startTroopResearch(this.campaign, kind, this.#now());
		if (!next) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next);
		this.#play('chime', 0.6);
		return true;
	}

	/** The troop being researched, with when it is done */
	get research() {
		return researchOf(this.campaign);
	}

	/** How long the next level of a troop takes to research */
	troopResearchMs(kind: TroopKind): number {
		return troopResearchMs(this.troopLevel(kind));
	}

	/** Trains one unit for gold (plus) or sends one home for a refund (minus) */
	changeTroop(kind: ArmyKind, delta: number): boolean {
		const next = delta > 0 ? recruitTroop(this.campaign, kind) : dismissTroop(this.campaign, kind);
		if (!next) {
			if (delta > 0) this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next, { claim: false });
		this.#play(delta > 0 ? 'chime' : 'click', 0.4);
		return true;
	}

	/** Training level of a support skill, set at the training ground */
	supportSkillLevel(skill: SkillId): number {
		return supportSkillLevel(this.campaign, skill);
	}

	supportSkillCost(skill: SkillId): Resources | null {
		return supportSkillCost(this.campaign, skill);
	}

	supportSkillLocked(skill: SkillId): boolean {
		return supportSkillLocked(this.campaign, skill);
	}

	canUpgradeSupportSkill(skill: SkillId): boolean {
		return this.research === null && canUpgradeSupportSkill(this.campaign, skill);
	}

	/** Researches the next level of a support skill in the lab, like a troop: paid now, done after a while */
	upgradeSupportSkill(skill: SkillId): boolean {
		const next = startSkillResearch(this.campaign, skill, this.#now());
		if (!next) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next, { claim: false });
		this.#play('chime', 0.6);
		return true;
	}

	/** How long the next level of a skill takes to research */
	skillResearchMs(skill: SkillId): number {
		return troopResearchMs(this.supportSkillLevel(skill));
	}

	/** The crystals: loose stock and levels, the slots on buildings and the base's own slots */
	get crystals() {
		return crystalsOf(this.campaign);
	}

	get baseEffects() {
		return baseEffects(this.campaign);
	}

	get overchargeSlotsTotal(): number {
		return overchargeSlots(this.campaign.levels.hq);
	}

	get overchargeSlotsUsed(): number {
		return usedOverchargeSlots(this.campaign);
	}

	get baseSlotsTotal(): number {
		return baseSlots(this.campaign.levels.hq);
	}

	crystalLevel(type: CrystalType): number {
		return crystalLevel(this.campaign, type);
	}

	crystalStock(type: CrystalType): number {
		return crystalStock(this.campaign, type);
	}

	crystalMergeCost(type: CrystalType): number | null {
		return mergeCost(crystalLevel(this.campaign, type));
	}

	canMergeCrystal(type: CrystalType): boolean {
		return canMergeCrystal(this.campaign, type);
	}

	/** Merges n² loose crystals of a type into one level */
	mergeCrystal(type: CrystalType): boolean {
		const next = mergeCrystal(this.campaign, type);
		if (!next) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next, { claim: false });
		this.#play('chime', 0.8);
		return true;
	}

	setOvercharge(target: string, type: OverchargeCrystal | null): boolean {
		const next = setOvercharge(this.campaign, target, type);
		if (!next) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next, { claim: false });
		this.#play('click', 0.5);
		return true;
	}

	setBaseCrystal(index: number, type: BaseCrystal | null): boolean {
		const next = setBaseCrystal(this.campaign, index, type);
		if (!next) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next, { claim: false });
		this.#play('click', 0.5);
		return true;
	}

	/** The expedition at sea, with when it is due back */
	get expedition() {
		return expeditionOf(this.campaign);
	}

	get expeditionDone(): boolean {
		return expeditionReady(this.campaign, this.#now());
	}

	expeditionTiers = EXPEDITION_TIERS;

	canStartExpedition(tier: number): boolean {
		return canStartExpedition(this.campaign, tier);
	}

	/** Sends a ship out for a few hours; the price is paid now and the chest is fixed from here */
	startExpedition(tier: number): boolean {
		const next = startExpedition(
			this.campaign,
			tier,
			this.#now(),
			Math.floor(this.#random() * 2_000_000_000) + 1
		);
		if (!next) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.chest = null;
		this.#commit(next, { claim: false });
		this.#play('chime', 0.6);
		return true;
	}

	/** Opens the chest of a ship that is back and pays the Fake News into the career wallet */
	openChest(): ChestRewards | null {
		const result = claimExpedition(this.campaign, this.#now());
		if (!result) return null;
		this.#commit(result.save, { claim: false });
		if (result.rewards.coins > 0) this.#rewardCoins(result.rewards.coins);
		this.chest = result.rewards;
		this.#play('chime-big', 0.9);
		return result.rewards;
	}

	/** Troops killed in attacks that wait to be retrained, by kind */
	get lost() {
		return lostOf(this.campaign);
	}

	get lostTotal(): number {
		return lostCount(this.campaign);
	}

	/** Gold it takes to bring every lost troop back */
	get retrainTotal(): number {
		return retrainAllCost(this.campaign);
	}

	retrainGold(kind: ArmyKind): number {
		return retrainCost(kind).gold;
	}

	/** Retrains every lost unit that gold and boat space allow */
	retrainAll(): boolean {
		const next = retrainAllIn(this.campaign);
		if (next === this.campaign) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#commit(next, { claim: false });
		this.#play('chime', 0.6);
		return true;
	}

	canAfford(cost: Resources): boolean {
		return canAfford(this.campaign, cost);
	}

	goBase() {
		this.#retreat();
		this.tick();
		this.effects = [];
		this.shake = 0;
		this.focusKind = null;
		this.selectedSkill = null;
		this.screen = 'base';
		this.status = 'playing';
	}

	goMap() {
		this.#retreat();
		this.tick();
		this.effects = [];
		this.shake = 0;
		this.focusKind = null;
		this.selectedSkill = null;
		this.screen = 'map';
		this.status = 'playing';
	}

	/** Starts an island; locked islands stay shut and controlled islands are not replayed */
	/** Attacks your own base with your own army; no casualties, no loot, nothing is saved */
	startDefenseTest(): boolean {
		this.tick();
		if (usedArmySpaceOf(this.campaign) <= 0) {
			this.#play('ui-error', 0.4);
			return false;
		}
		this.#retreat();
		const slots = crystalsOf(this.campaign).slots;
		this.battle = createBattle(
			testIslandOf(
				this.layout,
				(target) => {
					const type = slots[target];
					return type ? { type, level: crystalLevel(this.campaign, type) } : undefined;
				},
				(house) => this.levelOf(`house-${house}` as BuildingKey),
				(key) => this.levelOf(key as BuildingKey)
			),
			{
				...modifiersFor(this.campaign),
				// The bulwark crystal toughens everything in your own base
				defenseScale: 1 + baseEffects(this.campaign).defense
			}
		);
		this.testing = true;
		this.retreating = false;
		this.speed = 1;
		this.testResult = null;
		this.effects = [];
		this.shake = 0;
		this.timeMs = 0;
		this.#finishMs = 0;
		this.#settled = true;
		this.lastCasualties = {};
		this.heroCardsFound = 0;
		this.crystalFound = null;
		this.lootCollected = { wood: 0, stone: 0, iron: 0, gold: 0 };
		this.stars = 0;
		this.focusKind = null;
		this.selectedSkill = null;
		this.best = null;
		this.screen = 'play';
		this.status = 'playing';
		this.#sync();
		return true;
	}

	openIsland(index: number) {
		this.#retreat();
		this.testing = false;
		this.retreating = false;
		this.speed = 1;
		if (!this.isUnlocked(index) || index < 0 || index >= ISLAND_IDS.length) return;
		if (this.isControlled(ISLAND_IDS[index])) return;
		this.islandIndex = index;
		this.battle = createBattle(ISLANDS[index], modifiersFor(this.campaign, ISLANDS[index].id));
		this.effects = [];
		this.shake = 0;
		this.timeMs = 0;
		this.#finishMs = 0;
		this.#settled = false;
		this.lastCasualties = {};
		this.lootCollected = { wood: 0, stone: 0, iron: 0, gold: 0 };
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
	tap(worldX: number, worldY: number, raised: readonly { x: number; y: number }[] = []) {
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

		// In the isometric view a tall building is tapped on its wall, which lies above its footprint;
		// the canvas also hands over where the tap would land if it were higher up
		const hits = (point: { x: number; y: number }) =>
			this.battle.buildings.find(
				(candidate) =>
					!candidate.destroyed &&
					!isScenery(candidate.kind) &&
					point.x >= candidate.x &&
					point.x <= candidate.x + candidate.width &&
					point.y >= candidate.y &&
					point.y <= candidate.y + candidate.height
			);
		let building = hits({ x: worldX, y: worldY });
		for (const point of raised) building ??= hits(point);
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

	/** Cycles the attack speed; the fourfold step is only for Pro subscribers */
	cycleSpeed() {
		if (this.speed === 1) this.speed = 2;
		else if (this.speed === 2 && this.isPro) this.speed = 4;
		else {
			if (this.speed === 2) {
				this.speedProHint = true;
				setTimeout(() => (this.speedProHint = false), 3500);
			}
			this.speed = 1;
		}
		this.#play('click', 0.4);
	}

	/** Gives the attack up: the landed troops run back to the shore, still under fire */
	giveUp() {
		if (this.screen !== 'play' || this.status !== 'playing' || this.battle.status !== 'playing')
			return;
		giveUp(this.battle);
		this.retreating = true;
		this.selectedSkill = null;
		this.focusKind = null;
		this.#play('ui-toggle', 0.5);
		this.#sync();
	}

	cancelSkill() {
		this.selectedSkill = null;
	}

	/** One fixed step: called by the canvas game loop */
	update(realMs: number) {
		const dtMs = realMs * (this.screen === 'play' ? this.speed : 1);
		this.timeMs += dtMs;
		this.#shotSound = Math.max(0, this.#shotSound - dtMs);
		this.shake = Math.max(0, this.shake - dtMs * 0.0015);
		for (const effect of this.effects) effect.ageMs += dtMs;
		// Loot pieces that reach the stockpile count up on the HUD
		for (const effect of this.effects) {
			if (effect.kind === 'loot' && effect.ageMs >= effect.durationMs + effect.delayMs) {
				this.lootCollected = {
					...this.lootCollected,
					[effect.resource]: this.lootCollected[effect.resource] + effect.amount
				};
			}
		}
		this.effects = this.effects.filter((effect) =>
			effect.kind === 'loot'
				? effect.ageMs < effect.durationMs + effect.delayMs
				: effect.ageMs < effect.durationMs
		);

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
		if (this.#finishMs >= (this.battle.status === 'won' ? WIN_DELAY_MS : RESULT_DELAY_MS)) {
			this.#finish();
		}
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
		// A touch of vibration on the sounds that mark a decision or a hit; shots stay silent to the hand
		if (this.reducedMotion) return;
		if (id === 'click') haptic().play(0.1);
		else if (id === 'ui-error') haptic().play(0.3);
		else if (id === 'chime' || id === 'chime-big') haptic().play(id === 'chime' ? 0.2 : 0.5);
		else if (id.startsWith('explosion')) haptic().play(Math.min(0.6, intensity * 0.5));
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
				if (event.skill === 'emp') {
					for (let ring = 0; ring < 3; ring++) {
						this.#effect({
							kind: 'ring',
							x: event.x,
							y: event.y,
							radius: event.radius * (0.6 + ring * 0.2),
							color: ring % 2 === 0 ? '#7fd8ff' : '#e8f8ff',
							ageMs: 0,
							durationMs: (520 + ring * 160) * short + 60
						});
					}
					this.#effect({
						kind: 'explosion',
						x: event.x,
						y: event.y,
						size: 0.45,
						ageMs: 0,
						durationMs: 360 * short + 60
					});
					this.#play('explosion-small', 0.5);
					break;
				}
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
			case 'jammer-pulse':
				this.#effect({
					kind: 'ring',
					x: event.x,
					y: event.y,
					radius: event.radius,
					color: '#7fd8ff',
					ageMs: 0,
					durationMs: 600 * short + 60
				});
				break;
			case 'mine-triggered': {
				// Every mine goes off its own way: shrapnel and a flash, a fireball and a column of smoke,
				// or a pulse of lightning that crackles outwards
				const kind = event.mine;
				const base = { x: event.x, y: event.y, ageMs: 0 };
				if (kind === 'mine-emp') {
					for (let ring = 0; ring < 3; ring++) {
						this.#effect({
							...base,
							kind: 'ring',
							radius: event.radius * (0.5 + ring * 0.25),
							color: ring % 2 === 0 ? '#7fd8ff' : '#e8f8ff',
							durationMs: (420 + ring * 160) * short + 60
						});
					}
					this.#effect({ ...base, kind: 'explosion', size: 0.4, durationMs: 320 * short + 60 });
					this.#effect({
						...base,
						kind: 'debris',
						size: 0.5,
						seed: event.buildingId * 2.3,
						durationMs: 500 * short + 60
					});
					this.#play('explosion-small', 0.35);
					this.#shakeBy(0.05);
				} else if (kind === 'mine-at') {
					this.#effect({ ...base, kind: 'explosion', size: 1.0, durationMs: 700 * short + 60 });
					this.#effect({ ...base, kind: 'explosion', size: 0.6, durationMs: 420 * short + 60 });
					this.#effect({
						...base,
						kind: 'ring',
						radius: event.radius,
						color: '#f28c28',
						durationMs: 600 * short + 60
					});
					for (let piece = 0; piece < 2; piece++) {
						this.#effect({
							...base,
							kind: 'debris',
							size: 1.3,
							seed: event.buildingId * 2.3 + piece,
							durationMs: 800 * short + 60
						});
					}
					this.#effect({ ...base, kind: 'down', durationMs: 900 * short + 60 });
					this.#play('explosion-big', 0.8);
					this.#shakeBy(0.34);
				} else {
					this.#effect({ ...base, kind: 'explosion', size: 0.55, durationMs: 420 * short + 60 });
					this.#effect({
						...base,
						kind: 'ring',
						radius: event.radius,
						color: '#f5c83a',
						durationMs: 480 * short + 60
					});
					this.#effect({
						...base,
						kind: 'debris',
						size: 0.8,
						seed: event.buildingId * 2.3,
						durationMs: 600 * short + 60
					});
					this.#effect({
						...base,
						kind: 'debris',
						size: 0.5,
						seed: event.buildingId * 4.1,
						durationMs: 500 * short + 60
					});
					this.#play('explosion-small', 0.7);
					this.#shakeBy(0.2);
				}
				break;
			}
			case 'troop-escaped':
				this.#effect({
					kind: 'splash',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 420 * short + 60
				});
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
				this.#shakeBy(0.07);
				break;
			case 'won':
				this.#play('chime-big', 0.8);
				this.#startLootFlight();
				break;
			case 'lost':
				this.#play('game-over', 0.8);
				break;
		}
	}

	/** Sends the loot out of the enemy headquarters and depots towards the player's stockpile */
	#startLootFlight() {
		if (this.testing) return;
		const first = !isControlled(this.campaign, this.islandId);
		const base = lootFor(this.islandIndex, first);
		const bonus = 1 + baseEffects(this.campaign).loot;
		this.#plannedLoot = {
			wood: Math.round(base.wood * bonus),
			stone: Math.round(base.stone * bonus),
			iron: Math.round(base.iron * bonus),
			gold: Math.round(base.gold * bonus)
		};
		this.lootCollected = { wood: 0, stone: 0, iron: 0, gold: 0 };
		const sources = this.battle.buildings.filter(
			(building) => building.kind === 'hq' || building.kind === 'depot'
		);
		if (sources.length === 0) return;
		let order = 0;
		for (const resource of ['wood', 'stone', 'iron', 'gold'] as const) {
			const total = this.#plannedLoot[resource];
			if (total <= 0) continue;
			const pieces = Math.min(total, 5 + sources.length * 2);
			let left = total;
			for (let piece = 0; piece < pieces; piece++) {
				const source = sources[(piece + order) % sources.length];
				const amount = piece === pieces - 1 ? left : Math.floor(total / pieces);
				left -= amount;
				this.#effect({
					kind: 'loot',
					resource,
					amount,
					fromX: source.x + source.width / 2 + ((piece * 0.37) % 0.8) - 0.4,
					fromY: source.y + source.height / 2 + ((piece * 0.53) % 0.8) - 0.4,
					seed: order * 1.7 + piece,
					delayMs: 250 + order * 70,
					ageMs: 0,
					durationMs: this.reducedMotion ? 400 : 1000
				});
				order += 1;
			}
		}
	}

	/** Takes the troops the attack killed out of the army; once per attack, win, loss or retreat */
	#settleCasualties(save: BeachheadSave): BeachheadSave {
		if (this.#settled) return save;
		this.#settled = true;
		this.lastCasualties = { ...this.battle.casualties };
		return applyCasualties(save, this.battle.casualties);
	}

	/** Leaving a fight in progress counts as a retreat: whoever already landed is lost */
	#retreat() {
		if (this.screen !== 'play' || this.battle.status !== 'playing' || this.battle.deployed === 0)
			return;
		for (const troop of this.battle.troops) {
			if (troop.kind === 'hero' || troop.kind === 'azov' || troop.spawnedBy !== undefined) continue;
			this.battle.casualties[troop.kind] = (this.battle.casualties[troop.kind] ?? 0) + 1;
		}
		this.#commit(this.#settleCasualties(this.campaign), { claim: false });
	}

	#finish() {
		if (this.status !== 'playing') return;

		if (this.testing) {
			this.testResult = {
				fell: this.battle.status === 'won',
				seconds: Math.round(this.battle.timeMs / 1000)
			};
			this.testing = false;
			this.goBase();
			const shown = this.testResult;
			setTimeout(() => {
				if (this.testResult === shown) this.testResult = null;
			}, 7000);
			return;
		}

		if (this.battle.status === 'won') {
			this.stars = 0;
			this.lastSeconds = Math.round(this.battle.timeMs / 1000);
			const loot = this.#plannedLoot;
			let next = controlIsland(this.campaign, this.islandId, 1);
			next = addResources(next, loot);
			next = recordVictory(next, {
				stars: 1,
				skillsUsed: this.battle.skillsUsed,
				heroAlive: this.battle.troops.some((troop) => troop.kind === 'hero' && troop.hp > 0)
			});
			const cards = shardsForWin(this.islandIndex, Math.random());
			next = grantHeroCards(next, cards);
			const drop = crystalDrop(
				this.islandIndex,
				Math.random(),
				Math.random(),
				baseEffects(this.campaign).dropRate
			);
			this.crystalFound = drop;
			if (drop) next = addCrystals(next, drop.type, drop.count);
			next = this.#settleCasualties(next);
			this.heroCardsFound = cards;
			this.loot = loot;
			this.newAchievements = [];
			this.#commit(next, { announce: true });
			this.status = 'won';
			return;
		}

		this.#commit(this.#settleCasualties(this.campaign), { claim: false });
		this.lastSeconds = Math.round(this.battle.timeMs / 1000);
		this.status = 'over';
	}

	#sync() {
		const battle = this.battle;
		this.squadsLeft = battle.squadsLeft;
		this.troops = troopsAlive(battle);
		this.deployed = battle.deployed;
		// Mines are scenery that bites back; only real structures count towards the objective list
		const structures = battle.buildings.filter((building) => !isScenery(building.kind));
		this.buildingsLeft = structures.filter((building) => !building.destroyed).length;
		this.buildingsTotal = structures.length;
		this.score = scoreOf(battle);
		this.timeLeft = timeLeftMs(battle);
		this.energy = battle.energy;
		this.skillsUsed = battle.skillsUsed;
		this.skillPrice = skillCost(battle);
	}
}

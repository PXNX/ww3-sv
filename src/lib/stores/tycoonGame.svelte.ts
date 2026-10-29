/*
 * Oil Tycoon Idle Clicker store: wraps the pure rules with persistence, offline progress, the
 * toasts and the sounds. The rules live in a plain state object; what the page shows is copied
 * into reactive fields after each fixed step (ten times a second) and after every action.
 *
 * An idle game has no lives and no game over, so there is no end screen: the game saves itself,
 * keeps running until the tab is left, and credits the time away when the player returns.
 */
import { career } from '#lib/game/career/store.svelte.js';
import {
	PERKS,
	PRODUCERS,
	STEP_MS,
	WELCOME_MIN_MS,
	type PerkId,
	type ProducerId
} from '#lib/game/tycoon/config.js';
import {
	achievementBonus,
	availablePoints,
	availableUpgrades,
	cycleMs,
	perkCost,
	globalMultiplier,
	prestigeMultiplier,
	pricing,
	productionPerSecond,
	speedMultiplier,
	tapValue,
	unitOutput,
	type Pricing
} from '#lib/game/tycoon/economy.js';
import { canChoose, choiceCost, resolveEvent, spikeSellValue } from '#lib/game/tycoon/events.js';
import { clearSave, readSave, writeSave } from '#lib/game/tycoon/save.js';
import {
	applyOffline,
	buyPerk,
	buyProducer,
	buyUpgrade,
	emptyPerks,
	canPrestige,
	createState,
	pendingPrestige,
	prestige,
	stepGame,
	tap,
	type OfflineReport
} from '#lib/game/tycoon/state.js';
import type {
	ActiveEffect,
	EventChoice,
	PendingEvent,
	TycoonEvent,
	TycoonState
} from '#lib/game/tycoon/types.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import { formatBig } from '#lib/game/tycoon/format.js';
import { achievementName, outcomeText } from '#lib/components/tycoonText.js';

export type TycoonStatus = 'playing' | 'paused';
export type BuyAmount = 1 | 10 | 'max';

export const BEST_KEY = ['tycoon', 'lifetime'] as const;

/** The game saves itself this often */
export const AUTOSAVE_MS = 5000;
const TOAST_MS = 2600;

export interface Toast {
	id: number;
	text: string;
}

export interface TycoonOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per session otherwise */
	seed?: () => number;
	/** The clock, injected for tests */
	now?: () => number;
	/** The Fake News wallet the shop's Fake News investment pays into; injected for tests */
	coins?: () => Pick<ReturnType<typeof career>, 'coinsLeftToday' | 'grantCoins'>;
}

export class TycoonGame {
	status = $state<TycoonStatus>('playing');
	barrels = $state(0);
	perSecond = $state(0);
	tapGain = $state(1);
	runTotal = $state(0);
	lifetime = $state(0);
	taps = $state(0);
	crisesAnswered = $state(0);
	sanctionsEvaded = $state(0);
	owned = $state.raw<Record<ProducerId, number>>(createState(createRandom(1)).owned);
	/** Barrels per second one unit of each producer makes (upgrades and multipliers, no crisis) */
	eachOutput = $state.raw<Record<ProducerId, number>>(createState(createRandom(1)).owned);
	/** How long a cycle of each producer lasts, and how far the current one is (0 to 1) */
	cycles = $state.raw<Record<ProducerId, number>>(createState(createRandom(1)).owned);
	progress = $state.raw<Record<ProducerId, number>>(createState(createRandom(1)).owned);
	/** How producer prices behave right now (the shop and achievement discounts) */
	pricing = $state.raw<Pricing>({ growth: 1, factor: 1 });
	speed = $state(1);
	/** Producers silenced by sanctions right now */
	cut = $state.raw<ProducerId[]>([]);
	upgradeIds = $state.raw<string[]>([]);
	/** Upgrades that are unlocked and not yet bought */
	availableIds = $state.raw<string[]>([]);
	achievementIds = $state.raw<string[]>([]);
	/** What the unlocked achievements add up to, per kind of boost (shares, 0.05 is 5 percent) */
	achievementBoosts = $state.raw({ tap: 0, output: 0, speed: 0, discount: 0 });
	prestigePoints = $state(0);
	/** Points left to spend in the nationalization shop, and the levels bought there */
	spendablePoints = $state(0);
	perks = $state.raw<Record<PerkId, number>>(emptyPerks());
	/** Whether the spare points buy at least one more level */
	canInvest = $state(false);
	prestiges = $state(0);
	/** Points a nationalization would pay right now */
	pendingPoints = $state(0);
	multiplier = $state(1);
	/** Product of prestige, achievements, the shop and global upgrades */
	totalMultiplier = $state(1);
	event = $state.raw<PendingEvent | null>(null);
	effects = $state.raw<ActiveEffect[]>([]);
	/** Barrels the paying answer of the current crisis costs, and whether the player can pay */
	eventCost = $state(0);
	canPayEvent = $state(true);
	/** What selling at a price spike would pay */
	sellValue = $state(0);
	buyAmount = $state<BuyAmount>(1);
	buyMode = $state<'1x' | '10x' | 'max'>('1x');
	toast = $state.raw<Toast | null>(null);
	/** The report shown when the player comes back after a while; null once dismissed */
	welcome = $state.raw<OfflineReport | null>(null);
	best = $state<number | null>(null);
	/** Counts up when something was tapped, so the derrick can animate */
	tapCount = $state(0);
	loaded = $state(false);

	/** Rules state, deliberately not reactive */
	state: TycoonState;

	readonly reducedMotion: boolean;
	#random: Random;
	#store: () => Store;
	#scores: () => Highscores;
	#now: () => number;
	#coins: NonNullable<TycoonOptions['coins']>;
	#toastMs = 0;
	#toastId = 0;
	#saveMs = 0;
	#awayAt: number | null = null;
	#lastSound: Partial<Record<SoundId, number>> = {};

	constructor({
		reducedMotion = false,
		store = localStore,
		scores = highscores,
		seed = randomSeed,
		now = Date.now,
		coins = career
	}: TycoonOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#store = store;
		this.#scores = scores;
		this.#now = now;
		this.#coins = coins;
		this.#random = createRandom(seed());
		this.state = createState(this.#random);
		this.#sync();
	}

	/** Reads the saved game and credits the time since it was saved; call in the browser only */
	load() {
		this.best = this.#scores().get(BEST_KEY);
		const saved = readSave(this.#store(), this.#random);
		if (saved) {
			this.state = saved.state;
			this.#credit(this.#now() - saved.savedAt);
		}
		this.loaded = true;
		this.#sync();
	}

	/** Writes the game to storage and submits the lifetime total as the personal best */
	save() {
		const now = this.#now();
		writeSave(this.#store(), this.state, now);
		const result = this.#scores().submit(BEST_KEY, this.state.lifetime);
		this.best = result.best;
	}

	/** Throws the saved game away and starts over (personal bests are kept) */
	reset() {
		clearSave(this.#store());
		this.state = createState(this.#random);
		this.welcome = null;
		this.toast = null;
		this.#sync();
		this.save();
	}

	pause() {
		if (this.status === 'playing') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	/** The tab is hidden: save, and remember when, so the time away can be credited */
	away() {
		if (this.#awayAt !== null) return;
		this.#awayAt = this.#now();
		this.save();
	}

	/** The tab is visible again: credit the time away */
	back() {
		if (this.#awayAt === null) return;
		const elapsed = this.#now() - this.#awayAt;
		this.#awayAt = null;
		this.#credit(elapsed);
		this.#sync();
	}

	/** The player taps the derrick; returns the barrels it pumped (0 while protesters block it) */
	tap(): number {
		if (this.status !== 'playing') return 0;
		const { gained, events } = tap(this.state, this.#random);
		this.tapCount += 1;
		if (gained > 0) this.#play('click', 70);
		else this.#play('ui-error', 400);
		this.#handleAll(events);
		this.#sync();
		return gained;
	}

	buy(id: ProducerId, amount: number | 'max' = this.buyAmount): number {
		if (this.status !== 'playing') return 0;
		const { bought, events } = buyProducer(this.state, id, amount);
		if (bought > 0) {
			this.#play('pickup', 60);
			this.#handleAll(events);
			this.#sync();
			this.save();
		} else {
			this.#play('ui-error', 200);
		}
		return bought;
	}

	buyUpgrade(id: string): boolean {
		if (this.status !== 'playing') return false;
		const { bought, events } = buyUpgrade(this.state, id);
		if (bought) {
			this.#play('chime', 60);
			this.#handleAll(events);
			this.#sync();
			this.save();
		} else {
			this.#play('ui-error', 200);
		}
		return bought;
	}

	/** Buys the next level of a perk in the nationalization shop */
	buyPerk(id: PerkId): boolean {
		if (this.status !== 'playing') return false;
		// Fake News pays coins, so with today's coin cap used up the points are not spent on it
		if (id === 'fake_news' && this.#coins().coinsLeftToday <= 0) {
			this.#play('ui-error', 200);
			return false;
		}
		const { bought, events } = buyPerk(this.state, id);
		if (bought) {
			if (id === 'fake_news') {
				this.#coins().grantCoins(PERKS.find((def) => def.id === id)?.value ?? 0);
			}
			this.#play('chime-big', 60);
			this.#handleAll(events);
			this.#sync();
			this.save();
		} else {
			this.#play('ui-error', 200);
		}
		return bought;
	}

	/** The player answers the crisis */
	choose(choice: EventChoice) {
		if (this.status !== 'playing' || !this.state.event) return;
		if (!canChoose(this.state, choice)) {
			this.#play('ui-error', 200);
			return;
		}
		this.#handleAll(resolveEvent(this.state, choice, this.#random));
		this.#sync();
	}

	/** Nationalize and restart; the caller has asked the player to confirm */
	nationalize(): boolean {
		if (!canPrestige(this.state)) return false;
		this.#handleAll(prestige(this.state, this.#random));
		this.welcome = null;
		this.#sync();
		this.save();
		return true;
	}

	setBuyMode(mode: '1x' | '10x' | 'max') {
		this.buyMode = mode;
		this.state.buyMode = mode;
		this.save();
	}

	dismissWelcome() {
		this.welcome = null;
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number = STEP_MS) {
		if (this.status !== 'playing') return;
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		this.#handleAll(stepGame(this.state, dtMs, this.#random));
		this.#sync();
		if ((this.#saveMs += dtMs) >= AUTOSAVE_MS) {
			this.#saveMs = 0;
			this.save();
		}
	}

	/** Credits away time and prepares the welcome-back report */
	#credit(elapsedMs: number) {
		const { report, events } = applyOffline(this.state, elapsedMs, this.#random);
		this.#handleAll(events);
		if (elapsedMs >= WELCOME_MIN_MS && report.barrels > 0) this.welcome = report;
	}

	#handleAll(events: TycoonEvent[]) {
		for (const event of events) this.#handle(event);
	}

	#handle(event: TycoonEvent) {
		const locale = getLocale();
		switch (event.type) {
			case 'achievement':
				this.#showToast(m.tycoon_toast_achievement({ name: achievementName(event.id) }));
				this.#play('sparkle', 0);
				break;
			case 'event-start':
				this.#showToast(m.tycoon_toast_crisis());
				this.#play('alarm', 0);
				break;
			case 'event-resolved':
				this.#showToast(
					outcomeText(event.outcome, {
						barrels: formatBig(spikeSellValue(this.state), locale)
					})
				);
				this.#play(
					event.outcome === 'crash' ||
						event.outcome === 'sanctioned' ||
						event.outcome === 'leak' ||
						event.outcome === 'protest'
						? 'thud'
						: 'chime-big',
					0
				);
				break;
			case 'effect-end':
				break;
			case 'prestige':
				this.#showToast(m.tycoon_toast_prestige({ points: event.points }));
				this.#play('chime-big', 0);
				break;
		}
	}

	#showToast(text: string) {
		this.toast = { id: ++this.#toastId, text };
		this.#toastMs = TOAST_MS * (this.reducedMotion ? 0.7 : 1);
	}

	#play(id: SoundId, gapMs: number) {
		const last = this.#lastSound[id];
		const now = this.#now();
		if (last !== undefined && gapMs > 0 && now - last < gapMs) return;
		this.#lastSound[id] = now;
		soundManager().play(id);
	}

	#sync() {
		const state = this.state;
		this.barrels = state.barrels;
		this.perSecond = productionPerSecond(state);
		this.tapGain = tapValue(state);
		this.runTotal = state.runTotal;
		this.lifetime = state.lifetime;
		this.taps = state.taps;
		this.crisesAnswered = state.eventsHandled;
		this.sanctionsEvaded = state.sanctionsEvaded;
		this.owned = { ...state.owned };
		this.totalMultiplier = globalMultiplier(state);
		this.eachOutput = byProducer((id) => unitOutput(state, id));
		this.cycles = byProducer((id) => cycleMs(state, id));
		this.progress = byProducer((id) => Math.min(1, state.progress[id] / this.cycles[id]));
		this.pricing = pricing(state);
		this.speed = speedMultiplier(state);
		this.cut = state.effects.flatMap((effect) => (effect.producer ? [effect.producer] : []));
		this.upgradeIds = [...state.upgrades];
		this.availableIds = availableUpgrades(state).map((upgrade) => upgrade.id);
		this.achievementIds = [...state.achievements];
		this.achievementBoosts = {
			tap: achievementBonus(state, 'tap'),
			output: achievementBonus(state, 'output'),
			speed: achievementBonus(state, 'speed'),
			discount: achievementBonus(state, 'discount')
		};
		this.prestigePoints = state.prestigePoints;
		this.spendablePoints = availablePoints(state);
		this.perks = { ...state.perks };
		this.canInvest = PERKS.some(
			(def) =>
				state.perks[def.id] < def.maxLevel &&
				perkCost(def, state.perks[def.id]) <= this.spendablePoints
		);
		this.prestiges = state.prestiges;
		this.pendingPoints = pendingPrestige(state);
		this.multiplier = prestigeMultiplier(state.prestigePoints, state);
		this.buyMode = state.buyMode;
		this.event = state.event ? { ...state.event } : null;
		this.effects = state.effects.map((effect) => ({ ...effect }));
		this.eventCost = state.event ? choiceCost(state, state.event) : 0;
		this.canPayEvent = state.event ? canChoose(state, 'a') : true;
		this.sellValue = spikeSellValue(state);
	}
}

function byProducer(value: (id: ProducerId) => number): Record<ProducerId, number> {
	return Object.fromEntries(PRODUCERS.map((def) => [def.id, value(def.id)])) as Record<
		ProducerId,
		number
	>;
}

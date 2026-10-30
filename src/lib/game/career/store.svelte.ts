/*
 * The reactive career store: one profile shared by the start screen, the result sheet and the
 * supply depot. Reads and writes local storage, keeps the player on today's challenge and caps,
 * and guards against paying the same run twice when a result sheet is re-mounted.
 */
import type { ModeId } from '#lib/modes/registry.js';
import { redeemGift as redeemGiftIn, type RedeemResult } from '#lib/game/giftcode/redeem.js';
import { telegram } from '#lib/stores/telegram.svelte.js';
import { localStore } from '#lib/services/storage.js';
import type { CareerRankId } from './config';
import {
	adsLeft as adsLeftFor,
	awardRun as claimRun,
	buyRevives as buyRevivesIn,
	buyUnlock as buyUnlockIn,
	canClaimDaily,
	careerLevel,
	careerRank,
	claimDaily as claimDailyIn,
	coinsLeftToday,
	grantCoins as grantCoinsIn,
	levelInfo,
	newCareer,
	parseCareer,
	playedCount,
	recentModes,
	useRevive as useReviveIn,
	watchAd as watchAdIn,
	withToday,
	type AdResult,
	type CareerProfile,
	type LevelInfo,
	type RunInput,
	type RunReward,
	type StreakClaim
} from './profile';

const CAREER_KEY = 'career:profile';
/** The gift codes this device has redeemed */
const GIFT_KEY = 'career:gift-codes';

const isStringList = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/** A result sheet re-mounted within this window for the same run is not paid twice */
const DUPLICATE_WINDOW_MS = 5000;

class CareerStore {
	profile = $state<CareerProfile>(newCareer());

	#lastAward = { key: '', at: 0 };

	constructor() {
		const stored = localStore().read<unknown>(CAREER_KEY, null);
		this.profile = parseCareer(stored) ?? newCareer();
	}

	/** Moves the profile on to today (new challenge, cap and ad allowance) */
	refresh(now: Date = new Date()) {
		const next = withToday(this.profile, now);
		if (next !== this.profile) this.#commit(next);
	}

	/** Banks a finished run; null when the very same run was already paid a moment ago */
	awardRun(run: RunInput, now: Date = new Date()): RunReward | null {
		const key = `${run.mode}:${run.score}:${run.outcome}:${run.isNewBest}`;
		const stamp = now.getTime();
		if (this.#lastAward.key === key && stamp - this.#lastAward.at < DUPLICATE_WINDOW_MS) {
			return null;
		}
		this.#lastAward = { key, at: stamp };
		const result = claimRun(
			this.profile,
			run,
			now,
			telegram().proUntil ? (new Date(telegram().proUntil) > now ? 2 : 1) : 1
		);
		this.#commit(result.profile);
		return result;
	}

	claimDaily(now: Date = new Date()): StreakClaim | null {
		const claim = claimDailyIn(this.profile, now);
		if (claim) this.#commit(claim.profile);
		return claim;
	}

	buyRevives(count: number, now: Date = new Date()): boolean {
		const next = buyRevivesIn(this.profile, count, now);
		if (!next) return false;
		this.#commit(next);
		return true;
	}

	/** Buys a profile item with Fake News; false when it is already owned or too expensive */
	buyUnlock(id: string, price: number, now: Date = new Date()): boolean {
		const next = buyUnlockIn(this.profile, id, price, now);
		if (!next) return false;
		this.#commit(next);
		return true;
	}

	/** Redeems a gift code once per device; the reward goes straight into the wallet */
	redeemGift(input: string, now: Date = new Date()): RedeemResult {
		const redeemed = localStore().read<string[]>(GIFT_KEY, [], isStringList);
		const result = redeemGiftIn(this.profile, redeemed, input, now.getTime());
		if (result.status !== 'ok') return result;
		this.#commit(result.profile);
		localStore().write(GIFT_KEY, [...redeemed, result.gift.code]);
		return result;
	}

	/** Pays Fake News within today's cap; returns how many coins were paid */
	grantCoins(coins: number, now: Date = new Date()): number {
		const result = grantCoinsIn(this.profile, coins, now);
		if (result.granted > 0) this.#commit(result.profile);
		return result.granted;
	}

	useRevive(): boolean {
		const next = useReviveIn(this.profile);
		if (!next) return false;
		this.#commit(next);
		return true;
	}

	watchAd(coins: number, now: Date = new Date()): AdResult {
		const result = watchAdIn(this.profile, coins, now);
		if (result.watched) this.#commit(result.profile);
		return result;
	}

	get level(): number {
		return careerLevel(this.profile.xp);
	}

	get levelInfo(): LevelInfo {
		return levelInfo(this.profile.xp);
	}

	get rank(): CareerRankId {
		return careerRank(this.profile.xp);
	}

	get challengeMode(): ModeId {
		return this.profile.challenge.mode;
	}

	get dailyAvailable(): boolean {
		return canClaimDaily(this.profile);
	}

	get adsLeft(): number {
		return adsLeftFor(this.profile);
	}

	get coinsLeftToday(): number {
		return coinsLeftToday(this.profile);
	}

	get played(): number {
		return playedCount(this.profile);
	}

	recent(limit = 3): ModeId[] {
		return recentModes(this.profile, limit);
	}

	#commit(profile: CareerProfile) {
		this.profile = profile;
		localStore().write(CAREER_KEY, profile);
	}
}

// Imported separately to keep the pure module free of a name clash with the store method
let shared: CareerStore | undefined;

/** The app-wide career store (created on first use) */
export function career(): CareerStore {
	shared ??= new CareerStore();
	return shared;
}

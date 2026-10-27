import { describe, expect, it } from 'vitest';
import { MODES } from '#lib/modes/registry.js';
import {
	ADS_PER_DAY,
	CAREER_MODES,
	DAILY_REWARD_XP,
	DAILY_COIN_CAP,
	DAILY_TRACK,
	LEVEL_UP_COINS,
	STARTING_COINS,
	STARTING_REVIVES,
	rankFor,
	scoreCoins,
	xpToNextLevel
} from './config';
import {
	adsLeft,
	awardRun,
	buyRevives,
	canClaimDaily,
	careerLevel,
	challengeMode,
	claimDaily,
	coinsLeftToday,
	isCareerProfile,
	levelInfo,
	newCareer,
	parseCareer,
	playedCount,
	recentModes,
	reviveCost,
	useRevive,
	watchAd,
	withToday,
	type CareerProfile
} from './profile';

const DAY1 = new Date(2026, 9, 26, 12, 0, 0);
const DAY2 = new Date(2026, 9, 27, 12, 0, 0);
const DAY4 = new Date(2026, 9, 29, 12, 0, 0);

const run = (overrides: Partial<Parameters<typeof awardRun>[1]> = {}) => ({
	mode: 'blocks' as const,
	score: 0,
	outcome: 'lost' as const,
	isNewBest: false,
	...overrides
});

/** A profile whose daily challenge is already done, for tests about everything else */
const quiet = (day = DAY1) => {
	const profile = newCareer(day);
	return { ...profile, challenge: { ...profile.challenge, done: true } };
};

/** A top-level player, so the reward XP of a claim cannot cause a level-up */
const veteran = () => ({ ...quiet(), xp: 10_000_000 });

/** Takes a profile to the given day with that day's challenge already done */
const done = (profile: CareerProfile, day: Date) => {
	const today = withToday(profile, day);
	return { ...today, challenge: { ...today.challenge, done: true } };
};

describe('a fresh career', () => {
	it('starts with a little walking-around money and a challenge for today', () => {
		const profile = newCareer(DAY1);
		expect(profile.coins).toBe(STARTING_COINS);
		expect(profile.revives).toBe(STARTING_REVIVES);
		expect(profile.streak).toBe(0);
		expect(profile.challenge.day).toBe('2026-10-26');
		expect(profile.challenge.done).toBe(false);
	});

	it('picks the same challenge for everyone on the same day', () => {
		expect(challengeMode('2026-10-26')).toBe(challengeMode('2026-10-26'));
		expect(newCareer(DAY1).challenge.mode).toBe(challengeMode('2026-10-26'));
	});
});

describe('the career mode list', () => {
	it('names existing modes once, without duplicates', () => {
		const registered = new Set(MODES.map((mode) => mode.id));
		for (const mode of CAREER_MODES) expect(registered.has(mode)).toBe(true);
		expect(new Set(CAREER_MODES).size).toBe(CAREER_MODES.length);
	});

	it('leaves out the modes with their own economy or result screen', () => {
		for (const mode of ['tycoon', 'wordle', 'raid', 'fleethunt', 'beltroad', 'maze', 'parking']) {
			expect(CAREER_MODES).not.toContain(mode);
		}
	});
});

describe('levels', () => {
	it('needs a growing amount of XP per level', () => {
		expect(xpToNextLevel(1)).toBe(100);
		expect(xpToNextLevel(2)).toBe(150);
		expect(levelInfo(0)).toEqual({ level: 1, xpInto: 0, needed: 100 });
		expect(levelInfo(99)).toEqual({ level: 1, xpInto: 99, needed: 100 });
		expect(levelInfo(100)).toEqual({ level: 2, xpInto: 0, needed: 150 });
		expect(levelInfo(250)).toEqual({ level: 3, xpInto: 0, needed: 200 });
	});

	it('gives out ranks by level', () => {
		expect(rankFor(1)).toBe('intern');
		expect(rankFor(5)).toBe('lobbyist');
		expect(rankFor(12)).toBe('broker');
		expect(rankFor(40)).toBe('survivor');
	});
});

describe('paying out a run', () => {
	it('pays a base reward plus a first-play bonus on a scoreless loss', () => {
		const result = awardRun(quiet(), run(), DAY1);
		expect(result.runCoins).toBe(13);
		expect(result.runXp).toBe(40);
		expect(result.levelsGained).toBe(0);
		expect(result.profile.modes.blocks).toMatchObject({ plays: 1, best: 0 });
		expect(result.profile.runs).toBe(1);
	});

	it('pays more for a win, a personal best and a big score', () => {
		const result = awardRun(quiet(), run({ score: 1000, outcome: 'won', isNewBest: true }), DAY1);
		expect(scoreCoins(1000)).toBe(12);
		// 5 base + 3 win + 8 best + 8 first play + 12 score, then 25 for reaching level 2
		expect(result.coins).toBe(61);
		expect(result.xp).toBe(100);
		expect(result.levelsGained).toBe(1);
		expect(result.level).toBe(2);
		expect(result.profile.revives).toBe(STARTING_REVIVES);
	});

	it('marks the featured game as done once and doubles that run', () => {
		const profile = newCareer(DAY1);
		profile.challenge = { day: '2026-10-26', mode: 'blocks', done: false };
		const first = awardRun(profile, run({ score: 50 }), DAY1);
		expect(first.challengeCompleted).toBe(true);
		// (5 base + 8 first play + 7 score) twice; the reward itself waits for the daily claim
		expect(first.runCoins).toBe(40);
		expect(first.profile.revives).toBe(STARTING_REVIVES);
		expect(first.profile.challenge.done).toBe(true);

		const second = awardRun(first.profile, run({ score: 50 }), DAY1);
		expect(second.challengeCompleted).toBe(false);
		expect(second.runCoins).toBe(12);
	});

	it('does not count a scoreless run towards the challenge', () => {
		const profile = newCareer(DAY1);
		profile.challenge = { day: '2026-10-26', mode: 'blocks', done: false };
		const result = awardRun(profile, run({ score: 0 }), DAY1);
		expect(result.challengeCompleted).toBe(false);
	});

	it('trims the payout at the daily cap and moves the cap on the next day', () => {
		const profile = quiet();
		profile.earned = { day: '2026-10-26', coins: DAILY_COIN_CAP, xp: 0 };
		const capped = awardRun(profile, run(), DAY1);
		expect(capped.runCoins).toBe(0);
		expect(capped.capped).toBe(true);
		expect(coinsLeftToday(capped.profile, DAY1)).toBe(0);

		const nextDay = awardRun(capped.profile, run({ mode: 'convoy' }), DAY2);
		expect(nextDay.runCoins).toBeGreaterThan(0);
		expect(coinsLeftToday(nextDay.profile, DAY2)).toBeLessThan(DAILY_COIN_CAP);
	});

	it('keeps the best score and touches the recent list', () => {
		const first = awardRun(quiet(), run({ score: 30 }), DAY1);
		const second = awardRun(first.profile, run({ score: 12 }), DAY1);
		expect(second.profile.modes.blocks?.best).toBe(30);
		const later = awardRun(second.profile, run({ mode: 'convoy', score: 1 }), DAY2);
		expect(recentModes(later.profile)).toEqual(['convoy', 'blocks']);
		expect(playedCount(later.profile)).toBe(2);
	});
});

describe('the daily reward', () => {
	it('stays closed until the featured game has been played', () => {
		const profile = newCareer(DAY1);
		expect(canClaimDaily(profile, DAY1)).toBe(false);
		expect(claimDaily(profile, DAY1)).toBeNull();

		const otherMode = CAREER_MODES.find((mode) => mode !== profile.challenge.mode)!;
		const elsewhere = awardRun(profile, run({ mode: otherMode, score: 5 }), DAY1);
		expect(elsewhere.challengeCompleted).toBe(false);
		expect(canClaimDaily(elsewhere.profile, DAY1)).toBe(false);

		const featured = awardRun(profile, run({ mode: profile.challenge.mode, score: 5 }), DAY1);
		expect(featured.challengeCompleted).toBe(true);
		expect(canClaimDaily(featured.profile, DAY1)).toBe(true);
	});

	it('pays the first day, refuses a second claim and grows the next day', () => {
		const profile = veteran();
		expect(canClaimDaily(profile, DAY1)).toBe(true);
		const first = claimDaily(profile, DAY1);
		expect(first?.coins).toBe(DAILY_TRACK[0].coins);
		expect(first?.streak).toBe(1);
		expect(canClaimDaily(first!.profile, DAY1)).toBe(false);
		expect(claimDaily(first!.profile, DAY1)).toBeNull();

		const second = claimDaily(done(first!.profile, DAY2), DAY2);
		expect(second?.coins).toBe(DAILY_TRACK[1].coins);
		expect(second?.streak).toBe(2);
	});

	it('resets the streak after a missed day', () => {
		const profile = veteran();
		const first = claimDaily(profile, DAY1)!;
		const afterGap = claimDaily(done(first.profile, DAY4), DAY4)!;
		expect(afterGap.streak).toBe(1);
		expect(afterGap.coins).toBe(DAILY_TRACK[0].coins);
	});

	it('hands out revivals on the slots that carry them', () => {
		let profile: CareerProfile = veteran();
		const day2 = new Date(2026, 9, 27, 12);
		const day3 = new Date(2026, 9, 28, 12);
		profile = claimDaily(profile, DAY1)!.profile;
		const second = claimDaily(done(profile, day2), day2)!;
		expect(second.revives).toBe(DAILY_TRACK[1].revives);
		const third = claimDaily(done(second.profile, day3), day3)!;
		expect(third.slot).toBe(2);
		expect(third.revives).toBe(DAILY_TRACK[2].revives);
	});

	it('adds reward XP that can level the player up', () => {
		const claim = claimDaily(quiet(), DAY1)!;
		expect(claim.xp).toBe(DAILY_REWARD_XP);
		expect(claim.profile.xp).toBe(DAILY_REWARD_XP);
		expect(claim.levelsGained).toBe(1);
		expect(claim.coins).toBe(DAILY_TRACK[0].coins + LEVEL_UP_COINS);
		expect(claim.profile.coins).toBe(STARTING_COINS + DAILY_TRACK[0].coins + LEVEL_UP_COINS);
	});
});

describe('the shop', () => {
	it('cannot afford a revival at the start and can afford the crate later', () => {
		const profile = quiet();
		expect(buyRevives(profile, 1)).toBeNull();
		expect(reviveCost(1)).toBe(120);
		expect(reviveCost(5)).toBe(450);
		const rich = { ...profile, coins: 500 };
		const crate = buyRevives(rich, 5)!;
		expect(crate.coins).toBe(50);
		expect(crate.revives).toBe(STARTING_REVIVES + 5);
	});

	it('spends a revival token only when there is one', () => {
		const profile = quiet();
		expect(useRevive(profile)?.revives).toBe(STARTING_REVIVES - 1);
		expect(useRevive({ ...profile, revives: 0 })).toBeNull();
	});
});

describe('the sponsor break', () => {
	it('pays a limited number of adverts a day', () => {
		let profile = quiet();
		for (let i = 0; i < ADS_PER_DAY; i++) {
			const result = watchAd(profile, 10, DAY1);
			expect(result.watched).toBe(true);
			profile = result.profile;
		}
		const extra = watchAd(profile, 10, DAY1);
		expect(extra.watched).toBe(false);
		expect(extra.coins).toBe(0);
		expect(adsLeft(profile, DAY1)).toBe(0);
		expect(adsLeft(profile, DAY2)).toBe(ADS_PER_DAY);
	});

	it('never pays more than the advert is worth', () => {
		const result = watchAd(quiet(), 10_000, DAY1);
		expect(result.coins).toBe(150);
	});
});

describe('saved profiles', () => {
	it('reads a valid profile back and moves the challenge on to today', () => {
		const saved = awardRun(quiet(), run({ score: 5 }), DAY1).profile;
		const loaded = parseCareer(JSON.parse(JSON.stringify(saved)), DAY2);
		expect(loaded).not.toBeNull();
		expect(loaded?.coins).toBe(saved.coins);
		expect(loaded?.challenge.day).toBe('2026-10-27');
		expect(loaded?.challenge.done).toBe(false);
		expect(loaded?.modes.blocks?.best).toBe(5);
	});

	it('refuses anything that is not a career profile', () => {
		expect(isCareerProfile(null)).toBe(false);
		expect(parseCareer({ version: 1 }, DAY1)).toBeNull();
		expect(parseCareer({ ...newCareer(DAY1), coins: -5 }, DAY1)).toBeNull();
		expect(parseCareer({ ...newCareer(DAY1), version: 2 }, DAY1)).toBeNull();
		expect(careerLevel(newCareer(DAY1).xp)).toBe(1);
	});
});

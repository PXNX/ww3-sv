import { describe, expect, it } from 'vitest';
import { CAREER_MODES } from '#lib/game/career/config.js';
import { awardRun, newCareer, parseCareer } from '#lib/game/career/profile.js';
import { dayKey } from '#lib/game/random.js';
import {
	loadMessages,
	locales,
	messageKeys,
	messageParameters,
	missingMessages
} from '#lib/testing/messages.js';
import { MEDAL_CASE_SIZE } from './config.js';
import {
	addMedal,
	contestMode,
	contestPrize,
	contestTier,
	enterContest,
	medalCounts,
	newContest,
	recentMedals,
	tierRank,
	type ContestMedal
} from './contest.js';

const DAY1 = new Date(2026, 9, 29, 12);
const DAY2 = new Date(2026, 9, 30, 12);

const medal = (day: string, tier: ContestMedal['tier'] = 'bronze'): ContestMedal => ({
	day,
	mode: 'blocks',
	tier,
	score: 10
});

describe('the featured game', () => {
	it('is the same for everyone on the same day and a career game', () => {
		const mode = contestMode('2026-10-29');
		expect(contestMode('2026-10-29')).toBe(mode);
		expect(CAREER_MODES).toContain(mode);
	});

	it('moves on with the day', () => {
		const modes = new Set(
			Array.from({ length: 14 }, (_, index) =>
				contestMode(`2026-11-${String(index + 1).padStart(2, '0')}`)
			)
		);
		expect(modes.size).toBeGreaterThan(1);
	});

	it('starts a day with no medal and no score', () => {
		expect(newContest('2026-10-29')).toEqual({
			day: '2026-10-29',
			mode: contestMode('2026-10-29'),
			best: 0,
			tier: null
		});
	});
});

describe('the medal ladder', () => {
	it('pays bronze for a first score and nothing for an empty run', () => {
		expect(contestTier(5, null)).toBe('bronze');
		expect(contestTier(0, null)).toBeNull();
		expect(contestTier(-4, 100)).toBeNull();
		expect(contestTier(Number.NaN, 100)).toBeNull();
	});

	it('pays silver at half the record and gold at the record itself', () => {
		expect(contestTier(49, 100)).toBe('bronze');
		expect(contestTier(50, 100)).toBe('silver');
		expect(contestTier(99, 100)).toBe('silver');
		expect(contestTier(100, 100)).toBe('gold');
		expect(contestTier(140, 100)).toBe('gold');
	});

	it('ranks the tiers so an upgrade can be told from a worse run', () => {
		expect(tierRank(null)).toBe(-1);
		expect(tierRank('bronze')).toBeLessThan(tierRank('silver'));
		expect(tierRank('silver')).toBeLessThan(tierRank('gold'));
	});
});

describe('entering a run', () => {
	it('ignores another game and a run without a score', () => {
		const contest = newContest('2026-10-29');
		const other = CAREER_MODES.find((mode) => mode !== contest.mode)!;
		expect(enterContest(contest, [], { mode: other, score: 100 }, null)).toBeNull();
		expect(enterContest(contest, [], { mode: contest.mode, score: 0 }, null)).toBeNull();
	});

	it('pays the medal once and only raises it for a better run', () => {
		const contest = newContest('2026-10-29');
		const first = enterContest(contest, [], { mode: contest.mode, score: 10 }, null)!;
		expect(first.tier).toBe('bronze');
		expect(first.first).toBe(true);
		expect(first.improved).toBe(true);
		expect(first.coins).toBe(20);

		const worse = enterContest(first.contest, first.medals, { mode: contest.mode, score: 4 }, 10)!;
		expect(worse.improved).toBe(false);
		expect(worse.coins).toBe(0);
		expect(worse.revives).toBe(0);
		expect(worse.contest.best).toBe(10);

		const better = enterContest(
			first.contest,
			first.medals,
			{ mode: contest.mode, score: 10 },
			10
		)!;
		expect(better.tier).toBe('gold');
		expect(better.improved).toBe(true);
		expect(better.first).toBe(false);
		// Only the difference between bronze and gold is paid
		expect(better.coins).toBe(70);
		expect(better.revives).toBe(2);
	});

	it('pays nothing more for another gold the same day', () => {
		const contest = newContest('2026-10-29');
		const gold = enterContest(contest, [], { mode: contest.mode, score: 30 }, 30)!;
		const again = enterContest(gold.contest, gold.medals, { mode: contest.mode, score: 40 }, 30)!;
		expect(again.improved).toBe(false);
		expect(again.coins).toBe(0);
		expect(again.medals).toHaveLength(1);
	});

	it('keeps the prize ladder consistent', () => {
		expect(contestPrize(null, 'bronze')).toEqual({ coins: 20, revives: 0 });
		expect(contestPrize('bronze', 'silver')).toEqual({ coins: 25, revives: 1 });
		expect(contestPrize('silver', 'gold')).toEqual({ coins: 45, revives: 1 });
	});
});

describe('the medal case', () => {
	it('replaces the medal of the same day instead of stacking it', () => {
		const case1 = addMedal([medal('2026-10-28')], medal('2026-10-29', 'gold'));
		expect(case1).toHaveLength(2);
		const case2 = addMedal(case1, medal('2026-10-29', 'silver'));
		expect(case2).toHaveLength(2);
		expect(case2.find((entry) => entry.day === '2026-10-29')?.tier).toBe('silver');
	});

	it('keeps the newest medals once it is full', () => {
		const many = Array.from({ length: MEDAL_CASE_SIZE + 10 }, (_, index) =>
			medal(`2026-01-${String((index % 28) + 1).padStart(2, '0')}`)
		);
		const filled = addMedal(many, medal('2026-12-31'));
		expect(filled).toHaveLength(MEDAL_CASE_SIZE);
		expect(filled.at(-1)?.day).toBe('2026-12-31');
	});

	it('counts the tiers and shows the newest first', () => {
		const medals = [
			medal('2026-10-01', 'gold'),
			medal('2026-10-02', 'silver'),
			medal('2026-10-03')
		];
		expect(medalCounts(medals)).toEqual({ bronze: 1, silver: 1, gold: 1 });
		expect(recentMedals(medals).map((entry) => entry.day)).toEqual([
			'2026-10-03',
			'2026-10-02',
			'2026-10-01'
		]);
	});
});

describe('the contest in the career profile', () => {
	it('pays the medal through a finished run, outside the daily cap', () => {
		const profile = newCareer(DAY1);
		const mode = profile.contest.mode;
		const first = awardRun(profile, { mode, score: 100, outcome: 'won', isNewBest: true }, DAY1);
		expect(first.contest?.tier).toBe('bronze');
		expect(first.contest?.improved).toBe(true);
		expect(first.profile.medals).toHaveLength(1);
		expect(first.profile.coins).toBe(profile.coins + first.coins);
		expect(first.coins).toBe(first.runCoins + first.levelCoins + 20);
	});

	it('moves the contest on to the new day', () => {
		const profile = awardRun(
			newCareer(DAY1),
			{
				mode: newCareer(DAY1).contest.mode,
				score: 100,
				outcome: 'won',
				isNewBest: true
			},
			DAY1
		).profile;
		expect(profile.contest.best).toBe(100);
		const next = awardRun(
			profile,
			{ mode: 'blocks', score: 5, outcome: 'lost', isNewBest: false },
			DAY2
		);
		expect(next.profile.contest.day).toBe(dayKey(DAY2));
		expect(next.profile.contest.best).toBe(0);
		expect(next.profile.medals).toHaveLength(1);
	});

	it('keeps medals and owned items across a save', () => {
		const saved = awardRun(
			newCareer(DAY1),
			{
				mode: newCareer(DAY1).contest.mode,
				score: 100,
				outcome: 'won',
				isNewBest: true
			},
			DAY1
		).profile;
		const loaded = parseCareer(
			JSON.parse(JSON.stringify({ ...saved, unlocked: ['tophat'] })),
			DAY1
		);
		expect(loaded?.medals).toHaveLength(1);
		expect(loaded?.unlocked).toEqual(['tophat']);
	});

	it('gives an old save a contest and an empty case', () => {
		const old: Record<string, unknown> = { ...newCareer(DAY1) };
		delete old.contest;
		delete old.medals;
		delete old.unlocked;
		const loaded = parseCareer(old, DAY1);
		expect(loaded?.contest.day).toBe(dayKey(DAY1));
		expect(loaded?.contest.best).toBe(0);
		expect(loaded?.medals).toEqual([]);
		expect(loaded?.unlocked).toEqual([]);
	});
});

describe('the contest messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['contest_'])).toEqual([]);
	});

	it('name the same parameters in every language', () => {
		const keys = messageKeys(['contest_']);
		expect(keys).toContain('contest_case');
		for (const locale of locales) {
			const messages = loadMessages(locale);
			for (const key of keys) {
				expect(messageParameters(messages[key])).toEqual(
					messageParameters(loadMessages('en')[key])
				);
			}
		}
	});
});

/*
 * Daily quests: three a day, the same for everyone on the same day (seeded from the date), such
 * as defeating so many drones, surviving a few minutes in one raid or finding crystals. Raids add
 * their progress when they end; a finished quest is claimed in the lobby for XP (which also
 * climbs the season track) and gold or scrap.
 */
import { createRandom, dayKey, randomInt, seedFromString } from '#lib/game/random.js';
import type { Archetype, MapId } from './config';
import { mapsOfDay } from './rotation';

export const QUEST_KINDS = [
	'kills',
	'drones',
	'support',
	'survive',
	'boss',
	'crystals',
	'damage',
	'skills',
	'map'
] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

export const QUESTS_PER_DAY = 3;

export interface Quest {
	kind: QuestKind;
	target: number;
	/** The battlefield a map quest asks for */
	map?: MapId;
	progress: number;
	claimed: boolean;
	reward: { xp: number; gold: number; scrap: number };
}

export interface DailyQuests {
	/** The day, such as "2026-10-24" */
	day: string;
	quests: Quest[];
}

/** What a finished raid counts towards the quests */
export interface QuestStats {
	map: MapId;
	timeMs: number;
	kills: number;
	killsBy: Record<Archetype, number>;
	bossKills: number;
	crystals: number;
	damage: number;
	skillsUsed: number;
}

/** The possible goals of each kind, from easy to hard */
const TARGETS: Record<QuestKind, readonly number[]> = {
	kills: [60, 100, 150],
	drones: [8, 12, 20],
	support: [4, 6, 10],
	// Minutes in a single raid
	survive: [4, 6, 8],
	boss: [1],
	crystals: [1, 2, 3],
	damage: [15_000, 30_000, 60_000],
	skills: [10, 20, 30],
	map: [1]
};

/** The day's three quests: three different kinds, each with its goal and reward */
export function dailyQuests(day: string): DailyQuests {
	const random = createRandom(seedFromString(`raid-quests:${day}`));
	const kinds = [...QUEST_KINDS];
	const quests: Quest[] = [];
	for (let i = 0; i < QUESTS_PER_DAY; i++) {
		const kind = kinds.splice(randomInt(random, 0, kinds.length), 1)[0];
		const targets = TARGETS[kind];
		const step = randomInt(random, 0, targets.length);
		const hard = targets.length > 1 ? step / (targets.length - 1) : 0;
		const quest: Quest = {
			kind,
			target: targets[step],
			progress: 0,
			claimed: false,
			reward: {
				xp: Math.round(150 + 150 * hard),
				gold: i % 2 === 0 ? Math.round(80 + 80 * hard) : 0,
				scrap: i % 2 === 1 ? Math.round(20 + 20 * hard) : 0
			}
		};
		// Only the day's two battlefields are open, so the quest picks one of them
		if (kind === 'map') quest.map = mapsOfDay(day)[randomInt(random, 0, 2)];
		quests.push(quest);
	}
	return { day, quests };
}

/** Whole hours (at least one) until local midnight, when the next quests come */
export function hoursUntilNewQuests(now: number): number {
	const midnight = new Date(now);
	midnight.setHours(24, 0, 0, 0);
	return Math.max(1, Math.ceil((midnight.getTime() - now) / 3_600_000));
}

export function newDailyQuests(now: Date = new Date()): DailyQuests {
	return dailyQuests(dayKey(now));
}

/** How far one raid gets a quest; survival counts the best single raid, the rest add up */
function raidProgress(quest: Quest, stats: QuestStats): number {
	switch (quest.kind) {
		case 'kills':
			return stats.kills;
		case 'drones':
			return stats.killsBy.drone ?? 0;
		case 'support':
			return (
				(stats.killsBy.medic ?? 0) + (stats.killsBy.mortar ?? 0) + (stats.killsBy.artillery ?? 0)
			);
		case 'survive':
			return Math.floor(stats.timeMs / 60_000);
		case 'boss':
			return stats.bossKills;
		case 'crystals':
			return stats.crystals;
		case 'damage':
			return Math.round(stats.damage);
		case 'skills':
			return stats.skillsUsed;
		case 'map':
			return stats.map === quest.map ? 1 : 0;
	}
}

/** Adds a finished raid to the quests */
export function addRaidToQuests(daily: DailyQuests, stats: QuestStats): DailyQuests {
	return {
		...daily,
		quests: daily.quests.map((quest) => {
			const gained = raidProgress(quest, stats);
			const progress =
				quest.kind === 'survive' ? Math.max(quest.progress, gained) : quest.progress + gained;
			return { ...quest, progress: Math.min(quest.target, progress) };
		})
	};
}

export const questDone = (quest: Quest) => quest.progress >= quest.target;

/**
 * The enemy types the open quests still ask to be killed, for the minimap. A quest that names no
 * type (all the kills of a hunt, crystals, damage, skills, a map) marks nothing in particular, so
 * the map keeps its filter instead of showing every enemy.
 */
export function questKillTargets(quests: readonly Quest[]): Archetype[] {
	const targets = new Set<Archetype>();
	for (const quest of quests) {
		if (questDone(quest)) continue;
		switch (quest.kind) {
			case 'drones':
				targets.add('drone');
				break;
			case 'support':
				targets.add('medic');
				targets.add('mortar');
				targets.add('artillery');
				break;
			case 'boss':
				targets.add('boss');
				break;
		}
	}
	return [...targets];
}

export function isDailyQuests(value: unknown): value is DailyQuests {
	if (typeof value !== 'object' || value === null) return false;
	const { day, quests } = value as Record<string, unknown>;
	return (
		typeof day === 'string' &&
		/^\d{4}-\d{2}-\d{2}$/.test(day) &&
		Array.isArray(quests) &&
		quests.length <= QUESTS_PER_DAY &&
		quests.every(
			(quest) =>
				typeof quest === 'object' &&
				quest !== null &&
				(QUEST_KINDS as readonly unknown[]).includes(quest.kind) &&
				typeof quest.target === 'number' &&
				typeof quest.progress === 'number' &&
				typeof quest.claimed === 'boolean' &&
				typeof quest.reward === 'object' &&
				quest.reward !== null
		)
	);
}

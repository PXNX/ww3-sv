import { describe, expect, it } from 'vitest';
import type { Quest, QuestKind } from './quests';
import { questKillTargets } from './quests';

function quest(kind: QuestKind, progress = 0, target = 10): Quest {
	return { kind, target, progress, claimed: false, reward: { xp: 0, gold: 0, scrap: 0 } };
}

describe('quest kill targets', () => {
	it('marks the enemies a drone, support or boss quest asks for', () => {
		expect(questKillTargets([quest('drones')])).toEqual(['drone']);
		expect(questKillTargets([quest('support')])).toEqual(['medic', 'mortar', 'artillery']);
		expect(questKillTargets([quest('boss', 0, 1)])).toEqual(['boss']);
	});

	it('combines the enemies of several open quests without repeats', () => {
		const targets = questKillTargets([quest('drones'), quest('support'), quest('boss', 0, 1)]);
		expect(new Set(targets)).toEqual(new Set(['drone', 'medic', 'mortar', 'artillery', 'boss']));
	});

	it('marks nothing for a finished quest', () => {
		expect(questKillTargets([quest('drones', 12, 12)])).toEqual([]);
	});

	it('marks nothing for a quest that names no enemy type', () => {
		expect(
			questKillTargets([quest('kills', 0, 60), quest('survive', 0, 4), quest('crystals', 0, 2)])
		).toEqual([]);
	});
});

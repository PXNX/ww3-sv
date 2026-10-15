import {
	BASE_MAX_CRATES,
	BASE_SLACK,
	BASE_SPAWN_MS,
	BASE_SPEED,
	LICENCE_ROUND,
	MAX_CRATES_CAP,
	MAX_SPEED,
	MIN_SLACK,
	MIN_SPAWN_MS,
	QUOTA_ROUND,
	ROUND_MS,
	SECOND_RULE_ROUND,
	SLACK_LOSS,
	SPAWN_FACTOR,
	SPEED_GAIN,
	THIRD_ELEMENT_ROUND
} from './config.js';
import type { RuleKind } from './rules.js';

/** The round (1 and up) a point in game time falls in */
export function roundAt(elapsedMs: number): number {
	return 1 + Math.floor(Math.max(0, elapsedMs) / ROUND_MS);
}

export interface Difficulty {
	round: number;
	/** Map units per second */
	speed: number;
	spawnEveryMs: number;
	/** Deadline multiplier over the trip time */
	slack: number;
	maxCrates: number;
	/** How many different elements the mines produce */
	elements: number;
	/** Rules that may be in force or announced at once */
	maxRules: number;
	/** The kinds of notice the ministry may issue by now */
	ruleKinds: readonly RuleKind[];
}

export function difficulty(round: number): Difficulty {
	const r = Math.max(1, Math.floor(round));
	const ruleKinds: RuleKind[] = ['ban', 'tariff'];
	if (r >= QUOTA_ROUND) ruleKinds.push('quota');
	if (r >= LICENCE_ROUND) ruleKinds.push('licence');
	return {
		round: r,
		speed: Math.min(MAX_SPEED, BASE_SPEED + SPEED_GAIN * (r - 1)),
		spawnEveryMs: Math.max(MIN_SPAWN_MS, BASE_SPAWN_MS * SPAWN_FACTOR ** (r - 1)),
		slack: Math.max(MIN_SLACK, BASE_SLACK - SLACK_LOSS * (r - 1)),
		maxCrates: Math.min(MAX_CRATES_CAP, BASE_MAX_CRATES + Math.floor((r - 1) / 2)),
		elements: r >= THIRD_ELEMENT_ROUND ? 3 : 2,
		maxRules: r >= SECOND_RULE_ROUND ? 2 : 1,
		ruleKinds
	};
}

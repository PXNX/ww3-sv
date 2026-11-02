/*
 * Software the unit can buy with the DogeLite it siphons, all fictional and abstract like the rest
 * of Hermit Hackers:
 *
 *   - Breach Suite, Keylogger and Relay Breaker make their stage easier.
 *   - The Cryptominer runs on the player's own machine and pays a little DogeLite every second.
 *   - The Wallet Siphon sits on the target and drains a share of its wallet once a day.
 *
 * Levels only ever go up within a run: a new run starts with an empty toolkit.
 */
import type { ContractSpec } from './config';
import { contractSpec, TRACE_WRONG_GUESS } from './config';
import { emptyHardware, hardwareEffects, type Hardware } from './hardware';

export type ToolId = 'breach' | 'keylog' | 'relays' | 'miner' | 'siphon' | 'bruteforce' | 'worm' | 'rootkit' | 'backdoor';

export type Upgrades = Record<ToolId, number>;

export interface ToolSpec {
	id: ToolId;
	maxLevel: number;
	/** Cost of the first level */
	baseCost: number;
	/** Every further level costs this much more than the one before */
	costGrowth: number;
}

export const TOOL_SPECS: readonly ToolSpec[] = [
	{ id: 'breach', maxLevel: 5, baseCost: 60, costGrowth: 1.9 },
	{ id: 'keylog', maxLevel: 5, baseCost: 80, costGrowth: 1.85 },
	{ id: 'relays', maxLevel: 5, baseCost: 100, costGrowth: 1.85 },
	{ id: 'miner', maxLevel: 8, baseCost: 120, costGrowth: 1.7 },
	{ id: 'siphon', maxLevel: 5, baseCost: 200, costGrowth: 1.9 },
	/** Auto-cracks the breach stage using botnet nodes and cable speed */
	{ id: 'bruteforce', maxLevel: 5, baseCost: 160, costGrowth: 1.85 },
	/** Keeps keylogger running across contracts — bought with data */
	{ id: 'worm', maxLevel: 3, baseCost: 250, costGrowth: 2 },
	/** Cuts every trace creep — bought with data */
	{ id: 'rootkit', maxLevel: 3, baseCost: 300, costGrowth: 2 },
	/** Doubles siphon share — bought with data */
	{ id: 'backdoor', maxLevel: 3, baseCost: 350, costGrowth: 2 }
];

export function toolSpec(id: ToolId): ToolSpec {
	return TOOL_SPECS.find((tool) => tool.id === id) ?? TOOL_SPECS[0];
}

export function emptyUpgrades(): Upgrades {
	return { breach: 0, keylog: 0, relays: 0, miner: 0, siphon: 0, bruteforce: 0, worm: 0, rootkit: 0, backdoor: 0 };
}

/** What the next level of a tool costs; null once it is maxed */
export function upgradeCost(id: ToolId, level: number): number | null {
	const spec = toolSpec(id);
	if (level >= spec.maxLevel) return null;
	return Math.round(spec.baseCost * spec.costGrowth ** level);
}

/** Every level of the breach suite buys one more attempt and softer wrong guesses */
const BREACH_TRACE_RELIEF = 0.85;
/** Every level of the keylogger slows the keystroke stream down */
const KEYLOG_SLOWDOWN = 0.15;
/** Every level of the relay breaker slows the alarm's trace creep */
const RELAY_CREEP_RELIEF = 0.85;

/** Extra access attempts the breach suite buys */
export function breachAttempts(upgrades: Upgrades): number {
	return upgrades.breach;
}

/** Trace a wrong access code costs with the breach suite installed */
export function wrongGuessTrace(upgrades: Upgrades): number {
	return TRACE_WRONG_GUESS * BREACH_TRACE_RELIEF ** upgrades.breach;
}

/** Multiplier on the keystroke timings: higher is slower, so easier */
export function keylogSpeed(upgrades: Upgrades): number {
	return 1 + KEYLOG_SLOWDOWN * upgrades.keylog;
}

/** Multiplier on the relay stage's trace creep: lower is slower */
export function relayCreep(upgrades: Upgrades): number {
	return RELAY_CREEP_RELIEF ** upgrades.relays;
}

/** Extra access attempts bought with the bruteforce tool */
export function bruteAttempts(upgrades: Upgrades): number {
	return upgrades.bruteforce;
}

/** Speed boost from worm (keylog stream slower) */
export function wormSlowdown(upgrades: Upgrades): number {
	return upgrades.worm > 0 ? 0.85 : 1;
}

/** All-stage creep reduction from rootkit */
export function rootkitCreep(upgrades: Upgrades): number {
	return upgrades.rootkit > 0 ? 0.85 : 1;
}

/** Extra siphon share from backdoor */
export function backdoorShare(upgrades: Upgrades): number {
	return 0.05 * upgrades.backdoor;
}

/** For the shop: how much less trace a wrong guess costs, in percent */
export function breachReliefPercent(upgrades: Upgrades): number {
	return Math.round((1 - BREACH_TRACE_RELIEF ** upgrades.breach) * 100);
}

/** For the shop: how much slower the keystroke stream runs, in percent */
export function keylogSlowdownPercent(upgrades: Upgrades): number {
	return Math.round(KEYLOG_SLOWDOWN * upgrades.keylog * 100);
}

/** For the shop: how much slower the alarm trace creeps, in percent */
export function relayReliefPercent(upgrades: Upgrades): number {
	return Math.round((1 - RELAY_CREEP_RELIEF ** upgrades.relays) * 100);
}

/** The contract numbers with the bought tools and the unit's own machine folded in */
export function effectiveSpec(
	n: number,
	upgrades: Upgrades,
	hardware: Hardware = emptyHardware(),
	botnet: { nodes: number } = { nodes: 0 }
): ContractSpec {
	const base = contractSpec(n);
	const slow = keylogSpeed(upgrades);
	const ram = hardwareEffects(hardware).creepMultiplier;
	const crawl = rootkitCreep(upgrades);
	const creep = {
		breach: base.creep.breach * ram * crawl,
		keylog: base.creep.keylog * ram * crawl,
		breaker: base.creep.breaker * relayCreep(upgrades) * ram * crawl
	};
	// Worm: keylog stream is effectively slower, reflected in chip/spawn
	// Backdoor: siphon share bump already in siphonShare()
	return {
		...base,
		maxAttempts: base.maxAttempts + breachAttempts(upgrades),
		chipMs: Math.round(base.chipMs * slow * wormSlowdown(upgrades)),
		spawnMs: Math.round(base.spawnMs * slow * wormSlowdown(upgrades)),
		creep
	};
}

/** DogeLite a second the miner on the player's own machine pays */
export const MINER_INCOME_PER_LEVEL = 3;

export function minerIncome(upgrades: Upgrades, hardware: Hardware = emptyHardware()): number {
	return upgrades.miner * MINER_INCOME_PER_LEVEL * hardwareEffects(hardware).minerMultiplier;
}

/** One target day of the siphon clock */
export const SIPHON_DAY_MS = 20000;

/** The share of the target's wallet the siphon takes per day */
export function siphonShare(upgrades: Upgrades, hardware: Hardware = emptyHardware()): number {
	if (upgrades.siphon <= 0) return 0;
	return Math.min(1, 0.15 + 0.1 * upgrades.siphon + hardwareEffects(hardware).siphonBonus + backdoorShare(upgrades));
}

/** What a target's wallet holds on the contract of that number */
export function walletFor(n: number): number {
	const level = Math.max(1, Math.floor(n));
	return 250 + 150 * (level - 1);
}

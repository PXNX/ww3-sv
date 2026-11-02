/*
 * The unit's own machine. Hardware is bought with DogeLite banked from finished runs and kept
 * forever: a better CPU mines more, more RAM leaves room before the trace meter fills, and a
 * better GPU cracks the target's wallet harder. All names here are made up on purpose.
 */
import { isFiniteNumber } from '#lib/services/storage.js';

export type HardwareId = 'cpu' | 'ram' | 'gpu';

export type Hardware = Record<HardwareId, number>;

export interface HardwareSpec {
	id: HardwareId;
	maxLevel: number;
	/** Cost of the first level */
	baseCost: number;
	/** Every further level costs this much more than the one before */
	costGrowth: number;
}

export const HARDWARE_SPECS: readonly HardwareSpec[] = [
	{ id: 'cpu', maxLevel: 5, baseCost: 150, costGrowth: 1.9 },
	{ id: 'ram', maxLevel: 5, baseCost: 120, costGrowth: 1.8 },
	{ id: 'gpu', maxLevel: 5, baseCost: 200, costGrowth: 2 }
];

/** Fictional part names, indexed by level */
const CPU_NAMES = [
	'Celeron "Dumpster"',
	'Ryzen 5 "Basement"',
	'Ryzen 7 "Backroom"',
	'Ryzen 9 "Blackout"',
	'Threadripper "Bunker"',
	'EPYC "Deep State"'
] as const;
const GPU_NAMES = [
	'GeForce "Paperweight"',
	'Radeon "Sleeper"',
	'Radeon "Nightshift"',
	'GeForce "Ledger"',
	'Radeon "Vaultcracker"',
	'Instinct "Siphon"'
] as const;

export function emptyHardware(): Hardware {
	return { cpu: 0, ram: 0, gpu: 0 };
}

export function hardwareSpec(id: HardwareId): HardwareSpec {
	return HARDWARE_SPECS.find((spec) => spec.id === id) ?? HARDWARE_SPECS[0];
}

/** What the next level of a part costs; null once it is maxed */
export function hardwareCost(id: HardwareId, level: number): number | null {
	const spec = hardwareSpec(id);
	if (level >= spec.maxLevel) return null;
	return Math.round(spec.baseCost * spec.costGrowth ** level);
}

export interface HardwareEffects {
	/** Multiplier on the miner's DogeLite per second */
	minerMultiplier: number;
	/** Multiplier on the trace creep of every stage: lower is slower */
	creepMultiplier: number;
	/** Extra share of the target's wallet the siphon takes per day */
	siphonBonus: number;
}

export function hardwareEffects(hardware: Hardware): HardwareEffects {
	return {
		minerMultiplier: 1 + 0.25 * hardware.cpu,
		creepMultiplier: 0.96 ** hardware.ram,
		siphonBonus: 0.05 * hardware.gpu
	};
}

export function cpuName(hardware: Hardware): string {
	return CPU_NAMES[Math.min(hardware.cpu, CPU_NAMES.length - 1)];
}

export function gpuName(hardware: Hardware): string {
	return GPU_NAMES[Math.min(hardware.gpu, GPU_NAMES.length - 1)];
}

/** Made-up RAM size, 8 GB at level 0 and 8 GB more per level */
export function ramGb(hardware: Hardware): number {
	return 8 * (hardware.ram + 1);
}

/** Storage guard: a hardware record with every level present and inside its bounds */
export function isHardware(value: unknown): value is Hardware {
	if (!value || typeof value !== 'object') return false;
	return HARDWARE_SPECS.every((spec) => {
		const level = (value as Record<string, unknown>)[spec.id];
		return isFiniteNumber(level) && Number.isInteger(level) && level >= 0 && level <= spec.maxLevel;
	});
}

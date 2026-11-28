/*
 * GPU Grid: Novideo's scheduler. Each turn a compute job arrives and the player sends it to one of
 * three racks. Racks cool between turns but overheat if fed too much; a cool rack pays more for the
 * same job. Ten jobs, three heat alarms, and Huang watches the thermals.
 */
import { pickWeighted, type Random } from '#lib/game/random.js';

export const RACKS = 3 as const;
export const JOBS = 10;
export const MAX_HEAT = 100;
export const ALARM_HEAT = 85;
export const COOL_PER_TURN = 12;
export const MAX_ALARMS = 3;

export interface Job {
	/** Compute units; hotter and more valuable */
	size: 1 | 2 | 3;
	label: 'inference' | 'training' | 'render';
}

export interface GpuGridState {
	turn: number;
	heat: number[];
	score: number;
	alarms: number;
	status: 'playing' | 'won' | 'lost';
	job: Job | null;
	last: { rack: number; heat: number; points: number } | null;
}

const JOB_KINDS: readonly { item: Job['label']; weight: number; size: Job['size'] }[] = [
	{ item: 'inference', weight: 4, size: 1 },
	{ item: 'training', weight: 3, size: 2 },
	{ item: 'render', weight: 2, size: 3 }
];

const clamp = (value: number) => Math.min(MAX_HEAT, Math.max(0, value));

function nextJob(random: Random): Job {
	const label = pickWeighted(random, JOB_KINDS);
	const size = JOB_KINDS.find((entry) => entry.item === label)!.size;
	return { label, size };
}

export function createGpuGrid(random: Random): GpuGridState {
	return {
		turn: 0,
		heat: [10, 10, 10],
		score: 0,
		alarms: 0,
		status: 'playing',
		job: nextJob(random),
		last: null
	};
}

/** Sends the current job to a rack; the whole grid cools by one turn afterwards */
export function assign(state: GpuGridState, rack: number, random: Random): GpuGridState {
	if (state.status !== 'playing' || !state.job || rack < 0 || rack >= RACKS) return state;
	const before = state.heat[rack]!;
	const job = state.job;
	const heat = clamp(before + job.size * 16);
	const alarm = heat >= ALARM_HEAT;
	// A cool rack runs the job faster and pays more
	const points = alarm ? 0 : Math.round((10 + job.size * 12) * (1 - before / (ALARM_HEAT * 1.5)));
	const alarms = state.alarms + (alarm ? 1 : 0);
	const turn = state.turn + 1;
	const status = alarms >= MAX_ALARMS ? 'lost' : turn >= JOBS ? 'won' : 'playing';
	return {
		...state,
		turn,
		heat: state.heat.map((value, index) => clamp(index === rack ? heat : value - COOL_PER_TURN)),
		score: state.score + points,
		alarms,
		status,
		job: status === 'playing' ? nextJob(random) : null,
		last: { rack, heat, points }
	};
}

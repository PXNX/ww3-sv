import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { neutralModifiers, type GridEvent } from './events.js';
import {
	availableOutput,
	averageCleanShare,
	averageIntensity,
	averagePrice,
	baseDemand,
	createGrid,
	dayNumber,
	demandAt,
	demandForecast,
	frequency,
	GRACE_HOURS,
	growth,
	imbalanceShare,
	pointsPerHour,
	reactionsOf,
	recentNuclearFlips,
	setTarget,
	START_HOUR,
	stepGrid,
	STARTING_LIVES,
	sunShape,
	TOLERANCE,
	unitCost,
	windShape,
	type GridState
} from './grid.js';
import {
	BATTERY_EFFICIENCY,
	BATTERY_ENERGY,
	SOURCE_IDS,
	SOURCES,
	type SourceId
} from './sources.js';

const DT = 0.04;

function newGrid(seed = 1) {
	return { state: createGrid(createRandom(seed)), random: createRandom(seed + 100) };
}

function run(state: GridState, random: () => number, hours: number, before?: () => void) {
	const reports: ReturnType<typeof stepGrid> = [];
	const steps = Math.round(hours / DT);
	for (let i = 0; i < steps && !state.over; i++) {
		before?.();
		reports.push(...stepGrid(state, DT, random));
	}
	return reports;
}

/** Keeps the grid balanced like a careful player would: hydro, then gas, imports and coal up and down */
function autopilot(state: GridState) {
	const gap = state.demand - state.supply;
	const up: SourceId[] = ['hydro', 'gas', 'imports', 'coal'];
	const down: SourceId[] = ['imports', 'gas', 'coal', 'hydro', 'wind'];
	let remaining = gap;
	for (const id of gap > 0 ? up : down) {
		if (Math.abs(remaining) < 0.01) break;
		const available = Math.max(
			availableOutput(id, state.hour, state.weather, neutralModifiers()),
			1e-6
		);
		const current = state.outputs[id];
		const wanted = Math.min(available, Math.max(0, current + remaining));
		remaining -= wanted - current;
		setTarget(state, id, wanted / available);
	}
}

describe('demand and weather curves', () => {
	it('is low at night, high in the evening and repeats every day', () => {
		expect(baseDemand(3)).toBeLessThan(baseDemand(12));
		expect(baseDemand(12)).toBeLessThan(baseDemand(20));
		expect(baseDemand(5)).toBeCloseTo(baseDemand(5 + 24 * 3), 8);
		expect(baseDemand(24)).toBeCloseTo(baseDemand(0), 8);
	});

	it('changes smoothly through the day', () => {
		for (let hour = 0; hour < 48; hour += 0.25) {
			expect(Math.abs(baseDemand(hour + 0.25) - baseDemand(hour))).toBeLessThan(5);
		}
	});

	it('grows a little each day and then stops', () => {
		expect(growth(0)).toBe(1);
		expect(growth(3)).toBeGreaterThan(growth(1));
		expect(growth(100)).toBe(growth(50));
	});

	it('scales the demand with drift and events', () => {
		const calm = neutralModifiers();
		const hot = { ...neutralModifiers(), demand: 1.2 };
		expect(demandAt(12, 1, hot)).toBeCloseTo(demandAt(12, 1, calm) * 1.2, 8);
		expect(demandAt(12, 1.05, calm)).toBeGreaterThan(demandAt(12, 1, calm));
	});

	it('has no sun at night and the most at noon', () => {
		expect(sunShape(2)).toBe(0);
		expect(sunShape(23)).toBe(0);
		expect(sunShape(13)).toBeGreaterThan(sunShape(9));
		expect(sunShape(13)).toBeCloseTo(1, 1);
	});

	it('gives no wind in a calm and everything in a stiff breeze', () => {
		expect(windShape(0.05)).toBe(0);
		expect(windShape(0.9)).toBe(1);
		expect(windShape(0.4)).toBeGreaterThan(windShape(0.3));
	});

	it('keeps weather and drift inside their bounds over a long run', () => {
		const { state, random } = newGrid(3);
		for (let i = 0; i < 4000; i++) {
			stepGrid(state, DT, random);
			expect(state.weather.wind).toBeGreaterThanOrEqual(0);
			expect(state.weather.wind).toBeLessThanOrEqual(1);
			expect(state.weather.clear).toBeGreaterThanOrEqual(0.3);
			expect(state.weather.clear).toBeLessThanOrEqual(1);
			expect(state.drift).toBeGreaterThanOrEqual(0.94);
			expect(state.drift).toBeLessThanOrEqual(1.06);
			if (state.over) break;
		}
	});
});

describe('the sources', () => {
	it('has nine sources, each with a ramp, a cost and emissions', () => {
		expect(SOURCE_IDS).toHaveLength(9);
		for (const id of SOURCE_IDS) {
			const spec = SOURCES[id];
			expect(spec.capacity).toBeGreaterThan(0);
			expect(spec.ramp).toBeGreaterThan(0);
			expect(spec.cost).toBeGreaterThan(0);
			expect(spec.co2).toBeGreaterThanOrEqual(0);
		}
	});

	it('orders the plants as expected: nuclear ramps slowest, gas fastest, coal dirtiest', () => {
		expect(SOURCES.nuclear.ramp).toBeLessThan(SOURCES.coal.ramp);
		expect(SOURCES.coal.ramp).toBeLessThan(SOURCES.gas.ramp);
		expect(SOURCES.coal.co2).toBeGreaterThan(SOURCES.gas.co2);
		expect(SOURCES.gas.co2).toBeGreaterThan(SOURCES.nuclear.co2);
		expect(SOURCES.gas.cost).toBeGreaterThan(SOURCES.coal.cost);
	});

	it('makes wind depend on the wind, solar on the sun and hydro on the water', () => {
		const calm = neutralModifiers();
		const weather = { wind: 0.05, clear: 1 };
		const breezy = { wind: 0.7, clear: 1 };
		expect(availableOutput('wind', 12, weather, calm)).toBe(0);
		expect(availableOutput('wind', 12, breezy, calm)).toBeCloseTo(SOURCES.wind.capacity, 5);
		expect(availableOutput('solar', 2, breezy, calm)).toBe(0);
		expect(availableOutput('solar', 13, breezy, calm)).toBeGreaterThan(20);
		expect(availableOutput('solar', 13, { wind: 0.5, clear: 0.3 }, calm)).toBeLessThan(8);
		expect(availableOutput('hydro', 12, breezy, { ...calm, water: 0.35 })).toBeLessThan(
			availableOutput('hydro', 12, breezy, calm)
		);
		expect(availableOutput('coal', 3, weather, calm)).toBe(SOURCES.coal.capacity);
	});

	it('makes imports dearer when the demand is high, and events dearer still', () => {
		const calm = neutralModifiers();
		expect(unitCost('imports', 65, calm)).toBeGreaterThan(unitCost('imports', 40, calm));
		expect(unitCost('gas', 50, { ...calm, price: { ...calm.price, gas: 2 } })).toBe(240);
		expect(unitCost('coal', 50, calm)).toBe(SOURCES.coal.cost);
	});
});

describe('starting a game', () => {
	it('opens balanced, with full lives, a calm clock and no flips', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const { state } = newGrid(seed);
			expect(Math.abs(imbalanceShare(state.supply, state.demand))).toBeLessThan(TOLERANCE);
			expect(state.lives).toBe(STARTING_LIVES);
			expect(state.hour).toBe(START_HOUR);
			expect(dayNumber(state)).toBe(1);
			expect(state.stress).toBe(0);
			expect(state.nuclearFlips).toEqual([]);
		}
	});

	it('starts with the base plants warm and the others cold', () => {
		const { state } = newGrid();
		expect(state.online.coal).toBe(true);
		expect(state.online.nuclear).toBe(true);
		expect(state.online.biomass).toBe(false);
		expect(state.outputs.biomass).toBe(0);
	});

	it('stays balanced when nothing is touched for the first minutes of game time', () => {
		const { state, random } = newGrid(2);
		run(state, random, 0.5);
		expect(Math.abs(imbalanceShare(state.supply, state.demand))).toBeLessThan(0.1);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('does not start anything at an unknown hour or with a zero step', () => {
		const { state, random } = newGrid();
		const hour = state.hour;
		expect(stepGrid(state, 0, random)).toEqual([]);
		expect(state.hour).toBe(hour);
	});
});

describe('ramping', () => {
	it('moves an output no faster than the ramp allows', () => {
		const { state, random } = newGrid();
		setTarget(state, 'coal', 1);
		const before = state.outputs.coal;
		stepGrid(state, DT, random);
		const delta = state.outputs.coal - before;
		expect(delta).toBeGreaterThan(0);
		expect(delta).toBeLessThanOrEqual(SOURCES.coal.ramp * SOURCES.coal.capacity * DT + 1e-9);
	});

	it('lets gas follow much faster than coal and nuclear', () => {
		const { state, random } = newGrid();
		setTarget(state, 'gas', 0);
		setTarget(state, 'coal', 0);
		setTarget(state, 'nuclear', 0);
		const before = { ...state.outputs };
		run(state, random, 0.5);
		const dropped = (id: SourceId) => (before[id] - state.outputs[id]) / SOURCES[id].capacity;
		expect(dropped('gas')).toBeGreaterThan(dropped('coal'));
		expect(dropped('coal')).toBeGreaterThan(dropped('nuclear'));
	});

	it('never delivers more than the source can provide', () => {
		const { state, random } = newGrid(4);
		for (const id of SOURCE_IDS) setTarget(state, id, 1);
		const calm = neutralModifiers();
		for (let i = 0; i < 600; i++) {
			stepGrid(state, DT, random);
			for (const id of SOURCE_IDS) {
				if (id === 'batteries') continue;
				const available = availableOutput(id, state.hour, state.weather, calm);
				expect(state.outputs[id]).toBeLessThanOrEqual(available + 1e-6);
			}
			if (state.over) break;
		}
	});

	it('clamps targets to the allowed range', () => {
		const { state } = newGrid();
		setTarget(state, 'coal', 5);
		expect(state.targets.coal).toBe(1);
		setTarget(state, 'coal', -3);
		expect(state.targets.coal).toBe(0);
		setTarget(state, 'batteries', -4);
		expect(state.targets.batteries).toBe(-1);
		setTarget(state, 'batteries', Number.NaN);
		expect(state.targets.batteries).toBe(0);
	});
});

describe('cold starts', () => {
	it('keeps a cold plant silent for its start-up time, then lets it deliver', () => {
		const { state, random } = newGrid();
		expect(state.online.biomass).toBe(false);
		setTarget(state, 'biomass', 1);
		run(state, random, SOURCES.biomass.startupHours - 0.2);
		expect(state.outputs.biomass).toBe(0);
		expect(state.online.biomass).toBe(false);
		const reports = run(state, random, 0.5);
		expect(state.online.biomass).toBe(true);
		expect(reports).toContainEqual({ type: 'online', source: 'biomass' });
		run(state, random, 1);
		expect(state.outputs.biomass).toBeGreaterThan(0);
	});

	it('cancels the start-up when the player changes their mind', () => {
		const { state, random } = newGrid();
		setTarget(state, 'biomass', 1);
		run(state, random, 1);
		expect(state.warmup.biomass).not.toBeNull();
		setTarget(state, 'biomass', 0);
		run(state, random, 0.2);
		expect(state.warmup.biomass).toBeNull();
		expect(state.online.biomass).toBe(false);
	});

	it('needs no warm-up for wind, solar, hydro, batteries and imports', () => {
		const { state, random } = newGrid();
		setTarget(state, 'imports', 1);
		run(state, random, 0.4);
		expect(state.outputs.imports).toBeGreaterThan(0);
	});

	it('makes a shut-down nuclear plant take hours to come back', () => {
		const { state, random } = newGrid();
		setTarget(state, 'nuclear', 0);
		run(state, random, 12);
		expect(state.outputs.nuclear).toBe(0);
		expect(state.online.nuclear).toBe(false);
		setTarget(state, 'nuclear', 0.8);
		run(state, random, SOURCES.nuclear.startupHours - 0.5);
		expect(state.outputs.nuclear).toBe(0);
	});

	it('trips a plant that an outage takes away and makes it start cold afterwards', () => {
		const { state, random } = newGrid();
		const outage: GridEvent = {
			id: 1,
			kind: 'plant-outage',
			announcedAt: state.hour,
			startHour: state.hour,
			endHour: state.hour + 4,
			source: 'nuclear'
		};
		state.scheduler.active.push(outage);
		const reports = run(state, random, 0.2);
		expect(reports).toContainEqual({ type: 'tripped', source: 'nuclear' });
		expect(state.outputs.nuclear).toBe(0);
		expect(state.online.nuclear).toBe(false);
		// The outage is over after four hours, but the plant has to warm up again
		run(state, random, 4.2);
		expect(state.scheduler.active.some((e) => e.id === 1)).toBe(false);
		expect(state.outputs.nuclear).toBe(0);
	});
});

describe('nuclear flips', () => {
	it('counts every switch between on and off, and nothing else', () => {
		const { state } = newGrid();
		setTarget(state, 'nuclear', 0.6);
		expect(state.nuclearFlips).toHaveLength(0);
		setTarget(state, 'nuclear', 0);
		setTarget(state, 'nuclear', 0.9);
		expect(state.nuclearFlips).toHaveLength(2);
		setTarget(state, 'coal', 0);
		setTarget(state, 'coal', 1);
		expect(state.nuclearFlips).toHaveLength(2);
	});

	it('only remembers the recent ones', () => {
		const { state, random } = newGrid();
		setTarget(state, 'nuclear', 0);
		run(state, random, 1, () => autopilot(state));
		expect(recentNuclearFlips(state, 12)).toBe(1);
		run(state, random, 13, () => autopilot(state));
		expect(recentNuclearFlips(state, 12)).toBe(0);
	});

	it('annoys the Critic after one flip and outrages her after two', () => {
		const { state } = newGrid();
		expect(reactionsOf(state).woman).not.toBe('outraged');
		setTarget(state, 'nuclear', 0);
		expect(reactionsOf(state)).toMatchObject({ woman: 'annoyed', womanReason: 'nuclear' });
		setTarget(state, 'nuclear', 1);
		expect(reactionsOf(state)).toMatchObject({ woman: 'outraged', womanReason: 'nuclear' });
	});
});

describe('batteries', () => {
	it('discharge into the grid and drain the cells with some loss', () => {
		const { state, random } = newGrid();
		const start = state.soc;
		setTarget(state, 'batteries', 1);
		run(state, random, 0.5);
		expect(state.outputs.batteries).toBeGreaterThan(0);
		expect(state.soc).toBeLessThan(start);
		expect(start - state.soc).toBeGreaterThan(0);
	});

	it('charge from the grid and store less than they took', () => {
		const { state, random } = newGrid();
		state.soc = 0;
		setTarget(state, 'batteries', -1);
		let taken = 0;
		for (let i = 0; i < 25; i++) {
			stepGrid(state, DT, random);
			taken += -state.outputs.batteries * DT;
		}
		expect(state.outputs.batteries).toBeLessThan(0);
		expect(state.soc).toBeGreaterThan(0);
		expect(state.soc).toBeCloseTo(taken * BATTERY_EFFICIENCY, 5);
	});

	it('stop delivering when empty and stop charging when full', () => {
		const { state, random } = newGrid();
		state.soc = 0;
		setTarget(state, 'batteries', 1);
		run(state, random, 0.2);
		expect(state.outputs.batteries).toBeLessThan(0.5);
		expect(state.soc).toBeGreaterThanOrEqual(0);

		state.soc = BATTERY_ENERGY;
		setTarget(state, 'batteries', -1);
		run(state, random, 0.2);
		expect(state.soc).toBeLessThanOrEqual(BATTERY_ENERGY);
		expect(state.outputs.batteries).toBeGreaterThan(-0.5);
	});

	it('count against the supply while they charge', () => {
		const { state, random } = newGrid();
		setTarget(state, 'batteries', -1);
		run(state, random, 0.3);
		const others = SOURCE_IDS.filter((id) => id !== 'batteries').reduce(
			(sum, id) => sum + state.outputs[id],
			0
		);
		expect(state.supply).toBeCloseTo(others + state.outputs.batteries, 8);
		expect(state.supply).toBeLessThan(others);
	});
});

describe('balance and trips', () => {
	it('stays steady for a whole morning with a simple controller', () => {
		const { state, random } = newGrid(7);
		run(state, random, 14, () => autopilot(state));
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.blackouts + state.overloads).toBe(0);
		expect(state.score).toBeGreaterThan(40);
	});

	it('trips with a blackout when supply is far too low', () => {
		const { state, random } = newGrid();
		for (const id of SOURCE_IDS) setTarget(state, id, id === 'wind' || id === 'solar' ? 1 : 0);
		const reports = run(state, random, 6);
		expect(reports).toContainEqual({ type: 'blackout' });
		expect(state.lives).toBeLessThan(STARTING_LIVES);
		expect(state.blackouts).toBeGreaterThan(0);
	});

	it('trips with an overload when supply is far too high', () => {
		const { state, random } = newGrid();
		for (const id of SOURCE_IDS) setTarget(state, id, id === 'batteries' ? 0 : 1);
		const reports = run(state, random, 6);
		expect(reports).toContainEqual({ type: 'overload' });
		expect(state.overloads).toBeGreaterThan(0);
	});

	it('is lenient for small imbalances and recovers when the balance returns', () => {
		const { state, random } = newGrid();
		state.stress = 0.6;
		state.supply = state.demand;
		run(state, random, 1.5, () => autopilot(state));
		expect(state.stress).toBeLessThan(0.3);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('gives a grace period after a trip, so one fault costs one heart', () => {
		const { state, random } = newGrid();
		for (const id of SOURCE_IDS) setTarget(state, id, 0);
		const previous = state.lives;
		let steps = 0;
		while (state.lives === previous && steps++ < 2000) stepGrid(state, DT, random);
		expect(previous - state.lives).toBe(1);
		expect(state.grace).toBeGreaterThan(0);
		// Nothing more can trip for the length of the grace period
		const livesAfterFirst = state.lives;
		run(state, random, GRACE_HOURS - 0.3);
		expect(state.lives).toBe(livesAfterFirst);
	});

	it('ends the game when the last heart is gone and then stops simulating', () => {
		const { state, random } = newGrid();
		for (const id of SOURCE_IDS) setTarget(state, id, 0);
		const reports = run(state, random, 40);
		expect(state.lives).toBe(0);
		expect(state.over).toBe(true);
		expect(reports).toContainEqual({ type: 'game-over' });
		const hour = state.hour;
		stepGrid(state, DT, random);
		expect(state.hour).toBe(hour);
	});

	it('makes a no-hands player fail within two days while the controller survives', () => {
		const idle = newGrid(5);
		run(idle.state, idle.random, 48);
		expect(idle.state.lives).toBeLessThan(STARTING_LIVES);
	});

	it('survives a heatwave announced in advance with a controller that has reserves', () => {
		const { state, random } = newGrid(8);
		state.scheduler.active.push({
			id: 99,
			kind: 'heatwave',
			announcedAt: state.hour,
			startHour: state.hour + 2,
			endHour: state.hour + 14
		});
		run(state, random, 14, () => autopilot(state));
		expect(state.lives).toBeGreaterThanOrEqual(STARTING_LIVES - 1);
	});
});

describe('price, emissions and score', () => {
	it('prices and measures the mix of what is delivered', () => {
		const { state, random } = newGrid();
		run(state, random, 0.5);
		expect(state.price).toBeGreaterThan(20);
		expect(state.price).toBeLessThan(140);
		expect(state.intensity).toBeGreaterThan(100);
	});

	it('gets cleaner and cheaper when coal and gas make way for wind, sun, hydro and nuclear', () => {
		const dirty = newGrid(6);
		const clean = newGrid(6);
		for (const id of ['coal', 'gas'] as const) setTarget(dirty.state, id, 1);
		for (const id of ['coal', 'gas'] as const) setTarget(clean.state, id, 0);
		run(dirty.state, dirty.random, 1.5);
		run(clean.state, clean.random, 1.5);
		expect(clean.state.intensity).toBeLessThan(dirty.state.intensity);
		expect(clean.state.price).toBeLessThan(dirty.state.price);
	});

	it('smooths the figures instead of jumping', () => {
		const { state, random } = newGrid();
		const before = state.intensity;
		for (const id of ['coal', 'gas'] as const) setTarget(state, id, 1);
		stepGrid(state, DT, random);
		expect(Math.abs(state.intensity - before)).toBeLessThan(60);
	});

	it('pays most for a cheap, clean, balanced grid and nothing when off balance', () => {
		expect(pointsPerHour(40, 50, 0)).toBe(10);
		expect(pointsPerHour(120, 450, 0)).toBeLessThan(pointsPerHour(60, 200, 0));
		expect(pointsPerHour(40, 50, TOLERANCE + 0.01)).toBe(0);
		expect(pointsPerHour(40, 50, -(TOLERANCE + 0.01))).toBe(0);
		expect(pointsPerHour(500, 2000, 0)).toBeGreaterThan(0);
	});

	it('keeps run averages that match what happened', () => {
		const { state, random } = newGrid(9);
		run(state, random, 3, () => autopilot(state));
		expect(averagePrice(state)).toBeGreaterThan(20);
		expect(averageIntensity(state)).toBeGreaterThan(50);
		expect(averageCleanShare(state)).toBeGreaterThan(0);
		expect(averageCleanShare(state)).toBeLessThanOrEqual(1);
	});

	it('shows the mains frequency sag with a deficit and rise with a surplus', () => {
		expect(frequency(0)).toBe(50);
		expect(frequency(-0.03)).toBeLessThan(49.85);
		expect(frequency(0.03)).toBeGreaterThan(50.15);
	});
});

describe('forecast', () => {
	it('looks ahead along the daily curve', () => {
		const { state } = newGrid();
		expect(demandForecast(state, 2)).toBeGreaterThan(state.demand);
		expect(demandForecast(state, 0)).toBeCloseTo(state.demand, 6);
	});
});

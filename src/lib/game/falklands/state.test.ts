import { describe, expect, it } from 'vitest';
import { missingMessages } from '#lib/testing/messages.js';
import { createRandom } from '../random.js';
import {
	DIPLOMACY_TARGET,
	DISTANCE,
	ENEMY_START,
	FUEL_SLOW,
	PEACE_BASE,
	PEACE_FUEL_POINTS,
	PEACE_TALK_POINTS,
	START_FUEL,
	STORM_EXTRA_FUEL,
	WEATHER_DAYS
} from './config.js';
import {
	canDeal,
	createGame,
	deal,
	finalScore,
	move,
	progressScore,
	talk,
	zonesLeft,
	type FalklandsState
} from './state.js';
import { createWeather, weatherAt } from './weather.js';

/** A forecast of clear days unless a test needs weather */
function clearWeather(): Array<'clear' | 'fog' | 'storm'> {
	return Array.from({ length: WEATHER_DAYS }, () => 'clear' as const);
}

function game(): FalklandsState {
	const state = createGame(createRandom(1));
	state.weather = clearWeather();
	return state;
}

describe('Falklands weather', () => {
	it('starts with a clear day and never puts two storms back to back', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const forecast = createWeather(createRandom(seed));
			expect(forecast).toHaveLength(WEATHER_DAYS);
			expect(forecast[0]).toBe('clear');
			for (let i = 1; i < forecast.length; i++) {
				expect(
					forecast[i] === 'storm' && forecast[i - 1] === 'storm',
					`seed ${seed} day ${i}`
				).toBe(false);
			}
		}
	});

	it('repeats the forecast when a run lasts longer than it', () => {
		const forecast = createWeather(createRandom(4));
		expect(weatherAt(forecast, WEATHER_DAYS)).toBe(forecast[0]);
		expect(weatherAt(forecast, WEATHER_DAYS + 3)).toBe(forecast[3]);
	});
});

describe('Falklands state', () => {
	it('starts the race with the other fleet already three zones out', () => {
		const state = game();
		expect(state.phase).toBe('sail');
		expect(state.day).toBe(0);
		expect(state.playerAt).toBe(0);
		expect(state.enemyAt).toBe(ENEMY_START);
		expect(state.fuel).toBe(START_FUEL);
		expect(state.talks).toBe(0);
		expect(state.score).toBe(0);
		expect(zonesLeft(state)).toBe(DISTANCE);
	});

	it('sails slowly for one zone, fuel and a day', () => {
		const state = game();
		const events = move(state, 'slow');
		expect(events[0]).toMatchObject({ type: 'move', speed: 'slow', zones: 1, fuel: FUEL_SLOW });
		expect(state.playerAt).toBe(1);
		expect(state.fuel).toBe(START_FUEL - FUEL_SLOW);
		expect(state.day).toBe(1);
		expect(state.enemyAt).toBe(ENEMY_START + 1);
		expect(state.score).toBe(10);
		expect(state.phase).toBe('sail');
	});

	it('does not allow a sprint in fog or a storm, and spends nothing when it refuses', () => {
		const fog = game();
		fog.weather[0] = 'fog';
		expect(move(fog, 'flank')).toEqual([{ type: 'blocked', speed: 'flank', weather: 'fog' }]);
		expect(fog.day).toBe(0);
		expect(fog.fuel).toBe(START_FUEL);
		expect(fog.playerAt).toBe(0);

		const storm = game();
		storm.weather[0] = 'storm';
		expect(move(storm, 'flank')[0]).toMatchObject({ type: 'blocked' });
		expect(storm.day).toBe(0);
	});

	it('charges extra fuel in a storm', () => {
		const state = game();
		state.weather[0] = 'storm';
		move(state, 'slow');
		expect(state.fuel).toBe(START_FUEL - FUEL_SLOW - STORM_EXTRA_FUEL);
		expect(state.day).toBe(1);
	});

	it('refuses a move the fuel cannot pay for, without spending the day', () => {
		const state = game();
		state.fuel = 4;
		expect(move(state, 'cruise')).toEqual([{ type: 'shortfuel', need: 9 }]);
		expect(state.fuel).toBe(4);
		expect(state.day).toBe(0);
		expect(state.enemyAt).toBe(ENEMY_START);
	});

	it('arrives first for a military win and scores the fuel and the gap', () => {
		const state = game();
		state.playerAt = DISTANCE - 2;
		const events = move(state, 'flank');
		expect(events).toContainEqual({ type: 'win', outcome: 'military', score: state.score });
		expect(state.playerAt).toBe(DISTANCE);
		expect(state.phase).toBe('over');
		expect(state.outcome).toBe('military');
		expect(state.score).toBe(400 + (START_FUEL - 15) * 3 + (DISTANCE - (ENEMY_START + 1)) * 20);
	});

	it('loses the race when the other fleet arrives while the talks go on', () => {
		const state = game();
		state.enemyAt = DISTANCE - 1;
		const events = talk(state);
		expect(events).toContainEqual({ type: 'lose', outcome: 'enemy', score: state.score });
		expect(state.phase).toBe('over');
		expect(state.outcome).toBe('enemy');
		expect(state.score).toBe(progressScore(state));
	});

	it('strands the task force when the last move leaves too little fuel', () => {
		const state = game();
		state.fuel = FUEL_SLOW + 1;
		const events = move(state, 'slow');
		expect(state.fuel).toBe(1);
		expect(events).toContainEqual({ type: 'lose', outcome: 'stranded', score: state.score });
		expect(state.outcome).toBe('stranded');
		expect(state.score).toBe(10);
	});

	it('needs seven days of talks before the deal is on the table', () => {
		const state = game();
		for (let i = 0; i < DIPLOMACY_TARGET - 1; i++) talk(state);
		expect(canDeal(state)).toBe(false);
		expect(deal(state)).toEqual([{ type: 'no-deal', talks: DIPLOMACY_TARGET - 1 }]);
		expect(state.phase).toBe('sail');

		talk(state);
		expect(canDeal(state)).toBe(true);
		const events = deal(state);
		expect(events[0]).toMatchObject({ type: 'peace' });
		expect(state.outcome).toBe('peace');
		expect(state.phase).toBe('over');
		expect(state.score).toBe(
			PEACE_BASE + state.fuel * PEACE_FUEL_POINTS + state.talks * PEACE_TALK_POINTS
		);
	});

	it('pays less for the deal than for arriving first', () => {
		const peace = game();
		for (let i = 0; i < DIPLOMACY_TARGET; i++) talk(peace);
		deal(peace);

		const military = game();
		military.playerAt = DISTANCE - 2;
		move(military, 'flank');

		expect(peace.outcome).toBe('peace');
		expect(military.outcome).toBe('military');
		expect(peace.score).toBeLessThan(military.score);
	});

	it('keeps a lost run on the progress made and ignores actions after the end', () => {
		const state = game();
		state.playerAt = 4;
		state.talks = 2;
		state.enemyAt = DISTANCE - 1;
		talk(state);
		expect(state.phase).toBe('over');
		expect(state.score).toBe(4 * 10 + 3 * 5);
		expect(move(state, 'slow')).toEqual([]);
		expect(talk(state)).toEqual([]);
		expect(deal(state)).toEqual([]);
		expect(finalScore(state, 'enemy')).toBe(state.score);
	});
});

describe('Falklands messages', () => {
	it('has its own and its mode messages in every language', () => {
		expect(missingMessages(['falklands_', 'mode_falklands_'])).toEqual([]);
	});
});

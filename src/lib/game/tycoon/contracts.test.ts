import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	MAX_CONTRACT_BONUS,
	NEXT_CONTRACT_MS,
	contractReward,
	deliverToContract,
	offerContract,
	stepContracts
} from './contracts.js';
import { globalMultiplier } from './economy.js';
import { createState, stepGame } from './state.js';

const random = () => createRandom(42);

describe('tycoon contracts', () => {
	it('offers a contract scaled to the field, never an empty target', () => {
		const state = createState(random());
		expect(state.contract).not.toBeNull();
		expect(state.contract!.target).toBeGreaterThan(0);
		expect(state.contract!.remainingMs).toBeGreaterThan(0);
		const bigger = createState(random());
		bigger.owned.pumpjack = 100;
		const scaled = offerContract(bigger, random());
		expect(scaled.target).toBeGreaterThanOrEqual(state.contract!.target);
	});

	it('pays the reward and a permanent bonus when the target is delivered', () => {
		const state = createState(random());
		const contract = state.contract!;
		const reward = contractReward(contract);
		const before = state.barrels;
		const multBefore = globalMultiplier(state);
		const events = deliverToContract(state, contract.target);
		expect(events).toEqual([{ type: 'contract-complete', reward, bonus: contract.bonus }]);
		expect(state.barrels).toBe(before + reward);
		expect(state.contractsCompleted).toBe(1);
		expect(state.contractBonus).toBeCloseTo(contract.bonus);
		expect(globalMultiplier(state)).toBeGreaterThan(multBefore);
		expect(state.contract).toBeNull();
		expect(state.nextContractMs).toBe(NEXT_CONTRACT_MS);
	});

	it('does not double-pay a contract that is already complete', () => {
		const state = createState(random());
		const contract = state.contract!;
		deliverToContract(state, contract.target);
		const completed = state.contractsCompleted;
		const barrels = state.barrels;
		expect(deliverToContract(state, contract.target)).toEqual([]);
		expect(state.contractsCompleted).toBe(completed);
		expect(state.barrels).toBe(barrels);
	});

	it('fails a contract whose time runs out, then offers another after the pause', () => {
		const state = createState(random());
		const id = state.contract!.id;
		const failed = stepContracts(state, state.contract!.remainingMs + 1, 0, random());
		expect(failed).toContainEqual({ type: 'contract-failed', id });
		expect(state.contract).toBeNull();
		const offered = stepContracts(state, NEXT_CONTRACT_MS, 0, random());
		expect(offered.some((event) => event.type === 'contract-start')).toBe(true);
		expect(state.contract).not.toBeNull();
	});

	it('caps the permanent bonus at 30 percent', () => {
		const state = createState(random());
		state.contractBonus = MAX_CONTRACT_BONUS;
		const contract = state.contract!;
		state.contract = { ...contract, target: 1, delivered: 0 };
		deliverToContract(state, 1);
		expect(state.contractBonus).toBe(MAX_CONTRACT_BONUS);
	});

	it('counts field production towards the contract during a game step', () => {
		const state = createState(random());
		state.owned.pumpjack = 10;
		state.contract = { ...state.contract!, target: 1, delivered: 0 };
		const events = stepGame(state, 1000, random());
		expect(events.some((event) => event.type === 'contract-complete')).toBe(true);
	});
});

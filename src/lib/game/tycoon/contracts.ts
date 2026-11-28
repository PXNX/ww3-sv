/*
 * Contracts: short, time-limited delivery goals in the idle loop. A contract asks for a share of
 * what the field would pump while it runs, so it scales with the player instead of becoming
 * trivial. Hitting the target pays barrels and a small permanent output bonus; missing it costs
 * nothing but the chance. The next contract is offered after a short pause.
 */
import type { Random } from '#lib/game/random.js';
import { productionPerSecond } from './economy.js';
import type { TycoonEvent, TycoonState } from './types.js';

export interface ContractTemplate {
	id: string;
	/** How long the player has, in seconds */
	seconds: number;
	/** Share of the field's output during that time that has to be delivered */
	outputShare: number;
	/** Floor so the first contracts are not zero while the field is tiny */
	minTarget: number;
	/** Share of the target paid as a cash reward */
	rewardShare: number;
	/** Permanent output bonus for finishing, as a fraction */
	bonus: number;
}

export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = [
	{
		id: 'first-haul',
		seconds: 90,
		outputShare: 1.1,
		minTarget: 250,
		rewardShare: 0.5,
		bonus: 0.02
	},
	{
		id: 'spot-delivery',
		seconds: 120,
		outputShare: 1.2,
		minTarget: 1500,
		rewardShare: 0.6,
		bonus: 0.03
	},
	{
		id: 'refinery-run',
		seconds: 150,
		outputShare: 1.3,
		minTarget: 9000,
		rewardShare: 0.7,
		bonus: 0.04
	},
	{
		id: 'fleet-order',
		seconds: 180,
		outputShare: 1.4,
		minTarget: 50000,
		rewardShare: 0.8,
		bonus: 0.05
	}
];

export const MAX_CONTRACT_BONUS = 0.3;
export const NEXT_CONTRACT_MS = 20_000;

export interface ActiveContract {
	id: string;
	target: number;
	delivered: number;
	remainingMs: number;
	rewardShare: number;
	bonus: number;
}

export function contractTemplate(id: string): ContractTemplate | undefined {
	return CONTRACT_TEMPLATES.find((template) => template.id === id);
}

/** Offers the next contract, scaled to the field's output at the moment it is offered */
export function offerContract(state: TycoonState, random: Random): ActiveContract {
	const template = CONTRACT_TEMPLATES[Math.floor(random() * CONTRACT_TEMPLATES.length)]!;
	const output = productionPerSecond(state) * template.seconds;
	const target = Math.max(template.minTarget, Math.round(output * template.outputShare));
	return {
		id: template.id,
		target,
		delivered: 0,
		remainingMs: template.seconds * 1000,
		rewardShare: template.rewardShare,
		bonus: template.bonus
	};
}

/** Barrels the active contract pays when it is completed */
export function contractReward(contract: ActiveContract): number {
	return Math.ceil(contract.target * contract.rewardShare);
}

/** Counts barrels towards the active contract. Returns the event when it is completed. */
export function deliverToContract(state: TycoonState, barrels: number): TycoonEvent[] {
	const contract = state.contract;
	if (!contract || barrels <= 0) return [];
	contract.delivered += barrels;
	if (contract.delivered < contract.target) return [];
	const reward = contractReward(contract);
	state.barrels += reward;
	state.runTotal += reward;
	state.lifetime += reward;
	state.contractsCompleted += 1;
	state.contractBonus = Math.min(MAX_CONTRACT_BONUS, state.contractBonus + contract.bonus);
	state.contract = null;
	state.nextContractMs = NEXT_CONTRACT_MS;
	return [{ type: 'contract-complete', reward, bonus: contract.bonus }];
}

/**
 * Counts down the active contract and starts the next one after a pause. Called from the game step
 * with the barrels the field paid during that step, so production and taps both count.
 */
export function stepContracts(
	state: TycoonState,
	dtMs: number,
	barrels: number,
	random: Random
): TycoonEvent[] {
	const events = deliverToContract(state, barrels);
	const contract = state.contract;
	if (contract) {
		contract.remainingMs -= dtMs;
		if (contract.remainingMs <= 0) {
			state.contract = null;
			state.nextContractMs = NEXT_CONTRACT_MS;
			events.push({ type: 'contract-failed', id: contract.id });
		}
		return events;
	}
	if (state.nextContractMs > 0) {
		state.nextContractMs -= dtMs;
		if (state.nextContractMs <= 0) {
			state.nextContractMs = 0;
			state.contract = offerContract(state, random);
			events.push({ type: 'contract-start', id: state.contract.id, target: state.contract.target });
		}
	}
	return events;
}

/** Starts the first contract on a new run */
export function beginContracts(state: TycoonState, random: Random): void {
	if (!state.contract && state.contractsCompleted === 0 && state.nextContractMs === 0)
		state.contract = offerContract(state, random);
}

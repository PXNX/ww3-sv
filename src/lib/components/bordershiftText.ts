/*
 * Text helpers for Border Shift: the vehicle descriptions and the two clues, kept out of the
 * component so the mapping is testable and a missing message fails loudly.
 */
import { VEHICLE_COUNT } from '#lib/game/bordershift/config.js';
import type { Hint, Tool } from '#lib/game/bordershift/convoys.js';
import { m } from '#lib/paraglide/messages.js';

const VEHICLES = [
	m.bordershift_vehicle_0,
	m.bordershift_vehicle_1,
	m.bordershift_vehicle_2,
	m.bordershift_vehicle_3,
	m.bordershift_vehicle_4,
	m.bordershift_vehicle_5
];

if (VEHICLES.length !== VEHICLE_COUNT) {
	throw new Error('bordershiftText.ts and VEHICLE_COUNT disagree about the number of vehicles');
}

export function vehicleText(index: number): string {
	const text = VEHICLES[index];
	if (!text) throw new Error(`No Border Shift vehicle ${index}`);
	return text();
}

export function toolLabel(tool: Tool): string {
	return tool === 'documents' ? m.bordershift_action_documents() : m.bordershift_action_camera();
}

export function truthText(truth: 'family' | 'psyops'): string {
	return truth === 'family' ? m.bordershift_truth_family() : m.bordershift_truth_psyops();
}

export function clueText(tool: Tool, hint: Hint): string {
	if (hint === 'unclear') {
		return tool === 'documents'
			? m.bordershift_clue_unclear_documents()
			: m.bordershift_clue_unclear_camera();
	}
	if (tool === 'documents') {
		return hint === 'family'
			? m.bordershift_clue_family_documents()
			: m.bordershift_clue_psyops_documents();
	}
	return hint === 'family'
		? m.bordershift_clue_family_camera()
		: m.bordershift_clue_psyops_camera();
}

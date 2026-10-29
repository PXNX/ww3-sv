/*
 * Text helpers for Border Shift: the vehicle descriptions and the three clues, kept out of the
 * component so the mapping is testable and a missing message fails loudly.
 */
import { VEHICLE_COUNT } from '#lib/game/bordershift/config.js';
import type { ConvoyTruth, Hint, Tool } from '#lib/game/bordershift/convoys.js';
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

const TOOL_LABELS: Record<Tool, () => string> = {
	documents: m.bordershift_action_documents,
	camera: m.bordershift_action_camera,
	ground: m.bordershift_action_ground
};

export function toolLabel(tool: Tool): string {
	return TOOL_LABELS[tool]();
}

const TRUTHS: Record<ConvoyTruth, () => string> = {
	family: m.bordershift_truth_family,
	psyops: m.bordershift_truth_psyops,
	tunnel: m.bordershift_truth_tunnel
};

export function truthText(truth: ConvoyTruth): string {
	return TRUTHS[truth]();
}

const CLUES: Record<Tool, Record<Hint, () => string>> = {
	documents: {
		family: m.bordershift_clue_family_documents,
		psyops: m.bordershift_clue_psyops_documents,
		tunnel: m.bordershift_clue_tunnel_documents,
		unclear: m.bordershift_clue_unclear_documents
	},
	camera: {
		family: m.bordershift_clue_family_camera,
		psyops: m.bordershift_clue_psyops_camera,
		tunnel: m.bordershift_clue_tunnel_camera,
		unclear: m.bordershift_clue_unclear_camera
	},
	ground: {
		family: m.bordershift_clue_unclear_ground,
		psyops: m.bordershift_clue_unclear_ground,
		tunnel: m.bordershift_clue_tunnel_ground,
		unclear: m.bordershift_clue_unclear_ground
	}
};

export function clueText(tool: Tool, hint: Hint): string {
	return CLUES[tool][hint]();
}

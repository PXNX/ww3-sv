/*
 * Game-over cameo roster (requirements Section 10). Each entry pairs one portrait with its own
 * message, so a portrait and a joke can never be mismatched. All lines are absurd, obviously
 * fictional parody narration, never quotes.
 */
import { m } from '$lib/paraglide/messages';
import type { Random } from '$lib/game/random';

export type CameoId =
	| 'xi'
	| 'zelensky'
	| 'putin'
	| 'merz'
	| 'mbs'
	| 'khamenei'
	| 'netanyahu'
	| 'erdogan'
	| 'macron';

export interface Cameo {
	id: CameoId;
	name: () => string;
	message: (inputs: { characterName: string }) => string;
}

const CAMEO_DIRECTORY = '/assets/cameos';

export const CAMEO_PLACEHOLDER = `${CAMEO_DIRECTORY}/_placeholder.svg`;

/** Add a cameo here once its owner-supplied portrait is in static/assets/cameos/<id>.png */
const SUPPLIED_PORTRAITS: readonly CameoId[] = [];

export const CAMEOS: readonly Cameo[] = [
	{ id: 'xi', name: m.cameo_xi_name, message: m.cameo_xi },
	{ id: 'zelensky', name: m.cameo_zelensky_name, message: m.cameo_zelensky },
	{ id: 'putin', name: m.cameo_putin_name, message: m.cameo_putin },
	{ id: 'merz', name: m.cameo_merz_name, message: m.cameo_merz },
	{ id: 'mbs', name: m.cameo_mbs_name, message: m.cameo_mbs },
	{ id: 'khamenei', name: m.cameo_khamenei_name, message: m.cameo_khamenei },
	{ id: 'netanyahu', name: m.cameo_netanyahu_name, message: m.cameo_netanyahu },
	{ id: 'erdogan', name: m.cameo_erdogan_name, message: m.cameo_erdogan },
	{ id: 'macron', name: m.cameo_macron_name, message: m.cameo_macron }
];

export function cameoPortrait(id: CameoId): string {
	return SUPPLIED_PORTRAITS.includes(id) ? `${CAMEO_DIRECTORY}/${id}.png` : CAMEO_PLACEHOLDER;
}

/** Picks a random cameo, never the same one twice in a row */
export function pickCameo(random: Random, previous?: CameoId): Cameo {
	const pool = CAMEOS.length > 1 ? CAMEOS.filter((cameo) => cameo.id !== previous) : CAMEOS;
	return pool[Math.floor(random() * pool.length)];
}

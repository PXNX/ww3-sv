/*
 * Game-over cameo roster (requirements Section 10). Each entry pairs one portrait with its own
 * pool of messages, so a portrait and a joke can never be mismatched. All lines are absurd,
 * obviously fictional parody narration, never quotes.
 */
import { m } from '$lib/paraglide/messages';
import type { Random } from '$lib/game/random';

export type CameoId =
	'xi' | 'zelensky' | 'putin' | 'merz' | 'mbs' | 'khamenei' | 'netanyahu' | 'erdogan' | 'macron';

export type CameoMessage = (inputs: { characterName: string }) => string;

export interface Cameo {
	id: CameoId;
	name: () => string;
	/** Every joke for this cameo; one of them is picked at random per game over */
	messages: readonly [CameoMessage, ...CameoMessage[]];
}

const CAMEO_DIRECTORY = '/assets/cameos';

export const CAMEO_PLACEHOLDER = `${CAMEO_DIRECTORY}/_placeholder.svg`;

/** Add a cameo here once its portrait is in static/assets/cameos/<id>.svg */
const SUPPLIED_PORTRAITS: readonly CameoId[] = [
	'xi',
	'zelensky',
	'putin',
	'merz',
	'mbs',
	'khamenei',
	'netanyahu',
	'erdogan',
	'macron'
];

export const CAMEOS: readonly Cameo[] = [
	{
		id: 'xi',
		name: m.cameo_xi_name,
		messages: [m.cameo_xi, m.cameo_xi_2, m.cameo_xi_3]
	},
	{
		id: 'zelensky',
		name: m.cameo_zelensky_name,
		messages: [m.cameo_zelensky, m.cameo_zelensky_2, m.cameo_zelensky_3]
	},
	{
		id: 'putin',
		name: m.cameo_putin_name,
		messages: [m.cameo_putin, m.cameo_putin_2, m.cameo_putin_3]
	},
	{
		id: 'merz',
		name: m.cameo_merz_name,
		messages: [m.cameo_merz, m.cameo_merz_2, m.cameo_merz_3]
	},
	{
		id: 'mbs',
		name: m.cameo_mbs_name,
		messages: [m.cameo_mbs, m.cameo_mbs_2, m.cameo_mbs_3]
	},
	{
		id: 'khamenei',
		name: m.cameo_khamenei_name,
		messages: [m.cameo_khamenei, m.cameo_khamenei_2, m.cameo_khamenei_3]
	},
	{
		id: 'netanyahu',
		name: m.cameo_netanyahu_name,
		messages: [m.cameo_netanyahu, m.cameo_netanyahu_2, m.cameo_netanyahu_3]
	},
	{
		id: 'erdogan',
		name: m.cameo_erdogan_name,
		messages: [m.cameo_erdogan, m.cameo_erdogan_2, m.cameo_erdogan_3]
	},
	{
		id: 'macron',
		name: m.cameo_macron_name,
		messages: [m.cameo_macron, m.cameo_macron_2, m.cameo_macron_3]
	}
];

/**
 * A mode-specific cameo for the game-over screen, used instead of the random roster pick. Pass
 * `null` to the modal to show no cameo at all.
 */
export interface CameoOverride {
	/** Image URL, normally from cameoAsset(); falls back to the placeholder if it fails to load */
	image: string;
	alt: string;
	message: string;
	/** Caption above the message; defaults to the shared "Breaking news" label */
	label?: string;
}

/** URL of a file in static/assets/cameos/, for example cameoAsset('businessman-calm.svg') */
export function cameoAsset(file: string): string {
	return `${CAMEO_DIRECTORY}/${file}`;
}

export function cameoPortrait(id: CameoId): string {
	return SUPPLIED_PORTRAITS.includes(id) ? `${CAMEO_DIRECTORY}/${id}.svg` : CAMEO_PLACEHOLDER;
}

/** Guests that appear inside a mode rather than on the game-over roster */
export type GuestId = 'vance';

/** Add a guest here once its portrait is in static/assets/cameos/<id>.svg */
const SUPPLIED_GUESTS: readonly GuestId[] = ['vance'];

export function guestPortrait(id: GuestId): string {
	return SUPPLIED_GUESTS.includes(id) ? `${CAMEO_DIRECTORY}/${id}.svg` : CAMEO_PLACEHOLDER;
}

/** Picks a random cameo, never the same one twice in a row */
export function pickCameo(random: Random, previous?: CameoId): Cameo {
	const pool = CAMEOS.length > 1 ? CAMEOS.filter((cameo) => cameo.id !== previous) : CAMEOS;
	return pool[Math.floor(random() * pool.length)];
}

/** Picks which of a cameo's messages to show, as an index into `cameo.messages` */
export function pickCameoMessage(random: Random, cameo: Cameo): number {
	return Math.floor(random() * cameo.messages.length);
}

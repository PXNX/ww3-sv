/*
 * Owner-supplied Shahed Shootdown sprites (requirements Section 14, "Shahed Shootdown asset
 * pipeline"). Until a file is supplied and listed in SUPPLIED_ASSETS, drones, the missile, clouds
 * and the blimp fall back to a generic placeholder SVG; the commander poses instead fall back to
 * the hand-drawn inline SVG in ShootdownCommander.svelte. The launcher and explosions are shared
 * sprites and come from $lib/theme/sprites.
 */

export type ShootdownAssetId =
	| 'commanderPointing'
	| 'commanderWorried'
	| 'commanderSmug'
	| 'shahed'
	| 'shahedMega'
	| 'missile'
	| 'cloud'
	| 'blimp';

const DIRECTORY = '/assets/shootdown';

const ASSET_FILES: Record<ShootdownAssetId, string> = {
	commanderPointing: 'commander-pointing.png',
	commanderWorried: 'commander-worried.png',
	commanderSmug: 'commander-smug.png',
	shahed: 'shahed.png',
	shahedMega: 'shahed-mega.png',
	missile: 'patriot-missile.png',
	cloud: 'cloud.png',
	blimp: 'mascot-blimp.png'
};

/** Assets with a placeholder SVG file; anything else stays null until supplied */
const PLACEHOLDER_FILES: Partial<Record<ShootdownAssetId, string>> = {
	shahed: '_placeholder-shahed.svg',
	shahedMega: '_placeholder-shahed-mega.svg',
	missile: '_placeholder-missile.svg',
	cloud: '_placeholder-cloud.svg',
	blimp: '_placeholder-blimp.svg'
};

/** Add an asset here once its owner-supplied file is in static/assets/shootdown/ */
const SUPPLIED_ASSETS: readonly ShootdownAssetId[] = [];

/** Path of the supplied or placeholder file, or null while a hand-drawn fallback should be used */
export function shootdownAsset(id: ShootdownAssetId): string | null {
	if (SUPPLIED_ASSETS.includes(id)) return `${DIRECTORY}/${ASSET_FILES[id]}`;
	const placeholder = PLACEHOLDER_FILES[id];
	return placeholder ? `${DIRECTORY}/${placeholder}` : null;
}

/** Every supplied canvas sprite, for preloading (the commander is shown as a regular image) */
export const CANVAS_ASSETS: readonly ShootdownAssetId[] = [
	'shahed',
	'shahedMega',
	'missile',
	'cloud',
	'blimp'
];

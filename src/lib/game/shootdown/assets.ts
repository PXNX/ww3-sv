/*
 * Owner-supplied Shahed Shootdown sprites (requirements Section 14, "Shahed Shootdown asset
 * pipeline"). Until a file is supplied and listed in SUPPLIED_ASSETS, the game draws a generic
 * original placeholder shape instead. The launcher and explosions are shared sprites and come
 * from $lib/theme/sprites.
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

/** Add an asset here once its owner-supplied file is in static/assets/shootdown/ */
const SUPPLIED_ASSETS: readonly ShootdownAssetId[] = [];

/** Path of the supplied file, or null while the placeholder shape should be drawn */
export function shootdownAsset(id: ShootdownAssetId): string | null {
	return SUPPLIED_ASSETS.includes(id) ? `${DIRECTORY}/${ASSET_FILES[id]}` : null;
}

/** Every supplied canvas sprite, for preloading (the commander is shown as a regular image) */
export const CANVAS_ASSETS: readonly ShootdownAssetId[] = [
	'shahed',
	'shahedMega',
	'missile',
	'cloud',
	'blimp'
];

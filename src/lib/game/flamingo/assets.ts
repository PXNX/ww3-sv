/*
 * Owner-supplied Flamingo Flight art (requirements Section 14). Until a file is supplied and
 * listed in SUPPLIED_ASSETS, each asset falls back to a generic placeholder SVG in the same flat,
 * thick-outline style.
 */

export type FlamingoAssetId =
	| 'flamingoFlap'
	| 'flamingoFall'
	| 'radarMast'
	| 'droneNet'
	| 'pantsirTower'
	| 'tank'
	| 'tankDestroyed'
	| 'flareStack';

const ASSET_FILES: Record<FlamingoAssetId, string> = {
	flamingoFlap: '/assets/flamingo/flamingo-flap.png',
	flamingoFall: '/assets/flamingo/flamingo-fall.png',
	radarMast: '/assets/flamingo/radar-mast.png',
	droneNet: '/assets/flamingo/drone-net.png',
	pantsirTower: '/assets/flamingo/pantsir-tower.png',
	tank: '/assets/flamingo/tank.png',
	tankDestroyed: '/assets/flamingo/tank-destroyed.png',
	flareStack: '/assets/flamingo/flare-stack.png'
};

const PLACEHOLDER_FILES: Record<FlamingoAssetId, string> = {
	flamingoFlap: '/assets/flamingo/_placeholder-flamingo-flap.svg',
	flamingoFall: '/assets/flamingo/_placeholder-flamingo-fall.svg',
	radarMast: '/assets/flamingo/_placeholder-radar-mast.svg',
	droneNet: '/assets/flamingo/_placeholder-drone-net.svg',
	pantsirTower: '/assets/flamingo/_placeholder-pantsir-tower.svg',
	tank: '/assets/flamingo/_placeholder-tank.svg',
	tankDestroyed: '/assets/flamingo/_placeholder-tank-destroyed.svg',
	flareStack: '/assets/flamingo/_placeholder-flare-stack.svg'
};

/** Add an asset here once its owner-supplied file is in place */
const SUPPLIED_ASSETS: readonly FlamingoAssetId[] = [];

/**
 * Assets drawn into a fixed-size box, so a single placeholder image scales correctly. The radar
 * mast, Pantsir tower and drone net are instead drawn into a box whose height depends on where
 * the gap randomly lands, and the drone net hangs all the way to the top of the screen; a single
 * static image there would either stretch or leave most of the column transparent, so those three
 * keep the adaptive canvas drawing until real art (which can tile) is supplied.
 */
const PLACEHOLDER_ASSET_IDS: readonly FlamingoAssetId[] = [
	'flamingoFlap',
	'flamingoFall',
	'tank',
	'tankDestroyed',
	'flareStack'
];

/** Files to load for drawing: the owner-supplied file once listed above, a placeholder SVG otherwise */
export function suppliedFlamingoAssets(): [FlamingoAssetId, string][] {
	return PLACEHOLDER_ASSET_IDS.map((id) => [
		id,
		SUPPLIED_ASSETS.includes(id) ? ASSET_FILES[id] : PLACEHOLDER_FILES[id]
	]);
}

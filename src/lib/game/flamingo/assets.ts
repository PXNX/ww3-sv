/*
 * Owner-supplied Flamingo Flight art (requirements Section 14). Until a file is supplied and
 * listed in SUPPLIED_ASSETS, each asset falls back to a generic placeholder SVG in the same flat,
 * thick-outline style.
 */

export type FlamingoAssetId =
	| 'flamingoFlap'
	| 'flamingoFall'
	| 'radarMast'
	| 'barrageBalloon'
	| 'powerPylon'
	| 'tank'
	| 'tankDestroyed'
	| 'flareStack';

const ASSET_FILES: Record<FlamingoAssetId, string> = {
	flamingoFlap: '/assets/flamingo/flamingo-flap.png',
	flamingoFall: '/assets/flamingo/flamingo-fall.png',
	radarMast: '/assets/flamingo/radar-mast.png',
	barrageBalloon: '/assets/flamingo/barrage-balloon.png',
	powerPylon: '/assets/flamingo/power-pylon.png',
	tank: '/assets/flamingo/tank.png',
	tankDestroyed: '/assets/flamingo/tank-destroyed.png',
	flareStack: '/assets/flamingo/flare-stack.png'
};

const PLACEHOLDER_FILES: Record<FlamingoAssetId, string> = {
	flamingoFlap: '/assets/flamingo/_placeholder-flamingo-flap.svg',
	flamingoFall: '/assets/flamingo/_placeholder-flamingo-fall.svg',
	radarMast: '/assets/flamingo/_placeholder-radar-mast.svg',
	barrageBalloon: '/assets/flamingo/_placeholder-barrage-balloon.svg',
	powerPylon: '/assets/flamingo/_placeholder-power-pylon.svg',
	tank: '/assets/flamingo/_placeholder-tank.svg',
	tankDestroyed: '/assets/flamingo/_placeholder-tank-destroyed.svg',
	flareStack: '/assets/flamingo/_placeholder-flare-stack.svg'
};

/** Add an asset here once its owner-supplied file is in place */
const SUPPLIED_ASSETS: readonly FlamingoAssetId[] = [];

const ALL_ASSET_IDS: readonly FlamingoAssetId[] = [
	'flamingoFlap',
	'flamingoFall',
	'radarMast',
	'barrageBalloon',
	'powerPylon',
	'tank',
	'tankDestroyed',
	'flareStack'
];

/** Files to load for drawing: the owner-supplied file once listed above, a placeholder SVG otherwise */
export function suppliedFlamingoAssets(): [FlamingoAssetId, string][] {
	return ALL_ASSET_IDS.map((id) => [
		id,
		SUPPLIED_ASSETS.includes(id) ? ASSET_FILES[id] : PLACEHOLDER_FILES[id]
	]);
}

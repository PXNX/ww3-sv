/*
 * Owner-supplied Flamingo Flight art (requirements Section 14). Until a file is supplied and
 * listed in SUPPLIED_ASSETS, the canvas draws a generic flat placeholder shape instead.
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

/** Add an asset here once its owner-supplied file is in place */
const SUPPLIED_ASSETS: readonly FlamingoAssetId[] = [];

/** Files to load for drawing; everything missing here is drawn as a placeholder shape */
export function suppliedFlamingoAssets(): [FlamingoAssetId, string][] {
	return SUPPLIED_ASSETS.map((id) => [id, ASSET_FILES[id]]);
}

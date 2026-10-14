/* Translated names of the balloon's points of interest and of the things that pop it */
import type { HazardKind, PoiKind } from '#lib/game/balloon/course.js';
import { m } from '#lib/paraglide/messages.js';

const POI_NAMES: Record<PoiKind, () => string> = {
	farm: m.balloon_poi_farm,
	silo: m.balloon_poi_silo,
	lake: m.balloon_poi_lake,
	stadium: m.balloon_poi_stadium
};

const HIT_NAMES: Record<HazardKind | 'jet', () => string> = {
	crow: m.balloon_popup_crow,
	cloud: m.balloon_popup_cloud,
	kite: m.balloon_popup_kite,
	jet: m.balloon_popup_jet
};

export function poiName(kind: PoiKind): string {
	return POI_NAMES[kind]();
}

export function hitText(kind: HazardKind | 'jet'): string {
	return HIT_NAMES[kind]();
}

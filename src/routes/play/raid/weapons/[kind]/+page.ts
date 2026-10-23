import { error } from '@sveltejs/kit';
import { WEAPON_KINDS, type WeaponKind } from '#lib/game/raid/config.js';
import type { EntryGenerator, PageLoad } from './$types';

/** One prerendered page per weapon */
export const entries: EntryGenerator = () => WEAPON_KINDS.map((kind) => ({ kind }));

export const load: PageLoad = ({ params }) => {
	if (!(WEAPON_KINDS as readonly string[]).includes(params.kind)) error(404);
	return { kind: params.kind as WeaponKind };
};

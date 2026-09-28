/*
 * Owner-supplied artwork for Feathered Fury goes to static/assets/fury/ (requirements Section 14).
 * Until a file is supplied and listed in SUPPLIED_FURY_SPRITES, the renderer draws a generic,
 * original placeholder shape on the canvas in the same flat, thick-outline style.
 */
import { loadImage } from '$lib/theme/sprites';

export type FurySpriteId =
	| 'flamingo'
	| 'goose'
	| 'pelican'
	| 'slingshot'
	| 'wood'
	| 'stone'
	| 'ice'
	| 'dome'
	| 'domeBroken'
	| 'dust';

const FILES: Record<FurySpriteId, string> = {
	flamingo: '/assets/fury/flamingo.png',
	goose: '/assets/fury/goose.png',
	pelican: '/assets/fury/pelican.png',
	slingshot: '/assets/fury/slingshot.png',
	wood: '/assets/fury/wood.png',
	stone: '/assets/fury/stone.png',
	ice: '/assets/fury/ice.png',
	dome: '/assets/fury/dome.png',
	domeBroken: '/assets/fury/dome-broken.png',
	dust: '/assets/fury/dust.png'
};

/** Add a sprite here once its owner-supplied file is in place */
const SUPPLIED_FURY_SPRITES: readonly FurySpriteId[] = [];

export type FurySprites = Partial<Record<FurySpriteId, HTMLImageElement>>;

/** Loads every supplied sprite; anything missing or failing falls back to the drawn placeholder */
export async function loadFurySprites(): Promise<FurySprites> {
	const sprites: FurySprites = {};
	await Promise.all(
		SUPPLIED_FURY_SPRITES.map(async (id) => {
			const image = await loadImage(FILES[id]);
			if (image) sprites[id] = image;
		})
	);
	return sprites;
}

/*
 * Owner-supplied artwork for Feathered Fury goes to static/assets/fury/ (requirements Section 14).
 * Until a file is supplied and listed in SUPPLIED_FURY_SPRITES, the birds and the dome fall back to
 * a generic placeholder SVG in the same flat, thick-outline style. Blocks (wood/stone/ice), the
 * slingshot, the broken dome and dust are drawn parametrically (shape, material and damage all vary
 * at runtime) and are not swapped by a single image, so they have no placeholder file yet.
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

/** Sprites with a placeholder SVG file; anything else stays canvas-drawn until supplied */
const PLACEHOLDER_FILES: Partial<Record<FurySpriteId, string>> = {
	flamingo: '/assets/fury/_placeholder-flamingo.svg',
	goose: '/assets/fury/_placeholder-goose.svg',
	pelican: '/assets/fury/_placeholder-pelican.svg',
	dome: '/assets/fury/_placeholder-dome.svg'
};

/** Add a sprite here once its owner-supplied file is in place */
const SUPPLIED_FURY_SPRITES: readonly FurySpriteId[] = [];

const PLACEHOLDER_SPRITE_IDS = Object.keys(PLACEHOLDER_FILES) as FurySpriteId[];

export type FurySprites = Partial<Record<FurySpriteId, HTMLImageElement>>;

/** Loads every supplied sprite, falling back to a placeholder SVG where one exists */
export async function loadFurySprites(): Promise<FurySprites> {
	const sprites: FurySprites = {};
	const ids = new Set([...SUPPLIED_FURY_SPRITES, ...PLACEHOLDER_SPRITE_IDS]);
	await Promise.all(
		[...ids].map(async (id) => {
			const src = SUPPLIED_FURY_SPRITES.includes(id) ? FILES[id] : PLACEHOLDER_FILES[id];
			const image = src ? await loadImage(src) : null;
			if (image) sprites[id] = image;
		})
	);
	return sprites;
}

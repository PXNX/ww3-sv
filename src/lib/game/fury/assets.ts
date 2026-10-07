/*
 * Owner-supplied artwork for Magyar's Birds goes to static/assets/fury/ (requirements Section 14).
 * Until a file is supplied and listed in SUPPLIED_FURY_SPRITES, the birds, the dome and the
 * landmarks fall back to a generic placeholder SVG in the same flat, thick-outline style. Blocks
 * (wood/stone/ice), the slingshot, the broken dome and dust are drawn parametrically (shape,
 * material and damage all vary at runtime) and are not swapped by a single image, so they have no
 * placeholder file yet.
 */
import { loadImage } from '$lib/theme/sprites';

export type FurySpriteId =
	| 'flamingo'
	| 'pelican'
	| 'stork'
	| 'goose'
	| 'falcon'
	| 'phoenix'
	| 'parrot'
	| 'slingshot'
	| 'wood'
	| 'stone'
	| 'ice'
	| 'dome'
	| 'domeBroken'
	| 'dust'
	| 'oilTank'
	| 'refinery'
	| 'factory'
	| 'sam'
	| 'radar'
	| 'pylon'
	| 'watchtower'
	| 'bunker';

const FILES: Record<FurySpriteId, string> = {
	flamingo: '/assets/fury/flamingo.png',
	pelican: '/assets/fury/pelican.png',
	stork: '/assets/fury/stork.png',
	goose: '/assets/fury/goose.png',
	falcon: '/assets/fury/falcon.png',
	phoenix: '/assets/fury/phoenix.png',
	parrot: '/assets/fury/parrot.png',
	slingshot: '/assets/fury/slingshot.png',
	wood: '/assets/fury/wood.png',
	stone: '/assets/fury/stone.png',
	ice: '/assets/fury/ice.png',
	dome: '/assets/fury/dome.png',
	domeBroken: '/assets/fury/dome-broken.png',
	dust: '/assets/fury/dust.png',
	oilTank: '/assets/fury/oil-tank.png',
	refinery: '/assets/fury/refinery.png',
	factory: '/assets/fury/factory.png',
	sam: '/assets/fury/sam.png',
	radar: '/assets/fury/radar.png',
	pylon: '/assets/fury/pylon.png',
	watchtower: '/assets/fury/watchtower.png',
	bunker: '/assets/fury/bunker.png'
};

/**
 * Sprites with a placeholder SVG file; anything else stays canvas-drawn until supplied. The
 * landmarks reuse existing generic placeholders from other modes instead of new art: an oil tank
 * and a flare stack already exist for Flamingo Flight's refineries, and a generic launcher truck
 * already exists for Shahed Shootdown's Patriot battery. The factory has no matching asset yet, so
 * it stays a plain canvas-drawn box (see furyRender's drawLandmark) until one is supplied. The
 * radar mast and the power pylon reuse Flamingo Flight's placeholders as well; the watchtower and
 * the bunker are drawn parametrically on the canvas and have no placeholder file.
 */
const PLACEHOLDER_FILES: Partial<Record<FurySpriteId, string>> = {
	flamingo: '/assets/fury/_placeholder-flamingo.svg',
	pelican: '/assets/fury/_placeholder-pelican.svg',
	stork: '/assets/fury/_placeholder-stork.svg',
	goose: '/assets/fury/_placeholder-goose.svg',
	falcon: '/assets/fury/_placeholder-falcon.svg',
	phoenix: '/assets/fury/_placeholder-phoenix.svg',
	parrot: '/assets/fury/_placeholder-parrot.svg',
	dome: '/assets/fury/_placeholder-dome.svg',
	oilTank: '/assets/flamingo/_placeholder-tank.svg',
	refinery: '/assets/flamingo/_placeholder-flare-stack.svg',
	sam: '/assets/shootdown/_placeholder-patriot-launcher.svg',
	radar: '/assets/flamingo/_placeholder-radar-mast.svg',
	pylon: '/assets/flamingo/_placeholder-power-pylon.svg'
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

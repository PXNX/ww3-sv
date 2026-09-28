/*
 * Sprites shared between modes (for example the submarine is used by Minefield, Convoy Runner and
 * Merge Tankers). Each sprite falls back to a generic placeholder until owner-supplied art exists.
 */

export type SpriteId = 'tanker' | 'tankerTop' | 'submarine' | 'mine' | 'patriotLauncher';

interface SpriteSource {
	placeholder: string;
	/** Where the owner-supplied file goes, if one is expected */
	supplied?: string;
}

const SPRITES: Record<SpriteId, SpriteSource> = {
	tanker: { placeholder: '/assets/sprites/tanker.svg' },
	tankerTop: { placeholder: '/assets/sprites/tanker-top.svg' },
	submarine: { placeholder: '/assets/sprites/submarine.svg' },
	mine: { placeholder: '/assets/sprites/mine.svg' },
	patriotLauncher: {
		placeholder: '/assets/shootdown/_placeholder-patriot-launcher.svg',
		supplied: '/assets/shootdown/patriot-launcher.png'
	}
};

/** Add a sprite here once its owner-supplied file is in place */
const SUPPLIED_SPRITES: readonly SpriteId[] = [];

const EXPLOSION_PLACEHOLDER = '/assets/shootdown/_placeholder-explosion.svg';
const EXPLOSION_FRAMES_SUPPLIED = false;

export function spriteSrc(id: SpriteId): string {
	const sprite = SPRITES[id];
	return sprite.supplied && SUPPLIED_SPRITES.includes(id) ? sprite.supplied : sprite.placeholder;
}

/** Explosion animation frames; a single placeholder frame is scaled and faded until art arrives */
export function explosionFrames(): string[] {
	return EXPLOSION_FRAMES_SUPPLIED
		? [1, 2, 3, 4].map((frame) => `/assets/shootdown/explosion-${frame}.png`)
		: [EXPLOSION_PLACEHOLDER];
}

/** Loads an image for drawing on a canvas; resolves to null if it cannot be loaded */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => resolve(null);
		image.src = src;
	});
}

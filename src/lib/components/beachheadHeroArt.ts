/** The Blender-rendered commander sprites in static/assets/beachhead/heroes/. */
export const HERO_SPRITE_FRAMES = 12;

export function heroSprite(kind: 'azov' | 'hero'): string {
	return `/assets/beachhead/heroes/${kind}.png`;
}

export function isHeroKind(kind: string): kind is 'azov' | 'hero' {
	return kind === 'azov' || kind === 'hero';
}

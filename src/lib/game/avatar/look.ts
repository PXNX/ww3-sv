/*
 * The player's own cartoon agent: a handful of parts (shirt, face, skin, nose, eyes, hair and a
 * hat) picked from short fixed lists, so every combination draws cleanly and a saved look can be
 * validated part by part. Everything here is plain data and pure functions; the Avatar component
 * draws it and the avatar store keeps it in local storage.
 */
import { createRandom, pickOne, randomSeed, type Random } from '#lib/game/random.js';

export const SHIRT_TYPES = ['tee', 'hoodie', 'suit', 'camo', 'tank', 'trump-suit'] as const;
export const FACE_SHAPES = ['round', 'oval', 'square', 'long'] as const;
export const NOSES = ['button', 'pointy', 'potato', 'hook', 'beak'] as const;
/** Hair on the face; the mustache is an extra look */
export const FACIAL_HAIR = ['none', 'mustache'] as const;
export const EYE_TYPES = ['dots', 'wide', 'sleepy', 'angry', 'shades'] as const;
export const HAIRSTYLES = ['bald', 'buzz', 'mohawk', 'bun', 'curly', 'long', 'combover'] as const;
export const HATS = [
	'none',
	'beret',
	'cap',
	'helmet',
	'ushanka',
	'crown',
	'ogre-ears',
	'lula',
	'monocle',
	'cylinder',
	'cat-ears'
] as const;

/** Skin tones from light to deep; the first matches the game's caricature skin token */
export const SKIN_COLORS = [
	'#f6c9a0',
	'#f1d3b8',
	'#e0a878',
	'#c58a5a',
	'#9b6440',
	'#6b4128',
	'#9fd36a'
] as const;
export const SHIRT_COLORS = [
	'#7c8c5c',
	'#4fa8d8',
	'#e5484d',
	'#f5c83a',
	'#6a7c9b',
	'#111111',
	'#ffffff',
	'#b45cd6',
	'#8a5a33'
] as const;
export const HAIR_COLORS = [
	'#111111',
	'#5a3a22',
	'#a8642e',
	'#e8c35a',
	'#d9d9d9',
	'#e5484d',
	'#4fa8d8'
] as const;

export type ShirtType = (typeof SHIRT_TYPES)[number];
export type FaceShape = (typeof FACE_SHAPES)[number];
export type Nose = (typeof NOSES)[number];
export type EyeType = (typeof EYE_TYPES)[number];
export type Hairstyle = (typeof HAIRSTYLES)[number];
export type Hat = (typeof HATS)[number];
export type FacialHair = (typeof FACIAL_HAIR)[number];

export interface AvatarLook {
	version: 1;
	shirt: ShirtType;
	shirtColor: string;
	face: FaceShape;
	skin: string;
	nose: Nose;
	eyes: EyeType;
	hair: Hairstyle;
	hairColor: string;
	hat: Hat;
	facial: FacialHair;
}

/** The parts the editor offers, each with its list of choices, in the order they are shown */
export const LOOK_PARTS = {
	shirt: SHIRT_TYPES,
	shirtColor: SHIRT_COLORS,
	face: FACE_SHAPES,
	skin: SKIN_COLORS,
	eyes: EYE_TYPES,
	nose: NOSES,
	hair: HAIRSTYLES,
	hairColor: HAIR_COLORS,
	hat: HATS,
	facial: FACIAL_HAIR
} as const satisfies Record<Exclude<keyof AvatarLook, 'version'>, readonly string[]>;

export type LookPart = keyof typeof LOOK_PARTS;

export const DEFAULT_LOOK: AvatarLook = {
	version: 1,
	shirt: 'tee',
	shirtColor: SHIRT_COLORS[0],
	face: 'round',
	skin: SKIN_COLORS[0],
	nose: 'button',
	eyes: 'dots',
	hair: 'buzz',
	hairColor: HAIR_COLORS[1],
	hat: 'none',
	facial: 'none'
};

/** A ready-made agent that sets every part at once; the editor shows these as shortcuts */
export interface LookPreset {
	id: string;
	/** A name of its own, the same in every language: both are well-known characters */
	name: string;
	look: AvatarLook;
}

/**
 * Two familiar faces built from the same parts as any other agent. They are shortcuts, not a
 * separate unlock: each still needs every part it uses to be open, so the suit still asks for the
 * career level and the green skin still asks for the top one.
 */
export const LOOK_PRESETS: readonly LookPreset[] = [
	{
		id: 'agent-47',
		name: 'Agent 47',
		look: {
			version: 1,
			shirt: 'suit',
			shirtColor: '#111111',
			face: 'square',
			skin: '#f1d3b8',
			nose: 'button',
			eyes: 'angry',
			hair: 'bald',
			hairColor: '#111111',
			hat: 'none',
			facial: 'none'
		}
	},
	{
		id: 'ogre',
		name: 'Shrek',
		look: {
			version: 1,
			shirt: 'tee',
			shirtColor: '#8a5a33',
			face: 'square',
			skin: '#9fd36a',
			nose: 'potato',
			eyes: 'dots',
			hair: 'bald',
			hairColor: '#111111',
			hat: 'ogre-ears',
			facial: 'none'
		}
	}
];

/**
 * The agent shown to a player who is not signed in with Telegram: a hooded figure in shadow. Its
 * colours are outside the editor's lists on purpose, so it can never be saved or picked.
 */
export const ANONYMOUS_LOOK: AvatarLook = {
	version: 1,
	shirt: 'hoodie',
	shirtColor: '#2b2b2b',
	face: 'oval',
	skin: '#4a4a4a',
	nose: 'button',
	eyes: 'shades',
	hair: 'bald',
	hairColor: '#111111',
	hat: 'none',
	facial: 'none'
};

/** A random look; the same seed always gives the same look */
export function randomLook(seed: number = randomSeed(), allowed?: LookAllowed): AvatarLook {
	const random = createRandom(seed);
	// The ogre ears belong to the ready-made green agent, not to a random passer-by
	const randomHats = HATS.filter((hat) => hat !== 'ogre-ears');
	return {
		version: 1,
		shirt: pickAllowed(random, 'shirt', SHIRT_TYPES, DEFAULT_LOOK.shirt, allowed),
		shirtColor: pickAllowed(random, 'shirtColor', SHIRT_COLORS, DEFAULT_LOOK.shirtColor, allowed),
		face: pickAllowed(random, 'face', FACE_SHAPES, DEFAULT_LOOK.face, allowed),
		// The green "alien" tone is a joke option, not something to hand out at random
		skin: pickAllowed(random, 'skin', SKIN_COLORS.slice(0, -1), DEFAULT_LOOK.skin, allowed),
		nose: pickAllowed(random, 'nose', NOSES, DEFAULT_LOOK.nose, allowed),
		eyes: pickAllowed(random, 'eyes', EYE_TYPES, DEFAULT_LOOK.eyes, allowed),
		hair: pickAllowed(random, 'hair', HAIRSTYLES, DEFAULT_LOOK.hair, allowed),
		hairColor: pickAllowed(random, 'hairColor', HAIR_COLORS, DEFAULT_LOOK.hairColor, allowed),
		// Most agents go bareheaded, so a hat stays a little special
		hat:
			random() < 0.6
				? 'none'
				: pickAllowed(random, 'hat', randomHats.slice(1), DEFAULT_LOOK.hat, allowed),
		// Few agents wear a mustache, and only one that is open to them
		facial:
			random() < 0.85 ? 'none' : pickAllowed(random, 'facial', FACIAL_HAIR, DEFAULT_LOOK.facial, allowed)
	};
}

/** A predicate saying which options may be used, for example only the unlocked ones */
export type LookAllowed = (part: LookPart, value: string) => boolean;

function pickAllowed<T extends string>(
	random: Random,
	part: LookPart,
	options: readonly T[],
	fallback: T,
	allowed?: LookAllowed
): T {
	if (!allowed) return pickOne(random, options);
	const open = options.filter((value) => allowed(part, value));
	return open.length > 0 ? pickOne(random, open) : fallback;
}

/** Sets one part, ignoring a value that is not one of that part's choices */
export function withPart<P extends LookPart>(look: AvatarLook, part: P, value: string): AvatarLook {
	if (!(LOOK_PARTS[part] as readonly string[]).includes(value)) return look;
	return { ...look, [part]: value };
}

/** Steps a part to its next (or previous) choice, wrapping around at the ends */
export function cyclePart(look: AvatarLook, part: LookPart, step = 1): AvatarLook {
	const options = LOOK_PARTS[part] as readonly string[];
	const index = options.indexOf(look[part]);
	const next = options[(((index + step) % options.length) + options.length) % options.length];
	return { ...look, [part]: next };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export function isAvatarLook(value: unknown): value is AvatarLook {
	if (!isRecord(value) || value.version !== 1) return false;
	return (Object.keys(LOOK_PARTS) as LookPart[]).every(
		(part) =>
			typeof value[part] === 'string' &&
			(LOOK_PARTS[part] as readonly string[]).includes(value[part] as string)
	);
}

/** A saved look, or null if what came back from storage is not one */
export function parseLook(value: unknown): AvatarLook | null {
	// Looks saved before the mustache existed have no such part: they get the default one
	const upgraded =
		isRecord(value) && value.version === 1 && value.facial === undefined
			? { ...value, facial: DEFAULT_LOOK.facial }
			: value;
	return isAvatarLook(upgraded) ? upgraded : null;
}

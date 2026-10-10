/* The three building sizes the player can pick, and what each one is made of */

export const SIZE_IDS = ['small', 'medium', 'large'] as const;
export type SizeId = (typeof SIZE_IDS)[number];

export interface MazeConfig {
	width: number;
	height: number;
	/** Locked doors on the way to the goal; each needs its own document found somewhere else */
	locks: number;
	/** Offices closed until Tuesday */
	closed: number;
	/** Chance (0 to 1) of an extra door between two neighbouring offices that are not connected yet */
	loops: number;
	/** Chance (0 to 1) that the tree grows from the newest office: high gives long corridors, low many dead ends */
	winding: number;
}

export const SIZES: Record<SizeId, MazeConfig> = {
	small: { width: 5, height: 4, locks: 2, closed: 2, loops: 0.12, winding: 0.5 },
	medium: { width: 6, height: 5, locks: 3, closed: 3, loops: 0.1, winding: 0.5 },
	large: { width: 7, height: 6, locks: 4, closed: 5, loops: 0.08, winding: 0.5 }
};

export function isSizeId(value: unknown): value is SizeId {
	return typeof value === 'string' && (SIZE_IDS as readonly string[]).includes(value);
}

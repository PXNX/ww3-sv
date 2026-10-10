/* The fur colours of the cats: the cat drawing and the notes' colour dots must agree. */
import type { Coat } from '#lib/game/purrpentagram/cats.js';

export const COAT_COLORS: Record<Coat, { fur: string; shade: string }> = {
	black: { fur: '#2b2b33', shade: '#16161c' },
	ginger: { fur: '#e38b3a', shade: '#b4601c' },
	white: { fur: '#f4f0e6', shade: '#c9c2b2' },
	grey: { fur: '#8e949e', shade: '#626872' },
	tabby: { fur: '#a1714a', shade: '#6b4528' }
};

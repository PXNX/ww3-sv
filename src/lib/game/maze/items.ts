/*
 * How the documents look: one fixed color each (all readable against the dark ink outline), so a
 * locked door and the stamp or form that opens it always match. The shapes differ too (see
 * MazeItemIcon.svelte), so no document relies on color alone.
 */
import type { ItemKind } from './maze';

export const ITEM_COLORS: Record<ItemKind | 'permit', string> = {
	'entry-stamp': '#e5484d',
	'approval-stamp': '#4fae6a',
	'form-27b': '#4a78c8',
	'form-annex': '#ddb93c',
	seal: '#9a62c8',
	permit: '#f5c83a'
};

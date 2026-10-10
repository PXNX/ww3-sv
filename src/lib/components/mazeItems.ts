/* Display names of the maze documents, in the current language */
import type { ItemKind } from '#lib/game/maze/maze.js';
import { m } from '#lib/paraglide/messages.js';

export const ITEM_NAMES: Record<ItemKind | 'permit', () => string> = {
	'entry-stamp': m.maze_item_entry_stamp,
	'approval-stamp': m.maze_item_approval_stamp,
	'form-27b': m.maze_item_form_27b,
	'form-annex': m.maze_item_form_annex,
	seal: m.maze_item_seal,
	permit: m.maze_item_permit
};

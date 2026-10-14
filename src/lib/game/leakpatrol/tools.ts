/*
 * The tools lying around the West Wing: the Sharpie seals a leak for good, tape seals it for a
 * while, and the CLASSIFIED folder absorbs one burst. The inventory is a plain count per kind.
 */
import { pickWeighted, type Random } from '../random.js';
import { MAX_TOOLS_PER_KIND, TOOL_WEIGHTS } from './config.js';

export type ToolKind = 'sharpie' | 'tape' | 'folder';
export const TOOLS: readonly ToolKind[] = ['sharpie', 'tape', 'folder'];

/** Tools that the player arms and then applies to a leak (the folder works on its own) */
export function isHandTool(tool: ToolKind): boolean {
	return tool !== 'folder';
}

export type Inventory = Record<ToolKind, number>;

export function emptyInventory(): Inventory {
	return { sharpie: 0, tape: 0, folder: 0 };
}

export function pickTool(random: Random): ToolKind {
	return pickWeighted(random, TOOL_WEIGHTS);
}

/** True when there is room in the pocket for one more of this tool */
export function canAdd(inventory: Inventory, tool: ToolKind): boolean {
	return inventory[tool] < MAX_TOOLS_PER_KIND;
}

/** Adds one tool; returns false (and changes nothing) when the pocket for it is full */
export function addTool(inventory: Inventory, tool: ToolKind): boolean {
	if (!canAdd(inventory, tool)) return false;
	inventory[tool] += 1;
	return true;
}

/** Uses up one tool; returns false when there is none */
export function takeTool(inventory: Inventory, tool: ToolKind): boolean {
	if (inventory[tool] <= 0) return false;
	inventory[tool] -= 1;
	return true;
}

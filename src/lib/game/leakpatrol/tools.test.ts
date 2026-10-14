import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { MAX_TOOLS_PER_KIND } from './config.js';
import { addTool, canAdd, emptyInventory, isHandTool, pickTool, takeTool, TOOLS } from './tools.js';

describe('tools', () => {
	it('starts empty', () => {
		expect(emptyInventory()).toEqual({ sharpie: 0, tape: 0, folder: 0 });
	});

	it('adds and takes tools one by one', () => {
		const inventory = emptyInventory();
		expect(takeTool(inventory, 'tape')).toBe(false);
		expect(addTool(inventory, 'tape')).toBe(true);
		expect(inventory.tape).toBe(1);
		expect(takeTool(inventory, 'tape')).toBe(true);
		expect(inventory.tape).toBe(0);
	});

	it('limits every kind to the pocket size', () => {
		const inventory = emptyInventory();
		for (let i = 0; i < MAX_TOOLS_PER_KIND; i++) expect(addTool(inventory, 'sharpie')).toBe(true);
		expect(canAdd(inventory, 'sharpie')).toBe(false);
		expect(addTool(inventory, 'sharpie')).toBe(false);
		expect(inventory.sharpie).toBe(MAX_TOOLS_PER_KIND);
		expect(canAdd(inventory, 'tape')).toBe(true);
	});

	it('knows which tools are armed by hand', () => {
		expect(isHandTool('sharpie')).toBe(true);
		expect(isHandTool('tape')).toBe(true);
		expect(isHandTool('folder')).toBe(false);
	});

	it('eventually picks every kind, deterministically', () => {
		const random = createRandom(3);
		const seen = new Set(Array.from({ length: 80 }, () => pickTool(random)));
		expect([...seen].sort()).toEqual([...TOOLS].sort());
		const a = createRandom(9);
		const b = createRandom(9);
		expect(pickTool(a)).toBe(pickTool(b));
	});
});

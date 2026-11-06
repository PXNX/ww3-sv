import { describe, expect, it } from 'vitest';
import {
	applySnapshot,
	importCodeOf,
	importStartParam,
	parseCloudCopy,
	planSync,
	takeSnapshot
} from './cloudSave';

function memory(initial: Record<string, string> = {}) {
	const map = new Map(Object.entries(initial));
	return {
		get length() {
			return map.size;
		},
		key: (index: number) => [...map.keys()][index] ?? null,
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key),
		map
	};
}

describe('the cloud save', () => {
	it('snapshots only the app keys, without its own bookkeeping', () => {
		const storage = memory({
			'ww3:beachhead:save': '{"a":1}',
			'ww3:cloud:synced': '5',
			'other:thing': 'x'
		});
		expect(takeSnapshot(storage)).toEqual({ 'beachhead:save': '{"a":1}' });
	});

	it('replaces the progress with a snapshot but keeps the bookkeeping and foreign keys', () => {
		const storage = memory({ 'ww3:old': '1', 'ww3:cloud:synced': '5', 'other:thing': 'x' });
		applySnapshot(storage, { new: '2' });
		expect(Object.fromEntries(storage.map)).toEqual({
			'ww3:new': '2',
			'ww3:cloud:synced': '5',
			'other:thing': 'x'
		});
	});

	it('refuses snapshots with non-string values', () => {
		expect(parseCloudCopy({ data: { a: 1 }, updated_at: 5 })).toBeNull();
		expect(parseCloudCopy({ data: null })).toEqual({ data: null, updatedAt: 0 });
		expect(parseCloudCopy({ data: { a: '1' }, updated_at: 5 })?.data).toEqual({ a: '1' });
	});

	it('uploads to an empty account and downloads to a fresh device', () => {
		const empty = { data: null, updatedAt: 0 };
		const full = { data: { 'beachhead:save': '{}' }, updatedAt: 100 };
		expect(planSync(empty, { changed: 0, synced: 0, any: true })).toBe('upload');
		expect(planSync(empty, { changed: 0, synced: 0, any: false })).toBe('nothing');
		expect(planSync(full, { changed: 50, synced: 0, any: true })).toBe('download');
	});

	it('lets the newer side win once the device has synced before', () => {
		const cloud = { data: { 'beachhead:save': '{}' }, updatedAt: 200 };
		expect(planSync(cloud, { changed: 100, synced: 100, any: true })).toBe('download');
		expect(planSync(cloud, { changed: 300, synced: 200, any: true })).toBe('upload');
		expect(planSync(cloud, { changed: 250, synced: 100, any: true })).toBe('upload');
		expect(planSync(cloud, { changed: 150, synced: 100, any: true })).toBe('download');
		expect(planSync(cloud, { changed: 200, synced: 200, any: true })).toBe('nothing');
	});

	it('reads transfer codes from the start parameter', () => {
		expect(importCodeOf(importStartParam('abc123XY'))).toBe('abc123XY');
		expect(importCodeOf('import_x')).toBeNull();
		expect(importCodeOf('squad_abcdef')).toBeNull();
	});
});

/*
 * The cloud save: inside Telegram the whole progress (everything the app keeps under its storage
 * prefix) is mirrored to the bot's server, so it survives a new phone or a cleared app. In a normal
 * browser progress stays on the device, and a transfer code carries it into the Telegram account:
 * the browser uploads a snapshot without an account, opens the Mini App with `startapp=import_<code>`,
 * and the Mini App takes the snapshot over once the player agrees. See docs/cloud-save-api.md.
 */
import { apiUrl, call, TelegramCallError } from '#lib/services/telegram.js';
import { CLOUD_META, STORAGE_PREFIX, type KeyValueStorage } from '#lib/services/storage.js';

/** The raw stored values by key, without the prefix */
export type Snapshot = Record<string, string>;

export interface CloudCopy {
	data: Snapshot | null;
	/** When the server stored it, ms since the epoch; 0 when there is none */
	updatedAt: number;
}

/** The start parameter of a transfer link: `import_` and the code */
const IMPORT_PREFIX = 'import_';
const IMPORT_CODE = /^[A-Za-z0-9_-]{6,40}$/;
/** The server refuses bigger snapshots; the client does not even try */
export const MAX_SNAPSHOT_BYTES = 512 * 1024;
/** Local bookkeeping, kept out of the snapshot itself */
export const CHANGED_KEY = `${CLOUD_META}changed`;
export const SYNCED_KEY = `${CLOUD_META}synced`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Everything the app stored, except the cloud save's own bookkeeping */
export function takeSnapshot(
	storage: KeyValueStorage & { length: number; key(index: number): string | null }
): Snapshot {
	const data: Snapshot = {};
	for (let index = 0; index < storage.length; index++) {
		const full = storage.key(index);
		if (!full?.startsWith(STORAGE_PREFIX)) continue;
		const key = full.slice(STORAGE_PREFIX.length);
		if (key.startsWith(CLOUD_META) || key === 'probe') continue;
		const value = storage.getItem(full);
		if (value !== null) data[key] = value;
	}
	return data;
}

/** Replaces the stored progress with a snapshot; the bookkeeping keys stay */
export function applySnapshot(
	storage: KeyValueStorage & { length: number; key(index: number): string | null },
	data: Snapshot
): void {
	const stale: string[] = [];
	for (let index = 0; index < storage.length; index++) {
		const full = storage.key(index);
		if (!full?.startsWith(STORAGE_PREFIX)) continue;
		if (full.slice(STORAGE_PREFIX.length).startsWith(CLOUD_META)) continue;
		stale.push(full);
	}
	for (const full of stale) storage.removeItem(full);
	for (const [key, value] of Object.entries(data)) storage.setItem(STORAGE_PREFIX + key, value);
}

export function snapshotSize(data: Snapshot): number {
	return new TextEncoder().encode(JSON.stringify(data)).length;
}

export function hasProgress(data: Snapshot | null): boolean {
	return data !== null && Object.keys(data).some((key) => !key.startsWith('settings:'));
}

/** A snapshot from the wire, or null when malformed: string values under sane keys only */
export function parseSnapshot(value: unknown): Snapshot | null {
	if (!isRecord(value)) return null;
	const data: Snapshot = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry !== 'string' || key.length === 0 || key.length > 200) return null;
		if (key.startsWith(CLOUD_META)) continue;
		data[key] = entry;
	}
	return data;
}

export function parseCloudCopy(value: unknown): CloudCopy | null {
	if (!isRecord(value)) return null;
	const updatedAt = value.updated_at ?? 0;
	if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt < 0) return null;
	if (value.data === null || value.data === undefined) return { data: null, updatedAt: 0 };
	const data = parseSnapshot(value.data);
	return data ? { data, updatedAt } : null;
}

export type SyncPlan = 'upload' | 'download' | 'nothing';

/**
 * What to do when the app opens in Telegram. `changed` is the last local change, `synced` the
 * server time of the copy this device last matched. The newer side wins; a device that never
 * synced and holds progress uploads it only when the account has none yet.
 */
export function planSync(
	cloud: CloudCopy,
	local: { changed: number; synced: number; any: boolean }
): SyncPlan {
	if (!hasProgress(cloud.data)) return local.any ? 'upload' : 'nothing';
	if (local.synced === 0) return 'download';
	const localDirty = local.changed > local.synced;
	const cloudNewer = cloud.updatedAt > local.synced;
	if (cloudNewer && (!localDirty || cloud.updatedAt >= local.changed)) return 'download';
	return localDirty ? 'upload' : 'nothing';
}

/** The code in a start parameter such as `import_ab12cd34`, or null for any other */
export function importCodeOf(startParam: string | null | undefined): string | null {
	if (!startParam?.startsWith(IMPORT_PREFIX)) return null;
	const code = startParam.slice(IMPORT_PREFIX.length);
	return IMPORT_CODE.test(code) ? code : null;
}

export function importStartParam(code: string): string {
	return IMPORT_PREFIX + code;
}

export const cloudSave = {
	load: async (): Promise<CloudCopy> => {
		const copy = parseCloudCopy(await call<unknown>('progress_load', {}));
		if (!copy) throw new TelegramCallError('UNKNOWN', 'Unexpected progress_load reply');
		return copy;
	},
	/** Stores the snapshot; the reply is the server's time for it */
	save: async (data: Snapshot): Promise<number> => {
		const reply = await call<unknown>('progress_save', { data });
		const updatedAt = isRecord(reply) ? reply.updated_at : undefined;
		if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
			throw new TelegramCallError('UNKNOWN', 'Unexpected progress_save reply');
		}
		return updatedAt;
	},
	/** Takes over the snapshot a browser uploaded with a transfer code */
	claim: async (code: string): Promise<Snapshot> => {
		const reply = await call<unknown>('progress_import', { code });
		const data = isRecord(reply) ? parseSnapshot(reply.data) : null;
		if (!data) throw new TelegramCallError('UNKNOWN', 'Unexpected progress_import reply');
		return data;
	},
	/**
	 * Uploads the browser's progress without an account and returns the transfer code. Needs the
	 * bot's own server; without one it fails with `UNAVAILABLE` and the link opens the bot plainly.
	 */
	transfer: async (data: Snapshot): Promise<string> => {
		const url = apiUrl();
		if (!url) throw new TelegramCallError('UNAVAILABLE');
		let response: Response;
		try {
			response = await fetch(`${url}/api/progress_transfer`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ data })
			});
		} catch {
			throw new TelegramCallError('UNKNOWN', 'Network');
		}
		const body: unknown = await response.json().catch(() => null);
		const result = isRecord(body) && body.ok === true && isRecord(body.result) ? body.result : null;
		const code = result?.code;
		if (typeof code !== 'string' || !IMPORT_CODE.test(code)) {
			throw new TelegramCallError('UNKNOWN', 'Unexpected progress_transfer reply');
		}
		return code;
	}
};

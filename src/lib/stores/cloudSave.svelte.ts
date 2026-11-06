/*
 * Runs the cloud save (services/cloudSave.ts). In Telegram it settles once at launch which side is
 * newer, then mirrors every change to the bot's server a few seconds after it happens and again when
 * the app goes to the background. A transfer link from the browser asks before replacing anything.
 * Taking over a copy from the server rewrites local storage and reloads, because every game reads
 * its save when it starts. In a normal browser it only offers the move to Telegram.
 */
import {
	CHANGED_KEY,
	MAX_SNAPSHOT_BYTES,
	SYNCED_KEY,
	applySnapshot,
	cloudSave as server,
	hasProgress,
	importCodeOf,
	importStartParam,
	planSync,
	snapshotSize,
	takeSnapshot,
	type Snapshot
} from '#lib/services/cloudSave.js';
import { CLOUD_META, localStore, onStoreWrite } from '#lib/services/storage.js';
import { loadTelegram, telegramAppLink } from '#lib/services/telegram.js';

export type CloudStatus = 'off' | 'syncing' | 'saved' | 'failed';

const UPLOAD_DELAY_MS = 4000;
const HINT_DISMISSED_KEY = `${CLOUD_META}hint-dismissed`;

function browserLocal(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

class CloudSaveStore {
	status = $state<CloudStatus>('off');
	/** A browser's progress waiting for the player to agree to take it over */
	pendingImport = $state.raw<Snapshot | null>(null);
	/** The web hint was closed on this device */
	hintDismissed = $state(false);
	/** The browser holds progress worth carrying over */
	hasLocalProgress = $state(false);
	transferring = $state(false);

	#started = false;
	#timer: ReturnType<typeof setTimeout> | undefined;

	/** Call once in the browser with the launch's start parameter */
	async start(startParam: string | null): Promise<void> {
		if (this.#started) return;
		this.#started = true;
		const storage = browserLocal();
		this.hintDismissed = localStore().read<unknown>(HINT_DISMISSED_KEY, false) === true;
		this.hasLocalProgress = storage ? hasProgress(takeSnapshot(storage)) : false;
		const app = await loadTelegram();
		if (!app || !storage) return;

		this.status = 'syncing';
		try {
			const code = importCodeOf(startParam);
			if (code) {
				const data = await server.claim(code);
				if (hasProgress(data)) this.pendingImport = data;
			}
			const cloud = await server.load();
			const plan = planSync(cloud, {
				changed: this.#number(CHANGED_KEY),
				synced: this.#number(SYNCED_KEY),
				any: hasProgress(takeSnapshot(storage))
			});
			if (plan === 'download' && cloud.data && !this.pendingImport) {
				this.#takeOver(storage, cloud.data, cloud.updatedAt);
				return;
			}
			if (plan === 'upload') await this.#upload();
			else this.status = 'saved';
		} catch (error) {
			console.warn('cloud save', error);
			this.status = 'failed';
		}

		onStoreWrite(() => {
			localStore().write(CHANGED_KEY, Date.now());
			clearTimeout(this.#timer);
			this.#timer = setTimeout(() => void this.#upload(), UPLOAD_DELAY_MS);
		});
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState !== 'hidden') return;
			if (this.#number(CHANGED_KEY) <= this.#number(SYNCED_KEY)) return;
			clearTimeout(this.#timer);
			void this.#upload();
		});
	}

	/** The player agreed: the browser's progress replaces what this account had */
	async acceptImport() {
		const data = this.pendingImport;
		const storage = browserLocal();
		if (!data || !storage) return;
		this.pendingImport = null;
		applySnapshot(storage, data);
		try {
			const updatedAt = await server.save(data);
			this.#takeOver(storage, data, updatedAt);
		} catch {
			// The copy is local now; the next change uploads it
			localStore().write(CHANGED_KEY, Date.now());
			location.reload();
		}
	}

	declineImport() {
		this.pendingImport = null;
	}

	dismissHint() {
		this.hintDismissed = true;
		localStore().write(HINT_DISMISSED_KEY, true);
	}

	/**
	 * From the browser: uploads the progress under a transfer code and opens the Mini App on it. When
	 * that is not possible the bot opens plainly and the player starts fresh there.
	 */
	async moveToTelegram() {
		if (this.transferring) return;
		this.transferring = true;
		let link = telegramAppLink();
		const storage = browserLocal();
		try {
			const data = storage ? takeSnapshot(storage) : {};
			if (hasProgress(data) && snapshotSize(data) <= MAX_SNAPSHOT_BYTES) {
				link = telegramAppLink(importStartParam(await server.transfer(data)));
			}
		} catch (error) {
			console.warn('cloud transfer', error);
		}
		this.transferring = false;
		location.href = link;
	}

	#number(key: string): number {
		const value = localStore().read<unknown>(key, 0);
		return typeof value === 'number' && Number.isFinite(value) ? value : 0;
	}

	async #upload() {
		const storage = browserLocal();
		if (!storage) return;
		const data = takeSnapshot(storage);
		if (snapshotSize(data) > MAX_SNAPSHOT_BYTES) {
			this.status = 'failed';
			return;
		}
		this.status = 'syncing';
		try {
			const updatedAt = await server.save(data);
			localStore().write(SYNCED_KEY, updatedAt);
			localStore().write(CHANGED_KEY, updatedAt);
			this.status = 'saved';
		} catch (error) {
			console.warn('cloud save', error);
			this.status = 'failed';
		}
	}

	#takeOver(storage: Storage, data: Snapshot, updatedAt: number) {
		applySnapshot(storage, data);
		localStore().write(SYNCED_KEY, updatedAt);
		localStore().write(CHANGED_KEY, updatedAt);
		location.reload();
	}
}

let shared: CloudSaveStore | undefined;

export function cloudSave(): CloudSaveStore {
	shared ??= new CloudSaveStore();
	return shared;
}

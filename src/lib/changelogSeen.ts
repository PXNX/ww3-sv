/*
 * Remembers the newest release the player has opened the version history for, per device. Uses the
 * app's defensive store, so a browser with storage disabled simply gets the sheet shown again.
 */
import { localStore } from '#lib/services/storage.js';
import { isAppVersion, type AppVersion } from './version.js';

const LAST_SEEN_KEY = 'changelog:lastSeen';

export function lastSeenVersion(): AppVersion | null {
	return localStore().read<AppVersion | null>(
		LAST_SEEN_KEY,
		null,
		(value): value is AppVersion | null => value === null || isAppVersion(value)
	);
}

export function markVersionSeen(version: AppVersion): void {
	localStore().write(LAST_SEEN_KEY, version);
}

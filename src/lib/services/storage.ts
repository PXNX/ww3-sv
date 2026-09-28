/*
 * Defensive local storage wrapper. Every read and write tolerates unavailable storage (private
 * browsing, disabled cookies, quota exceeded) so the game never breaks because of it.
 */

export interface KeyValueStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface Store {
	read<T>(key: string, fallback: T, isValid?: (value: unknown) => value is T): T;
	write(key: string, value: unknown): boolean;
	remove(key: string): void;
}

const PREFIX = 'ww3:';

export function browserStorage(): KeyValueStorage | null {
	try {
		if (typeof localStorage === 'undefined') return null;
		const probe = `${PREFIX}probe`;
		localStorage.setItem(probe, '1');
		localStorage.removeItem(probe);
		return localStorage;
	} catch {
		return null;
	}
}

export function createStore(storage: KeyValueStorage | null): Store {
	return {
		read(key, fallback, isValid) {
			if (!storage) return fallback;
			try {
				const raw = storage.getItem(PREFIX + key);
				if (raw === null) return fallback;
				const value: unknown = JSON.parse(raw);
				if (isValid && !isValid(value)) return fallback;
				return value as typeof fallback;
			} catch {
				return fallback;
			}
		},
		write(key, value) {
			if (!storage) return false;
			try {
				storage.setItem(PREFIX + key, JSON.stringify(value));
				return true;
			} catch {
				return false;
			}
		},
		remove(key) {
			try {
				storage?.removeItem(PREFIX + key);
			} catch {
				// Nothing to do: storage is unavailable
			}
		}
	};
}

let shared: Store | undefined;

/** The app-wide store backed by the browser's local storage (created on first use) */
export function localStore(): Store {
	shared ??= createStore(browserStorage());
	return shared;
}

export function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

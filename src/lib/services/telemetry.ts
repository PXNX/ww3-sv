/*
 * Local-only telemetry.
 *
 * Events are diagnostics for the player, not analytics: they stay in this browser under their own
 * storage key, are never sent over the network and never join the cloud save (which collects keys
 * under the app's own prefix). Nothing free-form, identifying or Telegram-related is recorded —
 * only event names, the route and small primitive properties. The dashboard at /telemetry reads
 * the same log and can export or clear it.
 */

import type { KeyValueStorage } from './storage.js';

export const TELEMETRY_PREFIX = 'telemetry:';
export const TELEMETRY_KEY = `${TELEMETRY_PREFIX}log:v1`;
/** Old events fall off the end so the log cannot grow without bound */
export const MAX_EVENTS = 500;
/** A new session starts after this much time without an event */
const SESSION_IDLE_MS = 30 * 60 * 1000;

export type TelemetryValue = string | number | boolean;
export type TelemetryProps = Record<string, TelemetryValue>;

export interface TelemetryEvent {
	id: string;
	at: number;
	session: string;
	name: string;
	props: TelemetryProps;
}

interface Log {
	session: string;
	startedAt: number;
	lastAt: number;
	events: TelemetryEvent[];
}

const NAME = /^[a-z][a-z0-9_]{1,39}$/;
// Never store credentials, launch parameters, contact details or free text
const SENSITIVE = /(token|secret|password|initdata|auth|email|phone|address|query|hash|message|text)/i;

function memoryStorage(): KeyValueStorage {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => void values.set(key, value),
		removeItem: (key) => void values.delete(key)
	};
}

/** localStorage when it is available, an in-memory log otherwise (private mode, SSR, tests) */
export function browserTelemetryStorage(): KeyValueStorage {
	try {
		if (typeof localStorage === 'undefined') return memoryStorage();
		const probe = `${TELEMETRY_PREFIX}probe`;
		localStorage.setItem(probe, '1');
		localStorage.removeItem(probe);
		return localStorage;
	} catch {
		return memoryStorage();
	}
}

/** Keeps only safe, bounded primitive properties */
export function sanitizeProps(props: TelemetryProps | undefined): TelemetryProps {
	const safe: TelemetryProps = {};
	if (!props) return safe;
	for (const [key, value] of Object.entries(props)) {
		if (Object.keys(safe).length >= 10 || key.length > 32 || SENSITIVE.test(key)) continue;
		if (typeof value === 'string') {
			if (value) safe[key] = value.slice(0, 80);
		} else if (typeof value === 'number') {
			if (Number.isFinite(value)) safe[key] = value;
		} else if (typeof value === 'boolean') {
			safe[key] = value;
		}
	}
	return safe;
}

function validLog(value: unknown): Log | null {
	if (!value || typeof value !== 'object') return null;
	const log = value as Partial<Log>;
	if (
		typeof log.session !== 'string' ||
		!Number.isFinite(log.startedAt) ||
		!Number.isFinite(log.lastAt) ||
		!Array.isArray(log.events)
	) {
		return null;
	}
	return log as Log;
}

export interface Telemetry {
	/** Records one event; a bad name or unavailable storage is silently ignored */
	track(name: string, props?: TelemetryProps): void;
	/** Most recent events first */
	events(): TelemetryEvent[];
	/** Event counts, most frequent first */
	counts(): { name: string; count: number }[];
	/** The current session id */
	session(): string;
	/** Removes all events but keeps the session */
	clear(): void;
	/** The whole log as JSON, for a manual export */
	exportJson(): string;
}

export interface TelemetryOptions {
	now?: () => number;
	random?: () => number;
	limit?: number;
}

export function createTelemetry(
	storage: KeyValueStorage = memoryStorage(),
	{ now = Date.now, random = Math.random, limit = MAX_EVENTS }: TelemetryOptions = {}
): Telemetry {
	let cached: Log | null | undefined;

	function read(): Log {
		if (cached !== undefined) return cached;
		let loaded: Log | null = null;
		try {
			const raw = storage.getItem(TELEMETRY_KEY);
			if (raw) loaded = validLog(JSON.parse(raw));
		} catch {
			loaded = null;
		}
		if (loaded) {
			cached = loaded;
			return loaded;
		}
		const at = now();
		const fresh: Log = { session: newSession(at), startedAt: at, lastAt: at, events: [] };
		cached = fresh;
		return fresh;
	}

	function newSession(at: number) {
		return `s-${Math.floor(at).toString(36)}-${Math.floor(random() * 1e6).toString(36)}`;
	}

	function write(log: Log) {
		cached = log;
		try {
			storage.setItem(TELEMETRY_KEY, JSON.stringify(log));
		} catch {
			// A full or disabled storage must never break the game
		}
	}

	return {
		track(name, props) {
			if (!NAME.test(name)) return;
			const at = now();
			const log = read();
			if (at - log.lastAt > SESSION_IDLE_MS) {
				log.session = newSession(at);
				log.startedAt = at;
			}
			log.lastAt = at;
			log.events.push({
				id: `${at.toString(36)}-${Math.floor(random() * 1e9).toString(36)}`,
				at,
				session: log.session,
				name,
				props: sanitizeProps(props)
			});
			if (log.events.length > limit) log.events.splice(0, log.events.length - limit);
			write(log);
		},
		events() {
			return [...read().events].reverse();
		},
		counts() {
			const totals = new Map<string, number>();
			for (const event of read().events) totals.set(event.name, (totals.get(event.name) ?? 0) + 1);
			return [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
		},
		session() {
			return read().session;
		},
		clear() {
			const log = read();
			write({ ...log, events: [] });
		},
		exportJson() {
			return JSON.stringify(read(), null, 2);
		}
	};
}

/** The app-wide log; safe to import from any page or component */
export const telemetry = createTelemetry(browserTelemetryStorage());

/*
 * Other players as opponents, client side: in Beachhead their bases can be raided and they can raid
 * yours, in Hermit Hackers their rigs can be hacked and they can hack you back. The bot's server keeps
 * the published bases and rigs, picks opponents, settles who stole what, and keeps the logs (see
 * docs/rivals-api.md). The game publishes its own side, asks for opponents, and applies what others
 * took from it. Every reply is validated here before a store sees it. Outside Telegram every call
 * fails with `UNAVAILABLE` and the modes play alone, exactly as before.
 */
import {
	BUILDINGS,
	COLUMNS,
	ROWS,
	type BuildingKind,
	type IslandBuilding
} from '#lib/game/beachhead/config.js';
import { OVERCHARGE_CRYSTALS } from '#lib/game/beachhead/crystals.js';
import type { Resources } from '#lib/game/beachhead/campaign.js';
import { parseLook, type AvatarLook } from '#lib/game/avatar/look.js';
import { call, endpointCode, TelegramCallError } from '#lib/services/telegram.js';

// ---------------------------------------------------------------------------------------------
// Shared parsing

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isId = (value: unknown): value is string =>
	typeof value === 'string' && value !== '' && value.length <= 64;

const isTime = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value > 0;

/** A whole, non-negative amount, capped so a broken server cannot hand out absurd sums */
function toAmount(value: unknown, cap = 1e9): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
	return Math.min(cap, Math.floor(value));
}

function toName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const name = value.trim().slice(0, 64);
	return name === '' ? null : name;
}

function parseList<T>(value: unknown, parse: (entry: unknown) => T | null, max = 50): T[] | null {
	if (!Array.isArray(value) || value.length > max) return null;
	const items = value.map(parse);
	return items.every((item) => item !== null) ? (items as T[]) : null;
}

/** Another player as the logs name them */
export interface RivalPlayer {
	id: string;
	name: string;
	photoUrl?: string;
}

export function parsePlayer(value: unknown): RivalPlayer | null {
	if (!isRecord(value) || !isId(value.id)) return null;
	const name = toName(value.name);
	if (name === null) return null;
	const photo = value.photo_url;
	return typeof photo === 'string' && photo.startsWith('https://')
		? { id: value.id, name, photoUrl: photo }
		: { id: value.id, name };
}

const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;

export function parseResources(value: unknown): Resources | null {
	if (!isRecord(value)) return null;
	const out = { wood: 0, stone: 0, iron: 0, gold: 0 };
	for (const kind of RESOURCE_KINDS) {
		const amount = toAmount(value[kind] ?? 0, 1e7);
		if (amount === null) return null;
		out[kind] = amount;
	}
	return out;
}

/** The refusals the rival endpoints answer with */
export const RIVAL_ERROR_CODES = [
	'NOT_FOUND',
	'COOLDOWN',
	'SELF',
	'SHIELDED',
	'EXPIRED',
	'IP_TAKEN'
] as const;
export type RivalErrorCode = (typeof RIVAL_ERROR_CODES)[number];

export function rivalErrorCode(error: unknown): RivalErrorCode | null {
	const code = endpointCode(error);
	return RIVAL_ERROR_CODES.find((known) => known === code) ?? null;
}

/** True when the failure only means there is no server here (not in Telegram) */
export function isUnavailable(error: unknown): boolean {
	return error instanceof TelegramCallError && error.type === 'UNAVAILABLE';
}

async function ask<T>(
	name: string,
	input: unknown,
	parse: (value: unknown) => T | null
): Promise<T> {
	const reply = await call<unknown>(name, input);
	const parsed = parse(reply);
	if (parsed === null) throw new TelegramCallError('UNKNOWN', `Unexpected ${name} reply`);
	return parsed;
}

const parseEmpty = (value: unknown): Record<string, never> | null => (isRecord(value) ? {} : null);

// ---------------------------------------------------------------------------------------------
// Beachhead

/** A base as other players attack it: the battle island built from its layout */
export interface BeachheadBase {
	buildings: IslandBuilding[];
	/** The bulwark crystal's toughening, 1 or a little more */
	defenseScale: number;
}

const BUILDING_KINDS = new Set(Object.keys(BUILDINGS));
const MAX_BUILDINGS = 120;

function parseScale(value: unknown): number | undefined | null {
	if (value === undefined) return undefined;
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 20) return null;
	return value;
}

export function parseBuilding(value: unknown): IslandBuilding | null {
	if (!isRecord(value)) return null;
	const { kind, x, y } = value;
	if (typeof kind !== 'string' || !BUILDING_KINDS.has(kind)) return null;
	if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
	if ((x as number) < 0 || (x as number) >= COLUMNS || (y as number) < 0 || (y as number) >= ROWS)
		return null;
	const hpScale = parseScale(value.hp_scale);
	const damageScale = parseScale(value.damage_scale);
	if (hpScale === null || damageScale === null) return null;
	const building: IslandBuilding = { kind: kind as BuildingKind, x: x as number, y: y as number };
	if (hpScale !== undefined) building.hpScale = hpScale;
	if (damageScale !== undefined) building.damageScale = damageScale;
	const crystal = value.crystal;
	if (crystal !== undefined) {
		if (!isRecord(crystal)) return null;
		const level = toAmount(crystal.level, 20);
		const type = OVERCHARGE_CRYSTALS.find((known) => known === crystal.type);
		if (!type || level === null || level < 1) return null;
		building.crystal = { type, level };
	}
	// How the building looks in its owner's base; a wrong one is simply left out
	const look = value.look;
	if (
		isRecord(look) &&
		typeof look.key === 'string' &&
		/^(hq|training|dojo|radar|bunker|warehouse-(wood|stone|iron|gold)-\d|house-\d)$/.test(
			look.key
		) &&
		Number.isInteger(look.level) &&
		(look.level as number) >= 1 &&
		(look.level as number) <= 50
	) {
		building.look = { key: look.key, level: look.level as number };
	}
	return building;
}

export function parseBase(value: unknown): BeachheadBase | null {
	if (!isRecord(value)) return null;
	const buildings = parseList(value.buildings, parseBuilding, MAX_BUILDINGS);
	const defenseScale = parseScale(value.defense_scale ?? 1);
	if (!buildings || !defenseScale) return null;
	// A base without its headquarters cannot be won, so it is no base at all
	if (!buildings.some((building) => building.kind === 'hq')) return null;
	return { buildings, defenseScale };
}

/** What the server is sent about the player's own base */
export function baseToWire(base: BeachheadBase, exposed: Resources, level: number) {
	return {
		base: {
			buildings: base.buildings.map((building) => ({
				kind: building.kind,
				x: building.x,
				y: building.y,
				...(building.hpScale !== undefined ? { hp_scale: building.hpScale } : {}),
				...(building.damageScale !== undefined ? { damage_scale: building.damageScale } : {}),
				...(building.crystal ? { crystal: building.crystal } : {}),
				...(building.look ? { look: building.look } : {})
			})),
			defense_scale: base.defenseScale
		},
		exposed,
		level
	};
}

export interface BeachheadRival extends RivalPlayer {
	/** The headquarters level, a hint of how hard the base is */
	level: number;
	base: BeachheadBase;
	/** What a win takes home */
	loot: Resources;
	/** This player raided you lately: attacking them is revenge */
	revenge: boolean;
}

export function parseRival(value: unknown): BeachheadRival | null {
	const player = parsePlayer(value);
	if (!player || !isRecord(value)) return null;
	const base = parseBase(value.base);
	const loot = parseResources(value.loot);
	const level = toAmount(value.level ?? 1, 99);
	if (!base || !loot || level === null) return null;
	return { ...player, level, base, loot, revenge: value.revenge === true };
}

export interface BeachheadAttack {
	id: string;
	rival: BeachheadRival;
}

/** A line of the player's own raid history */
export interface BeachheadRaid {
	id: string;
	/** raided: somebody took from you; defended: somebody failed; plundered: you took from them */
	kind: 'raided' | 'defended' | 'plundered';
	player: RivalPlayer;
	loot: Resources;
	atMs: number;
}

export function parseRaid(value: unknown): BeachheadRaid | null {
	if (!isRecord(value) || !isId(value.id)) return null;
	const kind = value.kind;
	if (kind !== 'raided' && kind !== 'defended' && kind !== 'plundered') return null;
	const player = parsePlayer(value.player);
	const loot = parseResources(value.loot ?? {});
	if (!player || !loot || !isTime(value.at)) return null;
	return { id: value.id, kind, player, loot, atMs: value.at };
}

export const beachheadRivals = {
	/** Stores the player's base so others can attack it, with what a raid could take */
	publish: (base: BeachheadBase, exposed: Resources, level: number) =>
		ask('beachhead_publish', baseToWire(base, exposed, level), parseEmpty),
	/** A few bases to raid, picked by the server */
	list: () =>
		ask('beachhead_rivals', {}, (value) =>
			isRecord(value) ? parseList(value.rivals, parseRival, 6) : null
		),
	/** Locks a rival's base for one attack; the base that comes back is the one to fight */
	attack: (rivalId: string) =>
		ask('beachhead_attack', { rival_id: rivalId }, (value): BeachheadAttack | null => {
			if (!isRecord(value) || !isId(value.attack_id)) return null;
			const rival = parseRival(value.rival);
			return rival ? { id: value.attack_id, rival } : null;
		}),
	/** Ends a locked attack; the server answers with the loot it actually granted */
	result: (attackId: string, won: boolean) =>
		ask('beachhead_result', { attack_id: attackId, won }, (value) =>
			isRecord(value) ? parseResources(value.loot ?? {}) : null
		),
	/** The raid history, newest first */
	log: () =>
		ask('beachhead_log', {}, (value) =>
			isRecord(value) ? parseList(value.events, parseRaid, 50) : null
		)
};

// ---------------------------------------------------------------------------------------------
// Hermit Hackers

/** A player's rig as the target dossier shows it */
export interface HackerCard extends RivalPlayer {
	/** The made-up address their rig answers on */
	ip: string;
	/** DogeLite in their bank */
	bank: number;
	/** How hard their rig is to get into, 1 to 10 */
	firewall: number;
	/** Hacks they pulled off, for the dossier */
	hacks: number;
	/** The avatar they wear, when they made one */
	look?: AvatarLook;
	/** This player hacked you lately: hacking them is payback */
	revenge: boolean;
}

/** Four numbers 0 to 255, like the game's fictional addresses */
export const IP_PATTERN =
	/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function parseHacker(value: unknown): HackerCard | null {
	const player = parsePlayer(value);
	if (!player || !isRecord(value)) return null;
	const { ip } = value;
	const bank = toAmount(value.bank, 1e9);
	const firewall = toAmount(value.firewall ?? 1, 10);
	const hacks = toAmount(value.hacks ?? 0, 1e6);
	if (typeof ip !== 'string' || !IP_PATTERN.test(ip) || bank === null) return null;
	if (firewall === null || hacks === null) return null;
	const look = value.look === undefined ? null : parseLook(value.look);
	return {
		...player,
		ip,
		bank,
		firewall: Math.max(1, firewall),
		hacks,
		...(look ? { look } : {}),
		revenge: value.revenge === true
	};
}

export interface HackerHack {
	id: string;
	target: HackerCard;
}

/** One line of the player's firewall log: somebody tried their rig, and the trace they left */
export interface FirewallEntry {
	id: string;
	/** The address the attempt came from: the attacker's own rig */
	ip: string;
	player: RivalPlayer;
	/** DogeLite they got away with; 0 when the firewall held */
	stolen: number;
	blocked: boolean;
	atMs: number;
}

export function parseFirewallEntry(value: unknown): FirewallEntry | null {
	if (!isRecord(value) || !isId(value.id)) return null;
	const player = parsePlayer(value.player);
	const stolen = toAmount(value.stolen ?? 0, 1e9);
	if (!player || stolen === null || !isTime(value.at)) return null;
	if (typeof value.ip !== 'string' || !IP_PATTERN.test(value.ip)) return null;
	return {
		id: value.id,
		ip: value.ip,
		player,
		stolen,
		blocked: value.blocked === true || stolen === 0,
		atMs: value.at
	};
}

export const hackerRivals = {
	/** Stores the player's rig: its address, bank and firewall, plus the look for the dossier */
	publish: (rig: {
		ip: string;
		bank: number;
		firewall: number;
		hacks: number;
		look?: AvatarLook;
	}) => ask('hackers_publish', rig, parseEmpty),
	/** A few rigs to hack, picked by the server; the ones who hacked you come first */
	list: () =>
		ask('hackers_targets', {}, (value) =>
			isRecord(value) ? parseList(value.targets, parseHacker, 8) : null
		),
	/** Finds the player behind an address, such as one from the firewall log */
	lookup: (ip: string) =>
		ask('hackers_lookup', { ip }, (value) => (isRecord(value) ? parseHacker(value.target) : null)),
	/** Opens a hack on a rig; the target that comes back is the one to beat */
	hack: (targetId: string) =>
		ask('hackers_hack', { target_id: targetId }, (value): HackerHack | null => {
			if (!isRecord(value) || !isId(value.hack_id)) return null;
			const target = parseHacker(value.target);
			return target ? { id: value.hack_id, target } : null;
		}),
	/** Ends an open hack; the server answers with what was actually stolen */
	result: (hackId: string, won: boolean) =>
		ask('hackers_result', { hack_id: hackId, won }, (value) =>
			isRecord(value) ? toAmount(value.stolen ?? 0) : null
		),
	/** Who tried the player's rig lately, newest first */
	firewall: () =>
		ask('hackers_firewall', {}, (value) =>
			isRecord(value) ? parseList(value.entries, parseFirewallEntry, 50) : null
		)
};

/** Ids of log lines whose losses were already taken from the local save */
export function unseen<T extends { id: string }>(
	entries: readonly T[],
	seen: readonly string[]
): T[] {
	const known = new Set(seen);
	return entries.filter((entry) => !known.has(entry.id));
}

/** Keeps the newest ids only, so the list of seen lines never grows without end */
export function remember(seen: readonly string[], ids: readonly string[], keep = 200): string[] {
	return [...new Set([...seen, ...ids])].slice(-keep);
}

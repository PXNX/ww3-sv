/*
 * Hermit against hermit: the pure side of hacking other players. Every hermit's rig answers on one
 * made-up address that it keeps for good; that address is what lands in a victim's firewall log, so
 * the victim can look it up and hack back. How hard a rig is to get into follows its hardware, and a
 * hack on a player is one contract at that difficulty. The server (see docs/rivals-api.md) settles
 * what was stolen; this file only works out the client's side of it.
 */
import type { Random } from '#lib/game/random.js';
import type { Hardware } from './hardware.js';

/** Four numbers 0 to 255, like the game's fictional addresses */
export const IP_PATTERN =
	/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** The hardest a rig can be */
export const MAX_FIREWALL = 10;

/** A fresh address for the player's own rig, never one of the private ranges the banks use */
export function randomIp(random: Random): string {
	const octet = (low: number, high: number): number =>
		low + Math.floor(random() * (high - low + 1));
	let first = octet(11, 223);
	// 127 is the machine itself, 169 and 172 belong to the made-up banks' networks
	while (first === 127 || first === 169 || first === 172) first = octet(11, 223);
	return [first, octet(0, 255), octet(0, 255), octet(1, 254)].join('.');
}

/** The firewall other players run into: one level, plus one for every two hardware levels */
export function firewallLevel(hardware: Hardware): number {
	const levels = hardware.cpu + hardware.ram + hardware.gpu + hardware.cable;
	return Math.min(MAX_FIREWALL, 1 + Math.floor(levels / 2));
}

/** A rig's firewall as the number of the contract its hack plays like */
export function rivalContractLevel(firewall: number): number {
	return Math.min(MAX_FIREWALL, Math.max(1, Math.round(firewall)));
}

/** What other players took from the bank, from firewall lines not applied yet; never below zero */
export function applyThefts(
	bank: number,
	entries: readonly { id: string; stolen: number }[],
	seen: readonly string[]
): { bank: number; stolen: number; hits: number; ids: string[] } {
	const known = new Set(seen);
	const fresh = entries.filter((entry) => !known.has(entry.id));
	const robbed = fresh.filter((entry) => entry.stolen > 0);
	const stolen = robbed.reduce((sum, entry) => sum + entry.stolen, 0);
	return {
		bank: Math.max(0, bank - stolen),
		stolen: Math.min(bank, stolen),
		hits: robbed.length,
		ids: fresh.map((entry) => entry.id)
	};
}

/** How long ago something happened, as a terminal would print it */
export function agoShort(nowMs: number, atMs: number): string {
	const seconds = Math.max(0, Math.floor((nowMs - atMs) / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

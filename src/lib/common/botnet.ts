/*
 * Botnet + data economy: nodes earn data each second. Cable speeds downloads.
 * Downloads purchase botnet nodes and software the player hasn't bought yet.
 */
import { downloadSpeed } from './hardware';

export type Botnet = { nodes: number; data: number };

export function emptyBotnet(): Botnet {
	return { nodes: 0, data: 0 };
}

/** Each node earns data at 0.5/sec, capped at 5/sec */
export function botnetIncome(botnet: Botnet): number {
	return Math.min(5, botnet.nodes * 0.5);
}

/** Time to download an item before cable speed shrinks it */
export function rawDownloadTime(kind: string): number {
	switch (kind) {
		case 'bruteforce-lv1': return 20_000;
		case 'bruteforce-lv2': return 20_000;
		case 'bruteforce-lv3': return 20_000;
		case 'bruteforce-lv4': return 20_000;
		case 'bruteforce-lv5': return 20_000;
		case 'software-common': return 30_000;
		case 'software-uncommon': return 30_000;
		case 'software-rare': return 30_000;
		default: return 30_000;
	}
}

/** Cable-shrunk download time in ms */
export function downloadTime(kind: string, cableLevel: number): number {
	const base = rawDownloadTime(kind);
	return Math.round(base / downloadSpeed({ cable }));
}

/** How many nodes unlock each bruteforce level */
export function nodesForBruteforceLevel(level: number): number {
	return Math.max(1, level);
}

export interface Downloadable {
	id: string;
	kind: 'bruteforce' | 'software' | 'node';
	toolId?: string;
	costData: number;
	label: () => string;
}

export const DOWNLOADABLES: readonly Downloadable[] = [
	{ id: 'bruteforce-lv1', kind: 'bruteforce', toolId: 'bruteforce', costData: 100, label: () => 'Brute‑force Lv 1' },
	{ id: 'bruteforce-lv2', kind: 'bruteforce', toolId: 'bruteforce', costData: 250, label: () => 'Brute‑force Lv 2' },
	{ id: 'bruteforce-lv3', kind: 'bruteforce', toolId: 'bruteforce', costData: 500, label: () => 'Brute‑force Lv 3' },
	{ id: 'bruteforce-lv4', kind: 'bruteforce', toolId: 'bruteforce', costData: 1_000, label: () => 'Brute‑force Lv 4' },
	{ id: 'bruteforce-lv5', kind: 'bruteforce', toolId: 'bruteforce', costData: 2_000, label: () => 'Brute‑force Lv 5' },
	{ id: 'botnet-node', kind: 'node', costData: 80, label: () => 'Botnet node' },
	{ id: 'worm', kind: 'software', toolId: 'worm', costData: 600, label: () => 'Worm' },
	{ id: 'rootkit', kind: 'software', toolId: 'rootkit', costData: 800, label: () => 'Rootkit' },
	{ id: 'backdoor', kind: 'software', toolId: 'backdoor', costData: 1_200, label: () => 'Backdoor' }
];

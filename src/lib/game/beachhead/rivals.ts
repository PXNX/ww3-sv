/*
 * Raiding other players, the pure part: the island a rival's published base becomes, what a raid on
 * your own base takes (never more than the bunker leaves exposed), and the sea log lines the raid
 * history turns into. The server traffic lives in services/rivals.ts, the flow in the store.
 */
import type { BeachheadBase, BeachheadRaid } from '#lib/services/rivals.js';
import { exposedStock, type BeachheadSave, type Resources } from './campaign.js';
import type { Island } from './config.js';
import type { LogEvent } from './mapLog.js';

const KINDS = ['wood', 'stone', 'iron', 'gold'] as const;

/** Island ids of rival bases start with this, so nothing is stored or scored for them */
export const RIVAL_ISLAND_PREFIX = 'rival-';

export function rivalIsland(rivalId: string, base: BeachheadBase): Island {
	return { id: `${RIVAL_ISLAND_PREFIX}${rivalId}`, buildings: base.buildings };
}

/** Takes what a raider got away with out of the stock, but never what the bunker protects */
export function applyRaidLoss(save: BeachheadSave, loot: Resources): BeachheadSave {
	const resources = { ...save.resources };
	for (const kind of KINDS) {
		const taken = Math.min(Math.max(0, Math.floor(loot[kind])), exposedStock(save, kind));
		resources[kind] = Math.max(0, resources[kind] - taken);
	}
	return { ...save, resources };
}

/** The sea log lines for the raid history; raids on your base point at your home bay */
export function raidLog(raids: readonly BeachheadRaid[]): LogEvent[] {
	return raids.map((raid) => ({
		kind: raid.kind,
		player: raid.player.name,
		island: 'home' as const,
		atMs: raid.atMs,
		id: `raid-${raid.id}`,
		...(raid.kind === 'defended' ? {} : { loot: raid.loot })
	})) as LogEvent[];
}

export function totalOf(resources: Resources): number {
	return KINDS.reduce((sum, kind) => sum + resources[kind], 0);
}

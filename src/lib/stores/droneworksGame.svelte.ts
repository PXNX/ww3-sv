/*
 * Drone Works store: wraps the pure plant rules with the toasts, the sounds, the strike flashes and
 * the personal best. The playfield reads reactive copies of the resources and the twelve tiles; the
 * fixed-step loop only has to tick the plant, and the copies are refreshed ten times a second so
 * the repair bars move smoothly without rebuilding the whole grid every frame.
 */
import {
	CONTRACTS,
	SLOT_COUNT,
	BUILDINGS,
	type BuildingId,
	type DroneId,
	type ResourceId
} from '#lib/game/droneworks/config.js';
import {
	build,
	canBuild,
	canRepair,
	createGame,
	demolish,
	flakCount,
	quotaShare,
	repair,
	repairCost,
	stepGame,
	REPAIR_COST_DAMAGED,
	REPAIR_COST_DESTROYED,
	timeShare,
	type Building,
	type DroneworksEvent,
	type DroneworksState,
	type DroneworksStats
} from '#lib/game/droneworks/state.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type DroneworksStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['droneworks', 'score'] as const;

/** How often the reactive copies are refreshed while the plant runs */
const SYNC_MS = 100;
const TOAST_MS = 2400;

export interface Toast {
	id: number;
	text: string;
}

export interface DroneworksOptions {
	reducedMotion?: boolean;
	scores?: () => Highscores;
	seed?: () => number;
}

function emptyStats(): DroneworksStats {
	return { shipped: 0, intercepted: 0, hits: 0, destroyed: 0, repaired: 0, spent: 0 };
}

export class DroneworksGame {
	status = $state<DroneworksStatus>('ready');
	credits = $state(0);
	stock = $state.raw<Record<ResourceId, number>>({
		ore: 0,
		steel: 0,
		chips: 0,
		engines: 0,
		airframes: 0
	});
	slots = $state.raw<(Building | null)[]>(Array.from({ length: SLOT_COUNT }, () => null));
	/** Index into CONTRACTS */
	contract = $state(0);
	drone = $state<DroneId>('flamingo');
	quota = $state(CONTRACTS[0].quota);
	delivered = $state(0);
	quotaShare = $state(0);
	timeShare = $state(1);
	timeLeftSeconds = $state(Math.ceil(CONTRACTS[0].timeMs / 1000));
	score = $state(0);
	flak = $state(0);
	stats = $state.raw<DroneworksStats>(emptyStats());
	toast = $state.raw<Toast | null>(null);
	/** Counts up on every struck building, so the tile can flash and the field can shake */
	hitCount = $state(0);
	/** The last strike, for the alarm banner */
	lastStrike = $state.raw<{ severity: 'damaged' | 'destroyed' | 'intercepted' } | null>(null);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: DroneworksState;

	readonly reducedMotion: boolean;
	#random: Random;
	#scores: () => Highscores;
	#seed: () => number;
	#toastMs = 0;
	#toastId = 0;
	#syncMs = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: DroneworksOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.#random = createRandom(seed());
		this.state = createGame();
		this.#sync();
	}

	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame();
		this.toast = null;
		this.lastStrike = null;
		this.hitCount = 0;
		this.isNewBest = false;
		this.#toastMs = 0;
		this.#syncMs = 0;
		this.#sync();
		this.status = 'playing';
	}

	pause() {
		if (this.status === 'playing') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else if (this.status === 'paused') this.resume();
	}

	/** Whether a slot can take this building right now, for the build menu */
	canBuild(slot: number, id: BuildingId): boolean {
		if (this.status !== 'playing') return false;
		if (slot < 0 || slot >= SLOT_COUNT) return false;
		if (this.slots[slot] !== null) return false;
		return this.credits >= BUILDINGS[id].cost;
	}

	canRepair(slot: number): boolean {
		if (this.status !== 'playing') return false;
		if (slot < 0 || slot >= SLOT_COUNT) return false;
		const building = this.slots[slot];
		if (!building) return false;
		if (building.condition === 'ok' || building.repairLeftMs > 0) return false;
		const cost = building.condition === 'destroyed' ? REPAIR_COST_DESTROYED : REPAIR_COST_DAMAGED;
		return this.credits >= cost;
	}

	repairCost(slot: number): number {
		const building = this.state.slots[slot];
		return building ? repairCost(building) : 0;
	}

	build(slot: number, id: BuildingId) {
		if (this.status !== 'playing') return;
		const events = build(this.state, slot, id);
		if (events.length === 0) {
			this.#play('ui-error', 0.6);
			this.#showToast(m.droneworks_popup_no_budget());
			return;
		}
		this.#handle(events);
		this.#sync();
	}

	repair(slot: number) {
		if (this.status !== 'playing') return;
		const events = repair(this.state, slot);
		if (events.length === 0) {
			this.#play('ui-error', 0.6);
			this.#showToast(m.droneworks_popup_no_budget());
			return;
		}
		this.#handle(events);
		this.#sync();
	}

	demolish(slot: number) {
		if (this.status !== 'playing') return;
		const events = demolish(this.state, slot);
		if (events.length === 0) return;
		this.#handle(events);
		this.#sync();
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		const events = stepGame(this.state, dtMs, this.#random);
		if (events.length > 0) this.#handle(events);
		this.#syncMs += dtMs;
		if (events.length > 0 || this.#syncMs >= SYNC_MS) {
			this.#syncMs = 0;
			this.#sync();
		}
	}

	/** Draws the plant onto the shared score card: a hall, a chimney and a drone leaving */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const ink = '#111111';
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeStyle = ink;
		// Night sky behind the plant
		context.fillStyle = '#2f3a4a';
		context.fillRect(x, y, size, size);
		context.fillStyle = '#f4efcf';
		context.beginPath();
		context.arc(x + size * 0.8, y + size * 0.18, size * 0.06, 0, Math.PI * 2);
		context.fill();
		// Hall with a saw-tooth roof
		context.fillStyle = '#6f7d8c';
		context.beginPath();
		context.moveTo(x + size * 0.08, y + size * 0.86);
		context.lineTo(x + size * 0.08, y + size * 0.52);
		context.lineTo(x + size * 0.28, y + size * 0.4);
		context.lineTo(x + size * 0.48, y + size * 0.52);
		context.lineTo(x + size * 0.48, y + size * 0.86);
		context.closePath();
		context.fill();
		context.stroke();
		// Chimney with a bit of smoke
		context.fillStyle = '#4b5563';
		context.fillRect(x + size * 0.54, y + size * 0.34, size * 0.1, size * 0.52);
		context.strokeRect(x + size * 0.54, y + size * 0.34, size * 0.1, size * 0.52);
		context.fillStyle = '#b9c2ca';
		context.beginPath();
		context.arc(x + size * 0.59, y + size * 0.28, size * 0.055, 0, Math.PI * 2);
		context.arc(x + size * 0.65, y + size * 0.22, size * 0.045, 0, Math.PI * 2);
		context.fill();
		// Windows
		context.fillStyle = '#e1a53c';
		for (let i = 0; i < 3; i++) {
			context.fillRect(x + size * (0.13 + i * 0.11), y + size * 0.6, size * 0.06, size * 0.08);
		}
		// The drone climbing away
		context.strokeStyle = ink;
		context.beginPath();
		context.moveTo(x + size * 0.7, y + size * 0.62);
		context.lineTo(x + size * 0.9, y + size * 0.56);
		context.stroke();
		context.fillStyle = '#c1442e';
		context.beginPath();
		context.arc(x + size * 0.8, y + size * 0.59, size * 0.03, 0, Math.PI * 2);
		context.fill();
		// Ground
		context.fillStyle = '#55604a';
		context.fillRect(x, y + size * 0.86, size, size * 0.14);
		context.strokeRect(x, y + size * 0.86, size, size * 0.14);
	};

	#handle(events: DroneworksEvent[]) {
		for (const event of events) {
			switch (event.type) {
				case 'built':
					this.#play('ui-tap', 0.7);
					this.#showToast(m.droneworks_popup_built({ building: buildingName(event.id) }));
					break;
				case 'demolished':
					this.#play('ui-toggle', 0.6);
					this.#showToast(m.droneworks_popup_demolished({ building: buildingName(event.id) }));
					break;
				case 'repair-start':
					this.#play('ui-tap', 0.8);
					this.#showToast(m.droneworks_popup_repairing({ seconds: Math.ceil(event.ms / 1000) }));
					break;
				case 'repaired':
					this.#play('chime', 0.5);
					this.#showToast(m.droneworks_popup_repaired({ building: buildingName(event.id) }));
					break;
				case 'strike':
					this.lastStrike = { severity: event.severity };
					if (event.severity === 'intercepted') {
						this.#play('zap', 0.7);
						this.#showToast(m.droneworks_popup_intercepted());
					} else {
						this.hitCount += 1;
						this.#play(event.severity === 'destroyed' ? 'explosion-small' : 'thud', 0.9);
						this.#showToast(
							event.severity === 'destroyed'
								? m.droneworks_popup_destroyed()
								: m.droneworks_popup_damaged()
						);
					}
					break;
				case 'slowdown':
					this.#play('alarm', 0.4);
					this.#showToast(m.droneworks_popup_slowdown({ building: buildingName(event.id) }));
					break;
				case 'delivered':
					this.#play('chime', 0.8);
					this.#showToast(
						m.droneworks_popup_delivered({
							drone: droneName(event.drone)
						})
					);
					break;
				case 'contract-done':
					this.#play('chime-big', 0.9);
					this.#showToast(m.droneworks_popup_contract_done({ drone: droneName(event.drone) }));
					break;
				case 'contract':
					this.#showToast(
						m.droneworks_popup_contract({
							drone: droneName(event.drone),
							quota: event.quota
						})
					);
					break;
				case 'won':
					this.#sync();
					this.#finish();
					break;
				case 'lost':
					this.#sync();
					this.#finish();
					break;
			}
		}
	}

	#showToast(text: string) {
		this.toast = { id: ++this.#toastId, text };
		this.#toastMs = TOAST_MS * (this.reducedMotion ? 1.4 : 1);
	}

	#play(id: SoundId, intensity: number) {
		soundManager().play(id, intensity);
	}

	#sync() {
		const state = this.state;
		const contract = CONTRACTS[state.contract];
		this.credits = state.credits;
		const stock = { ...state.stock };
		this.stock = stock;
		this.slots = state.slots.map((building) => (building ? { ...building } : null));
		this.contract = state.contract;
		this.drone = contract.drone;
		this.quota = contract.quota;
		this.delivered = state.delivered;
		this.quotaShare = quotaShare(state);
		this.timeShare = timeShare(state);
		this.timeLeftSeconds = Math.ceil(state.timeLeftMs / 1000);
		this.score = state.score;
		this.flak = flakCount(state);
		this.stats = { ...state.stats };
	}

	#finish() {
		const result = this.#scores().submit(SCORE_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.status = 'over';
	}
}

function buildingName(id: BuildingId): string {
	const names: Record<BuildingId, () => string> = {
		mine: m.droneworks_building_mine,
		smelter: m.droneworks_building_smelter,
		chipfab: m.droneworks_building_chipfab,
		engine: m.droneworks_building_engine,
		airframe: m.droneworks_building_airframe,
		assembly: m.droneworks_building_assembly,
		flak: m.droneworks_building_flak
	};
	return names[id]();
}

function droneName(id: DroneId): string {
	const names: Record<DroneId, () => string> = {
		flamingo: m.droneworks_drone_flamingo,
		freyja: m.droneworks_drone_freyja,
		pelikan: m.droneworks_drone_pelikan
	};
	return names[id]();
}

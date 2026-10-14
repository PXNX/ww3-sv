/*
 * Leak Patrol rules as a plain state machine. Leaks spring up in the rooms (a harmless drip first,
 * then the water flows), fingers held on open leaks plug them, and holding one long enough fixes
 * it for good. A room whose meter fills costs a heart and is pumped out. Tools seal leaks, and the
 * group chat dialog must be dismissed in time or a big burst leak opens. The store and components
 * only react to the events.
 */
import { pickOne, randomInt, type Random } from '../random.js';
import {
	BIG_FIX_MS,
	BIG_LEAK_RATE,
	DRAIN_RATE,
	DRIP_MS,
	FIRST_DIALOG_MS,
	FIRST_PICKUP_MS,
	FIRST_SPAWN_MS,
	FIX_MS,
	FLOOD_RESET,
	MAX_LEAKS_PER_ROOM,
	MAX_PICKUPS,
	PICKUP_EVERY_MS,
	PICKUP_LIFE_MS,
	ROOM_COUNT,
	STARTING_LIVES,
	TAPE_MS
} from './config.js';
import { pluggingIds, pressHold, releaseHold } from './fingers.js';
import {
	addTool,
	canAdd,
	emptyInventory,
	isHandTool,
	pickTool,
	takeTool,
	type Inventory,
	type ToolKind
} from './tools.js';
import {
	dialogEveryMs,
	dialogWindowMs,
	leakRate,
	maxLeaks,
	scoreFor,
	spawnMs,
	waveAt
} from './waves.js';

export type LeakPhase = 'drip' | 'open';

export interface Leak {
	id: number;
	room: number;
	phase: LeakPhase;
	/** Time spent dripping, for the telegraph */
	ageMs: number;
	/** A burst leak from an ignored group chat: floods faster and takes longer to fix */
	big: boolean;
	/** Time this leak has been held in total; reaching the fix time ends it */
	fixMs: number;
	/** Time the tape still holds, 0 when not taped */
	tapeMs: number;
}

export interface Pickup {
	id: number;
	room: number;
	tool: ToolKind;
	leftMs: number;
}

export interface Dialog {
	leftMs: number;
	windowMs: number;
}

export type LeakPatrolPhase = 'playing' | 'over';

export interface LeakPatrolState {
	phase: LeakPatrolPhase;
	elapsedMs: number;
	wave: number;
	/** Water meter of every room, 0 to 1 */
	rooms: number[];
	leaks: Leak[];
	pickups: Pickup[];
	/** Ids of the leaks under a finger, in the order the fingers came down */
	held: number[];
	tools: Inventory;
	/** The tool picked up from the tray, applied to the next leak that is pressed */
	armed: ToolKind | null;
	dialog: Dialog | null;
	lives: number;
	/** Leaks fixed for good or sealed with the Sharpie */
	plugged: number;
	floods: number;
	absorbed: number;
	bursts: number;
	dismissed: number;
	score: number;
	nextLeakMs: number;
	nextPickupMs: number;
	nextDialogMs: number;
	nextId: number;
}

export type PlugKind = 'held' | 'sharpie';

export type LeakPatrolEvent =
	| { type: 'drip'; leakId: number; room: number }
	| { type: 'open'; leakId: number; room: number; big: boolean }
	| { type: 'plug'; leakId: number; room: number; how: PlugKind; plugged: number }
	| { type: 'tape'; leakId: number; room: number }
	| { type: 'untape'; leakId: number; room: number }
	| { type: 'pickup-spawn'; pickupId: number; room: number; tool: ToolKind }
	| { type: 'pickup'; tool: ToolKind; full: boolean }
	| { type: 'arm'; tool: ToolKind | null }
	| { type: 'dialog'; windowMs: number }
	| { type: 'dismiss' }
	| { type: 'burst'; room: number; absorbed: boolean }
	| { type: 'wave'; wave: number }
	| { type: 'flood'; room: number; lives: number }
	| { type: 'game-over' };

export function createGame(): LeakPatrolState {
	return {
		phase: 'playing',
		elapsedMs: 0,
		wave: 1,
		rooms: Array.from({ length: ROOM_COUNT }, () => 0),
		leaks: [],
		pickups: [],
		held: [],
		tools: emptyInventory(),
		armed: null,
		dialog: null,
		lives: STARTING_LIVES,
		plugged: 0,
		floods: 0,
		absorbed: 0,
		bursts: 0,
		dismissed: 0,
		score: 0,
		nextLeakMs: FIRST_SPAWN_MS,
		nextPickupMs: FIRST_PICKUP_MS,
		nextDialogMs: FIRST_DIALOG_MS,
		nextId: 1
	};
}

export function leakById(state: LeakPatrolState, id: number): Leak | undefined {
	return state.leaks.find((leak) => leak.id === id);
}

export function leaksInRoom(state: LeakPatrolState, room: number): Leak[] {
	return state.leaks.filter((leak) => leak.room === room);
}

/** True while a leak is open and not sealed by tape: it can be plugged and it floods the room */
export function isFlowing(leak: Leak): boolean {
	return leak.phase === 'open' && leak.tapeMs <= 0;
}

/** True for leaks under one of the fingers that count */
export function isPlugging(state: LeakPatrolState, leak: Leak): boolean {
	return isFlowing(leak) && pluggingIds(state.held).includes(leak.id);
}

/** The leak a room key presses: the open leak that is closest to being fixed first */
export function pressableLeak(state: LeakPatrolState, room: number): Leak | undefined {
	return leaksInRoom(state, room)
		.filter((leak) => leak.phase === 'open' && !state.held.includes(leak.id))
		.sort((a, b) => Number(isFlowing(b)) - Number(isFlowing(a)) || b.fixMs - a.fixMs)[0];
}

/** How far a leak is from being fixed for good, 0 to 1 */
export function fixProgress(leak: Leak): number {
	return Math.min(1, leak.fixMs / (leak.big ? BIG_FIX_MS : FIX_MS));
}

function removeLeak(state: LeakPatrolState, id: number) {
	state.leaks = state.leaks.filter((leak) => leak.id !== id);
	state.held = releaseHold(state.held, id);
}

function addLeak(state: LeakPatrolState, room: number, big: boolean): Leak {
	const leak: Leak = {
		id: state.nextId++,
		room,
		phase: big ? 'open' : 'drip',
		ageMs: 0,
		big,
		fixMs: 0,
		tapeMs: 0
	};
	state.leaks.push(leak);
	return leak;
}

/** A room with space for another ordinary leak, picked at random; -1 when every room is busy */
function leakRoom(state: LeakPatrolState, random: Random): number {
	const open = state.rooms
		.map((_, room) => room)
		.filter((room) => leaksInRoom(state, room).length < MAX_LEAKS_PER_ROOM);
	return open.length === 0 ? -1 : pickOne(random, open);
}

/** Opens a big burst leak, unless a CLASSIFIED folder soaks it up */
function burst(state: LeakPatrolState, random: Random): LeakPatrolEvent[] {
	const room = randomInt(random, 0, ROOM_COUNT);
	state.bursts += 1;
	if (takeTool(state.tools, 'folder')) {
		state.absorbed += 1;
		return [{ type: 'burst', room, absorbed: true }];
	}
	const leak = addLeak(state, room, true);
	return [
		{ type: 'burst', room, absorbed: false },
		{ type: 'open', leakId: leak.id, room, big: true }
	];
}

function resolveLeak(state: LeakPatrolState, leak: Leak, how: PlugKind): LeakPatrolEvent {
	removeLeak(state, leak.id);
	state.plugged += 1;
	return { type: 'plug', leakId: leak.id, room: leak.room, how, plugged: state.plugged };
}

/** A finger comes down on a leak: applies the armed tool, or starts plugging it */
export function holdLeak(state: LeakPatrolState, id: number): LeakPatrolEvent[] {
	if (state.phase !== 'playing') return [];
	const leak = leakById(state, id);
	if (!leak || leak.phase !== 'open') return [];
	const tool = state.armed;
	if (tool === 'sharpie' && takeTool(state.tools, 'sharpie')) {
		state.armed = null;
		return [resolveLeak(state, leak, 'sharpie')];
	}
	if (tool === 'tape' && takeTool(state.tools, 'tape')) {
		state.armed = null;
		leak.tapeMs = TAPE_MS;
		state.held = releaseHold(state.held, id);
		return [{ type: 'tape', leakId: id, room: leak.room }];
	}
	state.armed = null;
	state.held = pressHold(state.held, id);
	return tool === null ? [] : [{ type: 'arm', tool: null }];
}

/** A finger lifts from a leak */
export function releaseLeak(state: LeakPatrolState, id: number) {
	state.held = releaseHold(state.held, id);
}

/** Takes the tool out of the tray (again to put it back); only hand tools can be armed */
export function armTool(state: LeakPatrolState, tool: ToolKind): LeakPatrolEvent[] {
	if (state.phase !== 'playing' || !isHandTool(tool)) return [];
	if (state.armed === tool) {
		state.armed = null;
		return [{ type: 'arm', tool: null }];
	}
	if (state.tools[tool] <= 0) return [];
	state.armed = tool;
	return [{ type: 'arm', tool }];
}

/** The player grabs a tool lying in a room; it stays put when the pocket for it is full */
export function collectPickup(state: LeakPatrolState, id: number): LeakPatrolEvent[] {
	if (state.phase !== 'playing') return [];
	const pickup = state.pickups.find((entry) => entry.id === id);
	if (!pickup || !canAdd(state.tools, pickup.tool)) {
		return pickup ? [{ type: 'pickup', tool: pickup.tool, full: true }] : [];
	}
	addTool(state.tools, pickup.tool);
	state.pickups = state.pickups.filter((entry) => entry.id !== id);
	return [{ type: 'pickup', tool: pickup.tool, full: false }];
}

/** The pickup lying in a room, for the room keys */
export function pickupInRoom(state: LeakPatrolState, room: number): Pickup | undefined {
	return state.pickups.find((pickup) => pickup.room === room);
}

/** Answers the group chat dialog: no is safe, yes lets the journalist in and a burst opens */
export function answerDialog(
	state: LeakPatrolState,
	accept: boolean,
	random: Random
): LeakPatrolEvent[] {
	if (state.phase !== 'playing' || !state.dialog) return [];
	state.dialog = null;
	state.nextDialogMs = dialogEveryMs(state.wave);
	if (accept) return burst(state, random);
	state.dismissed += 1;
	return [{ type: 'dismiss' }];
}

function tickLeaks(state: LeakPatrolState, dtMs: number, events: LeakPatrolEvent[]) {
	const plugging = pluggingIds(state.held);
	for (const leak of [...state.leaks]) {
		if (leak.phase === 'drip') {
			leak.ageMs += dtMs;
			if (leak.ageMs >= DRIP_MS) {
				leak.phase = 'open';
				events.push({ type: 'open', leakId: leak.id, room: leak.room, big: false });
			}
		} else if (leak.tapeMs > 0) {
			leak.tapeMs = Math.max(0, leak.tapeMs - dtMs);
			if (leak.tapeMs === 0) events.push({ type: 'untape', leakId: leak.id, room: leak.room });
		} else if (plugging.includes(leak.id)) {
			leak.fixMs += dtMs;
			if (leak.fixMs >= (leak.big ? BIG_FIX_MS : FIX_MS)) {
				events.push(resolveLeak(state, leak, 'held'));
			}
		}
	}
}

/** Fills the meters; returns false when the last heart was lost */
function tickRooms(state: LeakPatrolState, dtMs: number, events: LeakPatrolEvent[]): boolean {
	const seconds = dtMs / 1000;
	for (let room = 0; room < ROOM_COUNT; room++) {
		let rate = 0;
		for (const leak of state.leaks) {
			if (leak.room !== room || !isFlowing(leak) || isPlugging(state, leak)) continue;
			rate += leak.big ? BIG_LEAK_RATE : leakRate(state.wave);
		}
		state.rooms[room] =
			rate > 0
				? state.rooms[room] + rate * seconds
				: Math.max(0, state.rooms[room] - DRAIN_RATE * seconds);
		if (state.rooms[room] < 1) continue;
		state.rooms[room] = FLOOD_RESET;
		for (const leak of leaksInRoom(state, room)) removeLeak(state, leak.id);
		state.lives = Math.max(0, state.lives - 1);
		state.floods += 1;
		events.push({ type: 'flood', room, lives: state.lives });
		if (state.lives === 0) return false;
	}
	return true;
}

/** One fixed step: spawns, fills the meters, runs the timers */
export function step(state: LeakPatrolState, dtMs: number, random: Random): LeakPatrolEvent[] {
	if (state.phase !== 'playing') return [];
	const events: LeakPatrolEvent[] = [];
	state.elapsedMs += dtMs;

	const wave = waveAt(state.elapsedMs);
	if (wave > state.wave) {
		state.wave = wave;
		events.push({ type: 'wave', wave });
	}

	state.nextLeakMs -= dtMs;
	if (state.nextLeakMs <= 0) {
		state.nextLeakMs = spawnMs(state.wave);
		const room = state.leaks.length < maxLeaks(state.wave) ? leakRoom(state, random) : -1;
		if (room >= 0) {
			const leak = addLeak(state, room, false);
			events.push({ type: 'drip', leakId: leak.id, room });
		}
	}

	tickLeaks(state, dtMs, events);

	if (!tickRooms(state, dtMs, events)) {
		state.phase = 'over';
		state.score = scoreFor(state.elapsedMs, state.plugged);
		events.push({ type: 'game-over' });
		return events;
	}

	for (const pickup of state.pickups) pickup.leftMs -= dtMs;
	state.pickups = state.pickups.filter((pickup) => pickup.leftMs > 0);
	state.nextPickupMs -= dtMs;
	if (state.nextPickupMs <= 0) {
		state.nextPickupMs = PICKUP_EVERY_MS;
		const free = state.rooms.map((_, room) => room).filter((room) => !pickupInRoom(state, room));
		if (state.pickups.length < MAX_PICKUPS && free.length > 0) {
			const pickup: Pickup = {
				id: state.nextId++,
				room: pickOne(random, free),
				tool: pickTool(random),
				leftMs: PICKUP_LIFE_MS
			};
			state.pickups.push(pickup);
			events.push({
				type: 'pickup-spawn',
				pickupId: pickup.id,
				room: pickup.room,
				tool: pickup.tool
			});
		}
	}

	if (state.dialog) {
		state.dialog.leftMs -= dtMs;
		if (state.dialog.leftMs <= 0) {
			state.dialog = null;
			state.nextDialogMs = dialogEveryMs(state.wave);
			events.push(...burst(state, random));
		}
	} else {
		state.nextDialogMs -= dtMs;
		if (state.nextDialogMs <= 0) {
			const windowMs = dialogWindowMs(state.wave);
			state.dialog = { leftMs: windowMs, windowMs };
			events.push({ type: 'dialog', windowMs });
		}
	}

	state.score = scoreFor(state.elapsedMs, state.plugged);
	return events;
}

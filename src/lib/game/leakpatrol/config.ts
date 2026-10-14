/*
 * Leak Patrol tuning. The West Wing pipes leak, and every leak is a leak: anonymous sources, memos,
 * group chats. Leaks spring up in six rooms, the player holds fingers on them to plug them, and a
 * room whose water meter fills up costs a heart. Every "news cycle" (wave) is a bit wetter.
 */

export const STARTING_LIVES = 3;

/** Rooms on the cross-section, in a grid of this many columns */
export const ROOM_COUNT = 6;
export const ROOM_COLUMNS = 3;
/** At most this many leaks drip in one room at once (bursts may exceed it) */
export const MAX_LEAKS_PER_ROOM = 2;

/** Fingers that count at once: a fourth finger only takes over when one of the first three lifts */
export const MAX_FINGERS = 3;

/** A leak drips harmlessly for this long (the telegraph) before the water starts to flow */
export const DRIP_MS = 1300;
/** Holding a leak for this long in total fixes it for good; a burst leak takes longer */
export const FIX_MS = 4500;
export const BIG_FIX_MS = 6500;

/** Room meter: level per second from one leak, from a burst, and the drain while nothing leaks */
export const LEAK_RATE = 0.07;
export const BIG_LEAK_RATE = 0.2;
export const DRAIN_RATE = 0.05;
/** A flooded room is pumped out to this level and loses its leaks */
export const FLOOD_RESET = 0.25;

/** News cycles: a wave lasts this long, and every wave leaks a bit faster and more often */
export const WAVE_MS = 18_000;
export const WAVE_RATE_GAIN = 0.12;
/** Time between new leaks in wave 1, how much of it each wave keeps, and the floor */
export const BASE_SPAWN_MS = 3200;
export const SPAWN_FACTOR = 0.88;
export const MIN_SPAWN_MS = 900;
/** The first leak comes after this long */
export const FIRST_SPAWN_MS = 1200;
/** Open leaks allowed at once: a base plus one per wave, up to the cap */
export const BASE_MAX_LEAKS = 3;
export const MAX_LEAKS_CAP = 9;

/** Tools: tape seals a leak for a while, the Sharpie for good (like the weather map) */
export const TAPE_MS = 8000;
export const MAX_TOOLS_PER_KIND = 2;
/** Pickups lie around for this long, come this often, and never more than this many at once */
export const PICKUP_LIFE_MS = 7000;
export const PICKUP_EVERY_MS = 8500;
export const FIRST_PICKUP_MS = 4000;
export const MAX_PICKUPS = 2;
/** Relative chance of each tool turning up */
export const TOOL_WEIGHTS = [
	{ item: 'sharpie', weight: 2 },
	{ item: 'tape', weight: 3 },
	{ item: 'folder', weight: 2 }
] as const;

/**
 * The group chat dialog "Add journalist to group chat?": say no within the window or a big burst
 * leak opens. It first shows up after FIRST_DIALOG_MS, then every DIALOG_EVERY_MS (shorter later),
 * and the window shrinks with the waves down to a floor.
 */
export const FIRST_DIALOG_MS = 12_000;
export const DIALOG_EVERY_MS = 16_000;
export const MIN_DIALOG_EVERY_MS = 8000;
export const DIALOG_WINDOW_MS = 4200;
export const MIN_DIALOG_WINDOW_MS = 2000;
export const DIALOG_FACTOR = 0.92;

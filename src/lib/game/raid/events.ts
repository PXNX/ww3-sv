/*
 * Live events: on the real clock, the first minute of every ten is an event (double XP, an elite
 * surge, rapid skills or a gold rush), the same for every player at the same moment. The events
 * take turns, so no event comes twice in a row, and no server is needed.
 */
import { LIVE_EVENT_EVERY_MS, LIVE_EVENT_MS, LIVE_EVENTS, type LiveEvent } from './config';

export interface ActiveEvent {
	kind: LiveEvent;
	/** When it ends, in epoch milliseconds */
	endsAt: number;
}

const eventOfWindow = (window: number): LiveEvent => LIVE_EVENTS[window % LIVE_EVENTS.length];

/** The event running at this moment, or null */
export function liveEventAt(now: number): ActiveEvent | null {
	const window = Math.floor(now / LIVE_EVENT_EVERY_MS);
	const start = window * LIVE_EVENT_EVERY_MS;
	if (now - start >= LIVE_EVENT_MS) return null;
	return { kind: eventOfWindow(window), endsAt: start + LIVE_EVENT_MS };
}

/** The next event to start after this moment, and when it starts */
export function nextLiveEvent(now: number): { kind: LiveEvent; startsAt: number } {
	const window = Math.floor(now / LIVE_EVENT_EVERY_MS) + 1;
	return { kind: eventOfWindow(window), startsAt: window * LIVE_EVENT_EVERY_MS };
}

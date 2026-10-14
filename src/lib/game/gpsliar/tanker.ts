/*
 * The shadow-fleet tanker: it sails back and forth along its route (running dark, so it is never
 * on the chart) and drags its anchor on a chain behind it. Both the hull and the anchor are solid.
 */
import { ANCHOR_CHAIN, TANKER_SPEED } from './config.js';
import type { TankerRoute } from './level.js';
import type { Vec } from './lie.js';

export interface TankerPose {
	hull: Vec;
	anchor: Vec;
	/** Unit vector the tanker is heading in */
	heading: Vec;
}

/** Where the tanker and its anchor are at a time (seconds since the level began) */
export function tankerPose(route: TankerRoute, time: number): TankerPose {
	const dx = route.to.x - route.from.x;
	const dy = route.to.y - route.from.y;
	const length = Math.hypot(dx, dy);
	// A triangle wave along the route: out and back at constant speed
	const travelled = (time * TANKER_SPEED) % (2 * length);
	const forward = travelled <= length;
	const along = forward ? travelled : 2 * length - travelled;
	const ux = dx / length;
	const uy = dy / length;
	const hx = forward ? ux : -ux;
	const hy = forward ? uy : -uy;
	const hull = { x: route.from.x + ux * along, y: route.from.y + uy * along };
	return {
		hull,
		anchor: { x: hull.x - hx * ANCHOR_CHAIN, y: hull.y - hy * ANCHOR_CHAIN },
		heading: { x: hx, y: hy }
	};
}

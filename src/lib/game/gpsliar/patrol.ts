/*
 * Coast guard patrols. A patrol boat cruises a closed oval (so it is a pure function of the clock,
 * like the tanker) with a rotating radar beam. The beam only matters inside a cone and within
 * range: a boat caught in it fills the patrol's lock meter, unless it is spoofing. Patrol boats
 * are not solid, only their radar is a danger.
 */
import { PATROL_CONE, PATROL_RANGE, PATROL_SWEEP } from './config.js';
import type { PatrolRoute } from './level.js';
import type { Vec } from './lie.js';

export interface PatrolPose {
	pos: Vec;
	/** Direction of travel, radians */
	heading: number;
	/** Direction the radar beam points in, radians */
	beam: number;
}

/** Where a patrol boat is and where its beam points at a time (seconds) */
export function patrolPose(route: PatrolRoute, time: number): PatrolPose {
	const phase = route.phase + (time / route.period) * Math.PI * 2;
	const pos = {
		x: route.center.x + Math.cos(phase) * route.rx,
		y: route.center.y + Math.sin(phase) * route.ry
	};
	const heading = Math.atan2(Math.cos(phase) * route.ry, -Math.sin(phase) * route.rx);
	return { pos, heading, beam: route.phase * 2 + time * PATROL_SWEEP };
}

/** The smallest angle between two directions, 0 to PI */
export function angleBetween(a: number, b: number): number {
	const turn = Math.abs((((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
	return Math.abs(turn);
}

/** Whether a point is inside the radar beam of a patrol at a time */
export function inBeam(route: PatrolRoute, time: number, point: Vec): boolean {
	const pose = patrolPose(route, time);
	const dx = point.x - pose.pos.x;
	const dy = point.y - pose.pos.y;
	if (Math.hypot(dx, dy) > PATROL_RANGE) return false;
	return angleBetween(Math.atan2(dy, dx), pose.beam) <= PATROL_CONE / 2;
}

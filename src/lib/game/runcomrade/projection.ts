/*
 * The perspective that turns the course (lane positions and distances) into screen positions. The
 * camera looks along the course from behind and above the runner: things far ahead are small and
 * near the horizon, the runner stands at scale 1 near the bottom, and things just behind the runner
 * grow and slide off the bottom edge.
 */
import { WORLD_WIDTH } from './config';

export const HORIZON_Y = 150;
/** Screen height of the ground under the runner's feet */
export const RUNNER_Y = 440;
export const CENTER_X = WORLD_WIDTH / 2;
/** Width of one lane on screen at the runner's distance */
export const LANE_W = 104;
/** Distance of the camera behind the runner, in units; smaller means stronger perspective */
const CAMERA_BACK = 7;

/** Scale of things at a distance ahead of the runner (negative: behind the runner) */
export function scaleAt(ahead: number): number {
	return CAMERA_BACK / Math.max(0.5, CAMERA_BACK + ahead);
}

/** Screen y of the ground at a distance ahead of the runner */
export function groundY(ahead: number): number {
	return HORIZON_Y + (RUNNER_Y - HORIZON_Y) * scaleAt(ahead);
}

/** Screen x of a lane position (0, 1, 2 are the lane centers) at a distance ahead of the runner */
export function laneX(lanePosition: number, ahead: number): number {
	return CENTER_X + (lanePosition - 1) * LANE_W * scaleAt(ahead);
}

/** The distance ahead that ends up at the bottom edge of the screen (nothing nearer is visible) */
export function nearestVisible(worldHeight: number): number {
	const s = (worldHeight - HORIZON_Y) / (RUNNER_Y - HORIZON_Y);
	return CAMERA_BACK / s - CAMERA_BACK;
}

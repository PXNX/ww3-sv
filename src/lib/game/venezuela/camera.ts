/*
 * The side-scrolling camera: it follows the player horizontally with a little look-ahead in the
 * facing direction, eases toward its target and never shows anything beyond the level's ends.
 */
import { VIEW_W } from './config';

/** The left edge of the view (in tiles) the camera is heading for */
export function cameraTarget(
	playerCenterX: number,
	facing: 1 | -1,
	levelWidth: number,
	viewWidth: number = VIEW_W
): number {
	const wanted = playerCenterX - viewWidth / 2 + facing * 1.5;
	return Math.min(Math.max(0, wanted), Math.max(0, levelWidth - viewWidth));
}

/** Eases the camera toward its target; a snap when the gap is huge (after a respawn) */
export function followCamera(current: number, target: number, dt: number, speed = 7): number {
	if (Math.abs(target - current) > VIEW_W) return target;
	return current + (target - current) * Math.min(1, speed * dt);
}

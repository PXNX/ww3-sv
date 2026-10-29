/*
 * Spring pads: run or drop onto one and it flings the presidente high into the air, a little
 * higher while jump is held. A pad is a tile of its own (the level's `s`), half a tile tall,
 * standing on the floor. Shared by the world and the level validator.
 */
import { SPRING_SPEED, SPRING_SPEED_HELD } from './config';
import type { LevelData } from './level';
import type { Player } from './player';

/** Launches the player when they are on a spring pad; returns whether they were */
export function launchFromSpring(level: LevelData, player: Player, jumpHeld: boolean): boolean {
	if (level.springs.length === 0 || player.vy < 0) return false;
	const feet = player.y + player.h;
	const column = Math.floor(player.x + player.w / 2);
	for (const spring of level.springs) {
		if (spring.x !== column || feet < spring.y + 0.4 || feet > spring.y + 1.05) continue;
		player.vy = -(jumpHeld ? SPRING_SPEED_HELD : SPRING_SPEED);
		player.onGround = false;
		player.canCut = false;
		player.coyote = 0;
		player.buffer = 0;
		player.airJumps = 1;
		player.slam = 'none';
		return true;
	}
	return false;
}

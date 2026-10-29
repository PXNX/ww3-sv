/*
 * Level validator: can the flag (and every barrel) actually be reached with the jump physics?
 *
 * Instead of reasoning about jump arcs on paper, this replays the real player physics: from every
 * spot the player can stand on it tries walking and a spread of jumps (different run-ups, different
 * jump-button hold times, each in every direction), and every place a try lands becomes a new spot
 * to start from. Enemies are ignored (they can be stomped or dodged); barbed barricades kill a try.
 * The search runs with slightly weakened physics, so a level that passes has some slack and does
 * not depend on pixel-perfect play. Spring pads launch the replayed player just like the real
 * thing; a hover barge counts as a catwalk along its whole travel (a rider can wait for it to come
 * by), and mystery blocks are solid. Boosters are ignored: no level may need one.
 */
import { overlaps } from './collision';
import { PHYSICS, STEP, type Physics } from './config';
import { type LevelData } from './level';
import { createPlayer, stepPlayer, type Input, type Player } from './player';
import { createPlatform, platformSweepBox } from './platforms';
import { launchFromSpring } from './springs';
import { barrelBox, flagBox, touchesHazard } from './world';

/** The physics the validator assumes: a little slower and a little weaker than the real thing */
export const SLACK_PHYSICS: Physics = {
	...PHYSICS,
	jumpSpeed: PHYSICS.jumpSpeed * 0.94,
	maxSpeed: PHYSICS.maxSpeed * 0.9
};

export interface Reachability {
	goal: boolean;
	/** Per barrel, in level order */
	barrels: boolean[];
	/** Per checkpoint lamp, in level order */
	checkpoints: boolean[];
	/** Number of distinct standing spots found */
	spots: number;
	/** The furthest column a standing spot was found in, handy for locating a blocked level */
	farthest: number;
}

const BUCKETS_PER_TILE = 2;
const HOLDS = [3, 8, 14, 20, 60];
const DELAYS = [0, 6, 14];
const MAX_FRAMES = 420;

function key(player: Player): string {
	return `${Math.round(player.x * BUCKETS_PER_TILE)},${Math.round(player.y * 4)}`;
}

function copy(player: Player): Player {
	return { ...player };
}

/** The level with every hover barge's travel drawn in as catwalk tiles */
function withBargeStrips(level: LevelData): LevelData {
	if (level.platforms.length === 0) return level;
	const rows = level.rows.map((row) => row.split(''));
	level.platforms.forEach((spot, index) => {
		const sweep = platformSweepBox(createPlatform(index, spot));
		const lastRow = Math.ceil(sweep.y + sweep.h - 0.05) - 1;
		for (let y = Math.floor(sweep.y); y <= lastRow; y++) {
			for (let x = Math.floor(sweep.x); x < Math.ceil(sweep.x + sweep.w); x++) {
				if (rows[y]?.[x] === '.') rows[y][x] = '=';
			}
		}
	});
	return { ...level, rows: rows.map((row) => row.join('')) };
}

export function analyzeReach(source: LevelData, physics: Physics = SLACK_PHYSICS): Reachability {
	const level = withBargeStrips(source);
	const result: Reachability = {
		goal: false,
		barrels: level.barrels.map(() => false),
		checkpoints: level.checkpoints.map(() => false),
		spots: 0,
		farthest: 0
	};
	const flag = flagBox(level);
	const barrelBoxes = level.barrels.map(barrelBox);
	const lampBoxes = level.checkpoints.map((spot) => ({ x: spot.x, y: spot.y, w: 1, h: 1 }));

	/** Marks whatever the player touches at this moment */
	const touch = (player: Player) => {
		if (overlaps(player, flag)) result.goal = true;
		barrelBoxes.forEach((box, index) => {
			if (overlaps(player, box)) result.barrels[index] = true;
		});
		lampBoxes.forEach((box, index) => {
			if (overlaps(player, box)) result.checkpoints[index] = true;
		});
	};

	// Settle the start onto the floor first
	const first = createPlayer(level.start.x + (1 - 0.7) / 2, level.start.y + 1);
	for (let i = 0; i < 30; i++)
		stepPlayer(first, { move: 0, jumpHeld: false, jumpPressed: false }, level, physics);

	const seen = new Set<string>([key(first)]);
	const queue: Player[] = [first];

	/** Runs one try from a spot; returns where it ended standing, or null when it did not */
	const attempt = (from: Player, move: -1 | 0 | 1, delay: number, hold: number, walk: boolean) => {
		const player = copy(from);
		player.vx = 0;
		player.vy = 0;
		player.onGround = true;
		player.buffer = 0;
		let jumped = false;
		for (let frame = 0; frame < MAX_FRAMES; frame++) {
			const input: Input = walk
				? { move, jumpHeld: false, jumpPressed: false }
				: {
						move,
						jumpHeld: frame >= delay && frame < delay + hold,
						jumpPressed: frame === delay
					};
			const events = stepPlayer(player, input, level, physics, STEP);
			if (events.includes('jump')) jumped = true;
			if (launchFromSpring(level, player, input.jumpHeld)) jumped = true;
			if (player.y > level.height + 1 || touchesHazard(level, player)) return;
			touch(player);
			const settled = walk ? frame >= 9 : jumped && frame > delay + 1;
			if (player.onGround && settled) {
				const bucket = key(player);
				if (!seen.has(bucket)) {
					seen.add(bucket);
					queue.push(copy(player));
				}
				return;
			}
			// A jump that never started (no room, wall) is a dead end
			if (!walk && !jumped && frame > delay + 8) return;
		}
	};

	for (let head = 0; head < queue.length; head++) {
		const spot = queue[head];
		for (const move of [-1, 1] as const) attempt(spot, move, 0, 0, true);
		for (const hold of HOLDS) {
			attempt(spot, 0, 0, hold, false);
			for (const move of [-1, 1] as const) {
				for (const delay of DELAYS) attempt(spot, move, delay, hold, false);
			}
		}
	}
	result.spots = seen.size;
	result.farthest = Math.max(...queue.map((spot) => Math.floor(spot.x)));
	return result;
}

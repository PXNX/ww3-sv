/*
 * One level being played: the player, the goons, the helicopters, the barrels, hearts and score.
 * stepWorld advances everything by one fixed step and returns what happened, so the store can
 * turn events into sounds and effects and the tests can check the rules without a browser.
 */
import { overlaps, type Box } from './collision';
import {
	INVULNERABLE_S,
	PHYSICS,
	PLAYER_W,
	SCORE_BARREL,
	SCORE_FLAG,
	SCORE_PER_HEART,
	SCORE_STOMP,
	STARTING_HEARTS,
	STEP
} from './config';
import {
	createHelicopter,
	createWalker,
	helicopterAt,
	helicopterBox,
	stepWalker,
	type Helicopter,
	type Walker
} from './enemies';
import { tileAt, type LevelData } from './level';
import { createPlayer, stepPlayer, type Input, type Player } from './player';

export type HurtCause = 'goon' | 'heli' | 'hazard' | 'fall';

export type WorldEvent =
	| { type: 'jump' }
	| { type: 'land' }
	| { type: 'bump' }
	| { type: 'barrel'; x: number; y: number; points: number }
	| { type: 'stomp'; x: number; y: number; points: number }
	| { type: 'hurt'; cause: HurtCause; x: number; y: number }
	| { type: 'checkpoint' }
	| { type: 'flag' }
	| { type: 'dead' };

export type WorldStatus = 'playing' | 'won' | 'dead';

export interface HeliState {
	heli: Helicopter;
	x: number;
	y: number;
	mode: ReturnType<typeof helicopterAt>['mode'];
}

export interface World {
	level: LevelData;
	player: Player;
	walkers: Walker[];
	helis: HeliState[];
	/** Which barrels (in level order) have been collected */
	collected: boolean[];
	time: number;
	hearts: number;
	score: number;
	/** Seconds of invulnerability left after a hit */
	invuln: number;
	status: WorldStatus;
	/** Where the player comes back after a fall: tile column and the row of the floor tile */
	respawn: { x: number; y: number };
	barrelsCollected: number;
	goonsStomped: number;
	heartsLost: number;
	/** The checkpoint lamps already lit, by index */
	lit: boolean[];
}

const BARREL_SIZE = 0.6;

export function barrelBox(spot: { x: number; y: number }): Box {
	return {
		x: spot.x + (1 - BARREL_SIZE) / 2,
		y: spot.y + 1 - BARREL_SIZE,
		w: BARREL_SIZE,
		h: BARREL_SIZE
	};
}

/** The pole of the flag: a thin box three tiles tall standing on the goal tile */
export function flagBox(level: LevelData): Box {
	return { x: level.goal.x + 0.3, y: level.goal.y - 2.5, w: 0.4, h: 3.5 };
}

function placePlayer(spot: { x: number; y: number }): Player {
	const player = createPlayer(spot.x + (1 - PLAYER_W) / 2, spot.y + 1);
	// Starts standing: the first step settles it onto the floor
	return player;
}

export function createWorld(level: LevelData): World {
	let id = 0;
	return {
		level,
		player: placePlayer(level.start),
		walkers: [
			...level.goons.map((spot) => createWalker(id++, 'goon', spot)),
			...level.jumpers.map((spot) => createWalker(id++, 'jumper', spot))
		],
		helis: level.helicopters.map((spot, index) => {
			const heli = createHelicopter(index, spot);
			return { heli, ...helicopterAt(heli, 0) };
		}),
		collected: level.barrels.map(() => false),
		time: 0,
		hearts: STARTING_HEARTS,
		score: 0,
		invuln: 0,
		status: 'playing',
		respawn: { x: level.start.x, y: level.start.y },
		barrelsCollected: 0,
		goonsStomped: 0,
		heartsLost: 0,
		lit: level.checkpoints.map(() => false)
	};
}

/** Whether the player touches a barbed barricade tile */
export function touchesHazard(level: LevelData, player: Player): boolean {
	const body: Box = {
		x: player.x + 0.12,
		y: player.y + 0.12,
		w: player.w - 0.24,
		h: player.h - 0.12
	};
	for (let ty = Math.floor(body.y); ty <= Math.floor(body.y + body.h); ty++) {
		for (let tx = Math.floor(body.x); tx <= Math.floor(body.x + body.w); tx++) {
			if (tileAt(level, tx, ty) !== 'hazard') continue;
			if (overlaps(body, { x: tx + 0.1, y: ty + 0.5, w: 0.8, h: 0.5 })) return true;
		}
	}
	return false;
}

/** Loses a heart (unless still invulnerable) and bounces the player away; reports the hit */
function hurt(world: World, cause: HurtCause, events: WorldEvent[]) {
	if (world.invuln > 0 || world.status !== 'playing') return;
	world.hearts -= 1;
	world.heartsLost += 1;
	world.invuln = INVULNERABLE_S;
	const { player } = world;
	events.push({ type: 'hurt', cause, x: player.x + player.w / 2, y: player.y });
	if (world.hearts <= 0) {
		world.status = 'dead';
		events.push({ type: 'dead' });
		return;
	}
	player.vy = -9;
	player.vx = -player.facing * 4;
	player.canCut = false;
}

/** A fall into a pit always costs a heart; the player comes back at the last lit lamp */
function fall(world: World, events: WorldEvent[]) {
	world.hearts -= 1;
	world.heartsLost += 1;
	const { player } = world;
	events.push({
		type: 'hurt',
		cause: 'fall',
		x: player.x + player.w / 2,
		y: world.level.height - 1
	});
	if (world.hearts <= 0) {
		world.status = 'dead';
		events.push({ type: 'dead' });
		return;
	}
	world.player = placePlayer(world.respawn);
	world.invuln = INVULNERABLE_S;
}

/** Advances the level by one step */
export function stepWorld(world: World, input: Input, dt: number = STEP): WorldEvent[] {
	const events: WorldEvent[] = [];
	if (world.status !== 'playing') return events;

	world.time += dt;
	world.invuln = Math.max(0, world.invuln - dt);

	const { player, level } = world;
	const previousBottom = player.y + player.h;
	for (const event of stepPlayer(player, input, level, PHYSICS, dt)) events.push({ type: event });

	for (const walker of world.walkers) stepWalker(walker, level, dt);
	for (const state of world.helis) {
		const position = helicopterAt(state.heli, world.time);
		state.x = position.x;
		state.y = position.y;
		state.mode = position.mode;
	}

	// Barrels
	level.barrels.forEach((spot, index) => {
		if (world.collected[index] || !overlaps(player, barrelBox(spot))) return;
		world.collected[index] = true;
		world.barrelsCollected += 1;
		world.score += SCORE_BARREL;
		events.push({ type: 'barrel', x: spot.x + 0.5, y: spot.y, points: SCORE_BARREL });
	});

	// Checkpoint lamps
	level.checkpoints.forEach((spot, index) => {
		if (world.lit[index] || !overlaps(player, { x: spot.x, y: spot.y, w: 1, h: 1 })) return;
		world.lit[index] = true;
		world.respawn = { x: spot.x, y: spot.y };
		events.push({ type: 'checkpoint' });
	});

	// Goons: land on their heads to squash them, touch them from the side and lose a heart
	for (const walker of world.walkers) {
		if (!walker.alive || !overlaps(player, walker)) continue;
		if (player.vy > 0 && previousBottom <= walker.y + walker.h * 0.55) {
			walker.alive = false;
			walker.squashed = 0;
			world.goonsStomped += 1;
			world.score += SCORE_STOMP;
			player.vy = -(input.jumpHeld ? PHYSICS.stompBounceHeld : PHYSICS.stompBounce);
			player.canCut = false;
			player.onGround = false;
			events.push({ type: 'stomp', x: walker.x + walker.w / 2, y: walker.y, points: SCORE_STOMP });
		} else {
			hurt(world, 'goon', events);
		}
	}

	// Helicopters hurt from every side, there is nothing to stomp on a rotor
	for (const state of world.helis) {
		if (overlaps(player, helicopterBox(state))) hurt(world, 'heli', events);
	}

	if (touchesHazard(level, player)) hurt(world, 'hazard', events);

	if (world.status === 'playing' && player.y > level.height + 1) fall(world, events);

	// The flag
	if (world.status === 'playing' && overlaps(world.player, flagBox(level))) {
		world.status = 'won';
		world.score += SCORE_FLAG + world.hearts * SCORE_PER_HEART;
		events.push({ type: 'flag' });
	}
	return events;
}

/** One star for finishing, one for every barrel, one for never losing a heart */
export function starsFor(world: World): number {
	if (world.status !== 'won') return 0;
	const allBarrels = world.barrelsCollected === world.level.barrels.length;
	return 1 + (allBarrels ? 1 : 0) + (world.heartsLost === 0 ? 1 : 0);
}

/*
 * The rules of walking through a maze, as pure functions on an immutable play state. There is no
 * clock and no life; the score is the number of steps. A step is every move that goes through a
 * door, and also every bump into a locked door or a closed office (standing in the queue costs
 * time too). Walking into a plain wall costs nothing.
 *
 * The building is shrouded in fog: the player sees the offices already visited and the ones next
 * to a visited office. Whether an office is closed shows only after bumping into it.
 */
import {
	DIRECTIONS,
	doorAt,
	isClosed,
	roomCount,
	type Direction,
	type ItemKind,
	type Maze
} from './maze';

export interface PlayState {
	room: number;
	/** The score: moves through doors plus bumps into locked doors and closed offices */
	steps: number;
	/** Documents collected, in the order they were found */
	collected: readonly ItemKind[];
	/** Offices entered so far */
	visited: readonly boolean[];
	/** Closed offices the player found out about by bumping into them, sorted */
	knownClosed: readonly number[];
	/** Whether Passierschein B-38 has been reached */
	won: boolean;
}

export type MoveOutcome = 'wall' | 'locked' | 'closed' | 'moved' | 'won';

export interface MoveResult {
	state: PlayState;
	outcome: MoveOutcome;
	/** The document picked up by this move */
	pickup: ItemKind | null;
	/** The document a locked door asked for */
	missing: ItemKind | null;
}

export function startState(maze: Maze): PlayState {
	const visited = new Array<boolean>(roomCount(maze)).fill(false);
	visited[maze.start] = true;
	return { room: maze.start, steps: 0, collected: [], visited, knownClosed: [], won: false };
}

/** Tries to walk one step from the current office; the state is returned unchanged for a wall */
export function move(maze: Maze, state: PlayState, direction: Direction): MoveResult {
	const unchanged = (outcome: MoveOutcome): MoveResult => ({
		state,
		outcome,
		pickup: null,
		missing: null
	});
	if (state.won) return unchanged('wall');

	const door = doorAt(maze, state.room, direction);
	if (!door) return unchanged('wall');

	if (door.lock && !state.collected.includes(door.lock)) {
		return {
			state: { ...state, steps: state.steps + 1 },
			outcome: 'locked',
			pickup: null,
			missing: door.lock
		};
	}

	if (isClosed(maze, door.to)) {
		const knownClosed = state.knownClosed.includes(door.to)
			? state.knownClosed
			: [...state.knownClosed, door.to].sort((a, b) => a - b);
		return {
			state: { ...state, steps: state.steps + 1, knownClosed },
			outcome: 'closed',
			pickup: null,
			missing: null
		};
	}

	const item = maze.items[door.to];
	const pickup = item && !state.collected.includes(item) ? item : null;
	const visited = state.visited.map((seen, room) => seen || room === door.to);
	const won = door.to === maze.goal;
	return {
		state: {
			room: door.to,
			steps: state.steps + 1,
			collected: pickup ? [...state.collected, pickup] : state.collected,
			visited,
			knownClosed: state.knownClosed,
			won
		},
		outcome: won ? 'won' : 'moved',
		pickup,
		missing: null
	};
}

/**
 * The offices the player can see: visited ones, and those behind a door of a visited office (a
 * locked door too; you can see the next room through the glass, not the lock's key).
 */
export function seenRooms(maze: Maze, state: PlayState): boolean[] {
	const seen = [...state.visited];
	state.visited.forEach((isVisited, room) => {
		if (!isVisited) return;
		for (const direction of DIRECTIONS) {
			const door = doorAt(maze, room, direction);
			if (door) seen[door.to] = true;
		}
	});
	return seen;
}

/** The direction that leads from the player's office towards a tapped office (one step) */
export function directionToward(maze: Maze, from: number, target: number): Direction | null {
	const rowDelta = Math.floor(target / maze.width) - Math.floor(from / maze.width);
	const colDelta = (target % maze.width) - (from % maze.width);
	if (rowDelta === 0 && colDelta === 0) return null;
	if (Math.abs(colDelta) > Math.abs(rowDelta)) return colDelta > 0 ? 'right' : 'left';
	return rowDelta > 0 ? 'down' : 'up';
}

/** Direction of a swipe or drag, from the dominant axis; null for a movement too short to tell */
export function directionOfVector(dx: number, dy: number): Direction | null {
	if (dx === 0 && dy === 0) return null;
	if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
	return dy > 0 ? 'down' : 'up';
}

/** One to three stars for the steps taken against the shortest way (par) */
export function starsFor(steps: number, par: number): number {
	if (steps <= Math.ceil(par * 1.8)) return 3;
	if (steps <= Math.ceil(par * 3)) return 2;
	return 1;
}

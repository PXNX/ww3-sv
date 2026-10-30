/*
 * Grain Corridor — engaging runner with physics lanes.
 * Player taps/swipes left/right to steer grain ship between mine lanes.
 * Mines spawn from top, drift downward. Reach port (distance >= 100) for stars.
 */
export interface Lane {
	x: number; // lane center 0..1
	mineY: number[]; // mine positions in this lane
}
export interface GrainState {
	lanes: Lane[];
	shipLane: number; // current lane index
	distance: number;
	lives: number;
	over: boolean;
	won: boolean;
	score: number;
}
export function createGrain(): GrainState {
	const l: Lane[] = [
		{ x: 0.2, mineY: [0.15] },
		{ x: 0.5, mineY: [0.65] },
		{ x: 0.8, mineY: [0.35] }
	];
	return { lanes: l, shipLane: 1, distance: 0, lives: 3, over: false, won: false, score: 0 };
}
export function stepGrain(s: GrainState, dtMs: number) {
	if (s.over) return;
	s.distance += (dtMs / 1000) * 0.8;
	for (const lane of s.lanes) {
		lane.mineY = lane.mineY.map((y) => y + 0.008);
		lane.mineY = lane.mineY.filter((y) => y < 1);
	}
	// Spawn new mines
	if (Math.random() < 0.015) {
		const lane = s.lanes[Math.floor(Math.random() * s.lanes.length)];
		lane.mineY.push(0);
	}
	// Check collisions
	const currentLane = s.lanes[s.shipLane];
	for (const mineY of currentLane.mineY) {
		if (Math.abs(mineY - 0.5) < 0.12) {
			s.lives--;
			s.score = Math.max(0, s.score - 50);
			currentLane.mineY = currentLane.mineY.filter((y) => y !== mineY);
			if (s.lives <= 0) { s.over = true; s.won = false; }
		}
	}
	if (s.distance >= 100) { s.over = true; s.won = true; s.score += 300; }
}
export function moveLane(s: GrainState, dir: 'left' | 'right') {
	if (s.over) return;
	if (dir === 'left') s.shipLane = Math.max(0, s.shipLane - 1);
	else s.shipLane = Math.min(s.lanes.length - 1, s.shipLane + 1);
}

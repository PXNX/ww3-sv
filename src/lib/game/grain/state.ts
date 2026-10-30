/*
 * Grain Corridor — guide grain ships through Black Sea, dodge mines.
 * Runner-style: tap/swipe to steer between mine lanes; reach port.
 */
export interface GrainState {
	shipX: number;
	mineY: number[];
	distance: number;
	lives: number;
	over: boolean;
}
export function createGrain() {
	return { shipX: 0.5, mineY: [0.2,0.8], distance: 0, lives: 3, over: false };
}

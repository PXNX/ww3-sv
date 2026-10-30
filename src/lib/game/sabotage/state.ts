/*
 * Gig Saboteur (Russia / Putin): bumbler 50-euro messenger-channel hire.
 * Top-down stealth on a timer: power line, depot, shell factory. 9 levels, stars at top.
 */
export interface SabotageState {
	timer: number;
	level: number;
	missions: number;
	detected: boolean;
	over: boolean;
}
export const LEVELS = 9;
export const TIME_PER = 45;
export function createSabotage(): SabotageState {
	return { timer: TIME_PER, level: 1, missions: 0, detected: false, over: false };
}
export function stepSabotage(s: SabotageState, dt: number) {
	if (s.over) return;
	s.timer -= dt;
	if (s.timer <= 0) { s.over = true; s.timer = 0; }
}

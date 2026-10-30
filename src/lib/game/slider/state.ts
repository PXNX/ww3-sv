/*
 * Sondage Slider — tap rally icons to push a wobbling poll line downward.
 * The line wobbles left/right. Matching icon pushes it; wrong icon pulls back.
 */
export interface SliderState {
	lineY: number;
	wobbleX: number;
	pollProgress: number;
	streak: number;
	over: boolean;
}
export function createSlider(): SliderState {
	return { lineY: 80, wobbleX: 50, pollProgress: 0, streak: 0, over: false };
}

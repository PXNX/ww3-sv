/*
 * Hermit Hackers (North Korea / Kim): retro terminal game.
 * Mastermind to crack fictional crypto accounts, alternating with Lights Out on a breaker panel.
 */
export interface HackState {
	code: number[];
	guess: number[];
	tries: number;
	lights: boolean[];
	hacked: number;
}
export function createHack(): HackState {
	const code = [1, 3, 5, 2];
	return { code, guess: [0, 0, 0, 0], tries: 0, lights: [true, false, true, false], hacked: 0 };
}
export function checkHack(s: HackState): number {
	let exact = 0;
	for (let i = 0; i < 4; i++) if (s.guess[i] === s.code[i]) exact++;
	s.tries++;
	if (exact === 4) s.hacked++;
	return exact;
}

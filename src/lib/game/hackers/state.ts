/*
 * Hermit Hackers / North Korea (Kim): retro terminal hacking.
 * The player accesses a list of IP addresses (systems). Each IP hosts a crypto wallet
 * with a 4-digit access key (Mastermind / brute-force). Once cracked, the player installs
 * either a siphon (drains wallet slowly) or a worm (installs malware, flips breaker lights)
 * or both. The breaker panel (Lights Out) must be fully darkened to complete a system.
 * A quota of hacked wallets must be met before the timer runs out.
 */
import type { Random } from '../random';

export type InstallType = 'siphon' | 'worm' | 'both';

export interface Wallet {
	ip: string;
	system: string;
	code: number[];         // 4-digit access key, 1-9 each
	balance: number;        // fictional crypto balance
	hacked: boolean;
	siphonInstalled: boolean;
	wormInstalled: boolean;
}

export interface Breaker {
	id: number;
	on: boolean;            // true = light on (bad), false = dark (good)
}

export interface HackersState {
	systems: Wallet[];
	selectedIndex: number;
	breakers: Breaker[];     // 3x3 panel (9 breakers)
	timer: number;           // seconds left in this run
	totalHacked: number;
	quota: number;           // wallets to crack
	over: boolean;
	won: boolean;
	trace: number;           // 0..100; detected if it hits 100
	hintsSeen: number;
}

export const PANEL_SIZE = 3;
export const QUOTA_START = 3;
export const TIMER_START = 120;
export const TRACE_STEP = 8; // each install raises trace
export const IPs = [
	'10.0.17.44', '192.168.77.13', '172.31.200.5',
	'10.10.4.88', '192.168.215.33', '172.16.99.7'
];
export const SYSTEM_NAMES = [
	'Pyongyang Exchange', 'Seoul Custody', 'Moscow Vault',
	'Zürich Clearing', 'Dubai Deposit', 'Bangkok Node'
];

function makeCode(random: Random): number[] {
	const c: number[] = [];
	for (let i = 0; i < 4; i++) c.push(1 + Math.floor(random() * 9));
	return c;
}

function makeBreakers(random: Random): Breaker[] {
	const b: Breaker[] = [];
	for (let i = 0; i < PANEL_SIZE * PANEL_SIZE; i++)
		b.push({ id: i, on: random() < 0.55 });
	return b;
}

export function createHackers(random: Random): HackersState {
	const systems = IPs.map((ip, i) => ({
		ip,
		system: SYSTEM_NAMES[i],
		code: makeCode(random),
		balance: 1200 + Math.floor(random() * 8000),
		hacked: false,
		siphonInstalled: false,
		wormInstalled: false
	}));
	return {
		systems,
		selectedIndex: 0,
		breakers: makeBreakers(random),
		timer: TIMER_START,
		totalHacked: 0,
		quota: QUOTA_START,
		over: false,
		won: false,
		trace: 0,
		hintsSeen: 0
	};
}

/** Brute-force check: returns exact matches (Mastermind style) */
export function checkCrack(guess: number[], code: number[]): number {
	let exact = 0;
	for (let i = 0; i < 4; i++) if (guess[i] === code[i]) exact++;
	return exact;
}

/** Toggle one breaker on the panel */
export function toggleBreaker(state: HackersState, idx: number) {
	const b = state.breakers[idx];
	if (!b) return;
	b.on = !b.on;
	// Lights Out: toggling a cell also toggles its neighbors (orthogonal)
	const row = Math.floor(idx / PANEL_SIZE);
	const col = idx % PANEL_SIZE;
	for (let r = row - 1; r <= row + 1; r++) {
		for (let c = col - 1; c <= col + 1; c++) {
			if (r >= 0 && r < PANEL_SIZE && c >= 0 && c < PANEL_SIZE && !(r === row && c === col)) {
				const n = state.breakers[r * PANEL_SIZE + c];
				if (n) n.on = !n.on;
			}
		}
	}
}

/** Check whether all breakers are dark (won this panel) */
export function allBreakersDark(state: HackersState): boolean {
	return state.breakers.every((b) => !b.on);
}

/** Install malware on selected system */
export function installMalware(state: HackersState, type: InstallType) {
	const sys = state.systems[state.selectedIndex];
	if (!sys || sys.hacked) return;
	if (type === 'siphon' || type === 'both') sys.siphonInstalled = true;
	if (type === 'worm' || type === 'both') sys.wormInstalled = true;
	state.trace += TRACE_STEP;
}

/** Mark wallet cracked and update quota */
export function finishWallet(state: HackersState) {
	const sys = state.systems[state.selectedIndex];
	if (sys && !sys.hacked) {
		sys.hacked = true;
		state.totalHacked++;
		state.trace = Math.max(0, state.trace - 15);
	}
}

export function stepHack(state: HackersState, dtMs: number) {
	if (state.over) return;
	state.timer -= dtMs / 1000;
	if (state.timer <= 0) {
		state.over = true;
		state.won = state.totalHacked >= state.quota;
	}
	if (state.trace >= 100) {
		state.over = true;
		state.won = false;
	}
	if (state.totalHacked >= state.quota && allBreakersDark(state)) {
		state.over = true;
		state.won = true;
	}
}

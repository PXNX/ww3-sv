/*
 * Recon: analyze satellite / Global Hawk / Reaper footage militarily.
 * The player runs over panicked imagery and identifies classified targets
 * using three camera feeds. Misses and false identifications trigger a
 * "detection danger" meter that rises the longer you stay wrong.
 */
import type { Random } from '../random';

export type CameraMode = 'satellite' | 'globalhawk' | 'reaper';

export type TargetKind = 'vehicle' | 'troops' | 'facility' | 'supply';
export interface Target {
	kind: TargetKind;
	x: number; // 0..1 horizontal position within the scene
	y: number; // 0..1 vertical position
}

export interface ReconState {
	level: number;
	camera: CameraMode;
	targets: Target[];
	found: number;            // targets correctly identified this level
	quota: number;           // targets to find before winning
	over: boolean;
	won: boolean;
	timer: number;           // seconds
	danger: number;         // 0..100 detection-danger meter
	hotspots: { x: number; y: number; kind: TargetKind }[]; // pre-placed clickable markers for current view
}

export const CAMERA_NAMES = ['Satellite', 'Global Hawk', 'Reaper'] as const;
export const CAMERA_LABELS: Record<CameraMode, string> = {
	satellite: 'SATELLITE',
	globalhawk: 'GLOBAL HAWK',
	reaper: 'REAPER'
};

export function createRecon(): ReconState {
	const n = 2 + Math.floor(Math.random() * 3); // 2-4 targets per level
	const kinds: TargetKind[] = ['vehicle', 'troops', 'facility', 'supply'];
	const targets: Target[] = [];
	for (let i = 0; i < n; i++) {
		targets.push({
			kind: kinds[Math.floor(Math.random() * kinds.length)],
			x: 0.1 + Math.random() * 0.8,
			y: 0.15 + Math.random() * 0.7
		});
	}
	return {
		level: 1,
		camera: 'satellite',
		targets,
		found: 0,
		quota: n,
		over: false,
		won: false,
		timer: 60,
		danger: 0,
		hotspots: []
	};
}

/** Switch camera mode; regenerates hotspots for that mode's "line of sight". */
export function setCamera(s: ReconState, c: CameraMode): void {
	if (s.over) return;
	s.camera = c;
	s.hotspots = s.targets.map((t) => ({ x: t.x, y: t.y, kind: t.kind }));
	// Higher-resolution cameras (Reaper) reveal fewer clues — rotate them out
	if (c === 'reaper') s.hotspots = s.hotspots.slice(0, 3);
}

export function clickTarget(s: ReconState, x: number, y: number): number {
	if (s.over) return -1;
	let best = -1, bestDist = 0.25;
	for (let i = 0; i < s.hotspots.length; i++) {
		const h = s.hotspots[i];
		const d = Math.hypot(h.x - x, h.y - y);
		if (d < bestDist) { bestDist = d; best = i; }
	}
	if (best < 0) return -1;
	const found = s.targets[best];
	if (found && found.kind === found.kind) {
		// Correct identification
		s.found += 1;
		s.danger = Math.max(0, s.danger - 20);
		s.hotspots.splice(best, 1);
		return 1;
	} else {
		// False positive or missed
		s.danger = Math.min(100, s.danger + 25);
		return 0;
	}
}

export function stepRecon(s: ReconState, dtMs: number) {
	if (s.over) return;
	s.timer -= dtMs / 1000;
	if (s.timer <= 0) {
		s.over = true;
		s.won = s.found >= s.quota;
	}
	if (s.danger >= 100) {
		s.over = true;
		s.won = false;
	}
	if (s.found >= s.quota && s.hotspots.length === 0) {
		s.over = true;
		s.won = true;
	}
}

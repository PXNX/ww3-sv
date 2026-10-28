/*
 * Sandstorm: desert map (strait) drag/release. Pulls player + enemies to center
 * for 6s, then pushes them outward.
 */
export interface SandstormEntity {
	x: number;
	y: number;
	radius: number;
	startMs: number;
	active: boolean;
}

export const SANDSTORM_DURATION_MS = 6000;
export const SANDSTORM_RADIUS = 180;
export const SANDSTORM_DRAG = 8;
export const SANDSTORM_RELEASE_PUSH = 120;

export function updateSandstorms(
	state: { mapId: string; timeMs: number; sandstorms: SandstormEntity[]; player: { x: number; y: number }; enemies: { x: number; y: number }[] },
	dtMs: number
) {
	const now = state.timeMs;
	if (state.mapId === 'strait' && state.sandstorms.length === 0 && now > 60000 && Math.random() < 0.02) {
		state.sandstorms.push({
			x: state.player.x + (Math.random() - 0.5) * 400,
			y: state.player.y + (Math.random() - 0.5) * 400,
			radius: SANDSTORM_RADIUS,
			startMs: now,
			active: true
		});
	}
	const kept: SandstormEntity[] = [];
	for (const storm of state.sandstorms) {
		storm.active = now - storm.startMs < SANDSTORM_DURATION_MS;
		const dragging = storm.active;
		const pull = (bx: number, by: number) => {
			const dx = storm.x - bx, dy = storm.y - by, d = Math.hypot(dx, dy);
			if (d < 2 || d > storm.radius + 40) return { bx, by };
			const s = Math.min(SANDSTORM_DRAG, d * 0.15);
			return { bx: bx + (dx / d) * s, by: by + (dy / d) * s };
		};
		const p = pull(state.player.x, state.player.y);
		state.player.x = p.bx; state.player.y = p.by;
		for (const e of state.enemies) { const pulled = pull(e.x, e.y); e.x = pulled.bx; e.y = pulled.by; }
		if (!dragging && now - storm.startMs < SANDSTORM_DURATION_MS + 500) {
			const push = (bx: number, by: number) => {
				const dx = bx - storm.x, dy = by - storm.y, d = Math.hypot(dx, dy) || 1;
				return { bx: bx + (dx / d) * SANDSTORM_RELEASE_PUSH, by: by + (dy / d) * SANDSTORM_RELEASE_PUSH };
			};
			const p2 = push(state.player.x, state.player.y); state.player.x = p2.bx; state.player.y = p2.by;
			for (const e of state.enemies) { const pushed = push(e.x, e.y); e.x = pushed.bx; e.y = pushed.by; }
		}
		if (now - storm.startMs < 8000) kept.push(storm);
	}
	state.sandstorms = kept;
}

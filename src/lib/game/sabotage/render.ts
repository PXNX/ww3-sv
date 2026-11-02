/*
 * Canvas drawing for Gig Saboteur. The whole map is always on screen: `fitView` picks the tile size
 * and offset that make it fill the canvas, and everything is drawn in flat shapes with ink outlines
 * like the rest of the app, at dusk. Vision cones are ray cast, so walls and crates cut them short,
 * and they shift from a calm colour to red as the watcher gets suspicious.
 */
import { PHONE } from './config.js';
import type { Level, TargetKind } from './levels.js';
import { castRay, tileAt, type Grid, type Tile, type Vec } from './map.js';
import type { Guard, SabotageState, Sensor } from './state.js';

export const INK = '#111111';
const GRASS = '#46663f';
const GRASS_DARK = '#3b5a37';
const SHADOW = '#1f3328';
const PAVED = '#6b7078';
const PAVED_LINE = '#5a5f67';
const WALL_TOP = '#8c8f98';
const WALL_FACE = '#5c606a';
const FENCE = '#c8ccd2';
const CRATE = '#b07a40';
const CRATE_DARK = '#8a5e2e';
const BUSH = '#2f8a4c';
const BUSH_LIGHT = '#43a863';
const DOOR = '#8a5a2b';
const RED = '#e5484d';
const YELLOW = '#f5c83a';
const GREEN = '#43c373';
const PAPER = '#ffffff';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export interface View {
	/** Pixels per tile */
	tile: number;
	ox: number;
	oy: number;
}

export interface Extras {
	/** Seconds of play, drives the small animations */
	time: number;
	shake: number;
	phoneArmed: boolean;
	effects: readonly {
		kind: 'alert' | 'investigate' | 'noise' | 'boom' | 'phone';
		x: number;
		y: number;
		dog?: boolean;
		age: number;
		ttl: number;
	}[];
}

/** Largest tile size that fits the map in the canvas, centred, leaving a margin */
export function fitView(width: number, height: number, grid: Grid, margin = 6): View {
	const tile = Math.max(
		8,
		Math.floor(Math.min((width - margin * 2) / grid.width, (height - margin * 2) / grid.height))
	);
	return {
		tile,
		ox: Math.round((width - tile * grid.width) / 2),
		oy: Math.round((height - tile * grid.height) / 2)
	};
}

export const screenToTile = (view: View, px: number, py: number): Vec => ({
	x: (px - view.ox) / view.tile,
	y: (py - view.oy) / view.tile
});

const hash = (x: number, y: number) => {
	let h = (x * 374761393 + y * 668265263) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

function outline(ctx: CanvasRenderingContext2D, width: number) {
	ctx.strokeStyle = INK;
	ctx.lineWidth = width;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
}

function rect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: string,
	line = 0
) {
	ctx.fillStyle = fill;
	ctx.fillRect(x, y, w, h);
	if (line > 0) {
		outline(ctx, line);
		ctx.strokeRect(x, y, w, h);
	}
}

function disc(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	fill: string,
	line = 0
) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fillStyle = fill;
	ctx.fill();
	if (line > 0) {
		outline(ctx, line);
		ctx.stroke();
	}
}

// --- Ground ----------------------------------------------------------------------------------

function drawGround(ctx: CanvasRenderingContext2D, level: Level, view: View) {
	const { grid } = level;
	const t = view.tile;
	for (let y = 0; y < grid.height; y++) {
		for (let x = 0; x < grid.width; x++) {
			const tile = tileAt(grid, x, y);
			const px = view.ox + x * t;
			const py = view.oy + y * t;
			const noise = hash(x, y);
			switch (tile) {
				case 'paved':
				case 'target':
				case 'exit':
				case 'door':
					rect(ctx, px, py, t, t, PAVED);
					ctx.fillStyle = PAVED_LINE;
					ctx.fillRect(px, py + t - 2, t, 2);
					ctx.fillRect(px + t - 2, py, 2, t);
					break;
				case 'shadow':
					rect(ctx, px, py, t, t, SHADOW);
					ctx.strokeStyle = 'rgba(0,0,0,0.25)';
					ctx.lineWidth = 1;
					for (let i = -1; i < 4; i++) {
						ctx.beginPath();
						ctx.moveTo(px + (i * t) / 3, py + t);
						ctx.lineTo(px + (i * t) / 3 + t / 2, py);
						ctx.stroke();
					}
					break;
				default:
					rect(ctx, px, py, t, t, (x + y) % 2 === 0 ? GRASS : GRASS_DARK);
					if (noise > 0.72) {
						ctx.fillStyle = 'rgba(255,255,255,0.12)';
						ctx.fillRect(px + noise * t * 0.6, py + (1 - noise) * t * 0.7, 2, 4);
					}
					break;
			}
		}
	}
}

// --- Cones -----------------------------------------------------------------------------------

function mix(a: [number, number, number], b: [number, number, number], k: number): string {
	const c = a.map((value, index) => Math.round(value + (b[index] - value) * k));
	return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const CONE_COLOUR = {
	guard: [255, 220, 90],
	dog: [255, 170, 80],
	camera: [140, 220, 255],
	floodlight: [255, 244, 190]
} as const;
const ALARM: [number, number, number] = [238, 70, 76];

function drawCone(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	view: View,
	origin: Vec,
	facing: number,
	halfFov: number,
	range: number,
	heat: number,
	colour: readonly [number, number, number]
) {
	const t = view.tile;
	const full = halfFov >= Math.PI - 1e-6;
	const steps = full ? 44 : 22;
	const cx = view.ox + origin.x * t;
	const cy = view.oy + origin.y * t;
	ctx.beginPath();
	if (!full) ctx.moveTo(cx, cy);
	for (let i = 0; i <= steps; i++) {
		const angle = full ? (i / steps) * Math.PI * 2 : facing - halfFov + (i / steps) * halfFov * 2;
		const distance = castRay(grid, origin, angle, range);
		const px = cx + Math.cos(angle) * distance * t;
		const py = cy + Math.sin(angle) * distance * t;
		if (i === 0 && full) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, range * t);
	const base = mix([colour[0], colour[1], colour[2]], ALARM, Math.min(1, heat * 1.4));
	const alpha = 0.2 + heat * 0.32;
	gradient.addColorStop(0, base.replace('rgb', 'rgba').replace(')', `,${alpha + 0.12})`));
	gradient.addColorStop(1, base.replace('rgb', 'rgba').replace(')', `,${alpha * 0.45})`));
	ctx.fillStyle = gradient;
	ctx.fill();
	ctx.strokeStyle = base.replace('rgb', 'rgba').replace(')', `,${0.35 + heat * 0.4})`);
	ctx.lineWidth = 1.5;
	ctx.stroke();
}

function drawCones(ctx: CanvasRenderingContext2D, state: SabotageState, view: View) {
	const { grid } = state.level;
	for (const sensor of state.sensors) {
		if (!sensor.active) continue;
		drawCone(
			ctx,
			grid,
			view,
			sensor,
			sensor.angle,
			sensor.halfFov,
			sensor.range,
			sensor.heat,
			CONE_COLOUR[sensor.kind]
		);
	}
	for (const guard of state.guards) {
		drawCone(
			ctx,
			grid,
			view,
			guard,
			guard.facing,
			guard.halfFov,
			guard.range,
			guard.heat,
			CONE_COLOUR[guard.kind]
		);
	}
}

// --- Solid things ----------------------------------------------------------------------------

function drawWall(ctx: CanvasRenderingContext2D, grid: Grid, x: number, y: number, view: View) {
	const t = view.tile;
	const px = view.ox + x * t;
	const py = view.oy + y * t;
	const below = tileAt(grid, x, y + 1);
	const face = below !== 'wall' ? Math.round(t * 0.26) : 0;
	if (face > 0) rect(ctx, px, py + t - face, t, face, WALL_FACE);
	rect(ctx, px, py, t, t - face, WALL_TOP);
	ctx.fillStyle = 'rgba(255,255,255,0.16)';
	ctx.fillRect(px + 2, py + 2, t - 4, 3);
	outline(ctx, 2);
	ctx.strokeRect(px, py, t, t);
}

function drawFence(ctx: CanvasRenderingContext2D, x: number, y: number, view: View, grid: Grid) {
	const t = view.tile;
	const px = view.ox + x * t;
	const py = view.oy + y * t;
	const cx = px + t / 2;
	const cy = py + t / 2;
	const horizontal = tileAt(grid, x - 1, y) === 'fence' || tileAt(grid, x + 1, y) === 'fence';
	const vertical = tileAt(grid, x, y - 1) === 'fence' || tileAt(grid, x, y + 1) === 'fence';
	outline(ctx, 2);
	ctx.strokeStyle = FENCE;
	ctx.lineWidth = 2;
	ctx.beginPath();
	if (horizontal || !vertical) {
		ctx.moveTo(px, cy);
		ctx.lineTo(px + t, cy);
	}
	if (vertical) {
		ctx.moveTo(cx, py);
		ctx.lineTo(cx, py + t);
	}
	ctx.stroke();
	disc(ctx, cx, cy, t * 0.14, FENCE, 2);
}

function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, view: View) {
	const t = view.tile;
	const px = view.ox + x * t + t * 0.06;
	const py = view.oy + y * t + t * 0.06;
	const s = t * 0.88;
	rect(ctx, px, py + s * 0.12, s, s * 0.88, CRATE_DARK, 2);
	rect(ctx, px, py, s, s * 0.86, CRATE, 2);
	outline(ctx, 2);
	ctx.beginPath();
	ctx.moveTo(px, py);
	ctx.lineTo(px + s, py + s * 0.86);
	ctx.moveTo(px + s, py);
	ctx.lineTo(px, py + s * 0.86);
	ctx.stroke();
}

function drawDoor(ctx: CanvasRenderingContext2D, grid: Grid, x: number, y: number, view: View) {
	const t = view.tile;
	const px = view.ox + x * t;
	const py = view.oy + y * t;
	const sideways = tileAt(grid, x - 1, y) === 'wall' && tileAt(grid, x + 1, y) === 'wall';
	if (sideways) rect(ctx, px + t * 0.08, py + t * 0.28, t * 0.84, t * 0.44, DOOR, 2);
	else rect(ctx, px + t * 0.28, py + t * 0.08, t * 0.44, t * 0.84, DOOR, 2);
	disc(ctx, px + t * 0.5, py + t * 0.5, t * 0.07, YELLOW, 1.5);
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, view: View, alpha: number) {
	const t = view.tile;
	const cx = view.ox + x * t + t / 2;
	const cy = view.oy + y * t + t / 2;
	ctx.save();
	ctx.globalAlpha = alpha;
	disc(ctx, cx - t * 0.18, cy + t * 0.08, t * 0.3, BUSH, 2);
	disc(ctx, cx + t * 0.18, cy + t * 0.06, t * 0.3, BUSH, 2);
	disc(ctx, cx, cy - t * 0.12, t * 0.32, BUSH_LIGHT, 2);
	ctx.restore();
}

// --- Targets and exit ------------------------------------------------------------------------

function drawTargetArt(
	ctx: CanvasRenderingContext2D,
	kind: TargetKind,
	cx: number,
	cy: number,
	t: number,
	done: boolean
) {
	const body = done ? '#3d3d40' : undefined;
	switch (kind) {
		case 'pylon': {
			ctx.save();
			ctx.translate(cx, cy);
			outline(ctx, 2);
			ctx.fillStyle = body ?? '#b7bcc4';
			ctx.beginPath();
			ctx.moveTo(-t * 0.34, t * 0.4);
			ctx.lineTo(-t * 0.08, -t * 0.34);
			ctx.lineTo(t * 0.08, -t * 0.34);
			ctx.lineTo(t * 0.34, t * 0.4);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-t * 0.3, t * 0.12);
			ctx.lineTo(t * 0.3, t * 0.12);
			ctx.moveTo(-t * 0.2, -t * 0.1);
			ctx.lineTo(t * 0.2, -t * 0.1);
			ctx.moveTo(-t * 0.45, -t * 0.26);
			ctx.lineTo(t * 0.45, -t * 0.26);
			ctx.stroke();
			ctx.restore();
			break;
		}
		case 'transformer': {
			rect(ctx, cx - t * 0.38, cy - t * 0.3, t * 0.76, t * 0.62, body ?? '#8e99a6', 2);
			for (const dx of [-0.22, 0, 0.22])
				rect(ctx, cx + dx * t - t * 0.05, cy - t * 0.48, t * 0.1, t * 0.2, body ?? '#d9a441', 2);
			if (!done) {
				ctx.fillStyle = YELLOW;
				ctx.beginPath();
				ctx.moveTo(cx + t * 0.04, cy - t * 0.16);
				ctx.lineTo(cx - t * 0.12, cy + t * 0.04);
				ctx.lineTo(cx, cy + t * 0.04);
				ctx.lineTo(cx - t * 0.04, cy + t * 0.22);
				ctx.lineTo(cx + t * 0.14, cy - t * 0.04);
				ctx.lineTo(cx + t * 0.02, cy - t * 0.04);
				ctx.closePath();
				ctx.fill();
			}
			break;
		}
		case 'ammo': {
			rect(ctx, cx - t * 0.4, cy - t * 0.04, t * 0.8, t * 0.4, body ?? '#6e7f45', 2);
			rect(ctx, cx - t * 0.3, cy - t * 0.38, t * 0.6, t * 0.36, body ?? '#7d8f50', 2);
			if (!done) {
				rect(ctx, cx - t * 0.4, cy + t * 0.1, t * 0.8, t * 0.08, RED);
				rect(ctx, cx - t * 0.3, cy - t * 0.24, t * 0.6, t * 0.07, RED);
			}
			break;
		}
		case 'press': {
			rect(ctx, cx - t * 0.4, cy + t * 0.12, t * 0.8, t * 0.26, body ?? '#8a94a0', 2);
			rect(ctx, cx - t * 0.12, cy - t * 0.4, t * 0.24, t * 0.54, body ?? '#c8ccd2', 2);
			rect(ctx, cx - t * 0.32, cy - t * 0.44, t * 0.64, t * 0.16, body ?? '#d9a441', 2);
			break;
		}
	}
}

function drawTargets(
	ctx: CanvasRenderingContext2D,
	state: SabotageState,
	view: View,
	time: number
) {
	const t = view.tile;
	state.targets.forEach((target) => {
		const cx = view.ox + target.x * t;
		const cy = view.oy + target.y * t;
		const pulse = target.done ? 0 : (Math.sin(time * 4) + 1) / 2;
		if (!target.done) {
			ctx.beginPath();
			ctx.arc(cx, cy, t * (0.62 + pulse * 0.08), 0, Math.PI * 2);
			ctx.strokeStyle = `rgba(245,200,58,${0.35 + pulse * 0.35})`;
			ctx.lineWidth = 2;
			ctx.setLineDash([t * 0.14, t * 0.1]);
			ctx.stroke();
			ctx.setLineDash([]);
		}
		drawTargetArt(ctx, state.level.targetKind, cx, cy, t, target.done);
		if (target.done) {
			// Scorched and smoking
			disc(ctx, cx, cy - t * 0.1, t * 0.22 + Math.sin(time * 3 + cx) * 1.5, 'rgba(30,30,30,0.35)');
			disc(
				ctx,
				cx + t * 0.16,
				cy - t * 0.34 - ((time * 12) % (t * 0.3)),
				t * 0.1,
				'rgba(60,60,60,0.35)'
			);
		}
		if (target.progress > 0 && !target.done) {
			ctx.beginPath();
			ctx.arc(cx, cy, t * 0.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * target.progress);
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = Math.max(4, t * 0.14);
			ctx.lineCap = 'round';
			ctx.stroke();
		}
	});
}

function drawExit(ctx: CanvasRenderingContext2D, state: SabotageState, view: View, time: number) {
	const t = view.tile;
	const px = view.ox + Math.floor(state.level.exit.x) * t;
	const py = view.oy + Math.floor(state.level.exit.y) * t;
	const open = state.exitOpen;
	rect(ctx, px + 2, py + 2, t - 4, t - 4, open ? '#2f8a4c' : '#4a4d55');
	// Hazard stripes along the edge
	ctx.save();
	ctx.beginPath();
	ctx.rect(px + 2, py + 2, t - 4, t - 4);
	ctx.clip();
	ctx.fillStyle = open ? '#43c373' : YELLOW;
	for (let i = -4; i < 8; i++) {
		ctx.beginPath();
		ctx.moveTo(px + i * t * 0.3, py + t);
		ctx.lineTo(px + i * t * 0.3 + t * 0.15, py + t);
		ctx.lineTo(px + i * t * 0.3 + t * 0.15 + t, py);
		ctx.lineTo(px + i * t * 0.3 + t, py);
		ctx.closePath();
		ctx.globalAlpha = 0.45;
		ctx.fill();
	}
	ctx.restore();
	outline(ctx, 2);
	ctx.strokeRect(px + 2, py + 2, t - 4, t - 4);
	ctx.fillStyle = PAPER;
	ctx.font = `800 ${Math.round(t * 0.34)}px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	outline(ctx, 3);
	const label = open ? 'EXIT' : 'LOCK';
	ctx.strokeText(label, px + t / 2, py + t / 2 + (open ? Math.sin(time * 6) * 1.5 : 0));
	ctx.fillText(label, px + t / 2, py + t / 2 + (open ? Math.sin(time * 6) * 1.5 : 0));
}

// --- People ----------------------------------------------------------------------------------

function drawGuard(ctx: CanvasRenderingContext2D, guard: Guard, view: View, time: number) {
	const t = view.tile;
	const cx = view.ox + guard.x * t;
	const cy = view.oy + guard.y * t;
	const moving = guard.mode === 'patrol' || guard.mode === 'investigate' || guard.mode === 'return';
	const bob = moving ? Math.sin(time * 12 + cx) * t * 0.03 : 0;
	ctx.save();
	ctx.translate(cx, cy + bob);
	ctx.rotate(guard.facing);
	if (guard.kind === 'dog') {
		// Body, head, ears and a wagging tail, facing right
		ctx.beginPath();
		ctx.ellipse(0, 0, t * 0.3, t * 0.16, 0, 0, Math.PI * 2);
		ctx.fillStyle = '#9a6a3a';
		ctx.fill();
		outline(ctx, 2);
		ctx.stroke();
		disc(ctx, t * 0.3, 0, t * 0.14, '#b0804d', 2);
		disc(ctx, t * 0.26, -t * 0.12, t * 0.06, '#6e4a26', 1.5);
		disc(ctx, t * 0.26, t * 0.12, t * 0.06, '#6e4a26', 1.5);
		ctx.beginPath();
		ctx.moveTo(-t * 0.28, 0);
		ctx.lineTo(-t * 0.44, Math.sin(time * 14) * t * 0.1);
		outline(ctx, 3);
		ctx.stroke();
	} else {
		// A rifle across the chest, shoulders, then a fur-hatted head
		rect(ctx, t * 0.02, t * 0.1, t * 0.46, t * 0.07, '#3a3a3a', 1.5);
		ctx.beginPath();
		ctx.ellipse(0, 0, t * 0.17, t * 0.3, 0, 0, Math.PI * 2);
		ctx.fillStyle = '#6a7a4a';
		ctx.fill();
		outline(ctx, 2);
		ctx.stroke();
		disc(ctx, t * 0.04, 0, t * 0.17, '#8a8f98', 2);
		disc(ctx, t * 0.1, 0, t * 0.06, '#d6a679');
	}
	ctx.restore();
}

function drawMarker(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	view: View,
	text: string,
	colour: string,
	scale = 1
) {
	const t = view.tile;
	const cx = view.ox + x * t;
	const cy = view.oy + y * t - t * 0.62;
	ctx.font = `800 ${Math.round(t * 0.62 * scale)}px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	outline(ctx, Math.max(3, t * 0.12));
	ctx.strokeText(text, cx, cy);
	ctx.fillStyle = colour;
	ctx.fillText(text, cx, cy);
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: SabotageState, view: View, time: number) {
	const { player } = state;
	const t = view.tile;
	const cx = view.ox + player.x * t;
	const cy = view.oy + player.y * t;
	const sneaking = player.stance === 'sneak' || player.stance === 'idle';
	const scale = sneaking ? 0.92 : 1;
	const walking =
		player.stance === 'walk' || player.stance === 'sprint' || player.stance === 'sneak';
	const bob = walking ? Math.sin(time * (player.stance === 'sprint' ? 22 : 13)) * t * 0.03 : 0;
	// Soft shadow underneath
	ctx.beginPath();
	ctx.ellipse(cx, cy + t * 0.16, t * 0.26, t * 0.15, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(0,0,0,0.3)';
	ctx.fill();
	ctx.save();
	ctx.translate(cx, cy + bob);
	ctx.rotate(player.facing);
	ctx.scale(scale, scale);
	// Backpack, vest-wearing shoulders, then a hooded head
	rect(ctx, -t * 0.3, -t * 0.14, t * 0.16, t * 0.28, '#3a4a6a', 2);
	ctx.beginPath();
	ctx.ellipse(0, 0, t * 0.17, t * 0.28, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#f08a2d';
	ctx.fill();
	outline(ctx, 2);
	ctx.stroke();
	ctx.fillStyle = '#f7d36a';
	ctx.fillRect(-t * 0.02, -t * 0.26, t * 0.05, t * 0.52);
	disc(ctx, t * 0.05, 0, t * 0.16, '#e8e8ee', 2);
	disc(ctx, t * 0.12, 0, t * 0.06, '#d6a679');
	ctx.restore();
	// Dust behind a sprint
	if (player.stance === 'sprint') {
		for (let i = 0; i < 3; i++) {
			const back = ((time * 6 + i / 3) % 1) * t * 0.6;
			disc(
				ctx,
				cx - Math.cos(player.facing) * (t * 0.25 + back),
				cy - Math.sin(player.facing) * (t * 0.25 + back),
				t * 0.1 * (1 - back / (t * 0.7)),
				'rgba(230,230,210,0.45)'
			);
		}
	}
	// The meter, as a ring round the player
	if (state.suspicion > 0.02) {
		ctx.beginPath();
		ctx.arc(cx, cy, t * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.suspicion);
		ctx.strokeStyle = mixToRed(state.suspicion);
		ctx.lineWidth = Math.max(3, t * 0.1);
		ctx.lineCap = 'round';
		ctx.stroke();
	}
}

function mixToRed(k: number): string {
	return mix([245, 200, 58], [238, 70, 76], Math.min(1, k * 1.2));
}

// --- Effects ---------------------------------------------------------------------------------

function drawEffects(ctx: CanvasRenderingContext2D, extras: Extras, view: View) {
	const t = view.tile;
	for (const effect of extras.effects) {
		const k = effect.age / effect.ttl;
		const cx = view.ox + effect.x * t;
		const cy = view.oy + effect.y * t;
		switch (effect.kind) {
			case 'alert':
				drawMarker(
					ctx,
					effect.x,
					effect.y - 0.1 - k * 0.3,
					view,
					effect.dog ? '!!' : '!',
					RED,
					1 + Math.sin(k * Math.PI) * 0.35
				);
				break;
			case 'investigate':
				drawMarker(ctx, effect.x, effect.y - 0.1 - k * 0.2, view, '?', YELLOW);
				break;
			case 'noise': {
				for (let i = 0; i < 2; i++) {
					const kk = Math.min(1, k + i * 0.18);
					ctx.beginPath();
					ctx.arc(cx, cy, t * (0.4 + kk * 3.2), 0, Math.PI * 2);
					ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - kk)})`;
					ctx.lineWidth = 2;
					ctx.stroke();
				}
				break;
			}
			case 'phone': {
				const ring = (k * 6) % 1;
				ctx.beginPath();
				ctx.arc(cx, cy, t * (0.3 + ring * 1.8), 0, Math.PI * 2);
				ctx.strokeStyle = `rgba(79,168,216,${0.7 * (1 - ring)})`;
				ctx.lineWidth = 3;
				ctx.stroke();
				break;
			}
			case 'boom': {
				const radius = t * (0.3 + k * 1.3);
				ctx.beginPath();
				ctx.arc(cx, cy, radius, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(255,170,60,${0.7 * (1 - k)})`;
				ctx.fill();
				ctx.beginPath();
				ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(255,240,160,${0.9 * (1 - k)})`;
				ctx.fill();
				for (let i = 0; i < 8; i++) {
					const angle = (i / 8) * Math.PI * 2 + k;
					disc(
						ctx,
						cx + Math.cos(angle) * radius * 1.3,
						cy + Math.sin(angle) * radius * 1.3,
						t * 0.06 * (1 - k),
						'#ffd36a'
					);
				}
				break;
			}
		}
	}
}

function drawPhone(ctx: CanvasRenderingContext2D, state: SabotageState, view: View, time: number) {
	if (!state.phone) return;
	const t = view.tile;
	const cx = view.ox + state.phone.x * t;
	const cy = view.oy + state.phone.y * t;
	const shake = Math.sin(time * 40) * t * 0.03;
	ctx.save();
	ctx.translate(cx + shake, cy);
	ctx.rotate(Math.sin(time * 30) * 0.15);
	rect(ctx, -t * 0.12, -t * 0.2, t * 0.24, t * 0.4, '#2b3a55', 2);
	rect(ctx, -t * 0.08, -t * 0.15, t * 0.16, t * 0.24, '#8fd0f0');
	ctx.restore();
}

function drawAim(ctx: CanvasRenderingContext2D, state: SabotageState, view: View) {
	const t = view.tile;
	const cx = view.ox + state.player.x * t;
	const cy = view.oy + state.player.y * t;
	ctx.beginPath();
	ctx.arc(cx, cy, PHONE.range * t, 0, Math.PI * 2);
	ctx.strokeStyle = 'rgba(255,255,255,0.7)';
	ctx.lineWidth = 2;
	ctx.setLineDash([t * 0.2, t * 0.2]);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = 'rgba(79,168,216,0.08)';
	ctx.fill();
}

// --- Whole scene -----------------------------------------------------------------------------

export function drawScene(
	ctx: CanvasRenderingContext2D,
	state: SabotageState,
	extras: Extras,
	view: View,
	width: number,
	height: number
) {
	const { level } = state;
	const { grid } = level;
	ctx.save();
	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = '#16202a';
	ctx.fillRect(0, 0, width, height);
	if (extras.shake > 0) {
		const amount = extras.shake * view.tile * 0.22;
		ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
	}

	drawGround(ctx, level, view);
	drawCones(ctx, state, view);
	drawExit(ctx, state, view, extras.time);
	drawTargets(ctx, state, view, extras.time);

	// Floodlight and camera hardware sit on the wall
	for (const sensor of state.sensors) drawSensor(ctx, sensor, view);

	for (let y = 0; y < grid.height; y++) {
		for (let x = 0; x < grid.width; x++) {
			const tile: Tile = tileAt(grid, x, y);
			if (tile === 'wall') drawWall(ctx, grid, x, y, view);
			else if (tile === 'fence') drawFence(ctx, x, y, view, grid);
			else if (tile === 'crate') drawCrate(ctx, x, y, view);
			else if (tile === 'door') drawDoor(ctx, grid, x, y, view);
		}
	}

	drawPhone(ctx, state, view, extras.time);
	for (const guard of state.guards) drawGuard(ctx, guard, view, extras.time);
	drawPlayer(ctx, state, view, extras.time);

	// Bushes cover whoever stands in them
	const underBush = state.player.hidden
		? { x: Math.floor(state.player.x), y: Math.floor(state.player.y) }
		: null;
	for (let y = 0; y < grid.height; y++) {
		for (let x = 0; x < grid.width; x++) {
			if (tileAt(grid, x, y) !== 'bush') continue;
			drawBush(ctx, x, y, view, underBush && underBush.x === x && underBush.y === y ? 0.7 : 1);
		}
	}

	for (const guard of state.guards) {
		if (guard.mode === 'look')
			drawMarker(ctx, guard.x, guard.y, view, '!', RED, 0.8 + guard.heat * 0.4);
		else if (guard.mode === 'investigate' || guard.mode === 'search')
			drawMarker(ctx, guard.x, guard.y, view, '?', YELLOW, 0.85);
	}
	if (extras.phoneArmed) drawAim(ctx, state, view);
	drawEffects(ctx, extras, view);

	// A vignette keeps the eye on the middle
	const vignette = ctx.createRadialGradient(
		width / 2,
		height / 2,
		Math.min(width, height) * 0.35,
		width / 2,
		height / 2,
		Math.max(width, height) * 0.75
	);
	vignette.addColorStop(0, 'rgba(0,0,0,0)');
	vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

function drawSensor(ctx: CanvasRenderingContext2D, sensor: Sensor, view: View) {
	const t = view.tile;
	const cx = view.ox + sensor.x * t;
	const cy = view.oy + sensor.y * t;
	if (sensor.kind === 'camera') {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(sensor.angle);
		rect(ctx, -t * 0.22, -t * 0.17, t * 0.5, t * 0.34, '#2c3340', 2);
		disc(ctx, t * 0.28, 0, t * 0.1, sensor.seeing ? RED : '#8fd0f0', 1.5);
		ctx.restore();
	} else {
		disc(ctx, cx, cy, t * 0.26, '#2c3340', 2);
		disc(ctx, cx, cy, t * 0.16, sensor.active ? '#fff6b8' : '#555a66', 1.5);
	}
}

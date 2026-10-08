/*
 * Canvas drawing for Run Comrade: a sunny sunflower field in perspective with the runner at the
 * bottom, obstacles and pickups coming down the three lanes, rows of sunflowers along the lane
 * borders (thicker the further you run), the chasing drone peeking in at the bottom edge and short
 * cartoon effects. Everything is in screen units (see config.ts WORLD_WIDTH x WORLD_HEIGHT).
 */
import {
	JUMP_MS,
	STUMBLE_ANIM_MS,
	STUMBLE_GRACE_MS,
	VIEW_AHEAD,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	type Lane
} from './config';
import {
	DIRT,
	INK,
	PAPER,
	SAND,
	TIE_RED,
	YELLOW,
	drawDitch,
	drawDrone,
	drawHelmet,
	drawMine,
	drawRiceBowl,
	drawRunner,
	drawSunflower,
	drawTractorArm,
	type RunnerPose
} from './art';
import { densityAt, speedAt } from './patterns';
import { glanceAmount } from './glance';
import { opacityAt, visibility } from './weather';
import { HORIZON_Y, RUNNER_Y, groundY, laneX, scaleAt } from './projection';
import { isAirborne, isDucking, type RunState } from './state';

const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export type Effect =
	| {
			kind: 'popup';
			x: number;
			y: number;
			text: string;
			big: boolean;
			ageMs: number;
			durationMs: number;
	  }
	| { kind: 'poof'; x: number; y: number; ageMs: number; durationMs: number }
	| { kind: 'ring'; x: number; y: number; ageMs: number; durationMs: number };

export interface SceneExtras {
	effects: readonly Effect[];
	/** Skip the swaying flowers and the camera bob */
	reducedMotion: boolean;
}

const NO_EXTRAS: SceneExtras = { effects: [], reducedMotion: true };

/** Positions (in lanes) of the rows of sunflowers: the lane borders plus the field around them */
const FLOWER_ROWS = [-2.1, -1.4, -0.5, 0.5, 1.5, 2.5, 3.4, 4.1];
const FLOWER_SPACING = 1.6;
const TALL_SPACING = 1.1;
const TALL_HEIGHT = 104;
const CULL_BEHIND = -3.5;

/** A small deterministic hash to [0, 1), so flowers keep their place and look while scrolling */
function hash(a: number, b: number): number {
	let h = Math.imul(a | 0, 0x45d9f3b) ^ Math.imul((b + 7) | 0, 0x119de1f3);
	h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
	h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
	return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Blends two #rrggbb colors */
export function mixColor(from: string, to: string, amount: number): string {
	const t = Math.min(1, Math.max(0, amount));
	const channel = (hex: string, index: number) =>
		parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
	const part = (index: number) =>
		Math.round(channel(from, index) + (channel(to, index) - channel(from, index)) * t);
	return '#' + [0, 1, 2].map((index) => part(index).toString(16).padStart(2, '0')).join('');
}

/** A long, soft morning shadow stretching away from the low sun (to the left) */
function drawLongShadow(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	s: number,
	dawn: number,
	width: number
) {
	if (dawn < 0.05) return;
	ctx.beginPath();
	ctx.ellipse(
		x - width * 0.9 * s * dawn,
		y + 2 * s,
		width * s * (0.4 + dawn * 1.1),
		5 * s,
		0,
		0,
		Math.PI * 2
	);
	ctx.fillStyle = `rgba(60, 30, 70, ${0.22 * dawn})`;
	ctx.fill();
}

type Item =
	| { z: number; kind: 'flower'; lane: number; height: number; seed: number }
	| { z: number; kind: 'ditch' | 'arm' | 'mine'; lane: Lane }
	| { z: number; kind: 'helmet' | 'rice'; lane: Lane }
	| { z: number; kind: 'runner' };

export function runnerPose(state: RunState, reducedMotion = true): RunnerPose {
	const runner = state.runner;
	const t = runner.jumpMs >= 0 ? Math.min(1, runner.jumpMs / JUMP_MS) : 0;
	const hop = 4 * t * (1 - t);
	const stumbling = runner.stumbleMs > 0;
	const grace = runner.graceMs > 0 && !stumbling;
	return {
		stride: state.distance * 1.5,
		lift: isAirborne(runner) ? hop * 96 : 0,
		crouch: isDucking(runner) ? 1 : 0,
		tilt: stumbling ? Math.sin((runner.stumbleMs / STUMBLE_ANIM_MS) * Math.PI * 5) * 0.32 : 0,
		shield: state.power.shield,
		boost: state.power.boostMs > 0,
		alpha: grace && Math.floor(runner.graceMs / (STUMBLE_GRACE_MS / 7)) % 2 === 0 ? 0.45 : 1,
		// With reduced motion the glance is a still shocked pose instead of a turn
		glance: reducedMotion ? (glanceAmount(state.glance) > 0 ? 1 : 0) : glanceAmount(state.glance),
		still: reducedMotion,
		time: reducedMotion ? 0 : state.timeMs / 1000
	};
}

function collectItems(state: RunState): Item[] {
	const items: Item[] = [{ z: state.distance, kind: 'runner' }];
	const from = state.distance + CULL_BEHIND;
	const to = state.distance + VIEW_AHEAD;

	// Rows of sunflowers: more of them are in bloom the further the run has come
	const first = Math.ceil(from / FLOWER_SPACING);
	const last = Math.floor(to / FLOWER_SPACING);
	for (let k = first; k <= last; k++) {
		FLOWER_ROWS.forEach((lane, row) => {
			const z = k * FLOWER_SPACING + hash(k, row) * 0.9;
			if (z < from || z > to) return;
			const keep = 0.42 + 0.58 * densityAt(z);
			if (hash(k, row + 40) > keep) return;
			items.push({
				z,
				kind: 'flower',
				lane: lane + (hash(k, row + 80) - 0.5) * 0.18,
				height: 38 + hash(k, row + 120) * 16,
				seed: hash(k, row + 160)
			});
		});
	}

	// Tall sunflowers along the borders of the lanes where they hide the drone
	for (const patch of state.field.patches) {
		if (patch.zEnd < from || patch.zStart > to) continue;
		const borders = new Set<number>();
		for (const lane of patch.lanes) {
			borders.add(lane - 0.5);
			borders.add(lane + 0.5);
		}
		const startK = Math.ceil(patch.zStart / TALL_SPACING);
		for (let k = startK; k * TALL_SPACING <= patch.zEnd; k++) {
			const z = k * TALL_SPACING;
			if (z < from || z > to) continue;
			for (const lane of borders) {
				items.push({
					z: z + hash(k, lane * 10) * 0.5,
					kind: 'flower',
					lane: lane + (hash(k, lane * 10 + 3) - 0.5) * 0.14,
					height: TALL_HEIGHT + hash(k, lane * 10 + 6) * 24,
					seed: hash(k, lane * 10 + 9)
				});
			}
		}
	}

	for (const row of state.field.rows) {
		if (row.z < from || row.z > to) continue;
		for (const lane of [0, 1, 2] as const) {
			const kind = row.cells[lane];
			if (kind !== null && !row.spent[lane]) items.push({ z: row.z, kind, lane });
		}
	}
	for (const pickup of state.field.pickups) {
		if (pickup.taken || pickup.z < from || pickup.z > to) continue;
		items.push({ z: pickup.z, kind: pickup.kind, lane: pickup.lane });
	}
	items.sort((a, b) => b.z - a.z);
	return items;
}

function drawGround(ctx: CanvasRenderingContext2D, state: RunState) {
	// Sky
	const { dawn, fog } = state.weather;
	const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
	sky.addColorStop(0, mixColor(mixColor('#7cc7ea', '#e58aa8', dawn), '#7c8591', fog));
	sky.addColorStop(1, mixColor(mixColor('#e9f1cf', '#ffc98a', dawn), '#aeb5bb', fog));
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, WORLD_WIDTH, HORIZON_Y + 1);
	// Sun
	ctx.beginPath();
	ctx.save();
	ctx.globalAlpha = 1 - fog * 0.85;
	ctx.arc(WORLD_WIDTH - 70, 52 + dawn * (HORIZON_Y - 74), 24 + dawn * 10, 0, Math.PI * 2);
	ctx.fillStyle = mixColor(YELLOW, '#ff8f45', dawn);
	ctx.fill();
	ctx.lineWidth = 3;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.restore();
	// Clouds
	ctx.fillStyle = mixColor(PAPER, '#ffd6c4', dawn);
	for (const [cx, cy, r] of [
		[70, 48, 17],
		[96, 54, 13],
		[48, 56, 12]
	]) {
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
	}
	// Far hills
	ctx.beginPath();
	ctx.moveTo(0, HORIZON_Y);
	ctx.quadraticCurveTo(90, HORIZON_Y - 34, 190, HORIZON_Y - 8);
	ctx.quadraticCurveTo(280, HORIZON_Y - 30, WORLD_WIDTH, HORIZON_Y - 6);
	ctx.lineTo(WORLD_WIDTH, HORIZON_Y);
	ctx.closePath();
	ctx.fillStyle = '#9db27a';
	ctx.fill();

	// Field
	const field = ctx.createLinearGradient(0, HORIZON_Y, 0, WORLD_HEIGHT);
	field.addColorStop(0, '#b4b765');
	field.addColorStop(1, '#7f9340');
	ctx.fillStyle = field;
	ctx.fillRect(0, HORIZON_Y, WORLD_WIDTH, WORLD_HEIGHT - HORIZON_Y);

	// Scrolling bands, so speed can be felt
	const BAND = 3;
	const startBand = Math.floor((state.distance - 4) / BAND);
	for (let band = startBand; band * BAND < state.distance + VIEW_AHEAD; band++) {
		if (band % 2 !== 0) continue;
		const near = groundY(band * BAND - state.distance);
		const far = groundY((band + 1) * BAND - state.distance);
		if (near < HORIZON_Y || far > WORLD_HEIGHT) continue;
		ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
		ctx.fillRect(0, far, WORLD_WIDTH, near - far);
	}

	// The dirt track the three lanes run along
	const farAhead = VIEW_AHEAD;
	const nearAhead = -3.5;
	ctx.beginPath();
	ctx.moveTo(laneX(-0.5, farAhead), groundY(farAhead));
	ctx.lineTo(laneX(2.5, farAhead), groundY(farAhead));
	ctx.lineTo(laneX(2.5, nearAhead), groundY(nearAhead));
	ctx.lineTo(laneX(-0.5, nearAhead), groundY(nearAhead));
	ctx.closePath();
	ctx.fillStyle = DIRT;
	ctx.fill();
	// Furrows down the middle of each lane
	ctx.strokeStyle = 'rgba(90, 62, 28, 0.35)';
	for (const lane of [0, 1, 2]) {
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(laneX(lane, farAhead), groundY(farAhead));
		ctx.lineTo(laneX(lane, nearAhead), groundY(nearAhead));
		ctx.stroke();
	}
}

function drawItem(ctx: CanvasRenderingContext2D, state: RunState, item: Item, extras: SceneExtras) {
	const ahead = item.z - state.distance;
	const s = scaleAt(ahead);
	const y = groundY(ahead);
	const time = extras.reducedMotion ? 0 : state.timeMs / 1000;
	const dawn = state.weather.dawn;
	if (item.kind === 'runner') {
		const runnerX = laneX(state.runner.x, 0);
		drawLongShadow(ctx, runnerX, RUNNER_Y, 1, dawn, 40);
		drawRunner(ctx, runnerX, RUNNER_Y, 1, runnerPose(state, extras.reducedMotion));
		return;
	}
	// Fog fades things out, but never closer than a runner needs to see them
	const fade = opacityAt(ahead, visibility(state.weather, speedAt(state.distance)));
	if (fade <= 0) return;
	drawLongShadow(ctx, laneX(item.lane, ahead), y, s, dawn, item.kind === 'flower' ? 24 : 38);
	if (fade < 1) ctx.globalAlpha = fade;
	if (item.kind === 'flower') {
		const x = laneX(item.lane, ahead);
		drawSunflower(ctx, x, y, s, item.height, Math.sin(time * 1.6 + item.seed * 6.28) * 0.28);
	} else {
		const x = laneX(item.lane, ahead);
		switch (item.kind) {
			case 'ditch':
				drawDitch(ctx, x, y, s);
				break;
			case 'arm':
				drawTractorArm(ctx, x, y, s);
				break;
			case 'mine':
				drawMine(ctx, x, y, s, Math.sin(time * 9) > 0);
				break;
			case 'helmet':
				drawHelmet(ctx, x, y - (16 + Math.sin(time * 4 + item.z) * 4) * s, s, 1);
				break;
			case 'rice':
				drawRiceBowl(ctx, x, y - (16 + Math.sin(time * 4 + item.z) * 4) * s, s, time);
				break;
		}
	}
	if (fade < 1) ctx.globalAlpha = 1;
}

/**
 * Fog haze over the far field, the dark tint of heavy fog and the warm light of dawn. Fog only
 * shades the distance and darkens a little: things near the runner stay readable.
 */
function drawAtmosphere(ctx: CanvasRenderingContext2D, state: RunState, extras: SceneExtras) {
	const { dawn, fog } = state.weather;
	if (fog > 0.01) {
		// A slow drift in the density, skipped for reduced motion
		const drift = extras.reducedMotion ? 1 : 1 + 0.06 * Math.sin(state.timeMs / 1100);
		const reach = groundY(visibility(state.weather, speedAt(state.distance)) * 0.5);
		const haze = ctx.createLinearGradient(0, 0, 0, reach);
		const alpha = Math.min(1, fog * 0.9 * drift);
		haze.addColorStop(0, `rgba(190, 196, 204, ${alpha * 0.55})`);
		haze.addColorStop(HORIZON_Y / reach, `rgba(190, 196, 204, ${alpha})`);
		haze.addColorStop(1, 'rgba(190, 196, 204, 0)');
		ctx.fillStyle = haze;
		ctx.fillRect(0, 0, WORLD_WIDTH, reach);
		ctx.fillStyle = `rgba(10, 16, 34, ${0.4 * fog})`;
		ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	}
	if (dawn > 0.01) {
		ctx.fillStyle = `rgba(255, 140, 80, ${0.16 * dawn})`;
		ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	}
}

/** Where the chasing drone hangs on screen, null while it is too far away to see */
export function dronePlacement(state: RunState): { x: number; y: number; scale: number } | null {
	if (state.hidden) return null;
	const close = Math.min(1, Math.max(0, (9 - state.drone.gap) / 9));
	if (state.drone.gap >= 9) return null;
	const wobble = Math.sin(state.drone.phase * 3.1) * 16 * (1 - close * 0.5);
	return {
		x: laneX(state.drone.x, 0) + wobble,
		y: WORLD_HEIGHT + 30 - close * 170,
		scale: 0.75 + close * 0.85
	};
}

function drawCover(ctx: CanvasRenderingContext2D, state: RunState, extras: SceneExtras) {
	// Tall stalks in the foreground while the runner is among tall sunflowers: the drone is behind them
	const time = extras.reducedMotion ? 0 : state.timeMs / 1000;
	const center = laneX(state.runner.x, 0);
	for (const [dx, scale, height] of [
		[-150, 1.5, 190],
		[-88, 1.3, 130],
		[92, 1.3, 140],
		[152, 1.5, 200]
	]) {
		drawSunflower(
			ctx,
			center + dx,
			WORLD_HEIGHT + 24,
			scale,
			height / scale,
			Math.sin(time * 2 + dx) * 0.3
		);
	}
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[]) {
	for (const effect of effects) {
		const progress = Math.min(1, effect.ageMs / effect.durationMs);
		ctx.save();
		if (effect.kind === 'popup') {
			ctx.globalAlpha = 1 - progress * progress;
			ctx.font = `700 ${effect.big ? 26 : 19}px ${DISPLAY_FONT}`;
			ctx.textAlign = 'center';
			ctx.lineJoin = 'round';
			ctx.lineWidth = 5;
			ctx.strokeStyle = INK;
			const y = effect.y - progress * 40;
			ctx.strokeText(effect.text, effect.x, y);
			ctx.fillStyle = effect.big ? YELLOW : PAPER;
			ctx.fillText(effect.text, effect.x, y);
		} else if (effect.kind === 'poof') {
			ctx.globalAlpha = 1 - progress;
			for (let i = 0; i < 6; i++) {
				const angle = (i / 6) * Math.PI * 2 + 0.4;
				const reach = 10 + progress * 34;
				ctx.beginPath();
				ctx.arc(
					effect.x + Math.cos(angle) * reach,
					effect.y + Math.sin(angle) * reach * 0.7,
					9 + progress * 12,
					0,
					Math.PI * 2
				);
				ctx.fillStyle = i % 2 ? '#d8d2c0' : PAPER;
				ctx.fill();
				ctx.lineWidth = 2;
				ctx.strokeStyle = INK;
				ctx.stroke();
			}
		} else {
			ctx.globalAlpha = 1 - progress;
			ctx.beginPath();
			ctx.arc(effect.x, effect.y, 16 + progress * 54, 0, Math.PI * 2);
			ctx.lineWidth = 6 * (1 - progress) + 1;
			ctx.strokeStyle = TIE_RED;
			ctx.stroke();
		}
		ctx.restore();
	}
}

/** Draws the whole scene; the caller sets the transform so one unit is one world unit */
export function drawScene(
	ctx: CanvasRenderingContext2D,
	state: RunState,
	extras: SceneExtras = NO_EXTRAS
) {
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	ctx.clip();
	drawGround(ctx, state);
	for (const item of collectItems(state)) drawItem(ctx, state, item, extras);
	drawAtmosphere(ctx, state, extras);

	const drone = dronePlacement(state);
	if (drone) {
		// A red glow at the bottom edge warns that the drone is nearly there
		const danger = Math.min(1, Math.max(0, 1 - state.drone.gap / 4));
		if (danger > 0) {
			const glow = ctx.createLinearGradient(0, WORLD_HEIGHT - 90, 0, WORLD_HEIGHT);
			glow.addColorStop(0, 'rgba(229, 72, 77, 0)');
			glow.addColorStop(1, `rgba(229, 72, 77, ${0.45 * danger})`);
			ctx.fillStyle = glow;
			ctx.fillRect(0, WORLD_HEIGHT - 90, WORLD_WIDTH, 90);
		}
		ctx.globalAlpha = 1 - state.weather.fog * 0.35;
		drawDrone(ctx, drone.x, drone.y, drone.scale, state.drone.phase);
		ctx.globalAlpha = 1;
	}
	if (state.covered) drawCover(ctx, state, extras);

	drawEffects(ctx, extras.effects);
	ctx.restore();
}

/** Draws the final scene onto the shared score card */
export function drawScenePreview(
	ctx: CanvasRenderingContext2D,
	state: RunState,
	x: number,
	y: number,
	size: number
) {
	const scale = size / WORLD_HEIGHT;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, size, size);
	ctx.clip();
	ctx.fillStyle = SAND;
	ctx.fillRect(x, y, size, size);
	ctx.translate(x + (size - WORLD_WIDTH * scale) / 2, y);
	ctx.scale(scale, scale);
	drawScene(ctx, state, NO_EXTRAS);
	ctx.restore();
}

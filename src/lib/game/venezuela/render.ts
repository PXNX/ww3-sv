/*
 * Canvas drawing for El Presidente: a parallax backdrop of derricks and dunes, the tile map
 * (earth, crates, catwalks, barricades, pits of oil), then barrels, goons, helicopters, the hero
 * and short cartoon effects. The context is expected to be scaled so one unit is one tile; camX is
 * the tile at the left edge of the view.
 */
import {
	CRATE,
	EARTH,
	EARTH_DARK,
	INK,
	KHAKI,
	SLATE,
	drawBarrel,
	drawFlag,
	drawGoon,
	drawHelicopter,
	drawHero,
	drawLamp,
	drawSpikes,
	drawStars
} from './art';
import { SLAM_RADIUS, SQUASH_S, TWIRL_S, VIEW_H, VIEW_W } from './config';
import { tileAt } from './level';
import { isSprinting } from './player';
import { barrelBox, type World } from './world';

const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export interface Theme {
	skyTop: string;
	skyBottom: string;
	sun: string;
	far: string;
	near: string;
	pit: string;
	pitGlint: string;
}

/** One look per level, cycling when there are more levels than themes */
export const THEMES: readonly Theme[] = [
	{
		skyTop: '#8fcbe8',
		skyBottom: '#f6e3b0',
		sun: '#f5c83a',
		far: '#c9b27a',
		near: '#d8bf82',
		pit: '#1c1c22',
		pitGlint: '#4a4a58'
	},
	{
		skyTop: '#76b9e0',
		skyBottom: '#f3d28a',
		sun: '#ffd24d',
		far: '#c4a06a',
		near: '#d2ae6e',
		pit: '#1c1c22',
		pitGlint: '#4a4a58'
	},
	{
		skyTop: '#e3a06a',
		skyBottom: '#f7d9a0',
		sun: '#ee7b4a',
		far: '#a98a70',
		near: '#bf9a72',
		pit: '#1c1c22',
		pitGlint: '#5a4a58'
	},
	{
		skyTop: '#7fb3d6',
		skyBottom: '#d6ecf2',
		sun: '#fff0b0',
		far: '#8fa9bd',
		near: '#a3bccb',
		pit: '#2e6a8e',
		pitGlint: '#8fd0ff'
	},
	{
		skyTop: '#2c3e63',
		skyBottom: '#d98c6a',
		sun: '#f7e6a0',
		far: '#5a5d7c',
		near: '#7a6a80',
		pit: '#14141c',
		pitGlint: '#5a5a78'
	}
];

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
	| { kind: 'puff'; x: number; y: number; ageMs: number; durationMs: number }
	| { kind: 'ring'; x: number; y: number; ageMs: number; durationMs: number }
	/** The slam's shockwave, spreading along the floor */
	| { kind: 'shock'; x: number; y: number; ageMs: number; durationMs: number }
	/** A little cloud of dust kicked up behind a sprint or a landing */
	| { kind: 'dust'; x: number; y: number; ageMs: number; durationMs: number };

export interface SceneExtras {
	theme: number;
	camX: number;
	effects: readonly Effect[];
	reducedMotion: boolean;
	/** Tiles the whole view is shaken by right now, 0 for still */
	shake?: number;
}

function mix(from: string, to: string, amount: number): string {
	const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
	const out = [0, 1, 2].map((i) =>
		Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount)
			.toString(16)
			.padStart(2, '0')
	);
	return `#${out.join('')}`;
}

function drawDerrick(
	ctx: CanvasRenderingContext2D,
	x: number,
	baseY: number,
	size: number,
	color: string
) {
	ctx.beginPath();
	ctx.moveTo(x - size * 0.5, baseY);
	ctx.lineTo(x, baseY - size * 1.8);
	ctx.lineTo(x + size * 0.5, baseY);
	ctx.moveTo(x - size * 0.3, baseY - size * 0.7);
	ctx.lineTo(x + size * 0.3, baseY - size * 0.7);
	ctx.moveTo(x - size * 0.18, baseY - size * 1.2);
	ctx.lineTo(x + size * 0.18, baseY - size * 1.2);
	ctx.lineWidth = 0.09;
	ctx.strokeStyle = color;
	ctx.lineCap = 'round';
	ctx.stroke();
	// A pumpjack beam beside it
	ctx.beginPath();
	ctx.moveTo(x + size * 0.9, baseY - size * 0.5);
	ctx.lineTo(x + size * 1.9, baseY - size * 0.75);
	ctx.moveTo(x + size * 1.4, baseY);
	ctx.lineTo(x + size * 1.4, baseY - size * 0.62);
	ctx.stroke();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, theme: Theme, camX: number, time: number) {
	const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
	sky.addColorStop(0, theme.skyTop);
	sky.addColorStop(0.75, theme.skyBottom);
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, VIEW_W, VIEW_H);

	// Sun
	ctx.beginPath();
	ctx.arc(VIEW_W - 3 - camX * 0.02, 2, 0.9, 0, Math.PI * 2);
	ctx.fillStyle = theme.sun;
	ctx.fill();

	// Far dunes and derricks (slow parallax)
	const farShift = camX * 0.2;
	ctx.fillStyle = theme.far;
	ctx.beginPath();
	ctx.moveTo(0, VIEW_H);
	for (let x = 0; x <= VIEW_W + 1; x += 1) {
		const wx = x + farShift;
		ctx.lineTo(x, 6.2 + Math.sin(wx * 0.45) * 0.45 + Math.sin(wx * 0.17) * 0.5);
	}
	ctx.lineTo(VIEW_W + 1, VIEW_H);
	ctx.closePath();
	ctx.fill();
	for (let k = Math.floor(farShift / 7) - 1; k < Math.floor(farShift / 7) + 4; k++) {
		const x = k * 7 + 2 - farShift;
		drawDerrick(ctx, x, 6.5, 0.9, mix(theme.far, '#000000', 0.25));
	}

	// Near hills, with a smoke stack and a flare that flickers
	const nearShift = camX * 0.45;
	ctx.fillStyle = theme.near;
	ctx.beginPath();
	ctx.moveTo(0, VIEW_H);
	for (let x = 0; x <= VIEW_W + 1; x += 1) {
		const wx = x + nearShift;
		ctx.lineTo(x, 7.1 + Math.sin(wx * 0.6 + 1) * 0.3);
	}
	ctx.lineTo(VIEW_W + 1, VIEW_H);
	ctx.closePath();
	ctx.fill();
	for (let k = Math.floor(nearShift / 13) - 1; k < Math.floor(nearShift / 13) + 3; k++) {
		const x = k * 13 + 5 - nearShift;
		ctx.fillStyle = mix(theme.near, '#000000', 0.3);
		ctx.fillRect(x - 0.12, 4.9, 0.24, 2.3);
		const flicker = 0.18 + Math.sin(time * 9 + k) * 0.04;
		ctx.beginPath();
		ctx.ellipse(x, 4.75, flicker, flicker * 1.7, 0, 0, Math.PI * 2);
		ctx.fillStyle = '#ffb347';
		ctx.fill();
	}
}

function drawTiles(
	ctx: CanvasRenderingContext2D,
	world: World,
	theme: Theme,
	camX: number,
	time: number
) {
	const { level } = world;
	const first = Math.max(0, Math.floor(camX) - 1);
	const last = Math.min(level.width - 1, Math.ceil(camX + VIEW_W) + 1);
	for (let ty = 0; ty < level.height; ty++) {
		for (let tx = first; tx <= last; tx++) {
			const char = level.rows[ty][tx];
			const x = tx;
			const y = ty;
			if (char === '#') {
				const open = tileAt(level, tx, ty - 1) !== 'solid';
				ctx.fillStyle = (tx + ty) % 2 === 0 ? EARTH : mix(EARTH, EARTH_DARK, 0.35);
				ctx.fillRect(x, y, 1.02, 1.02);
				if (open) {
					ctx.fillStyle = KHAKI;
					ctx.fillRect(x, y, 1.02, 0.22);
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x + 1.02, y);
					ctx.lineWidth = 0.07;
					ctx.strokeStyle = INK;
					ctx.stroke();
				} else if ((tx * 7 + ty * 3) % 5 === 0) {
					ctx.fillStyle = EARTH_DARK;
					ctx.beginPath();
					ctx.arc(x + 0.5, y + 0.5, 0.12, 0, Math.PI * 2);
					ctx.fill();
				}
			} else if (char === 'W') {
				ctx.fillStyle = CRATE;
				ctx.fillRect(x + 0.02, y + 0.02, 0.96, 0.96);
				ctx.lineWidth = 0.07;
				ctx.strokeStyle = INK;
				ctx.strokeRect(x + 0.035, y + 0.035, 0.93, 0.93);
				ctx.beginPath();
				ctx.moveTo(x + 0.1, y + 0.1);
				ctx.lineTo(x + 0.9, y + 0.9);
				ctx.moveTo(x + 0.9, y + 0.1);
				ctx.lineTo(x + 0.1, y + 0.9);
				ctx.lineWidth = 0.05;
				ctx.stroke();
			} else if (char === '=') {
				ctx.fillStyle = SLATE;
				ctx.fillRect(x, y, 1.02, 0.24);
				ctx.lineWidth = 0.06;
				ctx.strokeStyle = INK;
				ctx.strokeRect(x, y, 1.02, 0.24);
				// Railing posts hanging below, like a catwalk's struts
				ctx.beginPath();
				ctx.moveTo(x + 0.2, y + 0.24);
				ctx.lineTo(x + 0.2, y + 0.5);
				ctx.moveTo(x + 0.8, y + 0.24);
				ctx.lineTo(x + 0.8, y + 0.5);
				ctx.lineWidth = 0.05;
				ctx.stroke();
			} else if (char === '^') {
				drawSpikes(ctx, x, y);
			}
		}
	}

	// Pits are pools: wherever the bottom row is open
	const bottom = level.height - 1;
	for (let tx = first; tx <= last; tx++) {
		if (tileAt(level, tx, bottom) === 'solid') continue;
		const wave = Math.sin(time * 3 + tx * 1.3) * 0.06;
		ctx.fillStyle = theme.pit;
		ctx.fillRect(tx, bottom + 0.1 + wave, 1.02, 0.95 - wave);
		ctx.fillStyle = theme.pitGlint;
		ctx.fillRect(tx + 0.2, bottom + 0.16 + wave, 0.35, 0.05);
	}
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[], camX: number) {
	for (const effect of effects) {
		const t = Math.min(1, effect.ageMs / effect.durationMs);
		const x = effect.x - camX;
		if (effect.kind === 'popup') {
			ctx.save();
			ctx.translate(x, effect.y - t * 0.9);
			ctx.scale(0.02, 0.02);
			ctx.globalAlpha = 1 - t * t;
			ctx.font = `bold ${effect.big ? 34 : 26}px ${DISPLAY_FONT}`;
			ctx.textAlign = 'center';
			ctx.lineWidth = 6;
			ctx.strokeStyle = INK;
			ctx.lineJoin = 'round';
			ctx.strokeText(effect.text, 0, 0);
			ctx.fillStyle = '#ffffff';
			ctx.fillText(effect.text, 0, 0);
			ctx.restore();
		} else if (effect.kind === 'shock') {
			ctx.save();
			ctx.globalAlpha = 1 - t;
			ctx.lineWidth = 0.14 * (1 - t) + 0.03;
			ctx.strokeStyle = '#ffffff';
			ctx.beginPath();
			ctx.ellipse(x, effect.y - 0.05, 0.4 + t * SLAM_RADIUS, 0.12 + t * 0.35, 0, Math.PI, 0);
			ctx.stroke();
			ctx.strokeStyle = INK;
			ctx.lineWidth = 0.05;
			ctx.beginPath();
			ctx.ellipse(x, effect.y - 0.05, 0.2 + t * SLAM_RADIUS * 0.7, 0.08 + t * 0.25, 0, Math.PI, 0);
			ctx.stroke();
			ctx.restore();
		} else if (effect.kind === 'dust') {
			ctx.save();
			ctx.globalAlpha = 0.7 * (1 - t);
			ctx.fillStyle = '#f3e6c8';
			ctx.beginPath();
			ctx.arc(x, effect.y - 0.12 - t * 0.25, 0.1 + t * 0.18, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		} else if (effect.kind === 'ring') {
			ctx.save();
			ctx.globalAlpha = 1 - t;
			ctx.beginPath();
			ctx.arc(x, effect.y, 0.3 + t * 0.9, 0, Math.PI * 2);
			ctx.lineWidth = 0.1;
			ctx.strokeStyle = '#ffffff';
			ctx.stroke();
			ctx.restore();
		} else {
			ctx.save();
			ctx.globalAlpha = 1 - t * 0.6;
			drawStars(ctx, x, effect.y, t);
			ctx.restore();
		}
	}
}

/** Draws the whole scene into a 14 x 10 tile view */
export function drawScene(ctx: CanvasRenderingContext2D, world: World, extras: SceneExtras) {
	const theme = THEMES[extras.theme % THEMES.length];
	const { camX } = extras;
	const time = extras.reducedMotion ? 0 : world.time;
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, VIEW_W, VIEW_H);
	ctx.clip();

	drawBackdrop(ctx, theme, camX, time);

	ctx.save();
	if (extras.shake && !extras.reducedMotion) {
		ctx.translate(
			Math.sin(world.time * 97) * extras.shake,
			Math.cos(world.time * 83) * extras.shake
		);
	}
	ctx.save();
	ctx.translate(-camX, 0);
	drawTiles(ctx, world, theme, camX, time);
	const { level } = world;

	drawFlag(ctx, level.goal.x + 0.5, level.goal.y + 1, time, world.status === 'won');
	level.checkpoints.forEach((spot, index) => {
		drawLamp(ctx, spot.x + 0.5, spot.y + 1, world.lit[index]);
	});
	level.barrels.forEach((spot, index) => {
		if (world.collected[index]) return;
		const box = barrelBox(spot);
		const bob = extras.reducedMotion ? 0 : Math.sin(time * 3 + spot.x) * 0.04;
		drawBarrel(ctx, box.x + box.w / 2, box.y + box.h + bob, Math.sin(time * 4 + spot.x));
	});
	for (const walker of world.walkers) {
		if (!walker.alive && walker.squashed > SQUASH_S) continue;
		const squash = walker.alive ? 0 : Math.min(1, walker.squashed / 0.08);
		drawGoon(ctx, walker.x + walker.w / 2, walker.y + walker.h, {
			time,
			dir: walker.dir,
			squash,
			airborne: !walker.onGround
		});
		if (!walker.alive && !extras.reducedMotion) {
			drawStars(
				ctx,
				walker.x + walker.w / 2,
				walker.y + walker.h - 0.5,
				walker.squashed / SQUASH_S
			);
		}
	}
	for (const state of world.helis) {
		drawHelicopter(ctx, state.x, state.y, time, state.mode === 'telegraph');
	}

	const { player } = world;
	const blinking = world.invuln > 0 && Math.floor(world.invuln * 12) % 2 === 0;
	if (!blinking && world.status !== 'dead') {
		drawHero(ctx, player.x + player.w / 2, player.y + player.h, {
			facing: player.facing,
			run: time,
			speed: Math.min(1, Math.abs(player.vx) / 4),
			airborne: !player.onGround,
			rising: player.vy < 0,
			hurt: world.invuln > 1.2,
			twirl: extras.reducedMotion || player.twirl === 0 ? 0 : 1 - player.twirl / TWIRL_S,
			slam: player.slam,
			sprint: player.onGround && isSprinting(player)
		});
	}
	ctx.restore();

	drawEffects(ctx, extras.effects, camX);
	ctx.restore();
	ctx.restore();
}

/** Draws the scene as a square picture for the share card */
export function drawPreview(
	ctx: CanvasRenderingContext2D,
	world: World,
	camX: number,
	theme: number,
	x: number,
	y: number,
	size: number
) {
	const scale = size / VIEW_W;
	ctx.save();
	ctx.translate(x, y + (size - VIEW_H * scale) / 2);
	ctx.scale(scale, scale);
	drawScene(ctx, world, { theme, camX, effects: [], reducedMotion: true });
	ctx.restore();
}

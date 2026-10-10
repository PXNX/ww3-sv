/*
 * Canvas drawing for Drone Wall, all in world units (see config.ts) and scaled by the caller.
 * Everything is original: chunky blob soldiers with thick ink outlines, flat fills, no blood.
 * Fallen soldiers tumble away and breaches or blasts end in a white poof.
 *
 * This file draws the field, the scenery, the effects and puts the scene together; the sprites
 * live next to it: renderEnemies.ts (soldiers, vehicles, aircraft), renderDefenses.ts (defenses,
 * units, elite looks), renderPowers.ts (shells, rockets, bombs, F-16 runs) and renderWeather.ts.
 */
import {
	HELMET_FLY_MS,
	HELMET_POP_MS,
	HELMET_TARGET,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	isFlyerKind,
	type DecorKind,
	type EnemyKind,
	type MapTheme,
	type Point
} from './config';
import {
	DISPLAY_FONT,
	FLAG_BLUE,
	INK,
	PAPER,
	SAND,
	SANDBAG,
	SOVIET_GREEN,
	SOVIET_GREEN_DARK,
	TIE_RED,
	YELLOW,
	easeOut,
	inkEllipse,
	inkPoly,
	inkRect,
	polyline,
	progressOf,
	smoothstep,
	starPath,
	type Ctx
} from './drawKit';
import { drawDefense, drawRangeRing, drawSlot, drawUnit } from './renderDefenses';
import { drawBlob, drawFlyer, drawFlyerBody, drawOfficerAura, drawSoldier } from './renderEnemies';
import { drawAirRun, drawShell, drawStrikePreview, type StrikePreview } from './renderPowers';
import { drawWeatherGround, drawWeatherSky, weatherIntensity } from './renderWeather';
import type { Decor, DroneWallMap } from './maps';
import type { DroneWallState, Helmet, Projectile } from './state';

export type Effect =
	| {
			kind: 'tumble';
			x: number;
			y: number;
			vx: number;
			vy: number;
			spin: number;
			soldier: EnemyKind;
			ageMs: number;
			durationMs: number;
	  }
	| { kind: 'poof'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'blast'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'ring'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'frost'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'popup'; x: number; y: number; text: string; ageMs: number; durationMs: number }
	| {
			kind: 'tracer';
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			ageMs: number;
			durationMs: number;
	  };

export type { StrikePreview };

export interface SceneExtras {
	/** Where collected helmets fly to, in world units */
	helmetTarget: Point;
	effects: readonly Effect[];
	/** Slot whose range ring is shown, or null */
	selectedSlot: number | null;
	/** Slot hint for the empty slots: draw a "+" when true */
	showEmptySlots: boolean;
	/**
	 * The visible slice of the field, in world units (the tall maps scroll). Weather particles are
	 * only drawn inside it, and sprites outside it are skipped. Default: the whole field.
	 */
	viewTop?: number;
	viewBottom?: number;
	/** Set while the player is aiming a power: draws the bombing band or the missile reticle */
	strikePreview?: StrikePreview | null;
}

const NO_EXTRAS: SceneExtras = {
	helmetTarget: HELMET_TARGET,
	effects: [],
	selectedSlot: null,
	showEmptySlots: false,
	viewTop: undefined,
	viewBottom: undefined,
	strikePreview: null
};

/** Sprites this far outside the visible slice are still drawn (their parts reach out) */
const CULL_MARGIN = 60;

function drawField(ctx: Ctx, map: DroneWallMap, timeMs: number, top: number, bottom: number) {
	const { theme, points } = map;
	ctx.fillStyle = theme.field;
	ctx.fillRect(0, 0, WORLD_WIDTH, map.height);
	// Soft mown stripes, only where they can be seen
	ctx.fillStyle = theme.stripe;
	for (
		let y = Math.max(0, Math.floor((top - 28) / 56) * 56);
		y < Math.min(map.height, bottom);
		y += 56
	) {
		ctx.fillRect(0, y, WORLD_WIDTH, 28);
	}

	// The road: ink edge, then the surface
	ctx.lineJoin = 'round';
	ctx.lineCap = 'butt';
	polyline(ctx, points);
	ctx.lineWidth = 38;
	ctx.strokeStyle = INK;
	ctx.stroke();
	polyline(ctx, points);
	ctx.lineWidth = 32;
	ctx.strokeStyle = theme.road;
	ctx.stroke();
	polyline(ctx, points);
	ctx.lineWidth = 2;
	ctx.setLineDash([10, 12]);
	ctx.strokeStyle = 'rgba(17,17,17,0.18)';
	ctx.stroke();
	ctx.setLineDash([]);

	for (const prop of map.decor) {
		if (prop.y < top - CULL_MARGIN || prop.y > bottom + CULL_MARGIN) continue;
		drawDecor(ctx, prop, theme, timeMs);
	}
}

const DECOR_SHADOW: Partial<Record<DecorKind, number>> = { ruin: 15, wreck: 16, hay: 11, stump: 9 };

/** One scenery prop, standing at its position */
function drawDecor(ctx: Ctx, prop: Decor, theme: MapTheme, timeMs: number) {
	const leaf = theme.leaves[prop.tint % theme.leaves.length];
	ctx.save();
	ctx.translate(prop.x, prop.y);
	ctx.scale(prop.size, prop.size);
	// A shadow under everything
	ctx.beginPath();
	ctx.ellipse(1, 3, DECOR_SHADOW[prop.kind] ?? 12, 4.5, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.18)';
	ctx.fill();
	switch (prop.kind) {
		case 'tree':
			ctx.fillStyle = '#7a5a3a';
			ctx.fillRect(-2.5, -8, 5, 11);
			ctx.lineWidth = 1.8;
			ctx.strokeStyle = INK;
			ctx.strokeRect(-2.5, -8, 5, 11);
			inkEllipse(ctx, 0, -16, 12, 11, leaf, 2);
			inkEllipse(ctx, -4, -19, 4, 3, 'rgba(255,255,255,0.3)', 0.1);
			break;
		case 'pine':
			ctx.fillStyle = '#6b4f36';
			ctx.fillRect(-2, -3, 4, 6);
			for (const [y, half] of [
				[-4, 11],
				[-13, 9],
				[-21, 6.5]
			]) {
				ctx.beginPath();
				ctx.moveTo(-half, y);
				ctx.lineTo(0, y - 12);
				ctx.lineTo(half, y);
				ctx.closePath();
				ctx.fillStyle = leaf;
				ctx.fill();
				ctx.lineWidth = 2;
				ctx.strokeStyle = INK;
				ctx.stroke();
				// Snow on the branches
				ctx.beginPath();
				ctx.moveTo(-half * 0.45, y - 6.5);
				ctx.lineTo(0, y - 12);
				ctx.lineTo(half * 0.45, y - 6.5);
				ctx.closePath();
				ctx.fillStyle = PAPER;
				ctx.fill();
			}
			break;
		case 'rock':
			ctx.beginPath();
			ctx.moveTo(-11, 3);
			ctx.lineTo(-8, -7);
			ctx.lineTo(1, -10);
			ctx.lineTo(10, -4);
			ctx.lineTo(11, 3);
			ctx.closePath();
			ctx.fillStyle = '#9a9a96';
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = INK;
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-6, -4);
			ctx.lineTo(0, -7);
			ctx.lineWidth = 2;
			ctx.strokeStyle = 'rgba(255,255,255,0.6)';
			ctx.stroke();
			break;
		case 'bush':
			inkEllipse(ctx, -6, -3, 7, 6, leaf, 2);
			inkEllipse(ctx, 6, -3, 7, 6, leaf, 2);
			inkEllipse(ctx, 0, -7, 8, 7, leaf, 2);
			break;
		case 'cactus':
			ctx.lineWidth = 2;
			ctx.strokeStyle = INK;
			ctx.fillStyle = leaf;
			for (const rect of [
				[-3.5, -22, 7, 26],
				[-12, -15, 5, 9],
				[7, -12, 5, 9]
			]) {
				ctx.beginPath();
				ctx.roundRect(rect[0], rect[1], rect[2], rect[3], 3);
				ctx.fill();
				ctx.stroke();
			}
			break;
		case 'ruin': {
			// A broken brick wall with a window hole, and rubble at its foot
			inkEllipse(ctx, -9, 1.5, 4.5, 2.6, '#9a9a96', 1.4);
			inkEllipse(ctx, 10, 2, 3.6, 2.2, '#8a8a86', 1.4);
			inkPoly(ctx, [11, 3, 11, -2, 17, -0.5, 17, 3], '#8f4c36', 1.8);
			inkPoly(
				ctx,
				[-12, 3, -12, -10, -8, -14, -5, -9, -1, -16, 3, -10, 6, -13, 11, -7, 11, 3],
				'#a85a40',
				2
			);
			ctx.beginPath();
			ctx.moveTo(-12, -3);
			ctx.lineTo(11, -3);
			ctx.moveTo(-12, -8);
			ctx.lineTo(8, -8);
			for (const x of [-7, -1, 5]) {
				ctx.moveTo(x, -3);
				ctx.lineTo(x, 3);
				ctx.moveTo(x + 3, -8);
				ctx.lineTo(x + 3, -3);
			}
			ctx.lineWidth = 1;
			ctx.strokeStyle = 'rgba(17,17,17,0.38)';
			ctx.stroke();
			inkRect(ctx, -6.5, -8, 6, 7.5, '#2b2b2b', 1.8, 1);
			ctx.beginPath();
			ctx.moveTo(-6.5, -8);
			ctx.lineTo(-3.5, -11);
			ctx.lineTo(-0.5, -8);
			ctx.fillStyle = '#2b2b2b';
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(4, -9.5);
			ctx.lineTo(4, -4.5);
			ctx.lineWidth = 3;
			ctx.strokeStyle = 'rgba(17,17,17,0.22)';
			ctx.stroke();
			break;
		}
		case 'wreck': {
			// A burnt-out tank hull with its turret thrown off, still smouldering
			inkRect(ctx, -14, -1, 28, 6, '#2c2a28', 2, 3);
			for (const x of [-9, -3, 3, 9]) {
				ctx.beginPath();
				ctx.arc(x, 2, 1.6, 0, Math.PI * 2);
				ctx.fillStyle = '#5a5651';
				ctx.fill();
			}
			inkPoly(ctx, [-13, -1, -10, -8, 9, -8, 13, -1], '#4a4642', 2);
			inkEllipse(ctx, 5, -5, 2.6, 1.4, '#8a4a26', 0.1);
			inkEllipse(ctx, -6, -4, 2, 1.1, '#8a4a26', 0.1);
			ctx.save();
			ctx.translate(1, -9);
			ctx.rotate(-0.28);
			inkRect(ctx, 4, -1.8, 14, 3.4, '#34312e', 1.6);
			inkEllipse(ctx, 0, 0, 7.5, 4.2, '#3a3734', 2);
			ctx.restore();
			for (let k = 0; k < 3; k++) {
				const p = (timeMs / 2100 + k / 3 + prop.x * 0.01) % 1;
				ctx.beginPath();
				ctx.arc(2 + Math.sin(p * 5 + k) * 3, -12 - p * 20, 2.4 + p * 4.5, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(70,70,74,${0.4 * (1 - p)})`;
				ctx.fill();
			}
			break;
		}
		case 'hay': {
			// A round hay bale with a spiral of straw
			inkEllipse(ctx, 0, -7, 9.5, 8.5, '#e2c35f', 2);
			ctx.beginPath();
			ctx.arc(0, -7, 6, 0.4, 5.3);
			ctx.moveTo(3.2, -7);
			ctx.arc(0, -7, 3.2, 0, 4.2);
			ctx.lineWidth = 1.2;
			ctx.strokeStyle = 'rgba(150,105,25,0.75)';
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-9, 1);
			ctx.lineTo(-13, -1);
			ctx.moveTo(-8, 2);
			ctx.lineTo(-12, 3);
			ctx.moveTo(9, 1);
			ctx.lineTo(13, -1);
			ctx.lineWidth = 1.6;
			ctx.strokeStyle = '#c9a53f';
			ctx.stroke();
			break;
		}
		case 'stump': {
			// A tree stump with annual rings on top
			ctx.beginPath();
			ctx.moveTo(-6, -7);
			ctx.lineTo(-7.5, 3);
			ctx.quadraticCurveTo(0, 5.5, 7.5, 3);
			ctx.lineTo(6, -7);
			ctx.closePath();
			ctx.fillStyle = '#8a6a45';
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = INK;
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-2.5, -5);
			ctx.lineTo(-3, 2);
			ctx.moveTo(2, -5);
			ctx.lineTo(2.6, 2.4);
			ctx.lineWidth = 1;
			ctx.strokeStyle = 'rgba(17,17,17,0.35)';
			ctx.stroke();
			inkEllipse(ctx, 0, -7, 6, 2.8, '#d1a76e', 2);
			ctx.beginPath();
			ctx.ellipse(0, -7, 3.4, 1.4, 0, 0, Math.PI * 2);
			ctx.moveTo(1.4, -7);
			ctx.ellipse(0, -7, 1.4, 0.6, 0, 0, Math.PI * 2);
			ctx.lineWidth = 0.9;
			ctx.strokeStyle = '#9a7440';
			ctx.stroke();
			break;
		}
	}
	ctx.restore();
}

function drawLine(ctx: Ctx, map: DroneWallMap) {
	// The Ukrainian line: a sandbag wall with the flag colours
	const top = map.lineY + 4;
	const depth = map.height - top;
	const exit = map.points[map.points.length - 1].x;
	ctx.fillStyle = FLAG_BLUE;
	ctx.fillRect(0, top, WORLD_WIDTH, depth / 2);
	ctx.fillStyle = YELLOW;
	ctx.fillRect(0, top + depth / 2, WORLD_WIDTH, depth / 2);
	ctx.lineWidth = 3;
	ctx.strokeStyle = INK;
	ctx.strokeRect(-2, top, WORLD_WIDTH + 4, depth + 2);
	// Sandbags along the top edge, with a gap where the road comes in
	for (let x = 8; x < WORLD_WIDTH; x += 30) {
		if (Math.abs(x - exit) < 24) continue;
		inkEllipse(ctx, x, top, 14, 7, SANDBAG);
	}
}

/** A Soviet steel helmet (olive dome, narrow brim, rivet, red star) about (0, 0), 28 units wide */
function drawSovietHelmet(ctx: Ctx) {
	// The dome
	ctx.beginPath();
	ctx.ellipse(0, 3, 11, 10, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = SOVIET_GREEN;
	ctx.fill();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// The narrow brim
	ctx.beginPath();
	ctx.roundRect(-14, 2, 28, 4.5, 2.2);
	ctx.fillStyle = SOVIET_GREEN_DARK;
	ctx.fill();
	ctx.stroke();
	// The red star on the front, and the top rivet
	starPath(ctx, 0, -2.6, 4.6, 1.9);
	ctx.fillStyle = TIE_RED;
	ctx.fill();
	ctx.lineWidth = 1.2;
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, -8.6, 1.3, 0, Math.PI * 2);
	ctx.fillStyle = SOVIET_GREEN_DARK;
	ctx.fill();
	ctx.stroke();
	// A shine
	ctx.beginPath();
	ctx.arc(-6.2, -0.5, 3.4, Math.PI * 1.05, Math.PI * 1.45);
	ctx.lineWidth = 1.8;
	ctx.strokeStyle = 'rgba(255,255,255,0.8)';
	ctx.stroke();
}

const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

/**
 * A dropped helmet pops up where the soldier fell, then arcs to the helmet counter, trailing
 * sparkles and shrinking a little as it goes in (the game adds it to the pocket when it lands).
 */
function drawHelmetPickup(ctx: Ctx, helmet: Helmet, timeMs: number, target: Point) {
	const size = helmet.value > 1 ? 1.3 : 1;
	let x = helmet.x;
	let y = helmet.y - 6;
	let scale: number;
	let spin = 0;

	if (helmet.ageMs < HELMET_POP_MS) {
		// A little hop with a bounce
		const p = helmet.ageMs / HELMET_POP_MS;
		scale = Math.max(0.05, easeOutBack(p));
		y -= Math.sin(p * Math.PI) * 14;
	} else {
		const q = Math.min(1, (helmet.ageMs - HELMET_POP_MS) / HELMET_FLY_MS);
		const e = smoothstep(q);
		const at = (amount: number) => ({
			x: helmet.x + (target.x - helmet.x) * amount,
			// The arc lifts the helmet up before it drops into the counter
			y: helmet.y - 6 + (target.y - (helmet.y - 6)) * amount - Math.sin(Math.PI * amount) * 36
		});
		// Sparkles trail behind the helmet
		for (let i = 3; i >= 1; i--) {
			const trail = at(Math.max(0, e - i * 0.07));
			ctx.beginPath();
			ctx.arc(trail.x, trail.y + 2, 5 - i, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(245,200,58,${0.55 - i * 0.14})`;
			ctx.fill();
		}
		({ x, y } = at(e));
		scale = 1 - 0.3 * e;
		spin = Math.sin(q * Math.PI) * 0.45;
	}

	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(spin);
	ctx.scale(scale * size, scale * size);
	// A soft glow so the helmet reads against the field
	ctx.beginPath();
	ctx.arc(0, 2, 15 + Math.sin(timeMs / 150) * 1.2, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.4)';
	ctx.fill();
	drawSovietHelmet(ctx);
	ctx.restore();

	if (helmet.value > 1 && helmet.ageMs < HELMET_POP_MS + 120) {
		ctx.font = `700 12px ${DISPLAY_FONT}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineWidth = 3;
		ctx.strokeStyle = INK;
		ctx.fillStyle = PAPER;
		const text = `×${helmet.value}`;
		ctx.strokeText(text, helmet.x, helmet.y + 14);
		ctx.fillText(text, helmet.x, helmet.y + 14);
	}
}

/** An FPV drone (a small quadcopter) or a Patriot missile, pointing the way it flies */
function drawProjectile(ctx: Ctx, p: Projectile, timeMs: number) {
	const dx = Math.cos(p.angle);
	const dy = Math.sin(p.angle);
	// A short trail behind it
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(p.x, p.y);
	ctx.lineTo(
		p.x - dx * (p.kind === 'missile' ? 20 : 12),
		p.y - dy * (p.kind === 'missile' ? 20 : 12)
	);
	ctx.lineWidth = p.kind === 'missile' ? 5 : 3;
	ctx.strokeStyle = p.kind === 'missile' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)';
	ctx.stroke();
	ctx.lineCap = 'butt';

	ctx.save();
	ctx.translate(p.x, p.y);
	if (p.kind === 'missile') {
		ctx.rotate(p.angle);
		// The flame flickers behind the body
		ctx.beginPath();
		ctx.ellipse(-9 - Math.sin(timeMs / 30) * 1.5, 0, 4.5, 2.6, 0, 0, Math.PI * 2);
		ctx.fillStyle = YELLOW;
		ctx.fill();
		ctx.beginPath();
		ctx.roundRect(-8, -2.6, 15, 5.2, 2.2);
		ctx.fillStyle = '#e8e4d0';
		ctx.fill();
		ctx.lineWidth = 1.8;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(7, -2.6);
		ctx.lineTo(11.5, 0);
		ctx.lineTo(7, 2.6);
		ctx.closePath();
		ctx.fillStyle = TIE_RED;
		ctx.fill();
		ctx.stroke();
	} else {
		// Four rotor blurs around a dark body; it tilts into the dive
		ctx.rotate(p.angle * 0.15);
		const spin = Math.sin(timeMs / 24 + p.id) > 0 ? 3.2 : 2.4;
		for (const [rx, ry] of [
			[-5, -4],
			[5, -4],
			[-5, 4],
			[5, 4]
		]) {
			ctx.beginPath();
			ctx.ellipse(rx, ry, spin, 1.6, 0, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,255,255,0.8)';
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = INK;
			ctx.stroke();
		}
		inkEllipse(ctx, 0, 0, 4.2, 3, '#3b4048', 1.5);
		ctx.beginPath();
		ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
		ctx.fillStyle = TIE_RED;
		ctx.fill();
	}
	ctx.restore();
}

function drawPoof(ctx: Ctx, x: number, y: number, size: number, p: number) {
	const grow = 0.5 + 0.5 * Math.min(1, p * 2.4);
	ctx.globalAlpha = 1 - p * p;
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2 + 0.4;
		const d = size * 0.5 * grow * (0.6 + (0.4 * ((i * 7) % 3)) / 2);
		inkEllipse(
			ctx,
			x + Math.cos(a) * d,
			y + Math.sin(a) * d * 0.8,
			size * 0.28 * grow,
			size * 0.28 * grow,
			PAPER,
			1.8
		);
	}
	inkEllipse(ctx, x, y, size * 0.34 * grow, size * 0.34 * grow, SAND, 1.8);
	ctx.globalAlpha = 1;
}

/** An ice-blue diamond crystal pointing along `angle` */
function crystal(ctx: Ctx, x: number, y: number, angle: number, length: number) {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const w = length * 0.38;
	inkPoly(
		ctx,
		[
			x + c * length,
			y + s * length,
			x - s * w,
			y + c * w,
			x - c * length * 0.35,
			y - s * length * 0.35,
			x + s * w,
			y - c * w
		],
		'#c4ecff',
		1.5
	);
	ctx.beginPath();
	ctx.moveTo(x - s * w * 0.3 + c * length * 0.2, y + c * w * 0.3 + s * length * 0.2);
	ctx.lineTo(x + c * length * 0.7, y + s * length * 0.7);
	ctx.lineWidth = 1;
	ctx.strokeStyle = PAPER;
	ctx.stroke();
}

function drawEffect(ctx: Ctx, effect: Effect) {
	const p = progressOf(effect);
	switch (effect.kind) {
		case 'tumble': {
			// Launched into the air, spinning, then gone: no blood, just a goofy tumble
			const seconds = effect.ageMs / 1000;
			const x = effect.x + effect.vx * seconds;
			const y = effect.y + effect.vy * seconds + 260 * seconds * seconds;
			ctx.save();
			ctx.globalAlpha = 1 - p * p;
			ctx.translate(x, y);
			ctx.rotate(effect.spin * seconds);
			if (isFlyerKind(effect.soldier)) drawFlyerBody(ctx, effect.soldier, effect.ageMs, false);
			else drawBlob(ctx, effect.soldier, effect.ageMs, 0, false, false);
			ctx.restore();
			break;
		}
		case 'poof':
			drawPoof(ctx, effect.x, effect.y, effect.size, p);
			break;
		case 'blast': {
			const grow = Math.min(1, p * 2.2);
			ctx.globalAlpha = 1 - p;
			inkEllipse(ctx, effect.x, effect.y, effect.size * grow, effect.size * grow * 0.85, YELLOW, 3);
			inkEllipse(
				ctx,
				effect.x,
				effect.y,
				effect.size * grow * 0.6,
				effect.size * grow * 0.5,
				PAPER,
				2
			);
			ctx.globalAlpha = 1;
			if (p > 0.15) drawPoof(ctx, effect.x, effect.y, effect.size * 1.1, (p - 0.15) / 0.85);
			break;
		}
		case 'ring': {
			// A shock wave: a white ring with an ink edge that expands and thins out
			const radius = effect.size * easeOut(p);
			ctx.globalAlpha = 1 - p * p;
			ctx.beginPath();
			ctx.ellipse(effect.x, effect.y, radius, radius * 0.85, 0, 0, Math.PI * 2);
			ctx.lineWidth = 6 * (1 - p) + 2.4;
			ctx.strokeStyle = INK;
			ctx.stroke();
			ctx.lineWidth = 3.6 * (1 - p) + 1;
			ctx.strokeStyle = PAPER;
			ctx.stroke();
			ctx.globalAlpha = 1;
			break;
		}
		case 'frost': {
			// Ice crystals burst out where a soldier froze, and a sparkle flashes in the middle
			const out = effect.size * 0.62 * easeOut(p);
			ctx.globalAlpha = 1 - p * p;
			for (let i = 0; i < 7; i++) {
				const a = (i / 7) * Math.PI * 2 + 0.35;
				const d = out * (0.65 + (0.35 * ((i * 5) % 3)) / 2);
				crystal(
					ctx,
					effect.x + Math.cos(a) * d,
					effect.y + Math.sin(a) * d * 0.85,
					a,
					effect.size * 0.2 * (1 - p * 0.5)
				);
			}
			const spark = effect.size * 0.34 * (1 - p);
			ctx.beginPath();
			ctx.moveTo(effect.x - spark, effect.y);
			ctx.lineTo(effect.x + spark, effect.y);
			ctx.moveTo(effect.x, effect.y - spark);
			ctx.lineTo(effect.x, effect.y + spark);
			ctx.lineWidth = 2.2;
			ctx.lineCap = 'round';
			ctx.strokeStyle = '#e8f8ff';
			ctx.stroke();
			ctx.lineCap = 'butt';
			ctx.globalAlpha = 1;
			break;
		}
		case 'popup': {
			ctx.globalAlpha = 1 - p * p;
			ctx.font = `700 15px ${DISPLAY_FONT}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 4;
			ctx.strokeStyle = INK;
			ctx.fillStyle = YELLOW;
			const y = effect.y - 12 - p * 22;
			ctx.strokeText(effect.text, effect.x, y);
			ctx.fillText(effect.text, effect.x, y);
			ctx.globalAlpha = 1;
			break;
		}
		case 'tracer':
			ctx.globalAlpha = 1 - p;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(effect.x1, effect.y1);
			ctx.lineTo(effect.x2, effect.y2);
			ctx.lineWidth = 2.5;
			ctx.strokeStyle = YELLOW;
			ctx.stroke();
			ctx.lineCap = 'butt';
			ctx.globalAlpha = 1;
			break;
	}
}

function renderScene(
	ctx: CanvasRenderingContext2D,
	state: DroneWallState,
	extras: SceneExtras,
	withWeather: boolean
) {
	const { map, timeMs } = state;
	const top = extras.viewTop ?? 0;
	const bottom = extras.viewBottom ?? map.height;
	const seen = (y: number) => y >= top - CULL_MARGIN && y <= bottom + CULL_MARGIN;

	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, WORLD_WIDTH, map.height);
	ctx.clip();
	drawField(ctx, map, timeMs, top, bottom);
	drawLine(ctx, map);
	const intensity = withWeather ? weatherIntensity(state.weather, state.weatherMs) : 0;
	drawWeatherGround(ctx, map, state.weather, intensity, top, bottom);

	if (extras.selectedSlot !== null) {
		drawRangeRing(ctx, map.slots, extras.selectedSlot, state.defenses[extras.selectedSlot] ?? null);
	}
	// Trenches lie flat on the ground, below the crowd
	state.defenses.forEach((defense, slot) => {
		if (!seen(map.slots[slot].y)) return;
		drawSlot(
			ctx,
			map.slots,
			slot,
			slot === extras.selectedSlot,
			extras.showEmptySlots,
			defense !== null
		);
		if (defense?.kind === 'trench') drawDefense(ctx, map.slots, slot, defense, timeMs);
	});

	// The rallying rings of officers go below the whole crowd
	for (const soldier of state.soldiers) {
		if (soldier.kind === 'officer' && seen(soldier.y)) drawOfficerAura(ctx, soldier, timeMs);
	}
	const standing = state.soldiers.filter((soldier) => seen(soldier.y)).sort((a, b) => a.y - b.y);
	for (const soldier of standing) drawSoldier(ctx, soldier, timeMs, map.road);

	state.defenses.forEach((defense, slot) => {
		if (defense && defense.kind !== 'trench' && seen(map.slots[slot].y)) {
			drawDefense(ctx, map.slots, slot, defense, timeMs);
		}
	});
	// Defender units walk about their posts, in front of them
	const units = state.units.filter((unit) => seen(unit.y)).sort((a, b) => a.y - b.y);
	for (const unit of units) {
		drawUnit(ctx, unit, timeMs, state.defenses[unit.slot]?.level ?? 1);
	}
	for (const shell of state.shells) drawShell(ctx, shell, timeMs);
	// Aircraft fly above everything on the ground, and the projectiles above them
	for (const flyer of state.flyers) {
		if (seen(flyer.y)) drawFlyer(ctx, flyer, timeMs);
	}
	for (const run of state.runs) drawAirRun(ctx, run, timeMs, top, bottom);
	for (const projectile of state.projectiles) drawProjectile(ctx, projectile, timeMs);
	for (const effect of extras.effects) drawEffect(ctx, effect);
	for (const helmet of state.helmets) drawHelmetPickup(ctx, helmet, timeMs, extras.helmetTarget);
	// The weather goes over everything, and the aiming aid of a power over the weather
	if (withWeather) drawWeatherSky(ctx, state.weather, intensity, timeMs, top, bottom);
	if (extras.strikePreview) drawStrikePreview(ctx, extras.strikePreview, timeMs, top, bottom);
	ctx.restore();
}

export function drawScene(
	ctx: CanvasRenderingContext2D,
	state: DroneWallState,
	extras: SceneExtras = NO_EXTRAS
) {
	renderScene(ctx, state, extras, true);
}

/** Draws the final field onto the shared score card: the bottom screen of the field, line included */
export function drawScenePreview(
	ctx: CanvasRenderingContext2D,
	state: DroneWallState,
	x: number,
	y: number,
	size: number
) {
	const scale = size / WORLD_HEIGHT;
	// A tall map shows its last screen, the one with the line the soldiers broke through (or not)
	const offset = Math.max(0, state.map.height - WORLD_HEIGHT);
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, size, size);
	ctx.clip();
	ctx.fillStyle = SAND;
	ctx.fillRect(x, y, size, size);
	ctx.translate(x + (size - WORLD_WIDTH * scale) / 2, y);
	ctx.scale(scale, scale);
	ctx.translate(0, -offset);
	renderScene(
		ctx,
		state,
		{ ...NO_EXTRAS, showEmptySlots: false, viewTop: offset, viewBottom: offset + WORLD_HEIGHT },
		false
	);
	ctx.restore();
}

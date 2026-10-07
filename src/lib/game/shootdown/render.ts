/*
 * Canvas drawing for Shahed Shootdown. Everything is drawn in world units (see shootdownStep.ts)
 * and scaled by the caller. Until owner-supplied sprites exist, drones, missiles, the blimp,
 * clouds and bunkers are generic original shapes: flat fills, thick ink outlines on machines,
 * and outline-free clouds and sky (requirements Section 6, visual treatment).
 */
import { explosionFrames, loadImage, spriteSrc } from '#lib/theme/sprites.js';
import { createRandom } from '#lib/game/random.js';
import { CANVAS_ASSETS, shootdownAsset, type ShootdownAssetId } from './assets';
import {
	BLIMP_HEIGHT,
	BLIMP_TOP,
	BLIMP_WIDTH,
	BOSS_HEIGHT,
	BOSS_WIDTH,
	BUNKER_COLUMNS,
	DRONE_HEIGHT,
	DRONE_WIDTH,
	GROUND_Y,
	LAUNCHER_HEIGHT,
	LAUNCHER_TOP,
	MISSILE_HEIGHT,
	MISSILE_WIDTH,
	SANDBAG_HEIGHT,
	SANDBAG_HIT_POINTS,
	SANDBAG_WIDTH,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	droneRect,
	type ShootdownState
} from './shootdownStep';

// Design tokens (src/lib/styles/tokens.css); a canvas cannot read Tailwind utilities
const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const KHAKI = '#7c8c5c';
const TIE_RED = '#e5484d';
const SKIN = '#f6c9a0';
const SKY = '#aeb4be';
const MUSTARD = '#ddb93c';
const EXPLOSION_YELLOW = '#f5c83a';
const DRONE_GREY = '#3b4048';
const BOSS_GREY = '#2c3036';
const SANDBAG = '#cdbb7e';
const FLAME = '#f0772f';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export interface Cloud {
	x: number;
	y: number;
	scale: number;
	/** Relative drift speed, so clouds at different heights drift at different rates */
	drift: number;
}

export type Effect =
	| { kind: 'explosion'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'popup'; x: number; y: number; text: string; ageMs: number; durationMs: number }
	| { kind: 'dust'; x: number; y: number; ageMs: number; durationMs: number };

export interface SceneSprites {
	launcher: HTMLImageElement | null;
	explosions: HTMLImageElement[];
	supplied: Partial<Record<ShootdownAssetId, HTMLImageElement>>;
}

export interface SceneExtras {
	clouds: readonly Cloud[];
	effects: readonly Effect[];
	/** Running time in milliseconds, for blinking warnings */
	timeMs: number;
	shakeX?: number;
	shakeY?: number;
}

let sprites: SceneSprites = { launcher: null, explosions: [], supplied: {} };
let loading: Promise<SceneSprites> | undefined;

/** Loads the launcher, explosion frames and any supplied sprites once, then reuses them */
export function loadSceneSprites(): Promise<SceneSprites> {
	loading ??= (async () => {
		const [launcher, explosions, supplied] = await Promise.all([
			loadImage(spriteSrc('patriotLauncher')),
			Promise.all(explosionFrames().map(loadImage)),
			Promise.all(
				CANVAS_ASSETS.map(async (id) => {
					const src = shootdownAsset(id);
					return [id, src ? await loadImage(src) : null] as const;
				})
			)
		]);
		sprites = {
			launcher,
			explosions: explosions.filter((image): image is HTMLImageElement => image !== null),
			supplied: Object.fromEntries(supplied.filter(([, image]) => image !== null))
		};
		return sprites;
	})();
	return loading;
}

export function sceneSprites(): SceneSprites {
	return sprites;
}

/** A few flat clouds spread over the sky, the same every game */
export function createClouds(): Cloud[] {
	const random = createRandom(7);
	return Array.from({ length: 5 }, (_, index) => ({
		x: random() * WORLD_WIDTH,
		y: 40 + index * 80 + random() * 30,
		scale: 0.7 + random() * 0.6,
		drift: 0.6 + random() * 0.8
	}));
}

/** Moves clouds sideways, wrapping around the playfield */
export function driftClouds(clouds: Cloud[], dtMs: number, speed: number) {
	for (const cloud of clouds) {
		cloud.x += (cloud.drift * speed * dtMs) / 1000;
		if (cloud.x > WORLD_WIDTH + 60) cloud.x = -60;
	}
}

function drawCloud(context: CanvasRenderingContext2D, cloud: Cloud) {
	const image = sprites.supplied.cloud;
	if (image) {
		const width = 80 * cloud.scale;
		context.drawImage(image, cloud.x - width / 2, cloud.y - width / 4, width, width / 2);
		return;
	}
	context.fillStyle = PAPER;
	context.beginPath();
	const s = cloud.scale;
	for (const [dx, dy, r] of [
		[-22, 4, 12],
		[-6, -4, 17],
		[14, 0, 14],
		[28, 6, 9]
	]) {
		context.moveTo(cloud.x + (dx + r) * s, cloud.y + dy * s);
		context.arc(cloud.x + dx * s, cloud.y + dy * s, r * s, 0, Math.PI * 2);
	}
	context.rect(cloud.x - 22 * s, cloud.y + 2 * s, 50 * s, 13 * s);
	context.fill();
}

/** A dark triangular dart pointing along its flight direction (downwards by default) */
function drawDart(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	options: { angle?: number; fill?: string; outline?: string; mega?: boolean } = {}
) {
	const image = sprites.supplied[options.mega ? 'shahedMega' : 'shahed'];
	context.save();
	context.translate(x, y);
	context.rotate(options.angle ?? 0);
	if (image) {
		context.drawImage(image, -width / 2, -height / 2, width, height);
		context.restore();
		return;
	}
	context.lineJoin = 'round';
	context.lineWidth = options.mega ? 3.5 : 2.5;
	context.strokeStyle = options.outline ?? INK;
	context.fillStyle = options.fill ?? DRONE_GREY;
	context.beginPath();
	context.moveTo(0, height / 2);
	context.lineTo(width / 2, -height / 2);
	context.lineTo(0, -height / 2 + height * 0.3);
	context.lineTo(-width / 2, -height / 2);
	context.closePath();
	context.fill();
	context.stroke();
	// Small tail fins at the wing tips and a propeller hub at the back
	context.beginPath();
	context.moveTo(width / 2 - 1, -height / 2);
	context.lineTo(width / 2 - 1, -height / 2 - height * 0.18);
	context.moveTo(-width / 2 + 1, -height / 2);
	context.lineTo(-width / 2 + 1, -height / 2 - height * 0.18);
	context.stroke();
	context.fillStyle = SKY;
	context.beginPath();
	context.ellipse(0, -height / 2 + height * 0.26, width * 0.12, height * 0.08, 0, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	context.restore();
}

function drawWarningMarker(context: CanvasRenderingContext2D, x: number, blinkOn: boolean) {
	const y = LAUNCHER_TOP - 26;
	context.save();
	context.lineJoin = 'round';
	context.lineWidth = 2.5;
	context.strokeStyle = INK;
	context.fillStyle = blinkOn ? TIE_RED : EXPLOSION_YELLOW;
	context.beginPath();
	context.moveTo(x, y - 10);
	context.lineTo(x + 11, y + 9);
	context.lineTo(x - 11, y + 9);
	context.closePath();
	context.fill();
	context.stroke();
	context.fillStyle = INK;
	context.fillRect(x - 1.3, y - 4, 2.6, 7);
	context.fillRect(x - 1.3, y + 4.5, 2.6, 2.6);
	// Dashed guide line down to the ground
	context.setLineDash([4, 4]);
	context.lineWidth = 2;
	context.beginPath();
	context.moveTo(x, y + 12);
	context.lineTo(x, GROUND_Y);
	context.stroke();
	context.restore();
}

function drawBlimp(context: CanvasRenderingContext2D, x: number, direction: number) {
	const image = sprites.supplied.blimp;
	if (image) {
		context.drawImage(image, x, BLIMP_TOP, BLIMP_WIDTH, BLIMP_HEIGHT);
		return;
	}
	const cx = x + BLIMP_WIDTH / 2;
	const cy = BLIMP_TOP + BLIMP_HEIGHT / 2 - 2;
	const back = -direction;
	context.save();
	context.lineJoin = 'round';
	context.lineWidth = 2.5;
	context.strokeStyle = INK;
	// Tail fins
	context.fillStyle = TIE_RED;
	context.beginPath();
	context.moveTo(cx + back * 20, cy);
	context.lineTo(cx + back * 32, cy - 12);
	context.lineTo(cx + back * 30, cy);
	context.lineTo(cx + back * 32, cy + 12);
	context.closePath();
	context.fill();
	context.stroke();
	// Envelope
	context.fillStyle = SKIN;
	context.beginPath();
	context.ellipse(cx, cy, BLIMP_WIDTH / 2 - 4, BLIMP_HEIGHT / 2 - 3, 0, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	// Gondola
	context.fillStyle = KHAKI;
	context.fillRect(cx - 8, cy + 8, 16, 7);
	context.strokeRect(cx - 8, cy + 8, 16, 7);
	context.restore();
}

function drawBunkers(context: CanvasRenderingContext2D, state: ShootdownState) {
	context.save();
	context.lineWidth = 1.5;
	context.strokeStyle = INK;
	for (const bunker of state.bunkers) {
		bunker.sandbags.forEach((hitPoints, index) => {
			if (hitPoints <= 0) return;
			const x = bunker.x + (index % BUNKER_COLUMNS) * SANDBAG_WIDTH;
			const y = bunker.y + Math.floor(index / BUNKER_COLUMNS) * SANDBAG_HEIGHT;
			// Damaged sandbags turn paler, so damage does not rely on color alone: they also shrink
			const damaged = hitPoints < SANDBAG_HIT_POINTS;
			const inset = damaged ? 1 : 0;
			context.fillStyle = damaged ? SAND : SANDBAG;
			context.beginPath();
			context.roundRect(
				x + inset,
				y + inset,
				SANDBAG_WIDTH - inset * 2,
				SANDBAG_HEIGHT - inset * 2,
				2.5
			);
			context.fill();
			context.stroke();
		});
	}
	context.restore();
}

function drawMissile(context: CanvasRenderingContext2D, x: number, y: number, timeMs: number) {
	const tail = y + MISSILE_HEIGHT;
	context.save();
	// Soft grey trail
	for (let i = 0; i < 6; i++) {
		context.globalAlpha = 0.45 - i * 0.07;
		context.fillStyle = '#e4e6ea';
		context.beginPath();
		context.arc(x, tail + 8 + i * 9, 3 + i * 0.9, 0, Math.PI * 2);
		context.fill();
	}
	context.globalAlpha = 1;
	const image = sprites.supplied.missile;
	if (image) {
		context.drawImage(image, x - MISSILE_WIDTH, y, MISSILE_WIDTH * 2, MISSILE_HEIGHT);
		context.restore();
		return;
	}
	// Small orange-red flame that flickers
	const flicker = 5 + Math.sin(timeMs / 30) * 1.5;
	context.fillStyle = FLAME;
	context.beginPath();
	context.moveTo(x - 3, tail);
	context.lineTo(x, tail + flicker + 3);
	context.lineTo(x + 3, tail);
	context.closePath();
	context.fill();
	// Dark body with a pointed nose
	context.lineJoin = 'round';
	context.lineWidth = 1.5;
	context.strokeStyle = INK;
	context.fillStyle = DRONE_GREY;
	context.beginPath();
	context.moveTo(x, y - 3);
	context.lineTo(x + MISSILE_WIDTH / 2, y + 3);
	context.lineTo(x + MISSILE_WIDTH / 2, tail);
	context.lineTo(x - MISSILE_WIDTH / 2, tail);
	context.lineTo(x - MISSILE_WIDTH / 2, y + 3);
	context.closePath();
	context.fill();
	context.stroke();
	context.restore();
}

function drawLauncher(context: CanvasRenderingContext2D, x: number, visible: boolean) {
	if (!visible) return;
	const width = 70;
	const height = (width * 104) / 170;
	const bottom = LAUNCHER_TOP + LAUNCHER_HEIGHT + 4;
	if (sprites.launcher) {
		context.drawImage(sprites.launcher, x - width / 2, bottom - height, width, height);
		return;
	}
	context.save();
	context.lineWidth = 2.5;
	context.strokeStyle = INK;
	context.fillStyle = KHAKI;
	context.fillRect(x - width / 2, bottom - height / 2, width, height / 2 - 6);
	context.strokeRect(x - width / 2, bottom - height / 2, width, height / 2 - 6);
	context.restore();
}

/** Flat starburst with arrow-shaped rays, used when no explosion frame could be loaded */
function drawStarburst(context: CanvasRenderingContext2D, size: number) {
	const rays = 12;
	for (const [scale, fill] of [
		[1, TIE_RED],
		[0.62, EXPLOSION_YELLOW]
	] as const) {
		context.beginPath();
		for (let i = 0; i < rays * 2; i++) {
			const radius = ((i % 2 === 0 ? 1 : 0.5) * size * scale) / 2;
			const angle = (i / (rays * 2)) * Math.PI * 2;
			context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
		}
		context.closePath();
		context.fillStyle = fill;
		context.fill();
		context.lineWidth = 2;
		context.strokeStyle = INK;
		context.stroke();
	}
}

function drawEffect(context: CanvasRenderingContext2D, effect: Effect) {
	const progress = Math.min(1, effect.ageMs / effect.durationMs);
	context.save();
	if (effect.kind === 'explosion') {
		// Scale up quickly, then fade
		const scale = 0.35 + 0.65 * Math.min(1, progress / 0.4);
		context.globalAlpha = progress < 0.5 ? 1 : 1 - (progress - 0.5) / 0.5;
		context.translate(effect.x, effect.y);
		const frames = sprites.explosions;
		const size = effect.size * scale;
		if (frames.length > 0) {
			const frame = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
			context.drawImage(frame, -size / 2, -size / 2, size, size);
		} else {
			drawStarburst(context, size);
		}
	} else if (effect.kind === 'popup') {
		context.globalAlpha = 1 - progress * progress;
		context.font = `bold 15px ${DISPLAY_FONT}`;
		context.textAlign = 'center';
		context.lineWidth = 4;
		context.lineJoin = 'round';
		context.strokeStyle = PAPER;
		const y = effect.y - 22 * progress;
		context.strokeText(effect.text, effect.x, y);
		context.fillStyle = INK;
		context.fillText(effect.text, effect.x, y);
	} else {
		context.globalAlpha = 1 - progress;
		context.fillStyle = SAND;
		context.strokeStyle = INK;
		context.lineWidth = 1.5;
		for (const dx of [-5, 0, 5]) {
			context.beginPath();
			context.arc(effect.x + dx * (1 + progress), effect.y - 4 * progress, 3 + progress * 2, 0, 7);
			context.fill();
			context.stroke();
		}
	}
	context.restore();
}

/** Draws the whole playfield in world units */
export function drawScene(
	context: CanvasRenderingContext2D,
	state: ShootdownState,
	extras: SceneExtras
) {
	const blinkOn = Math.floor(extras.timeMs / 120) % 2 === 0;
	context.save();
	context.fillStyle = SKY;
	context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	for (const cloud of extras.clouds) drawCloud(context, cloud);
	context.translate(extras.shakeX ?? 0, extras.shakeY ?? 0);

	// Ground band with a thick ink horizon line
	context.fillStyle = MUSTARD;
	context.fillRect(-20, GROUND_Y, WORLD_WIDTH + 40, WORLD_HEIGHT - GROUND_Y + 20);
	context.fillStyle = INK;
	context.fillRect(-20, GROUND_Y - 1.5, WORLD_WIDTH + 40, 3);

	if (state.blimp) drawBlimp(context, state.blimp.x, state.blimp.direction);
	drawBunkers(context, state);

	const { formation } = state;
	for (const drone of formation.drones) {
		if (!drone.alive) continue;
		const rect = droneRect(formation, drone);
		const warning = drone.warningMs > 0;
		drawDart(
			context,
			rect.left + DRONE_WIDTH / 2,
			rect.top + DRONE_HEIGHT / 2,
			DRONE_WIDTH,
			DRONE_HEIGHT,
			{ fill: warning && blinkOn ? TIE_RED : DRONE_GREY }
		);
		if (warning) drawWarningMarker(context, drone.targetX, blinkOn);
	}

	for (const diver of state.divers) {
		const angle = Math.atan2(diver.vy, diver.vx) - Math.PI / 2;
		drawDart(context, diver.x, diver.y, DRONE_WIDTH, DRONE_HEIGHT, { angle });
	}

	if (state.boss) {
		const { boss } = state;
		const cx = boss.x + BOSS_WIDTH / 2;
		drawDart(context, cx, boss.y + BOSS_HEIGHT / 2, BOSS_WIDTH, BOSS_HEIGHT, {
			fill: BOSS_GREY,
			mega: true
		});
		// Hit point pips above the Mega-Shahed: filled for remaining, hollow for lost
		const pip = 6;
		const gap = 2;
		const total = boss.maxHitPoints * (pip + gap) - gap;
		context.save();
		context.lineWidth = 1.5;
		context.strokeStyle = INK;
		for (let i = 0; i < boss.maxHitPoints; i++) {
			context.fillStyle = i < boss.hitPoints ? TIE_RED : PAPER;
			const x = cx - total / 2 + i * (pip + gap);
			context.fillRect(x, boss.y - 12, pip, pip);
			context.strokeRect(x, boss.y - 12, pip, pip);
		}
		context.restore();
	}

	for (const missile of state.missiles) drawMissile(context, missile.x, missile.y, extras.timeMs);

	const blinking = state.invulnerableMs > 0 && state.phase !== 'over';
	drawLauncher(context, state.launcherX, !blinking || blinkOn);

	for (const effect of extras.effects) drawEffect(context, effect);
	context.restore();
}

/** Draws the scene letterboxed into a square, for the shared score card */
export function drawScenePreview(
	context: CanvasRenderingContext2D,
	state: ShootdownState,
	extras: SceneExtras,
	x: number,
	y: number,
	size: number
) {
	const scale = size / WORLD_HEIGHT;
	context.save();
	context.beginPath();
	context.rect(x, y, size, size);
	context.clip();
	context.fillStyle = SAND;
	context.fillRect(x, y, size, size);
	context.translate(x + (size - WORLD_WIDTH * scale) / 2, y);
	context.scale(scale, scale);
	drawScene(context, state, { ...extras, shakeX: 0, shakeY: 0 });
	context.restore();
}

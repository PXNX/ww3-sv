/*
 * Canvas drawing for Convoy Runner, shared by the live playfield and the share card. Flat fills,
 * thick ink outlines, no gradients (requirements Section 15). Gunboats, drones, slicks and barrels
 * are generic original shapes; the tanker, mine and submarine use the shared sprites.
 */
import { explosionFrames, loadImage, spriteSrc } from '$lib/theme/sprites';
import {
	DRONE_WARNING_AHEAD,
	FIELD_HEIGHT,
	FIELD_WIDTH,
	ITEM_SIZE,
	LANE_COUNT,
	SIDE_MARGIN,
	TANKER_OFFSET,
	VIEW_AHEAD
} from './constants';
import { droneArrival, type Obstacle, type RunnerState } from './runnerStep';

const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const KHAKI = '#7c8c5c';
const WATER = '#4fa8d8';
const WAVE = '#8fcbeb';
const LANE_LINE = '#3a8fc0';
const TIE_RED = '#e5484d';
const SKY = '#aeb4be';
const MUSTARD = '#ddb93c';
const EXPLOSION_YELLOW = '#f5c83a';
const OIL = '#2b2f36';
const SLATE = '#6a7c9b';

export interface ConvoySprites {
	tanker: HTMLImageElement | null;
	submarine: HTMLImageElement | null;
	mine: HTMLImageElement | null;
	explosion: HTMLImageElement | null;
}

let sprites: ConvoySprites = { tanker: null, submarine: null, mine: null, explosion: null };
let loading: Promise<ConvoySprites> | undefined;

/** Loads the sprites once; drawing works with shape fallbacks until they arrive */
export function loadConvoySprites(): Promise<ConvoySprites> {
	loading ??= Promise.all([
		loadImage(spriteSrc('tankerTop')),
		loadImage(spriteSrc('submarine')),
		loadImage(spriteSrc('mine')),
		loadImage(explosionFrames()[0])
	]).then(([tanker, submarine, mine, explosion]) => {
		sprites = { tanker, submarine, mine, explosion };
		return sprites;
	});
	return loading;
}

/** A short-lived visual effect, positioned in world units */
export interface ConvoyEffect {
	kind: 'explosion' | 'shield' | 'sparkle' | 'splash';
	x: number;
	y: number;
	ageMs: number;
	durationMs: number;
}

export interface SceneOptions {
	/** Size of the drawing area in canvas units (CSS pixels on the live canvas) */
	width: number;
	height: number;
	/** Extra scroll since the last logic step, for smooth motion between steps */
	scrollAhead?: number;
	effects?: readonly ConvoyEffect[];
	shakeMs?: number;
	reducedMotion?: boolean;
	/** Wall-clock time for idle animation such as blinking markers */
	timeMs?: number;
}

/** Draws the whole field for a runner state into the rectangle (0, 0, width, height) */
export function drawScene(
	context: CanvasRenderingContext2D,
	runner: RunnerState,
	{
		width,
		height,
		scrollAhead = 0,
		effects = [],
		shakeMs = 0,
		reducedMotion = false,
		timeMs = 0
	}: SceneOptions
) {
	const unit = Math.min(width / FIELD_WIDTH, height / FIELD_HEIGHT);
	const distance = runner.distance + scrollAhead;
	const line = Math.max(2, unit * 0.045);
	const toX = (lane: number) => (SIDE_MARGIN + 0.5 + lane) * unit;
	const toY = (y: number) => height - (TANKER_OFFSET + y - distance) * unit;

	context.save();
	context.lineJoin = 'round';
	context.lineCap = 'round';

	if (shakeMs > 0 && !reducedMotion) {
		const strength = (shakeMs / 280) * unit * 0.08;
		context.translate(Math.sin(timeMs * 0.09) * strength, Math.cos(timeMs * 0.11) * strength);
	}

	drawWater(context, unit, width, height, distance, line);

	// Obstacles, far ones first so nearer ones overlap them
	const visible = runner.obstacles
		.filter((obstacle) => obstacle.y - distance < VIEW_AHEAD + DRONE_WARNING_AHEAD + 1)
		.sort((a, b) => b.y - a.y);
	for (const obstacle of visible) {
		const ahead = obstacle.y - distance;
		drawObstacle(context, obstacle, toX(obstacle.x), toY(obstacle.y), ahead, unit, line, {
			timeMs,
			reducedMotion,
			topY: line * 2
		});
	}

	drawTanker(context, runner, toX(runner.x), toY(runner.distance), unit, line, reducedMotion);

	for (const effect of effects) {
		drawEffect(context, effect, toX(effect.x), toY(effect.y), unit, line);
	}

	context.restore();
}

function drawWater(
	context: CanvasRenderingContext2D,
	unit: number,
	width: number,
	height: number,
	distance: number,
	line: number
) {
	context.fillStyle = WATER;
	context.fillRect(0, 0, width, height);

	// Flat wave marks scrolling with the water
	const spacing = 0.6;
	context.strokeStyle = WAVE;
	context.lineWidth = line;
	const first = Math.floor((distance - TANKER_OFFSET) / spacing) - 1;
	const last = Math.ceil((distance + VIEW_AHEAD) / spacing) + 1;
	for (let row = first; row <= last; row++) {
		const y = height - (TANKER_OFFSET + row * spacing - distance) * unit;
		const shift = (row % 2 === 0 ? 0.35 : 0.85) * unit;
		for (let x = SIDE_MARGIN * unit + shift; x < width - SIDE_MARGIN * unit; x += 1.1 * unit) {
			context.beginPath();
			context.arc(x, y, unit * 0.12, Math.PI * 0.15, Math.PI * 0.85);
			context.stroke();
		}
	}

	// Dashed lane dividers
	context.strokeStyle = LANE_LINE;
	context.lineWidth = line * 1.2;
	context.setLineDash([unit * 0.35, unit * 0.35]);
	context.lineDashOffset = -((distance * unit) % (unit * 0.7));
	for (let lane = 1; lane < LANE_COUNT; lane++) {
		const x = (SIDE_MARGIN + lane) * unit;
		context.beginPath();
		context.moveTo(x, 0);
		context.lineTo(x, height);
		context.stroke();
	}
	context.setLineDash([]);

	// Sandy banks on both sides
	const bank = SIDE_MARGIN * unit;
	context.fillStyle = SAND;
	context.fillRect(0, 0, bank, height);
	context.fillRect(width - bank, 0, bank, height);
	context.strokeStyle = INK;
	context.lineWidth = line * 1.5;
	context.beginPath();
	context.moveTo(bank, 0);
	context.lineTo(bank, height);
	context.moveTo(width - bank, 0);
	context.lineTo(width - bank, height);
	context.stroke();
}

function outlined(context: CanvasRenderingContext2D, fill: string, line: number) {
	context.fillStyle = fill;
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = line;
	context.stroke();
}

/** Draws an image centered at (x, y), optionally rotated, keeping its aspect ratio */
function drawSprite(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	rotation = 0
) {
	const height = width * (image.naturalHeight / image.naturalWidth || 1);
	context.save();
	context.translate(x, y);
	context.rotate(rotation);
	context.drawImage(image, -width / 2, -height / 2, width, height);
	context.restore();
}

function drawObstacle(
	context: CanvasRenderingContext2D,
	obstacle: Obstacle,
	x: number,
	y: number,
	ahead: number,
	unit: number,
	line: number,
	{ timeMs, reducedMotion, topY }: { timeMs: number; reducedMotion: boolean; topY: number }
) {
	const size = ITEM_SIZE[obstacle.kind];
	switch (obstacle.kind) {
		case 'mine': {
			const bob = reducedMotion ? 0 : Math.sin(timeMs / 400 + obstacle.id) * 0.12;
			if (sprites.mine) drawSprite(context, sprites.mine, x, y, size.halfWidth * 2.2 * unit, bob);
			else {
				context.beginPath();
				context.arc(x, y, size.halfWidth * unit, 0, Math.PI * 2);
				outlined(context, TIE_RED, line);
			}
			break;
		}
		case 'gunboat':
			drawGunboat(context, x, y, unit, line);
			break;
		case 'drone':
			drawDrone(context, x, y, ahead, unit, line, { timeMs, reducedMotion, topY });
			break;
		case 'slick':
			drawSlick(context, obstacle.id, x, y, unit, line);
			break;
		case 'barrel':
			drawBarrel(context, x, y, unit, line);
			break;
		case 'escort': {
			const pulse = reducedMotion ? 1 : 1 + Math.sin(timeMs / 180) * 0.08;
			context.beginPath();
			context.arc(x, y, size.halfWidth * 1.35 * unit * pulse, 0, Math.PI * 2);
			context.fillStyle = MUSTARD;
			context.fill();
			context.strokeStyle = INK;
			context.lineWidth = line;
			context.setLineDash([unit * 0.1, unit * 0.08]);
			context.stroke();
			context.setLineDash([]);
			if (sprites.submarine)
				drawSprite(context, sprites.submarine, x, y, unit * 0.62, -Math.PI / 2);
			break;
		}
	}
}

/** The mascot's gunboat: a small khaki boat heading down the strait, bow towards the tanker */
function drawGunboat(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	unit: number,
	line: number
) {
	const w = ITEM_SIZE.gunboat.halfWidth * unit;
	const h = ITEM_SIZE.gunboat.halfLength * unit;
	context.beginPath();
	context.moveTo(x - w, y - h);
	context.lineTo(x + w, y - h);
	context.lineTo(x + w, y + h * 0.35);
	context.quadraticCurveTo(x + w * 0.8, y + h * 0.85, x, y + h * 1.1);
	context.quadraticCurveTo(x - w * 0.8, y + h * 0.85, x - w, y + h * 0.35);
	context.closePath();
	outlined(context, KHAKI, line);

	// Cabin and a little deck cannon
	context.beginPath();
	context.rect(x - w * 0.55, y - h * 0.75, w * 1.1, h * 0.6);
	outlined(context, PAPER, line * 0.8);
	context.beginPath();
	context.arc(x, y + h * 0.3, w * 0.35, 0, Math.PI * 2);
	outlined(context, SLATE, line * 0.8);
	context.beginPath();
	context.moveTo(x, y + h * 0.3);
	context.lineTo(x, y + h * 0.8);
	context.strokeStyle = INK;
	context.lineWidth = line * 1.4;
	context.stroke();
}

function drawDrone(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	ahead: number,
	unit: number,
	line: number,
	{ timeMs, reducedMotion, topY }: { timeMs: number; reducedMotion: boolean; topY: number }
) {
	const arrival = droneArrival(ahead);
	if (arrival < 1) {
		// Warning marker: a dashed red target ring with an exclamation mark, pinned to the top
		// edge while the drone is still beyond it
		const blinkOn = reducedMotion || Math.floor(timeMs / 180) % 2 === 0;
		const radius = unit * 0.3;
		const markerY = Math.max(y, topY + radius);
		context.save();
		context.globalAlpha = blinkOn ? 1 : 0.55;
		context.beginPath();
		context.arc(x, markerY, radius, 0, Math.PI * 2);
		context.fillStyle = PAPER;
		context.fill();
		context.setLineDash([unit * 0.09, unit * 0.07]);
		context.strokeStyle = TIE_RED;
		context.lineWidth = line * 1.3;
		context.stroke();
		context.setLineDash([]);
		context.fillStyle = TIE_RED;
		context.fillRect(x - unit * 0.035, markerY - radius * 0.6, unit * 0.07, radius * 0.75);
		context.beginPath();
		context.arc(x, markerY + radius * 0.45, unit * 0.045, 0, Math.PI * 2);
		context.fill();
		context.restore();
		if (arrival <= 0) return;
	}

	// The drone swoops down: it starts larger and higher, its shadow marks where it will be
	const lift = (1 - arrival) * unit * 0.9;
	const scale = 1 + (1 - arrival) * 0.5;
	context.beginPath();
	context.ellipse(x, y, unit * 0.26, unit * 0.12, 0, 0, Math.PI * 2);
	context.fillStyle = 'rgba(17, 17, 17, 0.28)';
	context.fill();

	const w = ITEM_SIZE.drone.halfWidth * unit * scale;
	const top = y - lift;
	context.beginPath();
	context.moveTo(x, top + w);
	context.lineTo(x + w, top - w * 0.7);
	context.lineTo(x, top - w * 0.35);
	context.lineTo(x - w, top - w * 0.7);
	context.closePath();
	outlined(context, SKY, line);
	context.beginPath();
	context.arc(x, top + w * 0.35, w * 0.16, 0, Math.PI * 2);
	outlined(context, TIE_RED, line * 0.7);
}

function drawSlick(
	context: CanvasRenderingContext2D,
	id: number,
	x: number,
	y: number,
	unit: number,
	line: number
) {
	const { halfLength, halfWidth } = ITEM_SIZE.slick;
	const points = 9;
	context.beginPath();
	for (let i = 0; i <= points; i++) {
		const angle = (i / points) * Math.PI * 2;
		// A fixed wobble per slick, so its outline is irregular but stable
		const wobble = 0.82 + 0.18 * Math.sin(angle * 3 + id * 1.7);
		const px = x + Math.cos(angle) * halfWidth * 1.1 * unit * wobble;
		const py = y + Math.sin(angle) * halfLength * unit * wobble;
		if (i === 0) context.moveTo(px, py);
		else context.lineTo(px, py);
	}
	context.closePath();
	outlined(context, OIL, line);
	context.beginPath();
	context.arc(
		x - halfWidth * 0.3 * unit,
		y - halfLength * 0.3 * unit,
		unit * 0.1,
		Math.PI,
		Math.PI * 1.7
	);
	context.strokeStyle = SLATE;
	context.lineWidth = line;
	context.stroke();
}

/** An oil barrel seen from above: a round lid with a rim and a filler cap */
function drawBarrel(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	unit: number,
	line: number
) {
	const radius = ITEM_SIZE.barrel.halfWidth * unit;
	context.beginPath();
	context.arc(x, y, radius, 0, Math.PI * 2);
	outlined(context, MUSTARD, line);
	context.beginPath();
	context.arc(x, y, radius * 0.62, 0, Math.PI * 2);
	context.strokeStyle = INK;
	context.lineWidth = line * 0.7;
	context.stroke();
	context.beginPath();
	context.arc(x + radius * 0.3, y - radius * 0.3, radius * 0.18, 0, Math.PI * 2);
	outlined(context, INK, line * 0.5);
}

function drawTanker(
	context: CanvasRenderingContext2D,
	runner: RunnerState,
	x: number,
	y: number,
	unit: number,
	line: number,
	reducedMotion: boolean
) {
	const flickering = runner.invulnerableMs > 0;
	// Flicker by skipping alternate frames; with reduced motion it just turns see-through
	if (flickering && !reducedMotion && Math.floor(runner.invulnerableMs / 90) % 2 === 1) return;

	context.save();
	if (flickering && reducedMotion) context.globalAlpha = 0.5;

	if (runner.escort) {
		// The submarine escort trails behind, with a dashed shield ring around the tanker
		if (sprites.submarine)
			drawSprite(
				context,
				sprites.submarine,
				x + unit * 0.42,
				y + unit * 0.55,
				unit * 0.5,
				-Math.PI / 2
			);
		context.beginPath();
		context.ellipse(x, y, unit * 0.46, unit * 0.9, 0, 0, Math.PI * 2);
		context.strokeStyle = PAPER;
		context.lineWidth = line * 1.2;
		context.setLineDash([unit * 0.14, unit * 0.1]);
		context.stroke();
		context.setLineDash([]);
	}

	if (sprites.tanker) drawSprite(context, sprites.tanker, x, y, unit * 0.62);
	else {
		context.beginPath();
		context.roundRect(x - unit * 0.3, y - unit * 0.78, unit * 0.6, unit * 1.56, unit * 0.2);
		outlined(context, OIL, line);
	}
	context.restore();
}

function drawEffect(
	context: CanvasRenderingContext2D,
	effect: ConvoyEffect,
	x: number,
	y: number,
	unit: number,
	line: number
) {
	const t = Math.min(1, effect.ageMs / effect.durationMs);
	context.save();
	context.globalAlpha = 1 - t;
	switch (effect.kind) {
		case 'explosion':
			if (sprites.explosion) drawSprite(context, sprites.explosion, x, y, unit * (0.7 + t * 0.6));
			else drawStarburst(context, x, y, unit * (0.35 + t * 0.3), line);
			break;
		case 'shield':
		case 'splash':
			context.beginPath();
			context.arc(x, y, unit * (0.3 + t * 0.5), 0, Math.PI * 2);
			context.strokeStyle = effect.kind === 'shield' ? MUSTARD : PAPER;
			context.lineWidth = line * 1.5;
			context.stroke();
			break;
		case 'sparkle':
			for (let i = 0; i < 6; i++) {
				const angle = (i / 6) * Math.PI * 2;
				const inner = unit * (0.15 + t * 0.2);
				const outer = unit * (0.3 + t * 0.3);
				context.beginPath();
				context.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
				context.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
				context.strokeStyle = EXPLOSION_YELLOW;
				context.lineWidth = line * 1.5;
				context.stroke();
			}
			break;
	}
	context.restore();
}

function drawStarburst(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	line: number
) {
	const rays = 10;
	context.beginPath();
	for (let i = 0; i <= rays * 2; i++) {
		const angle = (i / (rays * 2)) * Math.PI * 2;
		const r = i % 2 === 0 ? radius : radius * 0.55;
		const px = x + Math.cos(angle) * r;
		const py = y + Math.sin(angle) * r;
		if (i === 0) context.moveTo(px, py);
		else context.lineTo(px, py);
	}
	context.closePath();
	outlined(context, EXPLOSION_YELLOW, line);
}

/** Draws the final field into a square, for the share card */
export function drawConvoyBoard(
	context: CanvasRenderingContext2D,
	runner: RunnerState,
	x: number,
	y: number,
	size: number
) {
	const height = size;
	const width = (size * FIELD_WIDTH) / FIELD_HEIGHT;
	context.save();
	context.fillStyle = SAND;
	context.fillRect(x, y, size, size);
	context.translate(x + (size - width) / 2, y);
	context.beginPath();
	context.rect(0, 0, width, height);
	context.clip();
	// Drawn steady: no flicker, shake or blinking on the still image
	drawScene(context, { ...runner, invulnerableMs: 0 }, { width, height, reducedMotion: true });
	context.restore();
}

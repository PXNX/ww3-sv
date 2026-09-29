/*
 * Canvas drawing for Flamingo Flight. All art is generic, original flat placeholder shapes in the
 * app's style (thick ink outlines, flat fills, no gradients) unless owner art is supplied.
 * Destruction is a flat cartoon fireball with black smoke only; no people appear anywhere.
 * Visual effects use their own seeded random, so they never touch the game logic.
 */
import { createRandom, type Random } from '../random';
import type { FlamingoAssetId } from './assets';
import { COLUMN_WIDTH, type GapColumn } from './gapSequence';
import {
	currentSegment,
	predictDive,
	type FlamingoEvent,
	type FlamingoState,
	type Segment
} from './flamingoStep';
import { FLAMINGO_SCREEN_X, GROUND_Y, WORLD_HEIGHT, WORLD_WIDTH } from './physics';
import { flareRect, type FlareStack, type Refinery, type Tank } from './refinery';

const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const SAND_DARK = '#cfc693';
const KHAKI = '#7c8c5c';
const TIE_RED = '#e5484d';
const SKY = '#aeb4be';
const MUSTARD = '#ddb93c';
const YELLOW = '#f5c83a';
const STEEL = '#c9cdd3';
const BALLOON = '#dfe2e6';
const CHAR = '#3a3a3a';
const SMOKE = '#1c1c1c';
const PINK = '#f28db2';
const PINK_DARK = '#d9608e';
const UKRAINE_BLUE = '#0057b7';
const UKRAINE_YELLOW = '#ffd700';
const LINE = 3;
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export interface RenderAssets {
	/** Explosion frames from the shared sprites; empty until loaded */
	explosion: HTMLImageElement[];
	supplied: Partial<Record<FlamingoAssetId, HTMLImageElement>>;
}

export interface RenderLabels {
	refineryNames: string[];
	biggest: string;
	strikeBiggest: string;
	strikeTanks: (count: number) => string;
	/** Cheered over every struck tank, in the Ukrainian flag's own blue and yellow */
	slogan: string;
	direction: 'ltr' | 'rtl';
}

interface Fireball {
	x: number;
	y: number;
	size: number;
	age: number;
	delay: number;
	duration: number;
}

interface Puff {
	x: number;
	y: number;
	radius: number;
	growth: number;
	rise: number;
	age: number;
	life: number;
}

interface Popup {
	x: number;
	y: number;
	text: string;
	age: number;
	tone?: 'slogan';
}

interface Feather {
	x: number;
	y: number;
	vx: number;
	vy: number;
	spin: number;
	age: number;
}

/** Fireballs, smoke, score pop-ups and feathers, driven by game events */
export class FlamingoEffects {
	fireballs: Fireball[] = [];
	puffs: Puff[] = [];
	popups: Popup[] = [];
	feathers: Feather[] = [];
	shake = 0;
	private random: Random;
	private smokeTimer = 0;

	constructor(
		private reducedMotion: boolean,
		seed = 1
	) {
		this.random = createRandom(seed);
	}

	private puff(x: number, y: number, size: number) {
		const r = this.random;
		this.puffs.push({
			x: x + (r() - 0.5) * size,
			y: y - r() * size * 0.4,
			radius: size * (0.25 + r() * 0.2),
			growth: size * (0.5 + r() * 0.4),
			rise: 30 + r() * 30,
			age: 0,
			life: this.reducedMotion ? 0.8 : 1.4 + r() * 0.6
		});
	}

	handle(events: readonly FlamingoEvent[], state: FlamingoState, labels: RenderLabels): void {
		for (const event of events) {
			if (event.type === 'strike') {
				const { refinery } = event.segment;
				const hit = refinery.tanks[event.result.hitIndex];
				for (const index of event.result.destroyed) {
					const tank = refinery.tanks[index];
					const size = tank.halfWidth * (index === refinery.biggest ? 3.4 : 2.6);
					this.fireballs.push({
						x: tank.x,
						y: GROUND_Y - tank.height * 0.7,
						size,
						age: 0,
						delay: this.reducedMotion ? 0 : Math.abs(tank.x - hit.x) / 500,
						duration: this.reducedMotion ? 0.4 : 0.9
					});
					const puffs = this.reducedMotion ? 2 : 5;
					for (let i = 0; i < puffs; i++) this.puff(tank.x, GROUND_Y - tank.height, size * 0.6);
				}
				this.popups.push({ x: event.x, y: event.y - 30, text: `+${event.result.points}`, age: 0 });
				if (event.result.biggestHit) {
					this.popups.push({ x: event.x, y: event.y - 60, text: labels.strikeBiggest, age: 0 });
				} else if (event.result.destroyed.length > 1) {
					const text = labels.strikeTanks(event.result.destroyed.length);
					this.popups.push({ x: event.x, y: event.y - 60, text, age: 0 });
				}
				this.popups.push({
					x: event.x,
					y: event.y - 90,
					text: labels.slogan,
					age: 0,
					tone: 'slogan'
				});
				if (!this.reducedMotion) this.shake = event.result.biggestHit ? 12 : 7;
			} else if (event.type === 'crash') {
				const count = this.reducedMotion ? 3 : 7;
				for (let i = 0; i < count; i++) {
					this.feathers.push({
						x: state.x,
						y: state.y,
						vx: (this.random() - 0.5) * 160,
						vy: -60 - this.random() * 120,
						spin: this.random() * Math.PI * 2,
						age: 0
					});
				}
				if (state.crash === 'flare') this.puff(state.x, state.y, 30);
				if (!this.reducedMotion) this.shake = 5;
			}
		}
	}

	update(dt: number, state: FlamingoState): void {
		for (const fireball of this.fireballs) fireball.age += dt;
		this.fireballs = this.fireballs.filter((f) => f.age < f.delay + f.duration);
		for (const puff of this.puffs) {
			puff.age += dt;
			puff.y -= puff.rise * dt;
		}
		this.puffs = this.puffs.filter((p) => p.age < p.life);
		for (const popup of this.popups) {
			popup.age += dt;
			popup.y -= 40 * dt;
		}
		this.popups = this.popups.filter((p) => p.age < 1.2);
		for (const feather of this.feathers) {
			feather.age += dt;
			feather.vy = Math.min(feather.vy + 300 * dt, 60);
			feather.x += feather.vx * dt;
			feather.y += feather.vy * dt;
			feather.vx *= 0.98;
			feather.spin += dt * 5;
		}
		this.feathers = this.feathers.filter((f) => f.age < 2.5);
		this.shake = Math.max(0, this.shake - dt * 30);

		// Struck refineries keep smouldering while they are on screen
		this.smokeTimer += dt;
		const interval = this.reducedMotion ? 0.8 : 0.3;
		if (this.smokeTimer >= interval) {
			this.smokeTimer = 0;
			const cameraX = state.x - FLAMINGO_SCREEN_X;
			for (const segment of state.segments) {
				if (!segment.strike) continue;
				for (const index of segment.strike.destroyed) {
					const tank = segment.refinery.tanks[index];
					if (tank.x < cameraX - 40 || tank.x > cameraX + WORLD_WIDTH + 40) continue;
					this.puff(tank.x, GROUND_Y - tank.height * 0.55, tank.halfWidth);
				}
			}
		}
	}
}

function outlined(context: CanvasRenderingContext2D, fill: string) {
	context.fillStyle = fill;
	context.fill();
	context.lineWidth = LINE;
	context.strokeStyle = INK;
	context.stroke();
}

function box(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: string
) {
	context.beginPath();
	context.rect(x, y, w, h);
	outlined(context, fill);
}

/** Deterministic pseudo-random value in [0, 1) for decoration positions */
function hash(n: number): number {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
}

function drawCloud(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
	const bumps: [number, number, number][] = [
		[0, 0, 18],
		[20, -8, 22],
		[42, 0, 16]
	];
	// Outline first, then fill, so the bumps merge into one shape
	context.lineWidth = LINE * 2;
	context.strokeStyle = INK;
	context.fillStyle = PAPER;
	for (const pass of ['stroke', 'fill'] as const) {
		for (const [dx, dy, r] of bumps) {
			context.beginPath();
			context.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
			if (pass === 'stroke') context.stroke();
			else context.fill();
		}
	}
}

function drawBackdrop(context: CanvasRenderingContext2D, cameraX: number) {
	context.fillStyle = SKY;
	context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

	const cloudOffset = cameraX * 0.3;
	const first = Math.floor((cloudOffset - 120) / 200);
	for (let k = first; k < first + 4; k++) {
		drawCloud(
			context,
			k * 200 - cloudOffset + hash(k) * 60,
			50 + hash(k + 99) * 170,
			0.8 + hash(k + 7) * 0.4
		);
	}

	// Low, far-away hills scroll at half speed
	const hillOffset = cameraX * 0.5;
	const firstHill = Math.floor((hillOffset - 160) / 140);
	for (let k = firstHill; k < firstHill + 5; k++) {
		const x = k * 140 - hillOffset;
		const height = 30 + hash(k + 31) * 40;
		context.beginPath();
		context.moveTo(x - 20, GROUND_Y);
		context.quadraticCurveTo(x + 70, GROUND_Y - height * 2, x + 160, GROUND_Y);
		outlined(context, SAND_DARK);
	}
}

function drawGround(context: CanvasRenderingContext2D, cameraX: number) {
	box(context, -LINE, GROUND_Y, WORLD_WIDTH + LINE * 2, WORLD_HEIGHT - GROUND_Y + LINE, SAND);
	context.fillStyle = MUSTARD;
	const offset = cameraX % 40;
	for (let x = -offset - 40; x < WORLD_WIDTH + 40; x += 40) {
		context.fillRect(x, GROUND_Y + 16, 20, 5);
	}
}

function drawLattice(context: CanvasRenderingContext2D, x: number, top: number, bottom: number) {
	context.lineWidth = 2;
	context.strokeStyle = INK;
	context.beginPath();
	for (let y = top; y < bottom; y += 36) {
		const next = Math.min(bottom, y + 36);
		context.moveTo(x + 6, y);
		context.lineTo(x + COLUMN_WIDTH - 6, next);
		context.moveTo(x + COLUMN_WIDTH - 6, y);
		context.lineTo(x + 6, next);
	}
	context.stroke();
}

function drawRadarMast(context: CanvasRenderingContext2D, column: GapColumn, time: number) {
	const { x, gapBottom } = column;
	box(context, x + 4, gapBottom + 24, COLUMN_WIDTH - 8, GROUND_Y - gapBottom - 24, KHAKI);
	drawLattice(context, x + 4, gapBottom + 24, GROUND_Y);
	// Rotating dish on top, squashed horizontally to look like it turns
	const spin = 0.25 + Math.abs(Math.cos(time * 2)) * 0.75;
	box(context, x + COLUMN_WIDTH / 2 - 4, gapBottom + 10, 8, 16, KHAKI);
	context.beginPath();
	context.ellipse(
		x + COLUMN_WIDTH / 2,
		gapBottom + 12,
		(COLUMN_WIDTH / 2) * spin,
		11,
		0,
		Math.PI,
		0
	);
	context.closePath();
	outlined(context, PAPER);
}

function drawPylon(context: CanvasRenderingContext2D, column: GapColumn) {
	const { x, gapBottom } = column;
	const armY = gapBottom + 14;
	// Wires drooping off to both sides (decoration behind the pylon)
	context.lineWidth = 2;
	context.strokeStyle = INK;
	for (const side of [-1, 1]) {
		const edge = side < 0 ? x : x + COLUMN_WIDTH;
		context.beginPath();
		context.moveTo(edge, armY + 12);
		context.quadraticCurveTo(edge + side * 30, armY + 70, edge + side * 70, armY + 110);
		context.stroke();
	}
	box(context, x + 8, gapBottom + 8, COLUMN_WIDTH - 16, GROUND_Y - gapBottom - 8, STEEL);
	drawLattice(context, x + 8, gapBottom + 30, GROUND_Y);
	box(context, x, armY - 6, COLUMN_WIDTH, 8, STEEL);
	for (const insulatorX of [x + 4, x + COLUMN_WIDTH - 10]) {
		box(context, insulatorX, armY + 2, 6, 12, PAPER);
	}
	context.beginPath();
	context.moveTo(x + 8, gapBottom + 8);
	context.lineTo(x + COLUMN_WIDTH / 2, gapBottom);
	context.lineTo(x + COLUMN_WIDTH - 8, gapBottom + 8);
	context.closePath();
	outlined(context, STEEL);
}

const BALLOON_HEIGHT = 44;

function drawBalloonStack(context: CanvasRenderingContext2D, column: GapColumn) {
	const { x, gapTop } = column;
	const middle = x + COLUMN_WIDTH / 2;
	context.lineWidth = 2;
	context.strokeStyle = INK;
	context.beginPath();
	context.moveTo(middle, 0);
	context.lineTo(middle, gapTop);
	context.stroke();
	// Absurdly, the balloons are stacked all the way up to the sky
	for (let bottom = gapTop; bottom > -BALLOON_HEIGHT; bottom -= BALLOON_HEIGHT) {
		const centerY = bottom - BALLOON_HEIGHT / 2;
		for (const fin of [-1, 1]) {
			context.beginPath();
			context.moveTo(x + 10, centerY);
			context.lineTo(x + 1, centerY + fin * 15);
			context.lineTo(x + 16, centerY + fin * 6);
			context.closePath();
			outlined(context, KHAKI);
		}
		context.beginPath();
		context.ellipse(
			middle + 3,
			centerY,
			COLUMN_WIDTH / 2 - 4,
			BALLOON_HEIGHT / 2 - 3,
			0,
			0,
			Math.PI * 2
		);
		outlined(context, BALLOON);
		context.beginPath();
		context.arc(middle + 16, centerY - 4, 3, 0, Math.PI * 2);
		context.fillStyle = INK;
		context.fill();
	}
}

function drawColumn(
	context: CanvasRenderingContext2D,
	column: GapColumn,
	time: number,
	assets: RenderAssets
) {
	const top = assets.supplied.barrageBalloon;
	if (top) context.drawImage(top, column.x, 0, COLUMN_WIDTH, column.gapTop);
	else drawBalloonStack(context, column);

	const bottomImage = assets.supplied[column.kind === 'radar' ? 'radarMast' : 'powerPylon'];
	if (bottomImage) {
		context.drawImage(
			bottomImage,
			column.x,
			column.gapBottom,
			COLUMN_WIDTH,
			GROUND_Y - column.gapBottom
		);
	} else if (column.kind === 'radar') drawRadarMast(context, column, time);
	else drawPylon(context, column);
}

function drawTank(
	context: CanvasRenderingContext2D,
	tank: Tank,
	isBiggest: boolean,
	destroyed: boolean,
	assets: RenderAssets
) {
	const left = tank.x - tank.halfWidth;
	const width = tank.halfWidth * 2;
	const top = GROUND_Y - tank.height;

	if (destroyed) {
		const image = assets.supplied.tankDestroyed;
		if (image) return context.drawImage(image, left, top, width, tank.height);
		// A charred, crumpled stump with a jagged top
		const stump = GROUND_Y - tank.height * 0.5;
		context.beginPath();
		context.moveTo(left, GROUND_Y);
		context.lineTo(left, stump + 6);
		for (let i = 1; i <= 6; i++) {
			context.lineTo(left + (width * i) / 6, stump + (i % 2 === 0 ? 8 : -6));
		}
		context.lineTo(left + width, GROUND_Y);
		context.closePath();
		outlined(context, CHAR);
		return;
	}

	const image = assets.supplied.tank;
	if (image) return context.drawImage(image, left, top, width, tank.height);
	box(context, left, top + 8, width, tank.height - 8, PAPER);
	context.fillStyle = isBiggest ? TIE_RED : KHAKI;
	context.fillRect(left + LINE / 2, top + tank.height * 0.45, width - LINE, 10);
	context.lineWidth = 2;
	context.strokeStyle = INK;
	context.strokeRect(left, top + tank.height * 0.45, width, 10);
	// Ladder
	context.beginPath();
	for (const railX of [left + width - 14, left + width - 6]) {
		context.moveTo(railX, top + 10);
		context.lineTo(railX, GROUND_Y);
	}
	for (let y = top + 18; y < GROUND_Y; y += 10) {
		context.moveTo(left + width - 14, y);
		context.lineTo(left + width - 6, y);
	}
	context.stroke();
	context.beginPath();
	context.ellipse(tank.x, top + 8, tank.halfWidth, 8, 0, 0, Math.PI * 2);
	outlined(context, PAPER);
}

function drawFlare(
	context: CanvasRenderingContext2D,
	flare: FlareStack,
	time: number,
	assets: RenderAssets
) {
	const rect = flareRect(flare);
	const image = assets.supplied.flareStack;
	if (image) return context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
	const stackTop = rect.y + 24;
	box(context, rect.x, stackTop, rect.width, GROUND_Y - stackTop, STEEL);
	context.fillStyle = PAPER;
	for (let y = stackTop + 20; y < GROUND_Y - 10; y += 40)
		context.fillRect(rect.x + 2, y, rect.width - 4, 12);
	// Flickering flat flame
	const flicker = 1 + Math.sin(time * 18) * 0.12;
	const flameX = flare.x;
	context.beginPath();
	context.moveTo(flameX - 9, stackTop);
	context.quadraticCurveTo(flameX - 12, stackTop - 16 * flicker, flameX, stackTop - 26 * flicker);
	context.quadraticCurveTo(flameX + 12, stackTop - 16 * flicker, flameX + 9, stackTop);
	context.closePath();
	outlined(context, YELLOW);
	context.beginPath();
	context.moveTo(flameX - 4, stackTop);
	context.quadraticCurveTo(flameX, stackTop - 14 * flicker, flameX + 4, stackTop);
	context.closePath();
	context.fillStyle = TIE_RED;
	context.fill();
}

function drawSign(context: CanvasRenderingContext2D, refinery: Refinery, labels: RenderLabels) {
	const x = refinery.startX - 90;
	const y = GROUND_Y - 96;
	box(context, x + 14, y + 30, 6, 66, KHAKI);
	box(context, x + 100, y + 30, 6, 66, KHAKI);
	context.save();
	context.translate(x + 60, y + 20);
	context.rotate(-0.04);
	box(context, -60, -18, 120, 40, PAPER);
	context.fillStyle = INK;
	context.font = `700 12px ${DISPLAY_FONT}`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.direction = labels.direction;
	context.fillText(labels.refineryNames[refinery.nameIndex] ?? '', 0, 2, 110);
	context.restore();
}

function drawBiggestMarker(
	context: CanvasRenderingContext2D,
	tank: Tank,
	time: number,
	label: string
) {
	const y = GROUND_Y - tank.height - 34 + Math.sin(time * 5) * 4;
	context.beginPath();
	context.moveTo(tank.x - 10, y);
	context.lineTo(tank.x + 10, y);
	context.lineTo(tank.x, y + 14);
	context.closePath();
	outlined(context, YELLOW);
	context.font = `700 12px ${DISPLAY_FONT}`;
	context.textAlign = 'center';
	context.textBaseline = 'bottom';
	context.lineWidth = 4;
	context.strokeStyle = PAPER;
	context.strokeText(label, tank.x, y - 2);
	context.fillStyle = INK;
	context.fillText(label, tank.x, y - 2);
}

function drawRefinery(
	context: CanvasRenderingContext2D,
	segment: Segment,
	target: number | null,
	time: number,
	assets: RenderAssets,
	labels: RenderLabels
) {
	const { refinery, strike } = segment;
	drawSign(context, refinery, labels);
	drawFlare(context, refinery.flare, time, assets);
	refinery.tanks.forEach((tank, index) => {
		const destroyed = strike?.destroyed.includes(index) ?? false;
		drawTank(context, tank, index === refinery.biggest, destroyed, assets);
		if (index === target && !strike) {
			// Dashed outline on the tank a dive would hit right now
			context.save();
			context.setLineDash([6, 5]);
			context.lineWidth = 3;
			context.strokeStyle = TIE_RED;
			context.strokeRect(
				tank.x - tank.halfWidth - 5,
				GROUND_Y - tank.height - 5,
				tank.halfWidth * 2 + 10,
				tank.height + 5
			);
			context.restore();
		}
	});
	if (!strike) drawBiggestMarker(context, refinery.tanks[refinery.biggest], time, labels.biggest);
}

export type FlamingoFrame = 'flap' | 'glide' | 'fall';

/** The placeholder flamingo: pink, flat, long trailing legs; facing right, centered on (0, 0) */
export function drawFlamingo(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	angle: number,
	frame: FlamingoFrame,
	assets?: RenderAssets
) {
	context.save();
	context.translate(x, y);
	context.rotate(angle);

	const image = assets?.supplied[frame === 'fall' ? 'flamingoFall' : 'flamingoFlap'];
	if (image) {
		context.drawImage(image, -34, -34, 68, 68);
		context.restore();
		return;
	}

	context.lineCap = 'round';
	context.lineJoin = 'round';
	// Long trailing legs: ink outline under a pink line
	const legs: [number, number][][] = [
		[
			[-8, 6],
			[-24, 12],
			[-42, 9]
		],
		[
			[-6, 8],
			[-20, 16],
			[-38, 16]
		]
	];
	for (const [width, color] of [
		[6, INK],
		[2.5, PINK_DARK]
	] as const) {
		context.lineWidth = width;
		context.strokeStyle = color;
		for (const leg of legs) {
			context.beginPath();
			context.moveTo(leg[0][0], leg[0][1]);
			for (const [px, py] of leg.slice(1)) context.lineTo(px, py);
			context.stroke();
		}
	}
	// Tail
	context.beginPath();
	context.moveTo(-14, -3);
	context.lineTo(-24, -8);
	context.lineTo(-22, 4);
	context.closePath();
	outlined(context, PINK_DARK);
	// Neck
	for (const [width, color] of [
		[9, INK],
		[4.5, PINK]
	] as const) {
		context.lineWidth = width;
		context.strokeStyle = color;
		context.beginPath();
		context.moveTo(10, -4);
		context.quadraticCurveTo(22, -8, 22, -20);
		context.stroke();
	}
	// Body
	context.beginPath();
	context.ellipse(0, 0, 17, 11, 0, 0, Math.PI * 2);
	outlined(context, PINK);
	// Head and beak
	context.beginPath();
	context.arc(24, -22, 6.5, 0, Math.PI * 2);
	outlined(context, PINK);
	context.beginPath();
	context.moveTo(29, -25);
	context.lineTo(40, -19);
	context.lineTo(30, -17);
	context.closePath();
	outlined(context, PAPER);
	context.beginPath();
	context.moveTo(36, -21);
	context.lineTo(40, -19);
	context.lineTo(35, -18);
	context.closePath();
	context.fillStyle = INK;
	context.fill();
	context.beginPath();
	context.arc(25, -24, 1.8, 0, Math.PI * 2);
	context.fill();
	// Wing: raised when flapping, level when gliding, swept back when falling or diving
	context.beginPath();
	if (frame === 'flap') {
		context.moveTo(-6, -5);
		context.lineTo(-14, -28);
		context.lineTo(8, -7);
	} else if (frame === 'glide') {
		context.moveTo(-8, -3);
		context.lineTo(-22, -12);
		context.lineTo(8, -4);
	} else {
		context.moveTo(-4, -2);
		context.lineTo(-26, -2);
		context.lineTo(8, 3);
	}
	context.closePath();
	outlined(context, PINK_DARK);
	context.restore();
}

function drawStarburst(context: CanvasRenderingContext2D, size: number) {
	for (const [outer, inner, fill] of [
		[1, 0.55, TIE_RED],
		[0.68, 0.38, YELLOW]
	] as const) {
		context.beginPath();
		for (let i = 0; i < 24; i++) {
			const radius = (size / 2) * (i % 2 === 0 ? outer : inner);
			const a = (i / 24) * Math.PI * 2;
			context.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
		}
		context.closePath();
		outlined(context, fill);
	}
}

function drawEffects(
	context: CanvasRenderingContext2D,
	effects: FlamingoEffects,
	assets: RenderAssets
) {
	for (const puff of effects.puffs) {
		const t = puff.age / puff.life;
		context.globalAlpha = 0.85 * (1 - t);
		context.fillStyle = SMOKE;
		context.beginPath();
		context.arc(puff.x, puff.y, puff.radius + puff.growth * t, 0, Math.PI * 2);
		context.fill();
	}
	context.globalAlpha = 1;

	for (const fireball of effects.fireballs) {
		const progress = (fireball.age - fireball.delay) / fireball.duration;
		if (progress < 0) continue;
		const frames = assets.explosion;
		context.save();
		context.translate(fireball.x, fireball.y);
		if (frames.length > 1) {
			const frame = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
			context.drawImage(
				frame,
				-fireball.size / 2,
				-fireball.size / 2,
				fireball.size,
				fireball.size
			);
		} else {
			// A single frame scales up, then fades
			const scale = progress < 0.35 ? 0.3 + (progress / 0.35) * 0.9 : 1.2;
			context.globalAlpha = progress < 0.35 ? 1 : Math.max(0, 1 - (progress - 0.35) / 0.65);
			const size = fireball.size * scale;
			if (frames[0]) context.drawImage(frames[0], -size / 2, -size / 2, size, size);
			else drawStarburst(context, size);
		}
		context.restore();
	}

	for (const feather of effects.feathers) {
		context.save();
		context.translate(feather.x, feather.y);
		context.rotate(feather.spin);
		context.globalAlpha = Math.max(0, 1 - feather.age / 2.5);
		context.beginPath();
		context.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2);
		context.fillStyle = PINK;
		context.fill();
		context.lineWidth = 1.5;
		context.strokeStyle = INK;
		context.stroke();
		context.restore();
	}

	context.font = `700 20px ${DISPLAY_FONT}`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	for (const popup of effects.popups) {
		context.globalAlpha = Math.min(1, 2.4 - popup.age * 2);
		context.lineWidth = 5;
		context.strokeStyle = popup.tone === 'slogan' ? UKRAINE_BLUE : INK;
		context.strokeText(popup.text, popup.x, popup.y);
		context.fillStyle =
			popup.tone === 'slogan' ? UKRAINE_YELLOW : popup.text.startsWith('+') ? TIE_RED : YELLOW;
		context.fillText(popup.text, popup.x, popup.y);
	}
	context.globalAlpha = 1;
}

function flamingoPose(state: FlamingoState): { angle: number; frame: FlamingoFrame } {
	if (state.phase === 'ready') {
		return { angle: 0, frame: Math.floor(state.time * 5) % 2 === 0 ? 'flap' : 'glide' };
	}
	if (state.phase === 'tumbling' || state.phase === 'over') {
		// Spins while falling, then lies on its back, legs up
		return {
			angle: state.landedSeconds === null ? state.time * 12 : Math.PI,
			frame: 'fall'
		};
	}
	const angle = Math.min(1.25, Math.max(-0.45, (state.vy / 620) * 1.2));
	if (state.time - state.lastFlapTime < 0.18) return { angle, frame: 'flap' };
	return { angle, frame: state.vy > 250 ? 'fall' : 'glide' };
}

function drawDizzyStars(context: CanvasRenderingContext2D, x: number, y: number, time: number) {
	for (let i = 0; i < 3; i++) {
		const a = time * 4 + (i * Math.PI * 2) / 3;
		const sx = x + Math.cos(a) * 18;
		const sy = y - 20 + Math.sin(a) * 6;
		context.beginPath();
		for (let p = 0; p < 10; p++) {
			const radius = p % 2 === 0 ? 6 : 2.5;
			const pa = (p / 10) * Math.PI * 2 - Math.PI / 2;
			context.lineTo(sx + Math.cos(pa) * radius, sy + Math.sin(pa) * radius);
		}
		context.closePath();
		context.lineWidth = 1.5;
		context.fillStyle = YELLOW;
		context.fill();
		context.strokeStyle = INK;
		context.stroke();
	}
}

/** Draws the whole scene in world units; the caller scales the context to the canvas size */
export function drawScene(
	context: CanvasRenderingContext2D,
	state: FlamingoState,
	effects: FlamingoEffects,
	assets: RenderAssets,
	labels: RenderLabels
): void {
	const cameraX = state.x - FLAMINGO_SCREEN_X;
	const shakeX = effects.shake ? Math.sin(state.time * 90) * effects.shake : 0;
	const shakeY = effects.shake ? Math.cos(state.time * 70) * effects.shake * 0.6 : 0;

	context.save();
	context.translate(shakeX, shakeY);
	drawBackdrop(context, cameraX);

	context.save();
	context.translate(-cameraX, 0);
	const current = currentSegment(state);
	const dive = state.stage === 'approach' ? predictDive(state) : null;
	const target = dive?.kind === 'tank' ? dive.index : null;
	for (const segment of state.segments) {
		drawRefinery(context, segment, segment === current ? target : null, state.time, assets, labels);
		for (const column of segment.columns) {
			if (column.x + COLUMN_WIDTH + 80 < cameraX || column.x - 80 > cameraX + WORLD_WIDTH) continue;
			drawColumn(context, column, state.time, assets);
		}
	}
	context.restore();

	drawGround(context, cameraX);

	context.save();
	context.translate(-cameraX, 0);
	const pose = flamingoPose(state);
	drawFlamingo(context, state.x, state.y, pose.angle, pose.frame, assets);
	if (state.landedSeconds !== null) drawDizzyStars(context, state.x, state.y, state.time);
	drawEffects(context, effects, assets);
	context.restore();

	context.restore();
}

/** Square picture for the share card: the flamingo flying away from a smouldering tank */
export function drawShareScene(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number
) {
	context.save();
	context.beginPath();
	context.rect(x, y, size, size);
	context.clip();
	context.translate(x, y);
	context.scale(size / WORLD_WIDTH, size / WORLD_WIDTH);
	context.translate(0, -(GROUND_Y - 280));
	drawBackdrop(context, 0);
	const tank: Tank = { x: 250, halfWidth: 42, height: 112, tier: 3 };
	const empty: RenderAssets = { explosion: [], supplied: {} };
	drawTank(context, tank, true, true, empty);
	for (const [dx, dy, r] of [
		[0, -80, 30],
		[-20, -120, 24],
		[14, -150, 20]
	]) {
		context.beginPath();
		context.arc(tank.x + dx, GROUND_Y + dy, r, 0, Math.PI * 2);
		context.fillStyle = SMOKE;
		context.fill();
	}
	context.save();
	context.translate(tank.x, GROUND_Y - 70);
	drawStarburst(context, 110);
	context.restore();
	drawGround(context, 0);
	context.save();
	context.scale(1.6, 1.6);
	drawFlamingo(context, 70, (GROUND_Y - 190) / 1.6, -0.3, 'flap');
	context.restore();
	context.restore();
}

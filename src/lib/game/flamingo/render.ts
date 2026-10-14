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
import { flareRect, type FlareStack, type Refinery, type SiteKind, type Tank } from './refinery';

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
const NET = '#dfe2e6';
const OLIVE_DARK = '#5f6d44';
const SLATE = '#2f3640';
const WB_PURPLE = '#a21caf';
const WB_DARK = '#701a75';
const YANDEX_RED = '#fc3f1d';
const RAIN = '#5d6e86';
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
	/** Names of the rarer sites, which have one each */
	siteNames: Record<Exclude<SiteKind, 'refinery'>, string>;
	biggest: string;
	strikeBiggest: string;
	strikeTanks: (count: number) => string;
	/** The same two for the warehouse and the datacenter, which have no tanks */
	strikeBiggestSite: string;
	strikeBuildings: (count: number) => string;
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
		readonly reducedMotion: boolean,
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
				const tanks = refinery.kind === 'refinery';
				if (event.result.biggestHit) {
					const text = tanks ? labels.strikeBiggest : labels.strikeBiggestSite;
					this.popups.push({ x: event.x, y: event.y - 60, text, age: 0 });
				} else if (event.result.destroyed.length > 1) {
					const count = event.result.destroyed.length;
					const text = tanks ? labels.strikeTanks(count) : labels.strikeBuildings(count);
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
				if (state.crash === 'flare' || state.crash === 'mast') this.puff(state.x, state.y, 30);
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

/** How much of each kind of weather is in the air, from 0 to 1 */
export interface Weather {
	rain: number;
	dust: number;
	haze: number;
}

export const CLEAR_WEATHER: Weather = { rain: 0, dust: 0, haze: 0 };

/** Distance in world units between the centers of two weather zones */
const WEATHER_ZONE = 1500;

function zoneWeather(seed: number, zone: number): Weather {
	// The take-off area is always clear; after that each zone gets one kind of weather, or none
	if (zone <= 0) return CLEAR_WEATHER;
	const roll = hash((seed % 9973) + zone * 17.3);
	const strength = 0.6 + 0.4 * hash((seed % 9973) + zone * 5.1);
	if (roll < 0.34) return CLEAR_WEATHER;
	if (roll < 0.58) return { rain: strength, dust: 0, haze: 0 };
	if (roll < 0.8) return { rain: 0, dust: strength, haze: 0 };
	return { rain: 0, dust: 0, haze: strength };
}

/** The weather over a world position: it drifts smoothly from one zone's weather to the next */
export function weatherAt(seed: number, worldX: number): Weather {
	const position = worldX / WEATHER_ZONE;
	const zone = Math.floor(position);
	const f = position - zone;
	const t = f * f * (3 - 2 * f);
	const from = zoneWeather(seed, zone);
	const to = zoneWeather(seed, zone + 1);
	return {
		rain: from.rain + (to.rain - from.rain) * t,
		dust: from.dust + (to.dust - from.dust) * t,
		haze: from.haze + (to.haze - from.haze) * t
	};
}

function wrap(value: number, length: number): number {
	return ((value % length) + length) % length;
}

/** Blends two #rrggbb colors */
function mixColor(from: string, to: string, t: number): string {
	const channel = (hex: string, index: number) =>
		parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
	const mixed = [0, 1, 2].map((index) =>
		Math.round(channel(from, index) + (channel(to, index) - channel(from, index)) * t)
	);
	return `rgb(${mixed.join(',')})`;
}

function drawCloud(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	scale: number,
	fill = PAPER
) {
	const bumps: [number, number, number][] = [
		[0, 0, 18],
		[20, -8, 22],
		[42, 0, 16]
	];
	// Outline first, then fill, so the bumps merge into one shape
	context.lineWidth = LINE * 2;
	context.strokeStyle = INK;
	context.fillStyle = fill;
	for (const pass of ['stroke', 'fill'] as const) {
		for (const [dx, dy, r] of bumps) {
			context.beginPath();
			context.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
			if (pass === 'stroke') context.stroke();
			else context.fill();
		}
	}
}

function drawSun(context: CanvasRenderingContext2D, time: number) {
	context.save();
	context.translate(WORLD_WIDTH - 66, 72);
	context.rotate(time * 0.25);
	context.lineWidth = LINE;
	context.strokeStyle = INK;
	context.lineCap = 'round';
	context.beginPath();
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * Math.PI * 2;
		context.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
		context.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
	}
	context.stroke();
	context.beginPath();
	context.arc(0, 0, 22, 0, Math.PI * 2);
	outlined(context, YELLOW);
	context.restore();
}

/** Streaks, dust and haze drawn behind the obstacles, so they never hide what can be hit */
function drawWeather(
	context: CanvasRenderingContext2D,
	weather: Weather,
	cameraX: number,
	time: number
) {
	context.save();
	if (weather.haze > 0.01) {
		context.fillStyle = PAPER;
		context.globalAlpha = 0.14 * weather.haze;
		context.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);
		// Pale banks of mist drifting past
		context.globalAlpha = 0.3 * weather.haze;
		for (let k = 0; k < 6; k++) {
			const x = wrap(
				hash(k + 400) * WORLD_WIDTH * 2 - cameraX * 0.25 - time * 6,
				WORLD_WIDTH + 300
			);
			context.beginPath();
			context.ellipse(
				x - 150,
				110 + hash(k + 410) * 400,
				90 + hash(k + 420) * 70,
				16,
				0,
				0,
				Math.PI * 2
			);
			context.fill();
		}
	}
	if (weather.dust > 0.01) {
		context.fillStyle = SAND;
		context.globalAlpha = 0.1 * weather.dust;
		// Stepped flat bands, thickest dust near the ground
		for (let band = 0; band < 4; band++) {
			const top = 300 + band * 70;
			context.fillRect(0, top, WORLD_WIDTH, GROUND_Y - top);
		}
		// Wind-blown sand streaks, rushing against the direction of flight
		context.globalAlpha = 0.75 * weather.dust;
		context.strokeStyle = '#c4b270';
		context.lineWidth = 2;
		context.lineCap = 'round';
		context.beginPath();
		const streaks = Math.ceil(34 * weather.dust);
		for (let i = 0; i < streaks; i++) {
			const speed = 150 + hash(i + 500) * 110;
			const x =
				wrap(
					hash(i + 510) * (WORLD_WIDTH + 120) - cameraX * 1.2 - time * speed,
					WORLD_WIDTH + 120
				) - 60;
			const y = 300 + hash(i + 520) * (GROUND_Y - 310);
			context.moveTo(x, y);
			context.lineTo(x + 12 + hash(i + 530) * 26, y);
		}
		context.stroke();
	}
	if (weather.rain > 0.01) {
		context.fillStyle = '#2f3b52';
		context.globalAlpha = 0.16 * weather.rain;
		context.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);
		context.globalAlpha = 0.6 * weather.rain;
		context.strokeStyle = RAIN;
		context.lineWidth = 1.5;
		context.beginPath();
		const drops = Math.ceil(70 * weather.rain);
		for (let i = 0; i < drops; i++) {
			const speed = 520 + hash(i + 300) * 180;
			const x =
				wrap(hash(i) * (WORLD_WIDTH + 80) - cameraX * 0.6 - time * 70, WORLD_WIDTH + 80) - 40;
			const y = wrap(hash(i + 150) * GROUND_Y + time * speed, GROUND_Y + 20) - 20;
			context.moveTo(x, y);
			context.lineTo(x - 4, y + 13);
		}
		context.stroke();
	}
	context.restore();
}

function drawBackdrop(
	context: CanvasRenderingContext2D,
	cameraX: number,
	weather: Weather = CLEAR_WEATHER,
	time = 0
) {
	context.fillStyle = SKY;
	context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

	// The sun only shows through when it is neither raining nor hazy
	const sun = 1 - Math.min(1, weather.rain + weather.haze * 0.6);
	if (sun > 0.02) {
		context.globalAlpha = sun;
		drawSun(context, time);
		context.globalAlpha = 1;
	}

	const cloudFill = mixColor(PAPER, '#a7aeba', weather.rain);
	const cloudOffset = cameraX * 0.3;
	const first = Math.floor((cloudOffset - 120) / 200);
	for (let k = first; k < first + 4; k++) {
		drawCloud(
			context,
			k * 200 - cloudOffset + hash(k) * 60,
			50 + hash(k + 99) * 170,
			0.8 + hash(k + 7) * 0.4,
			cloudFill
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

	drawWeather(context, weather, cameraX, time);
}

function drawGround(context: CanvasRenderingContext2D, cameraX: number) {
	box(context, -LINE, GROUND_Y, WORLD_WIDTH + LINE * 2, WORLD_HEIGHT - GROUND_Y + LINE, SAND);
	context.fillStyle = MUSTARD;
	const offset = cameraX % 40;
	for (let x = -offset - 40; x < WORLD_WIDTH + 40; x += 40) {
		context.fillRect(x, GROUND_Y + 16, 20, 5);
	}
}

function drawLattice(
	context: CanvasRenderingContext2D,
	x: number,
	top: number,
	bottom: number,
	inset = 6
) {
	context.lineWidth = 2;
	context.strokeStyle = INK;
	context.beginPath();
	for (let y = top; y < bottom; y += 36) {
		const next = Math.min(bottom, y + 36);
		context.moveTo(x + inset, y);
		context.lineTo(x + COLUMN_WIDTH - inset, next);
		context.moveTo(x + COLUMN_WIDTH - inset, y);
		context.lineTo(x + inset, next);
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

/** Air-defence tower: a wheeled launcher carrying a lattice mast and a turret of missile pods and twin guns */
function drawPantsir(context: CanvasRenderingContext2D, column: GapColumn) {
	const { x, gapBottom } = column;
	const middle = x + COLUMN_WIDTH / 2;
	const chassisTop = GROUND_Y - 26;
	// Missile pods tilted outwards, behind the turret body
	for (const side of [-1, 1]) {
		context.save();
		context.translate(middle + side * 12, gapBottom + 20);
		context.rotate(side * 0.4);
		box(context, -5, -18, 10, 18, STEEL);
		context.fillStyle = INK;
		for (const dx of [-2.5, 2.5]) {
			context.beginPath();
			context.arc(dx, -14, 2, 0, Math.PI * 2);
			context.fill();
		}
		context.restore();
	}
	// Twin gun barrels between the pods
	context.lineCap = 'round';
	for (const [width, color] of [
		[7, INK],
		[3, CHAR]
	] as const) {
		context.lineWidth = width;
		context.strokeStyle = color;
		context.beginPath();
		for (const dx of [-2.5, 2.5]) {
			context.moveTo(middle + dx, gapBottom + 22);
			context.lineTo(middle + dx, gapBottom + 3);
		}
		context.stroke();
	}
	// Mast down to the truck
	box(context, x + 14, gapBottom + 32, COLUMN_WIDTH - 28, chassisTop - gapBottom - 30, KHAKI);
	drawLattice(context, x, gapBottom + 34, chassisTop, 18);
	// Turret body with its optical sensor
	box(context, x + 6, gapBottom + 20, COLUMN_WIDTH - 12, 16, KHAKI);
	context.beginPath();
	context.arc(middle, gapBottom + 28, 4, 0, Math.PI * 2);
	outlined(context, PAPER);
	context.fillStyle = INK;
	context.fillRect(middle - 1, gapBottom + 27, 2, 2);
	// Truck: chassis, cab and three wheels
	box(context, x + 2, chassisTop, COLUMN_WIDTH - 4, 16, OLIVE_DARK);
	box(context, x + 40, chassisTop - 8, 14, 12, OLIVE_DARK);
	box(context, x + 46, chassisTop - 5, 6, 5, PAPER);
	for (const wheelX of [x + 12, x + 28, x + 44]) {
		context.beginPath();
		context.arc(wheelX, GROUND_Y - 8, 8, 0, Math.PI * 2);
		outlined(context, CHAR);
		context.beginPath();
		context.arc(wheelX, GROUND_Y - 8, 2.5, 0, Math.PI * 2);
		context.fillStyle = PAPER;
		context.fill();
	}
}

const NET_MESH = 20;

/** A drone net hanging from the sky: a diamond mesh on edge ropes, weighted along the hem */
function drawDroneNet(context: CanvasRenderingContext2D, column: GapColumn, time: number) {
	const { x, gapTop } = column;
	const left = x + 4;
	const width = COLUMN_WIDTH - 8;
	const hem = gapTop - 8;

	context.save();
	context.beginPath();
	context.rect(left, -LINE, width, hem + LINE);
	context.clip();
	context.globalAlpha = 0.9;
	context.fillStyle = NET;
	context.fillRect(left, -LINE, width, hem + LINE);
	context.globalAlpha = 1;
	context.lineWidth = 1.2;
	context.strokeStyle = INK;
	context.beginPath();
	for (let y = -width; y < hem; y += NET_MESH) {
		context.moveTo(left, y);
		context.lineTo(left + width, y + width);
		context.moveTo(left + width, y);
		context.lineTo(left, y + width);
	}
	context.stroke();
	context.restore();

	// A drone that has already flown into the net, now tangled up in it
	if (hash(x * 0.37) > 0.45 && hem > 70) {
		const droneY = 30 + hash(x * 0.11) * (hem - 60);
		context.save();
		context.translate(x + COLUMN_WIDTH / 2, droneY);
		context.rotate((hash(x * 0.71) - 0.5) * 0.9);
		context.lineCap = 'round';
		context.lineWidth = 3;
		context.strokeStyle = INK;
		context.beginPath();
		context.moveTo(-11, -5);
		context.lineTo(11, 5);
		context.moveTo(11, -5);
		context.lineTo(-11, 5);
		context.stroke();
		for (const [dx, dy] of [
			[-11, -5],
			[11, 5],
			[11, -5],
			[-11, 5]
		]) {
			context.beginPath();
			context.ellipse(dx, dy - 2, 5, 1.8, 0, 0, Math.PI * 2);
			outlined(context, PAPER);
		}
		box(context, -4, -3, 8, 6, CHAR);
		context.restore();
	}

	// Edge ropes and the weights that keep the net hanging straight
	context.lineWidth = LINE;
	context.strokeStyle = INK;
	context.beginPath();
	for (const edge of [left, left + width]) {
		context.moveTo(edge, 0);
		context.lineTo(edge, hem);
	}
	context.moveTo(left, hem);
	context.lineTo(left + width, hem);
	context.stroke();
	for (let i = 0; i < 4; i++) {
		const sway = Math.sin(time * 2.5 + x * 0.05 + i) * 1.2;
		context.beginPath();
		context.arc(left + (width * i) / 3, hem + 2 + sway, 4, 0, Math.PI * 2);
		outlined(context, OLIVE_DARK);
	}
}

function drawColumn(
	context: CanvasRenderingContext2D,
	column: GapColumn,
	time: number,
	assets: RenderAssets
) {
	const top = assets.supplied.droneNet;
	if (top) context.drawImage(top, column.x, 0, COLUMN_WIDTH, column.gapTop);
	else drawDroneNet(context, column, time);

	const bottomImage = assets.supplied[column.kind === 'radar' ? 'radarMast' : 'pantsirTower'];
	if (bottomImage) {
		context.drawImage(
			bottomImage,
			column.x,
			column.gapBottom,
			COLUMN_WIDTH,
			GROUND_Y - column.gapBottom
		);
	} else if (column.kind === 'radar') drawRadarMast(context, column, time);
	else drawPantsir(context, column);
}

/** A charred, crumpled stump with a jagged top: what is left of any building */
function drawStump(context: CanvasRenderingContext2D, tank: Tank) {
	const left = tank.x - tank.halfWidth;
	const width = tank.halfWidth * 2;
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
}

function drawStorageTank(
	context: CanvasRenderingContext2D,
	tank: Tank,
	isBiggest: boolean,
	assets: RenderAssets
) {
	const left = tank.x - tank.halfWidth;
	const width = tank.halfWidth * 2;
	const top = GROUND_Y - tank.height;
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

/** White letters with a dark edge, so they read on any wall */
function drawLetters(
	context: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	size: number,
	edge: string
) {
	context.font = `800 ${size}px ${DISPLAY_FONT}`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.lineJoin = 'round';
	context.lineWidth = 4;
	context.strokeStyle = edge;
	context.strokeText(text, x, y);
	context.fillStyle = PAPER;
	context.fillText(text, x, y);
}

/** A purple fulfilment hall with roller doors; the bigger ones carry big white letters */
function drawWarehouse(context: CanvasRenderingContext2D, tank: Tank) {
	const left = tank.x - tank.halfWidth;
	const width = tank.halfWidth * 2;
	const top = GROUND_Y - tank.height;
	box(context, left, top, width, tank.height, WB_PURPLE);
	box(context, left - 3, top, width + 6, 9, WB_DARK);

	const doors = Math.max(1, Math.floor(width / 40));
	const doorWidth = Math.min(26, width / doors - 10);
	const gap = (width - doors * doorWidth) / (doors + 1);
	context.lineWidth = 1.5;
	for (let i = 0; i < doors; i++) {
		const doorX = left + gap * (i + 1) + doorWidth * i;
		box(context, doorX, GROUND_Y - 22, doorWidth, 22, PAPER);
		context.lineWidth = 1.5;
		context.beginPath();
		for (const y of [GROUND_Y - 15, GROUND_Y - 8]) {
			context.moveTo(doorX, y);
			context.lineTo(doorX + doorWidth, y);
		}
		context.stroke();
	}

	const wallMiddle = top + 9 + (tank.height - 9 - 22) / 2;
	if (tank.tier >= 2) {
		drawLetters(context, 'WB', tank.x, wallMiddle, tank.tier === 3 ? 30 : 20, WB_DARK);
	} else {
		// A taped-up parcel on the smaller halls
		box(context, tank.x - 7, wallMiddle - 6, 14, 12, PAPER);
		context.lineWidth = 1.5;
		context.beginPath();
		context.moveTo(tank.x, wallMiddle - 6);
		context.lineTo(tank.x, wallMiddle + 6);
		context.stroke();
	}
}

/** A pale server block with a red roof band, rows of blinking racks and a round badge on the big one */
function drawDatacenter(
	context: CanvasRenderingContext2D,
	tank: Tank,
	isBiggest: boolean,
	time: number
) {
	const left = tank.x - tank.halfWidth;
	const width = tank.halfWidth * 2;
	const top = GROUND_Y - tank.height;
	box(context, left, top, width, tank.height, '#e4e8ee');
	box(context, left - 2, top, width + 4, 8, YANDEX_RED);

	const columns = Math.max(1, Math.floor((width - 8) / 12));
	const start = tank.x - (columns * 12 - 4) / 2;
	for (let y = top + 14; y + 8 <= GROUND_Y - 20; y += 12) {
		for (let i = 0; i < columns; i++) {
			const cellX = start + i * 12;
			context.fillStyle = SLATE;
			context.fillRect(cellX, y, 8, 8);
			// Each rack blinks on its own beat
			const lit = Math.sin(time * 4 + hash(cellX * 3.1 + y) * 20) > 0;
			context.fillStyle = lit ? YELLOW : YANDEX_RED;
			context.fillRect(cellX + 5, y + 2, 2, 2);
		}
	}
	box(context, tank.x - 6, GROUND_Y - 14, 12, 14, SLATE);

	if (isBiggest) {
		const radius = Math.min(17, width * 0.22);
		const badgeY = top + 8 + (tank.height - 8) * 0.42;
		context.beginPath();
		context.arc(tank.x, badgeY, radius, 0, Math.PI * 2);
		outlined(context, YANDEX_RED);
		context.font = `800 ${Math.round(radius * 1.5)}px ${DISPLAY_FONT}`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillStyle = PAPER;
		context.fillText('Я', tank.x, badgeY + 1);
	}
}

function drawTank(
	context: CanvasRenderingContext2D,
	tank: Tank,
	isBiggest: boolean,
	destroyed: boolean,
	assets: RenderAssets,
	kind: SiteKind = 'refinery',
	time = 0
) {
	if (destroyed) {
		const image = kind === 'refinery' ? assets.supplied.tankDestroyed : undefined;
		if (image) {
			const top = GROUND_Y - tank.height;
			return context.drawImage(
				image,
				tank.x - tank.halfWidth,
				top,
				tank.halfWidth * 2,
				tank.height
			);
		}
		return drawStump(context, tank);
	}
	if (kind === 'warehouse') drawWarehouse(context, tank);
	else if (kind === 'datacenter') drawDatacenter(context, tank, isBiggest, time);
	else drawStorageTank(context, tank, isBiggest, assets);
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

/** The mast beside a warehouse or datacenter: banded in the company's colors, with a blinking light */
function drawMast(
	context: CanvasRenderingContext2D,
	flare: FlareStack,
	time: number,
	kind: SiteKind
) {
	const rect = flareRect(flare);
	const color = kind === 'warehouse' ? WB_PURPLE : YANDEX_RED;
	box(context, rect.x, rect.y + 8, rect.width, GROUND_Y - rect.y - 8, PAPER);
	context.fillStyle = color;
	for (let y = rect.y + 8; y < GROUND_Y; y += 40) {
		context.fillRect(rect.x + LINE / 2, y, rect.width - LINE, Math.min(20, GROUND_Y - y));
	}
	if (kind === 'datacenter') {
		// Antenna braces in the white sections
		context.lineWidth = 1.5;
		context.strokeStyle = INK;
		context.beginPath();
		for (let y = rect.y + 28; y < GROUND_Y - 20; y += 40) {
			context.moveTo(rect.x + 2, y);
			context.lineTo(rect.x + rect.width - 2, y + 20);
			context.moveTo(rect.x + rect.width - 2, y);
			context.lineTo(rect.x + 2, y + 20);
		}
		context.stroke();
	}
	const on = Math.sin(time * 6) > -0.3;
	context.beginPath();
	context.arc(flare.x, rect.y + 6, 6, 0, Math.PI * 2);
	outlined(context, on ? color : PAPER);
}

const SIGN_FILL: Record<SiteKind, string> = {
	refinery: PAPER,
	warehouse: WB_PURPLE,
	datacenter: YANDEX_RED
};

function drawSign(context: CanvasRenderingContext2D, refinery: Refinery, labels: RenderLabels) {
	const x = refinery.startX - 90;
	const y = GROUND_Y - 96;
	const { kind } = refinery;
	box(context, x + 14, y + 30, 6, 66, KHAKI);
	box(context, x + 100, y + 30, 6, 66, KHAKI);
	context.save();
	context.translate(x + 60, y + 20);
	context.rotate(-0.04);
	box(context, -60, -18, 120, 40, SIGN_FILL[kind]);
	context.fillStyle = kind === 'refinery' ? INK : PAPER;
	context.font = `700 12px ${DISPLAY_FONT}`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.direction = labels.direction;
	const name =
		kind === 'refinery' ? labels.refineryNames[refinery.nameIndex] : labels.siteNames[kind];
	context.fillText(name ?? '', 0, 2, 110);
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
	if (refinery.kind === 'refinery') drawFlare(context, refinery.flare, time, assets);
	else drawMast(context, refinery.flare, time, refinery.kind);
	refinery.tanks.forEach((tank, index) => {
		const destroyed = strike?.destroyed.includes(index) ?? false;
		drawTank(context, tank, index === refinery.biggest, destroyed, assets, refinery.kind, time);
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
	// Weather depends on how far the flamingo has flown, so it is the same on every run of a seed
	const weather = weatherAt(state.seed, cameraX + WORLD_WIDTH / 2);
	drawBackdrop(context, cameraX, weather, effects.reducedMotion ? 0 : state.time);

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

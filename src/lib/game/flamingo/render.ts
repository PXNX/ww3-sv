/*
 * Canvas drawing for Flamingo Flight. All art is generic, original flat placeholder shapes in the
 * app's style (thick ink outlines, flat fills, no gradients) unless owner art is supplied.
 * Destruction is a flat cartoon fireball with black smoke only; no people appear anywhere.
 * Visual effects use their own seeded random, so they never touch the game logic.
 */
import { createRandom, type Random } from '../random';
import type { FlamingoAssetId } from './assets';
import { BRIDGE_OVERHANG, COLUMN_WIDTH, bridgeRect, type GapColumn } from './gapSequence';
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
const WATER = '#2f4a6b';
const WB_PURPLE = '#a21caf';
const WB_DARK = '#701a75';
const YANDEX_RED = '#fc3f1d';
const RAIN = '#5d6e86';
const CHAR = '#3a3a3a';
const BRIDGE_GREY = '#9aa3ad';
const ASPHALT = '#4a525c';
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
	/** Marker over the Crimea bridge, and the pop-up when it comes down */
	bridge: string;
	strikeBridge: string;
	direction: 'ltr' | 'rtl';
}

/**
 * The part of the world on screen, in world units relative to the camera. The field is always all
 * on screen; a screen with another shape shows extra sky, ground or scenery around it.
 */
export interface View {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export const FIELD_VIEW: View = { left: 0, top: 0, right: WORLD_WIDTH, bottom: WORLD_HEIGHT };

/** At most this much shows ahead of the field, so a new segment never pops into sight */
const MAX_LOOKAHEAD = 100;

/** Fits the whole field into a screen of the given size; the extra space shows more of the world */
export function fitView(width: number, height: number): { scale: number; view: View } {
	const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
	const extraX = width / scale - WORLD_WIDTH;
	const extraY = height / scale - WORLD_HEIGHT;
	// Sideways the extra space goes mostly behind the flamingo; upright, half to sky, half to ground
	const ahead = Math.min(extraX / 2, MAX_LOOKAHEAD);
	return {
		scale,
		view: {
			left: ahead - extraX,
			top: -extraY / 2,
			right: WORLD_WIDTH + ahead,
			bottom: WORLD_HEIGHT + extraY / 2
		}
	};
}

/** The view grown on every side, so the screen shake never uncovers an unpainted edge */
function padView(view: View, margin: number): View {
	return {
		left: view.left - margin,
		top: view.top - margin,
		right: view.right + margin,
		bottom: view.bottom + margin
	};
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
			} else if (event.type === 'bridge') {
				// The span blows up from the middle outwards, and the water smokes
				const { x: left, width } = bridgeRect(event.column);
				const middle = left + width / 2;
				const deckY = event.column.gapBottom;
				for (const offset of [0, -0.32, 0.32]) {
					this.fireballs.push({
						x: middle + offset * width,
						y: deckY - 6,
						size: offset === 0 ? 110 : 80,
						age: 0,
						delay: this.reducedMotion ? 0 : Math.abs(offset) * 0.35,
						duration: this.reducedMotion ? 0.4 : 0.9
					});
				}
				const puffs = this.reducedMotion ? 2 : 6;
				for (let i = 0; i < puffs; i++) this.puff(middle, deckY, width * 0.6);
				this.popups.push({ x: middle, y: deckY - 50, text: `+${event.points}`, age: 0 });
				this.popups.push({ x: middle, y: deckY - 80, text: labels.strikeBridge, age: 0 });
				this.popups.push({
					x: middle,
					y: deckY - 110,
					text: labels.slogan,
					age: 0,
					tone: 'slogan'
				});
				if (!this.reducedMotion) this.shake = 14;
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

	update(dt: number, state: FlamingoState, view: View = FIELD_VIEW): void {
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
				for (const column of segment.columns) {
					if (!column.struck) continue;
					const middle = column.x + COLUMN_WIDTH / 2;
					if (middle < cameraX + view.left - 40 - BRIDGE_OVERHANG) continue;
					if (middle > cameraX + view.right + 40 + BRIDGE_OVERHANG) continue;
					this.puff(middle, column.gapBottom + 10, COLUMN_WIDTH);
				}
				if (!segment.strike) continue;
				for (const index of segment.strike.destroyed) {
					const tank = segment.refinery.tanks[index];
					if (tank.x < cameraX + view.left - 40 || tank.x > cameraX + view.right + 40) continue;
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
	/** Wind-blown sand streaks */
	dust: number;
	/** Fog banks */
	haze: number;
	snow: number;
	/** A low, grey lid of cloud that hides the sun */
	overcast: number;
}

export const CLEAR_WEATHER: Weather = { rain: 0, dust: 0, haze: 0, snow: 0, overcast: 0 };

const WEATHER_KINDS = ['rain', 'dust', 'haze', 'snow', 'overcast'] as const;

/** Distance in world units between the centers of two weather zones */
const WEATHER_ZONE = 1500;

/** Each zone gets one kind of weather, or none; the chances add up to the share of zones with any */
const WEATHER_CHANCE: Record<(typeof WEATHER_KINDS)[number], number> = {
	rain: 0.18,
	dust: 0.16,
	haze: 0.14,
	snow: 0.12,
	overcast: 0.12
};

function zoneWeather(seed: number, zone: number): Weather {
	// The take-off area is always clear
	if (zone <= 0) return CLEAR_WEATHER;
	let roll = hash((seed % 9973) + zone * 17.3);
	const strength = 0.6 + 0.4 * hash((seed % 9973) + zone * 5.1);
	for (const kind of WEATHER_KINDS) {
		roll -= WEATHER_CHANCE[kind];
		if (roll < 0) return { ...CLEAR_WEATHER, [kind]: strength };
	}
	return CLEAR_WEATHER;
}

/** The weather over a world position: it drifts smoothly from one zone's weather to the next */
export function weatherAt(seed: number, worldX: number): Weather {
	const position = worldX / WEATHER_ZONE;
	const zone = Math.floor(position);
	const f = position - zone;
	const t = f * f * (3 - 2 * f);
	const from = zoneWeather(seed, zone);
	const to = zoneWeather(seed, zone + 1);
	const weather = { ...CLEAR_WEATHER };
	for (const kind of WEATHER_KINDS) weather[kind] = from[kind] + (to[kind] - from[kind]) * t;
	return weather;
}

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** The colors of the sky and the scenery behind the obstacles at one time of day */
export interface SkyPalette {
	sky: string;
	/** The faraway skyline, a flat silhouette */
	far: string;
	hill: string;
	cloud: string;
	sun: string;
	/** How high the sun stands: 1 at noon, 0 down on the horizon */
	sunHeight: number;
	/** How much night it is, 0 to 1: the moon and stars show and the ground darkens */
	night: number;
}

export const SKY_PALETTES: Record<TimeOfDay, SkyPalette> = {
	dawn: {
		sky: '#e7bfb4',
		far: '#c49a9c',
		hill: '#cfac93',
		cloud: '#fdebe2',
		sun: '#f9a66c',
		sunHeight: 0.25,
		night: 0
	},
	day: {
		sky: SKY,
		far: '#c3c2b2',
		hill: SAND_DARK,
		cloud: PAPER,
		sun: YELLOW,
		sunHeight: 1,
		night: 0
	},
	dusk: {
		sky: '#dd9473',
		far: '#9b6b6f',
		hill: '#b0835f',
		cloud: '#f6cdb0',
		sun: '#ef6a3c',
		sunHeight: 0.15,
		night: 0
	},
	night: {
		sky: '#28324d',
		far: '#3c4767',
		hill: '#58607a',
		cloud: '#5d6782',
		sun: '#f4efd0',
		sunHeight: 1,
		night: 1
	}
};

/** The times of day in the order a long flight goes through them */
const DAY_CYCLE: readonly TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
/** World units flown before the sky moves on to the next time of day */
export const DAY_PHASE_LENGTH = 6000;
/** The last stretch of a phase over which the sky blends into the next one */
const DAY_BLEND = 1500;

/** The time of day a run starts at: day most often, the others now and then */
export function startTimeOfDay(seed: number): TimeOfDay {
	const roll = hash((seed % 9973) * 0.37 + 3.1);
	if (roll < 0.4) return 'day';
	if (roll < 0.6) return 'dawn';
	if (roll < 0.8) return 'dusk';
	return 'night';
}

function blendPalette(from: SkyPalette, to: SkyPalette, t: number): SkyPalette {
	if (t <= 0) return from;
	const number = (a: number, b: number) => a + (b - a) * t;
	return {
		sky: mixColor(from.sky, to.sky, t),
		far: mixColor(from.far, to.far, t),
		hill: mixColor(from.hill, to.hill, t),
		cloud: mixColor(from.cloud, to.cloud, t),
		sun: mixColor(from.sun, to.sun, t),
		sunHeight: number(from.sunHeight, to.sunHeight),
		night: number(from.night, to.night)
	};
}

/**
 * The sky over a world position: a run starts at its seed's time of day, and the sky slowly moves
 * on through the day as the flamingo flies, so a long flight sees dusk and night fall
 */
export function skyAt(seed: number, worldX: number): SkyPalette {
	const start = DAY_CYCLE.indexOf(startTimeOfDay(seed));
	const position = Math.max(0, worldX) / DAY_PHASE_LENGTH;
	const phase = Math.floor(position);
	const into = (position - phase) * DAY_PHASE_LENGTH;
	const from = SKY_PALETTES[DAY_CYCLE[(start + phase) % DAY_CYCLE.length]];
	const to = SKY_PALETTES[DAY_CYCLE[(start + phase + 1) % DAY_CYCLE.length]];
	const f = Math.max(0, (into - (DAY_PHASE_LENGTH - DAY_BLEND)) / DAY_BLEND);
	return blendPalette(from, to, f * f * (3 - 2 * f));
}

function wrap(value: number, length: number): number {
	return ((value % length) + length) % length;
}

/** Blends two #rrggbb colors into a #rrggbb color */
function mixColor(from: string, to: string, t: number): string {
	const channel = (hex: string, index: number) =>
		parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
	let mixed = '#';
	for (let index = 0; index < 3; index++) {
		const value = Math.round(
			channel(from, index) + (channel(to, index) - channel(from, index)) * t
		);
		mixed += value.toString(16).padStart(2, '0');
	}
	return mixed;
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

/** The sun, high at noon and low and big at dawn and dusk */
function drawSun(context: CanvasRenderingContext2D, time: number, fill = YELLOW, height = 1) {
	context.save();
	context.translate(WORLD_WIDTH - 66, GROUND_Y - 110 - height * 402);
	const size = 1 + (1 - height) * 0.35;
	context.scale(size, size);
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
	outlined(context, fill);
	context.restore();
}

/** A crescent moon and a scatter of stars, for the night */
function drawNightSky(
	context: CanvasRenderingContext2D,
	palette: SkyPalette,
	cameraX: number,
	time: number,
	view: View
) {
	const width = view.right - view.left;
	context.save();
	context.globalAlpha = palette.night;
	context.fillStyle = PAPER;
	const stars = Math.ceil((40 * width) / WORLD_WIDTH);
	for (let i = 0; i < stars; i++) {
		const x = view.left + wrap(hash(i + 700) * width - cameraX * 0.05, width);
		const y = view.top + hash(i + 720) * (GROUND_Y - 200 - view.top);
		const size = hash(i + 740) < 0.2 ? 3 : 2;
		context.globalAlpha = palette.night * (0.55 + 0.45 * Math.sin(time * 2 + i * 1.7));
		context.fillRect(x, y, size, size);
	}
	context.globalAlpha = palette.night;
	context.translate(WORLD_WIDTH - 70, 84);
	context.beginPath();
	context.arc(0, 0, 20, 0, Math.PI * 2);
	outlined(context, palette.sun);
	// The dark side of the crescent, in the color of the sky
	context.beginPath();
	context.arc(9, -5, 17, 0, Math.PI * 2);
	context.fillStyle = palette.sky;
	context.fill();
	context.restore();
}

/** A far skyline of steppe, silos, chimneys, pylons and cranes, in one flat color */
function drawSkyline(context: CanvasRenderingContext2D, cameraX: number, fill: string, view: View) {
	const offset = cameraX * 0.18;
	const tile = 90;
	const first = Math.floor((offset + view.left - tile) / tile);
	const last = Math.ceil((offset + view.right + tile) / tile);
	context.fillStyle = fill;
	context.strokeStyle = fill;
	context.lineWidth = 2;
	const base = GROUND_Y - 34;
	context.fillRect(view.left, base, view.right - view.left, GROUND_Y - base);
	for (let k = first; k <= last; k++) {
		const x = k * tile - offset + hash(k + 900) * 40;
		const roll = hash(k + 910);
		context.beginPath();
		if (roll < 0.22) {
			// A grain elevator: a row of silos with a tower
			for (let s = 0; s < 4; s++) context.rect(x + s * 9, base - 46, 8, 46);
			context.rect(x + 36, base - 62, 12, 62);
			context.fill();
		} else if (roll < 0.4) {
			// Two factory chimneys
			context.rect(x, base - 70, 7, 70);
			context.rect(x + 16, base - 54, 7, 54);
			context.rect(x - 6, base - 20, 36, 20);
			context.fill();
		} else if (roll < 0.58) {
			// A power pylon
			context.moveTo(x - 10, base);
			context.lineTo(x, base - 66);
			context.lineTo(x + 10, base);
			context.moveTo(x - 12, base - 50);
			context.lineTo(x + 12, base - 50);
			context.moveTo(x - 9, base - 36);
			context.lineTo(x + 9, base - 36);
			context.stroke();
		} else if (roll < 0.72) {
			// A harbor crane
			context.rect(x, base - 58, 6, 58);
			context.rect(x - 22, base - 60, 46, 4);
			context.rect(x - 22, base - 56, 3, 16);
			context.fill();
		} else {
			// A gentle rise of steppe
			context.moveTo(x - 30, base);
			context.quadraticCurveTo(x + 15, base - 26 - hash(k + 920) * 20, x + 60, base);
			context.fill();
		}
	}
}

/** Fog, wind-blown sand, rain and snow, drawn behind the obstacles so they never hide what can be hit */
function drawWeather(
	context: CanvasRenderingContext2D,
	weather: Weather,
	cameraX: number,
	time: number,
	view: View
) {
	const width = view.right - view.left;
	const sky = GROUND_Y - view.top;
	context.save();
	if (weather.overcast > 0.01) {
		// A low grey lid of cloud along the top of the sky
		context.fillStyle = '#8c939f';
		context.globalAlpha = 0.18 * weather.overcast;
		context.fillRect(view.left, view.top, width, sky);
		context.globalAlpha = 0.55 * weather.overcast;
		const offset = cameraX * 0.35 + time * 4;
		const first = Math.floor((offset + view.left - 120) / 90);
		const last = Math.ceil((offset + view.right + 120) / 90);
		context.beginPath();
		for (let k = first; k <= last; k++) {
			const x = k * 90 - offset;
			context.moveTo(x + 70, 30);
			context.ellipse(x, 30 + hash(k + 600) * 26, 70, 26 + hash(k + 610) * 12, 0, 0, Math.PI * 2);
		}
		context.rect(view.left, view.top, width, 30 - view.top);
		context.fill();
	}
	if (weather.haze > 0.01) {
		context.fillStyle = PAPER;
		context.globalAlpha = 0.14 * weather.haze;
		context.fillRect(view.left, view.top, width, sky);
		// Pale banks of mist drifting past
		context.globalAlpha = 0.3 * weather.haze;
		const banks = Math.ceil((6 * width) / WORLD_WIDTH);
		for (let k = 0; k < banks; k++) {
			const x = wrap(hash(k + 400) * width * 2 - cameraX * 0.25 - time * 6, width + 300);
			context.beginPath();
			context.ellipse(
				view.left + x - 150,
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
			context.fillRect(view.left, top, width, GROUND_Y - top);
		}
		// Wind-blown sand streaks, rushing against the direction of flight
		context.globalAlpha = 0.75 * weather.dust;
		context.strokeStyle = '#c4b270';
		context.lineWidth = 2;
		context.lineCap = 'round';
		context.beginPath();
		const streaks = Math.ceil((34 * weather.dust * width) / WORLD_WIDTH);
		for (let i = 0; i < streaks; i++) {
			const speed = 150 + hash(i + 500) * 110;
			const x =
				view.left +
				wrap(hash(i + 510) * (width + 120) - cameraX * 1.2 - time * speed, width + 120) -
				60;
			const y = 300 + hash(i + 520) * (GROUND_Y - 310);
			context.moveTo(x, y);
			context.lineTo(x + 12 + hash(i + 530) * 26, y);
		}
		context.stroke();
	}
	if (weather.rain > 0.01) {
		context.fillStyle = '#2f3b52';
		context.globalAlpha = 0.16 * weather.rain;
		context.fillRect(view.left, view.top, width, sky);
		context.globalAlpha = 0.6 * weather.rain;
		context.strokeStyle = RAIN;
		context.lineWidth = 1.5;
		context.beginPath();
		// The same density of drops however much sky is on screen
		const drops = Math.ceil((70 * weather.rain * width * sky) / (WORLD_WIDTH * GROUND_Y));
		for (let i = 0; i < drops; i++) {
			const speed = 520 + hash(i + 300) * 180;
			const x =
				view.left + wrap(hash(i) * (width + 80) - cameraX * 0.6 - time * 70, width + 80) - 40;
			const y = view.top + wrap(hash(i + 150) * sky + time * speed, sky + 20) - 20;
			context.moveTo(x, y);
			context.lineTo(x - 4, y + 13);
		}
		context.stroke();
	}
	if (weather.snow > 0.01) {
		context.fillStyle = '#d8dde6';
		context.globalAlpha = 0.12 * weather.snow;
		context.fillRect(view.left, view.top, width, sky);
		// Square flakes drifting down and swaying, a cheap fillRect each
		context.globalAlpha = 0.9 * weather.snow;
		context.fillStyle = PAPER;
		const flakes = Math.ceil((60 * weather.snow * width * sky) / (WORLD_WIDTH * GROUND_Y));
		for (let i = 0; i < flakes; i++) {
			const speed = 30 + hash(i + 800) * 30;
			const sway = Math.sin(time * 1.3 + i) * 8;
			const x =
				view.left + wrap(hash(i + 810) * (width + 40) - cameraX * 0.5 + sway, width + 40) - 20;
			const y = view.top + wrap(hash(i + 820) * sky + time * speed, sky + 10) - 10;
			const size = hash(i + 830) < 0.3 ? 4 : 3;
			context.fillRect(x, y, size, size);
		}
	}
	context.restore();
}

function drawBackdrop(
	context: CanvasRenderingContext2D,
	cameraX: number,
	weather: Weather = CLEAR_WEATHER,
	time = 0,
	view: View = FIELD_VIEW,
	palette: SkyPalette = SKY_PALETTES.day
) {
	context.fillStyle = palette.sky;
	context.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);

	// The sun and moon only show through when it is neither raining nor hazy nor overcast
	const clearSky = 1 - Math.min(1, weather.rain + weather.haze * 0.6 + weather.overcast);
	if (palette.night > 0.02) drawNightSky(context, palette, cameraX, time, view);
	const sun = clearSky * (1 - palette.night);
	if (sun > 0.02) {
		context.globalAlpha = sun;
		drawSun(context, time, palette.sun, palette.sunHeight);
		context.globalAlpha = 1;
	}

	drawSkyline(context, cameraX, palette.far, view);

	const cloudFill = mixColor(
		palette.cloud,
		'#a7aeba',
		Math.min(1, weather.rain + weather.overcast * 0.7) * (1 - palette.night * 0.6)
	);
	const cloudOffset = cameraX * 0.3;
	const first = Math.floor((cloudOffset + view.left - 120) / 200);
	const last = Math.ceil((cloudOffset + view.right) / 200);
	for (let k = first; k <= last; k++) {
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
	const firstHill = Math.floor((hillOffset + view.left - 160) / 140);
	const lastHill = Math.ceil((hillOffset + view.right + 20) / 140);
	for (let k = firstHill; k <= lastHill; k++) {
		const x = k * 140 - hillOffset;
		const height = 30 + hash(k + 31) * 40;
		context.beginPath();
		context.moveTo(x - 20, GROUND_Y);
		context.quadraticCurveTo(x + 70, GROUND_Y - height * 2, x + 160, GROUND_Y);
		outlined(context, palette.hill);
	}

	drawWeather(context, weather, cameraX, time, view);
}

function drawGround(
	context: CanvasRenderingContext2D,
	cameraX: number,
	view: View = FIELD_VIEW,
	palette: SkyPalette = SKY_PALETTES.day,
	weather: Weather = CLEAR_WEATHER
) {
	const width = view.right - view.left;
	// Darker at night, and dusted white where snow is falling
	const ground = mixColor(
		mixColor(SAND, '#8e8f99', palette.night * 0.45),
		PAPER,
		weather.snow * 0.6
	);
	box(context, view.left - LINE, GROUND_Y, width + LINE * 2, view.bottom - GROUND_Y + LINE, ground);
	context.fillStyle = mixColor(MUSTARD, '#8a8160', palette.night * 0.45);
	// One row of dashes in the field; ground showing below it gets more rows, staggered
	for (let row = 0; GROUND_Y + 16 + row * 48 < view.bottom; row++) {
		const start = view.left - wrap(cameraX + view.left + (row % 2) * 20, 40) - 40;
		for (let x = start; x < view.right + 40; x += 40) {
			context.fillRect(x, GROUND_Y + 16 + row * 48, 20, 5);
		}
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

/** The Kerch strait under the bridge: a band of sea along the ground, with a couple of flat waves */
function drawStrait(context: CanvasRenderingContext2D, left: number, width: number, top: number) {
	box(context, left, top, width, GROUND_Y - top + LINE, WATER);
	context.strokeStyle = PAPER;
	context.lineWidth = 2;
	for (const [waveY, phase] of [
		[top + 10, 0],
		[top + 24, 3]
	]) {
		if (waveY > GROUND_Y - 4) continue;
		context.beginPath();
		for (let step = 6; step <= width - 6; step += 6) {
			const y = waveY + Math.sin((step + phase) / 5) * 1.5;
			if (step === 6) context.moveTo(left + step, y);
			else context.lineTo(left + step, y);
		}
		context.stroke();
	}
}

/** A slim concrete pier of the long viaduct, from the deck down into the sea */
function drawPier(context: CanvasRenderingContext2D, x: number, top: number, halfWidth = 4) {
	box(context, x - halfWidth, top, halfWidth * 2, GROUND_Y - top, STEEL);
}

/** A heavy pier under an end of the arch: wider, with a cap the arch rests on */
function drawArchPier(context: CanvasRenderingContext2D, x: number, top: number) {
	box(context, x - 7, top + 4, 14, GROUND_Y - top - 4, STEEL);
	box(context, x - 10, top, 20, 6, BRIDGE_GREY);
}

/** The far, railway deck: a thinner girder with sleepers, drawn from 0 to length along the x axis */
function drawRailDeck(context: CanvasRenderingContext2D, length: number, fill = BRIDGE_GREY) {
	box(context, 0, 0, length, 6, fill);
	context.fillStyle = INK;
	for (let tieX = 3; tieX < length - 2; tieX += 6) context.fillRect(tieX, -2, 2, 2);
}

/** The near, road deck: a grey girder carrying the asphalt, drawn from 0 to length along the x axis */
function drawDeck(context: CanvasRenderingContext2D, length: number) {
	box(context, 0, 0, length, 9, BRIDGE_GREY);
	box(context, 0, -4, length, 4, ASPHALT);
	context.fillStyle = PAPER;
	for (let dashX = 4; dashX < length - 4; dashX += 10) context.fillRect(dashX, -2.5, 5, 1.5);
}

/** Height of the arch's top chord above its springing points, for t from -1 (left) to 1 (right) */
function archRise(t: number, rise: number): number {
	return rise * (1 - t * t);
}

/**
 * One trussed steel arch of the Kerch bridge, springing from the deck at middle - half and
 * middle + half: a top and a bottom chord with zigzag bracing between them. Only the part from
 * t0 to t1 is drawn, so a broken arch can be drawn half by half.
 */
function drawArch(
	context: CanvasRenderingContext2D,
	middle: number,
	baseY: number,
	half: number,
	rise: number,
	fill: string,
	t0 = -1,
	t1 = 1
) {
	const steps = 12;
	const point = (t: number, depth: number) => ({
		x: middle + t * half,
		y: baseY - archRise(t, rise) + depth * (1 - t * t * 0.6)
	});
	const along = (i: number) => t0 + ((t1 - t0) * i) / steps;
	context.beginPath();
	for (let i = 0; i <= steps; i++) {
		const p = point(along(i), 0);
		if (i === 0) context.moveTo(p.x, p.y);
		else context.lineTo(p.x, p.y);
	}
	for (let i = steps; i >= 0; i--) {
		const p = point(along(i), 5);
		context.lineTo(p.x, p.y);
	}
	context.closePath();
	outlined(context, fill);
	// The bracing that makes it read as a truss
	context.lineWidth = 1.5;
	context.beginPath();
	for (let i = 0; i < steps; i++) {
		const a = point(along(i), i % 2 === 0 ? 0 : 5);
		const b = point(along(i + 1), i % 2 === 0 ? 5 : 0);
		context.moveTo(a.x, a.y);
		context.lineTo(b.x, b.y);
	}
	context.stroke();
}

/** Vertical hangers from the arch down to the deck */
function drawHangers(
	context: CanvasRenderingContext2D,
	middle: number,
	deckY: number,
	half: number,
	rise: number
) {
	context.strokeStyle = INK;
	context.lineWidth = 1.5;
	context.beginPath();
	for (let i = 1; i < 8; i++) {
		const t = -1 + (i * 2) / 8;
		context.moveTo(middle + t * half, deckY - 4);
		context.lineTo(middle + t * half, deckY - archRise(t, rise) + 5 * (1 - t * t * 0.6));
	}
	context.stroke();
}

/** A pulsing red crosshair: this one is meant to be hit */
function drawCrosshair(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	time: number
) {
	const pulse = radius * (1 + Math.sin(time * 6) * 0.08);
	context.save();
	context.lineWidth = 3;
	context.strokeStyle = TIE_RED;
	context.beginPath();
	context.arc(x, y, pulse, 0, Math.PI * 2);
	context.stroke();
	context.beginPath();
	context.arc(x, y, pulse * 0.45, 0, Math.PI * 2);
	context.stroke();
	context.beginPath();
	for (const [dx, dy] of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	]) {
		context.moveTo(x + dx * pulse * 0.7, y + dy * pulse * 0.7);
		context.lineTo(x + dx * pulse * 1.3, y + dy * pulse * 1.3);
	}
	context.stroke();
	context.restore();
}

/** How far the long, low viaduct visibly runs on past the target on either side; scenery only */
const VIADUCT_RUN = 60;
/** Distance between two piers of the viaduct */
const PIER_SPACING = 15;
/** Half the span of the steel arches over the shipping channel */
const ARCH_HALF = 38;

/** The viaduct running on into the distance on one side, fading out pier by pier */
function drawViaductRun(
	context: CanvasRenderingContext2D,
	from: number,
	direction: 1 | -1,
	deckY: number
) {
	context.save();
	for (let k = 0; k < VIADUCT_RUN / PIER_SPACING; k++) {
		context.globalAlpha = 0.55 * (1 - k / (VIADUCT_RUN / PIER_SPACING));
		const start = from + direction * k * PIER_SPACING;
		const end = start + direction * PIER_SPACING;
		drawPier(context, (start + end) / 2, deckY + 2, 3);
		context.save();
		context.translate(Math.min(start, end), deckY - 7);
		drawRailDeck(context, PIER_SPACING);
		context.restore();
		context.save();
		context.translate(Math.min(start, end), deckY);
		drawDeck(context, PIER_SPACING);
		context.restore();
	}
	context.restore();
}

/**
 * The rare Crimea (Kerch) bridge: not an obstacle but a big bonus target, wider than a column,
 * with open sky above and a crosshair on it. It reads as the real one: a long, low road and rail
 * viaduct on many slim piers across the strait, with the twin steel arches (the railway's behind,
 * the road's in front) over the shipping channel. Once struck, the road arch is broken in two,
 * the road spans hang into the sea and the rail deck is burnt through.
 */
function drawBridge(
	context: CanvasRenderingContext2D,
	column: GapColumn,
	time: number,
	label: string
) {
	const { x: left, y: archTop, width } = bridgeRect(column);
	const right = left + width;
	const middle = left + width / 2;
	const deckY = column.gapBottom;
	const rise = deckY - archTop - 2;
	const seaTop = Math.max(deckY + 16, GROUND_Y - 40);
	const springLeft = middle - ARCH_HALF;
	const springRight = middle + ARCH_HALF;

	drawViaductRun(context, left, -1, deckY);
	drawViaductRun(context, right, 1, deckY);
	for (const pierX of [left + 7, right - 7]) drawPier(context, pierX, deckY + 2);
	for (const pierX of [springLeft, springRight]) drawArchPier(context, pierX, deckY + 2);
	drawStrait(context, left - VIADUCT_RUN, width + VIADUCT_RUN * 2, seaTop);

	if (column.struck) {
		// The railway: its arch still stands, scorched, but its deck is burnt through in the middle
		drawArch(context, middle + 4, deckY - 7, ARCH_HALF, rise - 4, CHAR);
		for (const [from, to] of [
			[left, middle - 12],
			[middle + 16, right]
		]) {
			context.save();
			context.translate(from, deckY - 7);
			drawRailDeck(context, to - from, CHAR);
			context.restore();
		}
		// The road approaches still stand up to the arch piers
		for (const [from, to] of [
			[left, springLeft],
			[springRight, right]
		]) {
			context.save();
			context.translate(from, deckY);
			drawDeck(context, to - from);
			context.restore();
		}
		// The road arch is snapped at the crown, each half sagging off its pier
		for (const side of [-1, 1] as const) {
			const springX = side < 0 ? springLeft : springRight;
			context.save();
			context.translate(springX, deckY);
			context.rotate(-side * 0.32);
			context.translate(-springX, -deckY);
			if (side < 0) drawArch(context, middle, deckY, ARCH_HALF, rise, STEEL, -1, -0.12);
			else drawArch(context, middle, deckY, ARCH_HALF, rise, STEEL, 0.12, 1);
			context.restore();
		}
		// And the road spans under it hang from the arch piers down into the sea
		const length = ARCH_HALF - 3;
		const drop = Math.min(1.3, Math.atan2(seaTop + 8 - deckY, length));
		for (const side of [-1, 1] as const) {
			context.save();
			context.translate(side < 0 ? springLeft : springRight, deckY);
			// Mirrored on the right, so both spans tip towards the channel and down
			if (side > 0) context.scale(-1, 1);
			context.rotate(drop);
			drawDeck(context, length);
			context.restore();
		}
		// A thin plume of smoke still rising from the break
		context.save();
		context.globalAlpha = 0.55;
		context.fillStyle = SMOKE;
		for (let i = 0; i < 3; i++) {
			const rising = (time * 0.4 + i / 3) % 1;
			context.beginPath();
			context.arc(
				middle + Math.sin(time + i * 2) * 4 + rising * 10,
				deckY - 10 - rising * 60,
				5 + rising * 9,
				0,
				Math.PI * 2
			);
			context.fill();
		}
		context.restore();
		return;
	}

	// The railway, behind: its deck and its arch, set a little higher and further back
	context.save();
	context.translate(left, deckY - 7);
	drawRailDeck(context, width);
	context.restore();
	drawArch(context, middle + 4, deckY - 7, ARCH_HALF, rise - 4, BRIDGE_GREY);

	// The road, in front: hangers, deck and its arch over the shipping channel
	drawHangers(context, middle, deckY, ARCH_HALF, rise);
	context.save();
	context.translate(left, deckY);
	drawDeck(context, width);
	context.restore();
	drawArch(context, middle, deckY, ARCH_HALF, rise, PAPER);

	drawCrosshair(context, middle, deckY - 2, 18, time);
	drawTargetMarker(context, middle, archTop - 16, time, label);
}

const NET_MESH = 20;

/** A drone net hanging from the sky: a diamond mesh on edge ropes, weighted along the hem */
function drawDroneNet(
	context: CanvasRenderingContext2D,
	column: GapColumn,
	time: number,
	top: number
) {
	const { x, gapTop } = column;
	const left = x + 4;
	const width = COLUMN_WIDTH - 8;
	const hem = gapTop - 8;

	context.save();
	context.beginPath();
	context.rect(left, top - LINE, width, hem - top + LINE);
	context.clip();
	context.globalAlpha = 0.9;
	context.fillStyle = NET;
	context.fillRect(left, top - LINE, width, hem - top + LINE);
	context.globalAlpha = 1;
	context.lineWidth = 1.2;
	context.strokeStyle = INK;
	context.beginPath();
	// The mesh stays put in the world however far up the screen reaches
	const meshTop = -width - Math.ceil(Math.max(0, -top) / NET_MESH) * NET_MESH;
	for (let y = meshTop; y < hem; y += NET_MESH) {
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
		context.moveTo(edge, top);
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

const BALLOON_HEIGHT = 44;

function drawBalloonStack(context: CanvasRenderingContext2D, column: GapColumn, top: number) {
	const { x, gapTop } = column;
	const middle = x + COLUMN_WIDTH / 2;
	context.lineWidth = 2;
	context.strokeStyle = INK;
	context.beginPath();
	context.moveTo(middle, top);
	context.lineTo(middle, gapTop);
	context.stroke();
	// Absurdly, the balloons are stacked all the way up to the sky
	for (let bottom = gapTop; bottom > top - BALLOON_HEIGHT; bottom -= BALLOON_HEIGHT) {
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
		outlined(context, NET);
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
	assets: RenderAssets,
	/** Top of the screen: the hanging obstacles reach all the way up to it */
	top: number,
	labels: RenderLabels
) {
	if (column.kind === 'bridge') {
		drawBridge(context, column, time, labels.bridge);
		return;
	}
	const net = assets.supplied.droneNet;
	if (column.top === 'balloon') drawBalloonStack(context, column, top);
	else if (net) context.drawImage(net, column.x, top, COLUMN_WIDTH, column.gapTop - top);
	else drawDroneNet(context, column, time, top);

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
	drawTargetMarker(context, tank.x, GROUND_Y - tank.height - 20, time, label);
}

/** A bobbing yellow arrow with a label, pointing down at a target whose top is at bottom */
function drawTargetMarker(
	context: CanvasRenderingContext2D,
	x: number,
	bottom: number,
	time: number,
	label: string
) {
	const y = bottom - 14 + Math.sin(time * 5) * 4;
	context.beginPath();
	context.moveTo(x - 10, y);
	context.lineTo(x + 10, y);
	context.lineTo(x, y + 14);
	context.closePath();
	outlined(context, YELLOW);
	context.font = `700 12px ${DISPLAY_FONT}`;
	context.textAlign = 'center';
	context.textBaseline = 'bottom';
	context.lineWidth = 4;
	context.strokeStyle = PAPER;
	context.strokeText(label, x, y - 2);
	context.fillStyle = INK;
	context.fillText(label, x, y - 2);
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

/**
 * Draws the whole scene in world units, filling the given view; the caller scales and shifts the
 * context so the view covers the canvas (see fitView)
 */
export function drawScene(
	context: CanvasRenderingContext2D,
	state: FlamingoState,
	effects: FlamingoEffects,
	assets: RenderAssets,
	labels: RenderLabels,
	view: View = FIELD_VIEW
): void {
	const cameraX = state.x - FLAMINGO_SCREEN_X;
	const painted = padView(view, 16);
	const shakeX = effects.shake ? Math.sin(state.time * 90) * effects.shake : 0;
	const shakeY = effects.shake ? Math.cos(state.time * 70) * effects.shake * 0.6 : 0;

	context.save();
	context.translate(shakeX, shakeY);
	// Weather depends on how far the flamingo has flown, so it is the same on every run of a seed
	const weather = weatherAt(state.seed, cameraX + WORLD_WIDTH / 2);
	const palette = skyAt(state.seed, cameraX + WORLD_WIDTH / 2);
	drawBackdrop(context, cameraX, weather, effects.reducedMotion ? 0 : state.time, painted, palette);

	context.save();
	context.translate(-cameraX, 0);
	const current = currentSegment(state);
	const dive = state.stage === 'approach' ? predictDive(state) : null;
	const target = dive?.kind === 'tank' ? dive.index : null;
	const left = cameraX + view.left - 80;
	const right = cameraX + view.right + 80;
	for (const segment of state.segments) {
		drawRefinery(context, segment, segment === current ? target : null, state.time, assets, labels);
		for (const column of segment.columns) {
			// A bridge reaches past its column, and its viaduct further still
			const reach = column.kind === 'bridge' ? BRIDGE_OVERHANG + VIADUCT_RUN : 0;
			if (column.x + COLUMN_WIDTH + reach < left || column.x - reach > right) continue;
			drawColumn(context, column, state.time, assets, painted.top, labels);
		}
	}
	context.restore();

	drawGround(context, cameraX, painted, palette, weather);

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

/*
 * Weather drawing: a tint on the ground (wet road, a dusting of snow) before the units, and a sky
 * layer of fog banks, rain or snowflakes over everything. All particles are a pure function of the
 * game time (no Math.random in a frame) and their number scales with the visible slice of the
 * field, because the tall maps scroll.
 */
import { WORLD_WIDTH, type WeatherKind } from './config';
import { clamp, hash01, polyline, smoothstep, type Ctx } from './drawKit';
import type { DroneWallMap } from './maps';

/** How long a new weather takes to fade in */
const FADE_IN_MS = 2500;

/** 0 for clear weather, rising to 1 over the first seconds of any other weather */
export function weatherIntensity(weather: WeatherKind, weatherMs: number): number {
	if (weather === 'clear') return 0;
	return smoothstep(clamp(weatherMs / FADE_IN_MS, 0, 1));
}

const mod = (value: number, size: number) => ((value % size) + size) % size;

/** Wet road, snowy field: drawn right after the field, below the defenses and the crowd */
export function drawWeatherGround(
	ctx: Ctx,
	map: DroneWallMap,
	weather: WeatherKind,
	intensity: number,
	top: number,
	bottom: number
) {
	if (intensity <= 0 || (weather !== 'rain' && weather !== 'snow')) return;
	const rain = weather === 'rain';
	ctx.fillStyle = rain
		? `rgba(40,60,90,${0.06 * intensity})`
		: `rgba(255,255,255,${0.22 * intensity})`;
	ctx.fillRect(0, top, WORLD_WIDTH, bottom - top);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'butt';
	polyline(ctx, map.points);
	ctx.lineWidth = 32;
	ctx.strokeStyle = rain
		? `rgba(40,60,90,${0.16 * intensity})`
		: `rgba(255,255,255,${0.14 * intensity})`;
	ctx.stroke();
}

function drawFog(ctx: Ctx, t: number, intensity: number, top: number, bottom: number) {
	// An overall haze first
	ctx.fillStyle = `rgba(222,226,231,${0.22 * intensity})`;
	ctx.fillRect(0, top, WORLD_WIDTH, bottom - top);
	// Banks drifting slowly sideways, each a few stacked soft ellipses
	const spacing = 150;
	const first = Math.floor((top - 120) / spacing);
	const last = Math.ceil((bottom + 120) / spacing);
	for (let row = first; row <= last; row++) {
		for (let k = 0; k < 2; k++) {
			const seed = row * 2 + k;
			const speed = (5 + hash01(seed + 99) * 8) * (seed % 2 === 0 ? 1 : -1);
			const span = WORLD_WIDTH + 360;
			const x = mod(hash01(seed) * span + (t / 1000) * speed, span) - 180;
			const y = row * spacing + hash01(seed + 7) * 70 + Math.sin(t / 4000 + seed) * 6;
			const rx = 85 + hash01(seed + 3) * 70;
			const ry = 24 + hash01(seed + 5) * 20;
			for (let layer = 0; layer < 3; layer++) {
				const shrink = 1 - layer * 0.28;
				ctx.beginPath();
				ctx.ellipse(x, y, rx * shrink, ry * shrink, 0, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(238,240,244,${0.1 * intensity})`;
				ctx.fill();
			}
		}
	}
}

function drawRain(ctx: Ctx, t: number, intensity: number, top: number, bottom: number) {
	const height = bottom - top;
	const count = Math.round((WORLD_WIDTH * height) / 2200);
	ctx.fillStyle = `rgba(60,80,112,${0.12 * intensity})`;
	ctx.fillRect(0, top, WORLD_WIDTH, height);

	// Slanted streaks falling toward the bottom left, all in one path
	const slant = 0.22;
	const cycle = height + 40;
	ctx.beginPath();
	for (let i = 0; i < count; i++) {
		const speed = 420 + hash01(i * 3 + 2) * 220;
		const y = top - 20 + mod(hash01(i * 3 + 3) * cycle + (t / 1000) * speed, cycle);
		const x = hash01(i * 3 + 1) * (WORLD_WIDTH + slant * cycle + 20) - slant * (y - top);
		ctx.moveTo(x + slant * 14, y - 14);
		ctx.lineTo(x, y);
	}
	// A dark under-stroke keeps the streaks readable on light fields, a light one on dark fields
	ctx.lineCap = 'round';
	ctx.lineWidth = 2.6;
	ctx.strokeStyle = `rgba(50,75,120,${0.3 * intensity})`;
	ctx.stroke();
	ctx.lineWidth = 1.2;
	ctx.strokeStyle = `rgba(228,240,255,${0.85 * intensity})`;
	ctx.stroke();
	ctx.lineCap = 'butt';

	// Splash rings on the ground, tied to the world so they stay put while the view scrolls
	const cell = 52;
	for (let row = Math.floor(top / cell); row <= Math.ceil(bottom / cell); row++) {
		for (let col = 0; col <= Math.ceil(WORLD_WIDTH / cell); col++) {
			const seed = row * 131 + col * 7 + 5;
			if (hash01(seed) > 0.5) continue;
			const life = (t / 750 + hash01(seed + 1) * 5) % 1;
			if (life > 0.6) continue;
			const p = life / 0.6;
			const x = col * cell + hash01(seed + 2) * cell;
			const y = row * cell + hash01(seed + 3) * cell;
			ctx.beginPath();
			ctx.ellipse(x, y, 1.5 + p * 6, (1.5 + p * 6) * 0.45, 0, 0, Math.PI * 2);
			ctx.lineWidth = 1.2;
			ctx.strokeStyle = `rgba(236,246,255,${0.65 * (1 - p) * intensity})`;
			ctx.stroke();
		}
	}
}

function drawSnow(ctx: Ctx, t: number, intensity: number, top: number, bottom: number) {
	const height = bottom - top;
	const area = WORLD_WIDTH * height;
	ctx.fillStyle = `rgba(205,228,255,${0.1 * intensity})`;
	ctx.fillRect(0, top, WORLD_WIDTH, height);
	const cycle = height + 12;
	// Two sizes of flakes: the small ones are far away and drift slower
	for (const [radius, count, base, spread, seedOffset] of [
		[1.3, Math.round(area / 1700), 18, 14, 0],
		[2.4, Math.round(area / 4200), 32, 18, 5000]
	] as const) {
		ctx.beginPath();
		for (let i = 0; i < count; i++) {
			const seed = i * 4 + seedOffset;
			const speed = base + hash01(seed + 2) * spread;
			const y = top - 6 + mod(hash01(seed + 3) * cycle + (t / 1000) * speed, cycle);
			const sway =
				Math.sin((t / 1000) * (0.7 + hash01(seed + 4)) + hash01(seed + 1) * 40) * (7 + radius * 3);
			const x = hash01(seed + 1) * (WORLD_WIDTH + 20) - 10 + sway;
			ctx.moveTo(x + radius, y);
			ctx.arc(x, y, radius, 0, Math.PI * 2);
		}
		ctx.fillStyle = `rgba(255,255,255,${0.95 * intensity})`;
		ctx.fill();
		ctx.lineWidth = 0.8;
		ctx.strokeStyle = `rgba(110,140,185,${0.5 * intensity})`;
		ctx.stroke();
	}
}

/** The weather layer over the whole field slice [top, bottom] (world units) */
export function drawWeatherSky(
	ctx: Ctx,
	weather: WeatherKind,
	intensity: number,
	timeMs: number,
	top: number,
	bottom: number
) {
	if (intensity <= 0) return;
	if (weather === 'fog') drawFog(ctx, timeMs, intensity, top, bottom);
	else if (weather === 'rain') drawRain(ctx, timeMs, intensity, top, bottom);
	else if (weather === 'snow') drawSnow(ctx, timeMs, intensity, top, bottom);
}

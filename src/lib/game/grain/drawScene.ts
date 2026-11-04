/*
 * Grain Corridor renderer. Pure drawing: it reads the game state and the effects and paints a
 * night sea in the 640 x 420 world, scaled to fit the canvas (the sea and the banks carry on past
 * the world edges, so no letterbox bars show). Static scenery is keyed to the distance sailed,
 * so it scrolls with the water and parallax layers move at different rates.
 */
import {
	BUOY_RADIUS,
	CRATE_RADIUS,
	DRONE_RADIUS,
	MINE_RADIUS,
	PATROL_RADIUS,
	SHIPS,
	SHIP_Y,
	SWEEPER_RADIUS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	type ShipId
} from './config.js';
import { FLASH_MS, SHAKE_MS, type Fx } from './effects.js';
import { corridor, waveAt, waveThreat, type Entity, type GrainState } from './state.js';

export interface SceneOptions {
	/** Canvas size in CSS pixels */
	width: number;
	height: number;
	/** performance.now(): drives bobbing, pulses and blinking */
	timeMs: number;
	/** Seconds since the last logic step, to smooth the scroll between steps */
	ahead: number;
	reducedMotion: boolean;
	fx: Fx;
	/** The port gate banner text */
	portLabel: string;
}

export interface WorldView {
	scale: number;
	left: number;
	top: number;
}

/** The fit of the 640 x 420 world on a canvas, centred */
export function worldView(width: number, height: number): WorldView {
	const scale = Math.max(0.1, Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT));
	return {
		scale,
		left: (width - WORLD_WIDTH * scale) / 2,
		top: (height - WORLD_HEIGHT * scale) / 2
	};
}

/** World x under a canvas x */
export function worldXAt(view: WorldView, canvasX: number): number {
	return (canvasX - view.left) / view.scale;
}

function hash(n: number): number {
	const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return v - Math.floor(v);
}

function clamp01(v: number): number {
	return Math.min(1, Math.max(0, v));
}

/* ------------------------------------------------------------------------- sea and banks */

function drawSea(
	ctx: CanvasRenderingContext2D,
	b: Bounds,
	dist: number,
	t: number,
	camShift: number,
	storm: number,
	reduced: boolean
) {
	const sky = ctx.createLinearGradient(0, b.y0, 0, b.y1);
	sky.addColorStop(0, storm > 0 ? '#06121f' : '#07223d');
	sky.addColorStop(1, storm > 0 ? '#0b2c46' : '#0d4a6b');
	ctx.fillStyle = sky;
	ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);

	// Moonlight on the water
	const moon = ctx.createRadialGradient(
		WORLD_WIDTH * 0.7,
		b.y0 + 40,
		10,
		WORLD_WIDTH * 0.7,
		b.y0 + 40,
		420
	);
	moon.addColorStop(0, `rgba(190,225,255,${0.16 - storm * 0.08})`);
	moon.addColorStop(1, 'rgba(190,225,255,0)');
	ctx.fillStyle = moon;
	ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);

	// Three layers of swell, the far one slow and faint, the near one fast and bright
	const layers = [
		{ spacing: 52, speed: 0.3, amp: 2.2, alpha: 0.07, parallax: 0.3 },
		{ spacing: 36, speed: 0.62, amp: 3, alpha: 0.1, parallax: 0.6 },
		{ spacing: 26, speed: 1, amp: 3.6, alpha: 0.14, parallax: 1 }
	];
	ctx.lineWidth = 1.4;
	for (const layer of layers) {
		const scroll = dist * layer.speed;
		const offset = scroll % layer.spacing;
		const base = Math.floor(scroll / layer.spacing);
		ctx.strokeStyle = `rgba(190,230,255,${layer.alpha + storm * 0.05})`;
		ctx.beginPath();
		const amp = layer.amp * (1 + storm * 0.9);
		for (let k = -1; b.y0 + offset + k * layer.spacing < b.y1; k++) {
			const y = b.y0 + offset + k * layer.spacing;
			const row = k - base;
			const phase = reduced ? row * 1.7 : row * 1.7 + (t / 1100) * (row % 2 === 0 ? 1 : -1);
			const shift = camShift * layer.parallax;
			const x0 = b.x0 - 20;
			ctx.moveTo(x0, y + Math.sin(x0 / 54 + phase) * amp);
			for (let x = x0 + 22; x < b.x1 + 20; x += 22) {
				ctx.lineTo(x, y + Math.sin((x - shift) / 54 + phase) * amp);
			}
		}
		ctx.stroke();
	}
}

interface Bounds {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

function coastX(side: -1 | 1, left: number, right: number, u: number): number {
	const wobble = 3 + 3 * Math.sin(u / 31) + 2 * Math.sin(u / 13 + 2);
	return side < 0 ? left - wobble : right + wobble;
}

function drawBanks(
	ctx: CanvasRenderingContext2D,
	b: Bounds,
	dist: number,
	t: number,
	reduced: boolean
) {
	const { left, right } = corridor(dist);
	for (const side of [-1, 1] as const) {
		const far = side < 0 ? b.x0 - 30 : b.x1 + 30;
		const path = new Path2D();
		path.moveTo(far, b.y0 - 12);
		for (let y = b.y0 - 12; y <= b.y1 + 12; y += 12) {
			path.lineTo(coastX(side, left, right, y - dist), y);
		}
		path.lineTo(far, b.y1 + 12);
		path.closePath();
		const edge = new Path2D();
		for (let y = b.y0 - 12; y <= b.y1 + 12; y += 12) {
			const x = coastX(side, left, right, y - dist);
			if (y === b.y0 - 12) edge.moveTo(x, y);
			else edge.lineTo(x, y);
		}
		// Shallows, then the land, then the surf line along the shore
		ctx.save();
		ctx.lineWidth = 16;
		ctx.lineJoin = 'round';
		ctx.strokeStyle = 'rgba(110,200,215,0.16)';
		ctx.stroke(edge);
		ctx.lineWidth = 8;
		ctx.strokeStyle = 'rgba(110,200,215,0.2)';
		ctx.stroke(edge);
		ctx.fillStyle = '#14231c';
		ctx.fill(path);
		ctx.fillStyle = 'rgba(40,70,48,0.35)';
		ctx.save();
		ctx.clip(path);
		ctx.fillRect(side < 0 ? left - 120 : right + 40, b.y0, 80, b.y1 - b.y0);
		ctx.restore();
		ctx.lineWidth = 2.2;
		ctx.setLineDash([10, 8]);
		ctx.lineDashOffset = reduced ? 0 : -t / 60;
		ctx.strokeStyle = 'rgba(255,255,255,0.4)';
		ctx.stroke(edge);
		ctx.restore();

		// Scenery keyed to the sea so it scrolls: town lights, rocks, pines and a lighthouse
		const spacing = 70;
		const from = Math.floor((b.y0 - dist) / spacing) - 1;
		const to = Math.floor((b.y1 - dist) / spacing) + 1;
		for (let n = from; n <= to; n++) {
			const h = hash(n * 2 + (side < 0 ? 0 : 1));
			const y = n * spacing + dist + hash(n + 9) * 30;
			const inland = 16 + hash(n + 3) * 70;
			const x = coastX(side, left, right, y - dist) + side * inland;
			if (h < 0.35) continue;
			if (h < 0.6) {
				for (let i = 0; i < 3; i++) {
					const flick = reduced ? 1 : 0.7 + 0.3 * Math.sin(t / 300 + n * 3 + i * 2);
					ctx.fillStyle = `rgba(255,214,120,${0.85 * flick})`;
					ctx.fillRect(x + side * i * 6, y + (i % 2) * 5, 2.6, 2.6);
				}
			} else if (h < 0.8) {
				ctx.fillStyle = '#2c3a35';
				ctx.beginPath();
				ctx.ellipse(x, y, 9, 6, 0.4, 0, Math.PI * 2);
				ctx.fill();
			} else if (h < 0.95) {
				ctx.fillStyle = '#0d3322';
				ctx.beginPath();
				ctx.moveTo(x, y - 14);
				ctx.lineTo(x + 7, y + 3);
				ctx.lineTo(x - 7, y + 3);
				ctx.closePath();
				ctx.fill();
			} else {
				// A lighthouse sweeping its beam across the water
				ctx.fillStyle = '#d9d4c7';
				ctx.fillRect(x - 3, y - 18, 6, 18);
				ctx.fillStyle = '#c0392b';
				ctx.fillRect(x - 3.5, y - 12, 7, 3);
				if (!reduced) {
					const angle = t / 900 + n;
					const beam = ctx.createRadialGradient(x, y - 18, 2, x, y - 18, 160);
					beam.addColorStop(0, 'rgba(255,244,180,0.35)');
					beam.addColorStop(1, 'rgba(255,244,180,0)');
					ctx.fillStyle = beam;
					ctx.beginPath();
					ctx.moveTo(x, y - 18);
					ctx.arc(x, y - 18, 160, angle - 0.14, angle + 0.14);
					ctx.closePath();
					ctx.fill();
				}
				ctx.fillStyle = '#fff6c2';
				ctx.beginPath();
				ctx.arc(x, y - 19, 2.4, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}

/** The gate across the channel where a port takes the hold */
function drawPort(
	ctx: CanvasRenderingContext2D,
	state: GrainState,
	dist: number,
	t: number,
	label: string,
	reduced: boolean
) {
	const y = SHIP_Y - (state.nextMilestone - dist);
	if (y < -50 || y > WORLD_HEIGHT + 60) return;
	const { left, right } = corridor(dist);
	// Quays reaching into the channel from both banks, with cranes
	for (const side of [-1, 1]) {
		const x = side < 0 ? left : right;
		ctx.fillStyle = '#3a3f45';
		ctx.fillRect(side < 0 ? x - 160 : x - 28, y - 10, 188, 22);
		ctx.fillStyle = '#e3b23c';
		ctx.fillRect(x + side * -22 - 2, y - 38, 4, 32);
		ctx.fillRect(x + side * -22 - 2, y - 38, side * -34, 3);
		ctx.fillRect(x + side * -56, y - 38, 1.5, 16);
	}
	// A line of lanterns, chequered buoys between the quays
	const count = Math.max(2, Math.floor((right - left) / 26));
	for (let i = 0; i <= count; i++) {
		const x = left + 14 + ((right - left - 28) * i) / count;
		const lit = reduced ? true : Math.sin(t / 260 + i * 0.9) > -0.2;
		ctx.fillStyle = i % 2 === 0 ? '#f6f1e3' : '#d6452f';
		ctx.beginPath();
		ctx.arc(x, y, 4.2, 0, Math.PI * 2);
		ctx.fill();
		if (lit) {
			ctx.fillStyle = 'rgba(255,225,120,0.5)';
			ctx.beginPath();
			ctx.arc(x, y - 5, 5.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.font = '800 15px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineWidth = 4;
	ctx.strokeStyle = 'rgba(5,12,20,0.9)';
	ctx.strokeText(label, WORLD_WIDTH / 2, y - 20);
	ctx.fillStyle = '#ffe9a0';
	ctx.fillText(label, WORLD_WIDTH / 2, y - 20);
}

/* ---------------------------------------------------------------------------- the entities */

function circle(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	fill: string | CanvasGradient
) {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}

function drawMine(
	ctx: CanvasRenderingContext2D,
	e: Entity,
	y: number,
	t: number,
	reduced: boolean
) {
	const r = MINE_RADIUS;
	const bob = reduced ? 0 : Math.sin(t / 520 + e.id * 1.7) * 1.6;
	// A mine that is closing on the ship pulses faster and redder
	const urgency = y < SHIP_Y ? clamp01(1 - (SHIP_Y - y) / 260) : 0;
	const period = 1000 - 560 * urgency;
	const phase = ((t + e.id * 137) % period) / period;
	ctx.save();
	ctx.translate(e.x, y + bob);
	if (!reduced || urgency > 0.5) {
		ctx.strokeStyle = `rgba(255,70,60,${(1 - phase) * (0.25 + 0.55 * urgency)})`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, 0, r + 3 + phase * 20, 0, Math.PI * 2);
		ctx.stroke();
	}
	// Drifting mines leave ripples and carry an amber light
	if (e.vx !== 0) {
		ctx.strokeStyle = 'rgba(220,245,255,0.28)';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.ellipse(-Math.sign(e.vx) * 8, 8, r + 2, 5, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.fillStyle = 'rgba(0,0,0,0.3)';
	ctx.beginPath();
	ctx.ellipse(1, 6, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#4a515c';
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2 + e.id;
		ctx.save();
		ctx.rotate(a);
		ctx.beginPath();
		ctx.moveTo(r - 2, -3);
		ctx.lineTo(r + 5, 0);
		ctx.lineTo(r - 2, 3);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
	const body = ctx.createRadialGradient(-4, -5, 2, 0, 0, r);
	body.addColorStop(0, '#8a93a1');
	body.addColorStop(1, '#2b3039');
	circle(ctx, 0, 0, r, body);
	const blink = reduced ? 1 : Math.sin((t / period) * Math.PI * 2 + e.id) > 0 ? 1 : 0.25;
	circle(ctx, 0, -1, 3.4, `rgba(${e.vx !== 0 ? '255,170,40' : '255,50,40'},${blink})`);
	ctx.restore();
}

function drawDrone(
	ctx: CanvasRenderingContext2D,
	e: Entity,
	y: number,
	t: number,
	reduced: boolean
) {
	const sway = Math.cos((t + e.phase) / 650) * 0.35;
	ctx.save();
	ctx.translate(e.x, y);
	// Its shadow slides over the water
	ctx.fillStyle = 'rgba(0,0,0,0.25)';
	ctx.beginPath();
	ctx.ellipse(8, 16, DRONE_RADIUS, 6, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.rotate(sway);
	ctx.fillStyle = '#20252d';
	ctx.beginPath();
	ctx.moveTo(0, 14);
	ctx.lineTo(-17, -6);
	ctx.lineTo(-6, -4);
	ctx.lineTo(0, -12);
	ctx.lineTo(6, -4);
	ctx.lineTo(17, -6);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#586270';
	ctx.lineWidth = 1.2;
	ctx.stroke();
	circle(ctx, 0, 2, 3, '#ff3b30');
	if (!reduced) {
		const spin = t / 30;
		ctx.strokeStyle = 'rgba(200,210,225,0.45)';
		ctx.lineWidth = 2;
		for (const px of [-14, 14]) {
			ctx.beginPath();
			ctx.ellipse(px, -7, 6, 1.6, spin, 0, Math.PI * 2);
			ctx.stroke();
		}
	}
	ctx.restore();
}

function drawPatrol(
	ctx: CanvasRenderingContext2D,
	e: Entity,
	y: number,
	t: number,
	reduced: boolean
) {
	const angle = Math.atan2(e.vy, e.vx);
	ctx.save();
	ctx.translate(e.x, y);
	ctx.rotate(angle);
	// A wake behind it
	ctx.strokeStyle = 'rgba(235,248,255,0.4)';
	ctx.lineWidth = 2;
	for (const s of [-1, 1]) {
		ctx.beginPath();
		ctx.moveTo(-20, s * 4);
		ctx.lineTo(-52, s * 13);
		ctx.stroke();
	}
	ctx.fillStyle = '#5b6573';
	ctx.beginPath();
	ctx.moveTo(26, 0);
	ctx.lineTo(10, -PATROL_RADIUS * 0.55);
	ctx.lineTo(-22, -PATROL_RADIUS * 0.55);
	ctx.lineTo(-24, 0);
	ctx.lineTo(-22, PATROL_RADIUS * 0.55);
	ctx.lineTo(10, PATROL_RADIUS * 0.55);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#2a3038';
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.fillStyle = '#8b95a4';
	ctx.fillRect(-12, -5, 14, 10);
	ctx.fillStyle = '#c0392b';
	ctx.fillRect(-4, -2, 6, 4);
	const on = reduced ? true : Math.floor(t / 160) % 2 === 0;
	circle(ctx, -6, -7, 2.6, on ? '#ff3b30' : '#3b6bff');
	circle(ctx, -6, 7, 2.6, on ? '#3b6bff' : '#ff3b30');
	ctx.restore();
}

function drawCrate(
	ctx: CanvasRenderingContext2D,
	e: Entity,
	y: number,
	t: number,
	reduced: boolean
) {
	const r = CRATE_RADIUS;
	const bob = reduced ? 0 : Math.sin(t / 460 + e.id) * 2;
	const tilt = reduced ? 0 : Math.sin(t / 700 + e.id * 2) * 0.14;
	ctx.save();
	ctx.translate(e.x, y + bob);
	const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r + 12);
	glow.addColorStop(0, 'rgba(255,214,90,0.4)');
	glow.addColorStop(1, 'rgba(255,214,90,0)');
	ctx.fillStyle = glow;
	ctx.fillRect(-r - 14, -r - 14, (r + 14) * 2, (r + 14) * 2);
	ctx.rotate(tilt);
	ctx.fillStyle = '#8a5a2b';
	ctx.fillRect(-r + 1, -r + 3, r * 2 - 2, r * 2 - 5);
	ctx.strokeStyle = '#5a3817';
	ctx.lineWidth = 1.4;
	ctx.strokeRect(-r + 1, -r + 3, r * 2 - 2, r * 2 - 5);
	ctx.beginPath();
	ctx.moveTo(-r + 1, 0);
	ctx.lineTo(r - 1, 0);
	ctx.stroke();
	// The grain sack on top
	ctx.fillStyle = '#f0c24a';
	ctx.beginPath();
	ctx.ellipse(0, -r + 3, r - 3, 6, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#d19a2a';
	ctx.fillRect(-1.2, -r - 3, 2.4, 4);
	ctx.restore();
}

function drawBuoy(
	ctx: CanvasRenderingContext2D,
	e: Entity,
	y: number,
	t: number,
	reduced: boolean
) {
	const bob = reduced ? 0 : Math.sin(t / 420 + e.id) * 2.4;
	const pulse = reduced ? 0.7 : 0.55 + 0.45 * Math.sin(t / 240);
	ctx.save();
	ctx.translate(e.x, y + bob);
	circle(ctx, 0, 0, BUOY_RADIUS + 9, `rgba(255,120,150,${0.18 * pulse})`);
	ctx.fillStyle = '#f2f2f2';
	ctx.beginPath();
	ctx.moveTo(-BUOY_RADIUS + 3, 8);
	ctx.lineTo(-5, -10);
	ctx.lineTo(5, -10);
	ctx.lineTo(BUOY_RADIUS - 3, 8);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#d6452f';
	ctx.fillRect(-BUOY_RADIUS + 6, -2, BUOY_RADIUS * 2 - 12, 5);
	circle(ctx, 0, -13, 3.2, `rgba(255,90,120,${0.5 + 0.5 * pulse})`);
	// A little heart: this one repairs
	ctx.fillStyle = '#ff5c7c';
	ctx.beginPath();
	ctx.moveTo(0, -19);
	ctx.bezierCurveTo(-8, -26, -12, -17, 0, -12);
	ctx.bezierCurveTo(12, -17, 8, -26, 0, -19);
	ctx.fill();
	ctx.restore();
}

function drawSweeperPickup(
	ctx: CanvasRenderingContext2D,
	e: Entity,
	y: number,
	t: number,
	reduced: boolean
) {
	const bob = reduced ? 0 : Math.sin(t / 500 + e.id) * 2;
	ctx.save();
	ctx.translate(e.x, y + bob);
	circle(ctx, 0, 0, SWEEPER_RADIUS + 10, 'rgba(100,255,180,0.16)');
	ctx.fillStyle = '#2f8f6f';
	ctx.beginPath();
	ctx.moveTo(0, -SWEEPER_RADIUS - 2);
	ctx.lineTo(9, 4);
	ctx.lineTo(7, SWEEPER_RADIUS);
	ctx.lineTo(-7, SWEEPER_RADIUS);
	ctx.lineTo(-9, 4);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#124c3a';
	ctx.lineWidth = 1.4;
	ctx.stroke();
	ctx.fillStyle = '#eafff6';
	ctx.fillRect(-1.8, -3, 3.6, 10);
	ctx.fillRect(-5, 0, 10, 3.6);
	// A sweeping net out behind
	ctx.strokeStyle = 'rgba(180,255,220,0.5)';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(-7, SWEEPER_RADIUS);
	ctx.lineTo(-15, SWEEPER_RADIUS + 10);
	ctx.moveTo(7, SWEEPER_RADIUS);
	ctx.lineTo(15, SWEEPER_RADIUS + 10);
	ctx.stroke();
	ctx.restore();
}

function drawEntity(
	ctx: CanvasRenderingContext2D,
	e: Entity,
	y: number,
	t: number,
	reduced: boolean
) {
	// Things fade in at the top so they never pop into view
	const alpha = clamp01((y + 30) / 50);
	if (alpha <= 0) return;
	ctx.globalAlpha = alpha;
	switch (e.kind) {
		case 'mine':
			drawMine(ctx, e, y, t, reduced);
			break;
		case 'drone':
			drawDrone(ctx, e, y, t, reduced);
			break;
		case 'patrol':
			drawPatrol(ctx, e, y, t, reduced);
			break;
		case 'crate':
			drawCrate(ctx, e, y, t, reduced);
			break;
		case 'buoy':
			drawBuoy(ctx, e, y, t, reduced);
			break;
		case 'sweeper':
			drawSweeperPickup(ctx, e, y, t, reduced);
			break;
	}
	ctx.globalAlpha = 1;
}

/** A pulsing arrow at the bank where a patrol boat is about to come in */
function drawPatrolWarning(ctx: CanvasRenderingContext2D, e: Entity, dist: number, t: number) {
	const { left, right } = corridor(dist);
	const side = e.vx > 0 ? -1 : 1;
	const x = side < 0 ? left + 20 : right - 20;
	const y = Math.max(34, e.y + 20);
	const pulse = 0.55 + 0.45 * Math.sin(t / 90);
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(-side, 1);
	ctx.fillStyle = `rgba(255,60,50,${pulse})`;
	ctx.strokeStyle = 'rgba(40,0,0,0.9)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(14, 0);
	ctx.lineTo(-6, -12);
	ctx.lineTo(-6, 12);
	ctx.closePath();
	ctx.stroke();
	ctx.fill();
	ctx.fillStyle = '#fff';
	ctx.font = '800 13px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('!', -1, 1);
	ctx.restore();
}

/* ------------------------------------------------------------------------------- the ships */

interface ShipLook {
	hull: string;
	trim: string;
	deck: string;
	length: number;
	width: number;
	hatches: number;
	/** Blunt bow for the bulker */
	blunt: boolean;
}

const LOOKS: Record<ShipId, ShipLook> = {
	coaster: {
		hull: '#d8dde4',
		trim: '#c0392b',
		deck: '#8e99a8',
		length: 38,
		width: 17,
		hatches: 2,
		blunt: false
	},
	freighter: {
		hull: '#b73a2e',
		trim: '#f2f2f2',
		deck: '#7d8795',
		length: 48,
		width: 22,
		hatches: 3,
		blunt: false
	},
	bulker: {
		hull: '#1f4f8f',
		trim: '#e3b23c',
		deck: '#6c7686',
		length: 58,
		width: 30,
		hatches: 4,
		blunt: true
	}
};

export function drawShip(
	ctx: CanvasRenderingContext2D,
	shipId: ShipId,
	x: number,
	y: number,
	roll: number,
	t: number,
	fill: number,
	reduced: boolean,
	hullOnly = false
) {
	const look = LOOKS[shipId];
	const L = look.length;
	const W = look.width;
	const bob = reduced ? 0 : Math.sin(t / 430) * 1.2;
	ctx.save();
	ctx.translate(x, y + bob);
	if (!hullOnly) {
		// Wake: two foam lines streaming from the stern, and a soft bow wave
		ctx.strokeStyle = 'rgba(235,248,255,0.5)';
		ctx.lineWidth = 2.2;
		for (const s of [-1, 1]) {
			ctx.beginPath();
			ctx.moveTo(s * (W / 2 - 2), L * 0.3);
			ctx.lineTo(s * (W / 2 + 18), L * 0.3 + 62);
			ctx.stroke();
		}
		const bow = ctx.createRadialGradient(0, -L / 2, 2, 0, -L / 2, 22);
		bow.addColorStop(0, 'rgba(255,255,255,0.4)');
		bow.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = bow;
		ctx.fillRect(-26, -L / 2 - 22, 52, 44);
		// The bow lantern lights the water ahead
		const lamp = ctx.createRadialGradient(0, -L / 2 - 30, 4, 0, -L / 2 - 30, 70);
		lamp.addColorStop(0, 'rgba(255,240,190,0.18)');
		lamp.addColorStop(1, 'rgba(255,240,190,0)');
		ctx.fillStyle = lamp;
		ctx.fillRect(-70, -L / 2 - 100, 140, 140);
	}
	ctx.rotate(roll);
	// Shadow
	ctx.fillStyle = 'rgba(0,0,0,0.28)';
	ctx.beginPath();
	ctx.ellipse(2, 4, W / 2 + 2, L / 2 + 2, 0, 0, Math.PI * 2);
	ctx.fill();
	// Hull
	ctx.beginPath();
	if (look.blunt) {
		ctx.moveTo(-W / 2 + 4, -L / 2);
		ctx.lineTo(W / 2 - 4, -L / 2);
		ctx.quadraticCurveTo(W / 2 + 1, -L / 2 + 6, W / 2, -L / 2 + 14);
	} else {
		ctx.moveTo(0, -L / 2 - 6);
		ctx.quadraticCurveTo(W / 2 + 2, -L / 2 + 8, W / 2, -L / 2 + 16);
	}
	ctx.lineTo(W / 2, L / 2 - 4);
	ctx.quadraticCurveTo(W / 2 - 2, L / 2, W / 2 - 6, L / 2);
	ctx.lineTo(-W / 2 + 6, L / 2);
	ctx.quadraticCurveTo(-W / 2 + 2, L / 2, -W / 2, L / 2 - 4);
	ctx.lineTo(-W / 2, -L / 2 + 16);
	if (look.blunt) {
		ctx.quadraticCurveTo(-W / 2 - 1, -L / 2 + 6, -W / 2 + 4, -L / 2);
	} else {
		ctx.quadraticCurveTo(-W / 2 - 2, -L / 2 + 8, 0, -L / 2 - 6);
	}
	ctx.closePath();
	ctx.fillStyle = look.hull;
	ctx.fill();
	ctx.lineWidth = 1.6;
	ctx.strokeStyle = 'rgba(10,18,28,0.85)';
	ctx.stroke();
	// Deck, with hatches that fill with grain as the hold does
	const deckW = W - 8;
	ctx.fillStyle = look.deck;
	ctx.fillRect(-deckW / 2, -L / 2 + 10, deckW, L - 24);
	const hatchH = (L - 40) / look.hatches - 2;
	for (let i = 0; i < look.hatches; i++) {
		const hy = -L / 2 + 13 + i * (hatchH + 2);
		ctx.fillStyle = '#2b323c';
		ctx.fillRect(-deckW / 2 + 2, hy, deckW - 4, hatchH);
		const share = clamp01(fill * look.hatches - i);
		if (share > 0) {
			ctx.fillStyle = '#f0c24a';
			ctx.fillRect(
				-deckW / 2 + 3,
				hy + 1 + (hatchH - 2) * (1 - share),
				deckW - 6,
				(hatchH - 2) * share
			);
		}
	}
	// Bridge and funnel at the stern
	ctx.fillStyle = look.trim;
	ctx.fillRect(-deckW / 2, L / 2 - 14, deckW, 10);
	ctx.fillStyle = '#26303b';
	ctx.fillRect(-deckW / 2 + 2, L / 2 - 12, deckW - 4, 3);
	circle(ctx, 0, L / 2 - 7, 2.2, '#1b222b');
	// Navigation lights
	circle(ctx, -W / 2 + 2, -L / 2 + 16, 1.8, '#ff4d4d');
	circle(ctx, W / 2 - 2, -L / 2 + 16, 1.8, '#4dff88');
	ctx.restore();
}

/* ------------------------------------------------------------------------------ effects */

function drawFx(ctx: CanvasRenderingContext2D, fx: Fx) {
	for (const r of fx.rings) {
		const p = r.ageMs / r.lifeMs;
		const eased = 1 - (1 - p) * (1 - p);
		ctx.strokeStyle = r.color;
		ctx.globalAlpha = (1 - p) * 0.85;
		if (r.kind === 'pulse') {
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(r.x, r.y, r.radius * eased, r.radius * eased * 0.45, 0, 0, Math.PI * 2);
			ctx.stroke();
		} else if (r.kind === 'sweep') {
			ctx.lineWidth = 4 * (1 - p) + 1;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.radius * eased, Math.PI * 1.18, Math.PI * 1.82);
			ctx.stroke();
		} else {
			ctx.lineWidth = r.kind === 'shock' ? 5 * (1 - p) + 1 : 2.5;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.radius * eased, 0, Math.PI * 2);
			ctx.stroke();
		}
	}
	ctx.globalAlpha = 1;
	for (const p of fx.particles) {
		const k = p.ageMs / p.lifeMs;
		switch (p.kind) {
			case 'spark':
				ctx.globalCompositeOperation = 'lighter';
				ctx.globalAlpha = 1 - k;
				circle(ctx, p.x, p.y, p.size * (1 - k * 0.5), p.color);
				ctx.globalCompositeOperation = 'source-over';
				break;
			case 'debris':
			case 'grain':
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot);
				ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
				ctx.fillStyle = p.color;
				if (p.kind === 'grain') ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
				else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
				ctx.restore();
				break;
			case 'smoke':
				ctx.globalAlpha = 0.5 * (1 - k);
				circle(ctx, p.x, p.y, p.size * (0.6 + k), p.color);
				break;
			case 'drop':
				ctx.globalAlpha = 0.9 * (1 - k * k);
				circle(ctx, p.x, p.y, p.size, p.color);
				break;
			case 'foam':
				ctx.globalAlpha = 0.5 * (1 - k);
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, p.size * (1 + k * 1.6), p.size * 0.7, 0, 0, Math.PI * 2);
				ctx.fill();
				break;
			case 'bubble':
				ctx.globalAlpha = 0.6 * (1 - k);
				ctx.strokeStyle = p.color;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.stroke();
				break;
		}
	}
	ctx.globalAlpha = 1;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	for (const text of fx.texts) {
		const k = text.ageMs / text.lifeMs;
		const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.4);
		ctx.save();
		ctx.translate(text.x, text.y);
		ctx.scale(pop, pop);
		ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
		ctx.font = `800 ${text.big ? 21 : 14}px system-ui, sans-serif`;
		ctx.lineWidth = 4;
		ctx.strokeStyle = 'rgba(4,10,20,0.9)';
		ctx.strokeText(text.text, 0, 0);
		ctx.fillStyle = text.color;
		ctx.fillText(text.text, 0, 0);
		ctx.restore();
	}
	ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------------------ the scene */

export function drawScene(ctx: CanvasRenderingContext2D, state: GrainState, o: SceneOptions) {
	const { width, height, timeMs: t, fx } = o;
	const reduced = o.reducedMotion;
	const view = worldView(width, height);
	const dist = state.distance + state.speed * o.ahead;
	const storm = waveThreat(waveAt(dist)) === 'storm' ? 1 : 0;
	const spec = SHIPS[state.shipId];

	const shakeK = fx.shakeMs > 0 ? fx.shakeMs / SHAKE_MS : 0;
	const shakeX = shakeK > 0 ? Math.sin(t / 17) * fx.shakeStrength * shakeK * view.scale : 0;
	const shakeY = shakeK > 0 ? Math.cos(t / 13) * fx.shakeStrength * shakeK * view.scale : 0;
	// The camera leans a little towards the ship, so the layers slide against each other
	const camShift = reduced ? 0 : (WORLD_WIDTH / 2 - state.shipX) * 0.05;

	const bounds: Bounds = {
		x0: -view.left / view.scale,
		y0: -view.top / view.scale,
		x1: (width - view.left) / view.scale,
		y1: (height - view.top) / view.scale
	};

	ctx.save();
	ctx.translate(view.left + shakeX, view.top + shakeY);
	ctx.scale(view.scale, view.scale);

	drawSea(ctx, bounds, dist, t, camShift, storm, reduced);
	ctx.save();
	ctx.translate(camShift * 0.8, 0);
	drawBanks(ctx, bounds, dist, t, reduced);
	drawPort(ctx, state, dist, t, o.portLabel, reduced);
	ctx.restore();

	ctx.save();
	ctx.translate(camShift, 0);
	// Wake foam sits under everything that floats
	const entities = [...state.entities].sort((a, b) => a.y - b.y);
	for (const e of entities) {
		if (e.warnMs > 0) {
			drawPatrolWarning(ctx, e, dist, t);
			continue;
		}
		const x = e.x + (e.kind === 'patrol' || (e.kind === 'mine' && e.vx !== 0) ? e.vx * o.ahead : 0);
		const y = e.y + e.vy * o.ahead;
		drawEntity(ctx, x === e.x ? e : { ...e, x }, y, t, reduced);
	}

	const lean = (state.targetX - state.shipX) * 0.0035;
	const roll = reduced ? 0 : Math.max(-0.22, Math.min(0.22, lean)) + Math.sin(t / 620) * 0.025;
	const flicker = state.invulnMs > 0 && !reduced && Math.floor(t / 90) % 2 === 0;
	if (!state.over) {
		ctx.globalAlpha = flicker ? 0.35 : 1;
		const shipX = state.shipX + (state.targetX - state.shipX) * Math.min(1, o.ahead * spec.steer);
		drawShip(
			ctx,
			state.shipId,
			shipX,
			SHIP_Y,
			roll,
			t,
			spec.hold > 0 ? state.hold / spec.hold : 0,
			reduced
		);
		ctx.globalAlpha = 1;
	}
	drawFx(ctx, fx);
	ctx.restore();

	ctx.restore();

	// Screen-space finish: night vignette, rain and lightning, the hit flash
	const vignette = ctx.createRadialGradient(
		width / 2,
		height * 0.55,
		Math.min(width, height) * 0.45,
		width / 2,
		height * 0.55,
		Math.max(width, height) * 0.8
	);
	vignette.addColorStop(0, 'rgba(2,8,18,0)');
	vignette.addColorStop(1, `rgba(2,8,18,${0.55 + storm * 0.15})`);
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, width, height);

	if (storm && !reduced) {
		ctx.strokeStyle = 'rgba(190,215,235,0.3)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i < 70; i++) {
			const x = (hash(i) * (width + 80) - ((t * 0.12) % 80)) % width;
			const y = (hash(i + 99) * height + t * 0.7) % height;
			ctx.moveTo(x, y);
			ctx.lineTo(x - 5, y + 14);
		}
		ctx.stroke();
		const bolt = Math.sin(t / 2300) * Math.sin(t / 770);
		if (bolt > 0.93) {
			ctx.fillStyle = `rgba(220,235,255,${(bolt - 0.93) * 5})`;
			ctx.fillRect(0, 0, width, height);
		}
	}

	if (fx.flashMs > 0) {
		const k = fx.flashMs / FLASH_MS;
		const flash = ctx.createRadialGradient(
			width / 2,
			height / 2,
			Math.min(width, height) * 0.2,
			width / 2,
			height / 2,
			Math.max(width, height) * 0.75
		);
		flash.addColorStop(0, 'rgba(255,255,255,0)');
		flash.addColorStop(1, hexAlpha(fx.flashColor, k * (reduced ? 0.25 : 0.55)));
		ctx.fillStyle = flash;
		ctx.fillRect(0, 0, width, height);
	}
}

function hexAlpha(hex: string, alpha: number): string {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp01(alpha).toFixed(3)})`;
}

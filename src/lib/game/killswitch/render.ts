/*
 * Canvas drawing for Starlink Kill Switch, in world units (see state.ts) scaled by the caller.
 * A night sky with parallax stars and hills, satellites that beam pulses to every linked target
 * and ping now and then, a road and a lake along the bottom, a SpaceX-ish rocket on the left and
 * the refinery on the right. Machines get thick ink outlines like the other modes; the sky and the
 * lake are outline-free. All purely decorative motion (parallax, pings, waves) stands still when
 * reduced motion is on.
 */
import { createRandom } from '#lib/game/random.js';
import {
	LAKE_Y,
	REFINERY_X,
	ROAD_Y,
	STARTING_LIVES,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	targetRadius,
	type CivilianKind,
	type DroneKind,
	type KillState,
	type Target
} from './state';

const INK = '#111111';
const PAPER = '#ffffff';
const TIE_RED = '#e5484d';
const EXPLOSION_YELLOW = '#f5c83a';
const LINK = '#37d4ff';
const DRONE_GREY = '#3b4048';
const FLAME = '#f0772f';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export type Effect =
	| { kind: 'burst'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'splash'; x: number; ageMs: number; durationMs: number }
	| {
			kind: 'popup';
			x: number;
			y: number;
			text: string;
			color: string;
			/** Font size in world units, 20 when omitted */
			size?: number;
			ageMs: number;
			durationMs: number;
	  }
	| { kind: 'ping'; x: number; y: number; color?: string; ageMs: number; durationMs: number }
	/** A cut link: the beam from the satellite snaps and crackles */
	| {
			kind: 'snap';
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			ageMs: number;
			durationMs: number;
	  }
	| {
			kind: 'ring';
			x: number;
			y: number;
			size: number;
			color: string;
			ageMs: number;
			durationMs: number;
	  }
	| {
			kind: 'sparks';
			x: number;
			y: number;
			size: number;
			color: string;
			count: number;
			seed: number;
			ageMs: number;
			durationMs: number;
	  }
	/** The whole screen tinted for a moment */
	| { kind: 'flash'; color: string; strength: number; ageMs: number; durationMs: number };

export interface SceneExtras {
	effects: readonly Effect[];
	timeMs: number;
	shakeX: number;
	shakeY: number;
	reducedMotion?: boolean;
	/** The geofence line being dragged, if any */
	preview: { x1: number; y1: number; x2: number; y2: number } | null;
}

const STAR_LAYERS = [
	{ speed: 1.5, alpha: 0.4, size: 0.9 },
	{ speed: 4, alpha: 0.65, size: 1.3 },
	{ speed: 8, alpha: 0.9, size: 1.9 }
] as const;

const STARS = (() => {
	const random = createRandom(5);
	return Array.from({ length: 66 }, (_, i) => ({
		layer: i % 3,
		x: random() * WORLD_WIDTH,
		y: random() * 250,
		phase: random() * Math.PI * 2
	}));
})();

/** Three satellites crawling along the top; each target beams to the nearest one */
function satellites(ambientMs: number) {
	return [0, 1, 2].map((i) => ({
		x: (((ambientMs / 1000) * (6 + i * 2) + i * 230) % (WORLD_WIDTH + 80)) - 40,
		y: 22 + i * 9
	}));
}

/** Where a cut link's beam starts: the satellite nearest to x */
export function beamOrigin(ambientMs: number, x: number): { x: number; y: number } {
	const sats = satellites(ambientMs);
	let nearest = sats[0];
	for (const sat of sats) {
		if (Math.abs(sat.x - x) < Math.abs(nearest.x - x)) nearest = sat;
	}
	return nearest;
}

/** Height of a target's link badge above its centre */
export function badgeOffset(target: Pick<Target, 'civilian' | 'kind'>): number {
	if (target.civilian) return target.kind === 'heli' ? 40 : 44;
	return target.kind === 'swarm' ? 22 : target.kind === 'hardened' ? 38 : 30;
}

function outline(context: CanvasRenderingContext2D, width = 3) {
	context.lineWidth = width;
	context.lineJoin = 'round';
	context.lineCap = 'round';
	context.strokeStyle = INK;
}

function roundRect(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	context.beginPath();
	context.roundRect(x, y, w, h, r);
}

/** A seamless ridge: a sum of sines whose periods divide the world width, drifting sideways */
function ridge(
	context: CanvasRenderingContext2D,
	offset: number,
	base: number,
	amplitude: number,
	seed: number,
	fill: string
) {
	context.fillStyle = fill;
	context.beginPath();
	context.moveTo(-20, LAKE_Y);
	for (let x = -20; x <= WORLD_WIDTH + 20; x += 10) {
		const t = ((x + offset) / WORLD_WIDTH) * Math.PI * 2;
		const y =
			base - amplitude * (0.55 * Math.sin(t * 2 + seed) + 0.45 * Math.sin(t * 3 + seed * 2.3));
		context.lineTo(x, y);
	}
	context.lineTo(WORLD_WIDTH + 20, LAKE_Y);
	context.closePath();
	context.fill();
}

function drawBackground(context: CanvasRenderingContext2D, ambientMs: number) {
	const sky = context.createLinearGradient(0, 0, 0, 320);
	sky.addColorStop(0, '#080c26');
	sky.addColorStop(0.65, '#1d2a63');
	sky.addColorStop(1, '#3d4b8f');
	context.fillStyle = sky;
	context.fillRect(-20, -20, WORLD_WIDTH + 40, 350);

	// Three star layers drifting at different speeds: the nearer, the faster
	context.fillStyle = PAPER;
	for (const star of STARS) {
		const layer = STAR_LAYERS[star.layer];
		const x =
			(((star.x - (ambientMs / 1000) * layer.speed) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
		context.globalAlpha = layer.alpha * (0.6 + 0.4 * Math.sin(ambientMs / 700 + star.phase));
		context.fillRect(x, star.y, layer.size, layer.size);
	}
	context.globalAlpha = 1;

	// Moon
	context.fillStyle = '#f4efd6';
	context.beginPath();
	context.arc(96, 78, 22, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = '#d9d3b4';
	for (const [dx, dy, r] of [
		[-6, -5, 5],
		[7, 6, 4],
		[3, -9, 2.5]
	]) {
		context.beginPath();
		context.arc(96 + dx, 78 + dy, r, 0, Math.PI * 2);
		context.fill();
	}

	// Two ranges of hills, the far one slower
	const drift = ambientMs / 1000;
	ridge(context, drift * 3, 290, 26, 0.8, '#1d2c4d');
	ridge(context, drift * 8, 304, 22, 2.4, '#16233a');

	// Road
	context.fillStyle = '#2a2f3d';
	context.fillRect(-20, ROAD_Y - 18, WORLD_WIDTH + 40, 50);
	context.strokeStyle = '#d8cf7a';
	context.lineWidth = 2;
	context.setLineDash([14, 12]);
	context.lineDashOffset = -drift * 26;
	context.beginPath();
	context.moveTo(-20, ROAD_Y + 9);
	context.lineTo(WORLD_WIDTH + 20, ROAD_Y + 9);
	context.stroke();
	context.setLineDash([]);
	context.lineDashOffset = 0;

	// Lake, with rows of waves that move faster the nearer they are
	const lake = context.createLinearGradient(0, LAKE_Y, 0, WORLD_HEIGHT);
	lake.addColorStop(0, '#1b5a8c');
	lake.addColorStop(1, '#0d2a4d');
	context.fillStyle = lake;
	context.fillRect(-20, LAKE_Y, WORLD_WIDTH + 40, WORLD_HEIGHT - LAKE_Y + 20);
	for (let row = 0; row < 3; row++) {
		context.strokeStyle = `rgba(255,255,255,${0.12 + row * 0.05})`;
		context.lineWidth = 1.5;
		context.beginPath();
		for (let x = -20; x <= WORLD_WIDTH + 20; x += 8) {
			const y =
				LAKE_Y +
				14 +
				row * 18 +
				Math.sin(x / 26 + (ambientMs / 600) * (1 + row * 0.5) + row * 2) * 2.2;
			if (x === -20) context.moveTo(x, y);
			else context.lineTo(x, y);
		}
		context.stroke();
	}
}

function drawSatellite(context: CanvasRenderingContext2D, x: number, y: number) {
	context.save();
	context.translate(x, y);
	context.fillStyle = '#b8c4e8';
	context.fillRect(-4, -3, 8, 6);
	context.fillStyle = '#4a6fd8';
	context.fillRect(-17, -2, 11, 4);
	context.fillRect(6, -2, 11, 4);
	context.restore();
}

/** Every satellite sends out a slow ring now and then, as if pinging the ground */
function drawSatellitePings(
	context: CanvasRenderingContext2D,
	sats: { x: number; y: number }[],
	ambientMs: number
) {
	context.lineWidth = 1.5;
	sats.forEach((sat, i) => {
		const phase = ((ambientMs + i * 900) % 2700) / 2700;
		context.strokeStyle = `rgba(55,212,255,${0.5 * (1 - phase)})`;
		context.beginPath();
		context.arc(sat.x, sat.y, 5 + phase * 26, Math.PI * 0.1, Math.PI * 0.9);
		context.stroke();
	});
}

function drawRocket(context: CanvasRenderingContext2D, timeMs: number) {
	context.save();
	context.translate(20, LAKE_Y - 4);
	// Launch tower
	outline(context, 2);
	context.fillStyle = '#4b5568';
	context.fillRect(18, -118, 8, 118);
	context.strokeRect(18, -118, 8, 118);
	// Starship-ish stack
	context.fillStyle = '#d9dee8';
	roundRect(context, -8, -96, 22, 86, 4);
	context.fill();
	context.stroke();
	context.beginPath();
	context.moveTo(-8, -96);
	context.quadraticCurveTo(3, -122, 14, -96);
	context.closePath();
	context.fill();
	context.stroke();
	context.fillStyle = INK;
	context.fillRect(-8, -62, 22, 3);
	context.fillRect(-8, -40, 22, 3);
	// Idle engine glow
	context.fillStyle = FLAME;
	context.globalAlpha = 0.6 + 0.3 * Math.sin(timeMs / 140);
	context.beginPath();
	context.moveTo(-2, -10);
	context.lineTo(3, 6);
	context.lineTo(8, -10);
	context.closePath();
	context.fill();
	context.restore();
}

function drawRefinery(context: CanvasRenderingContext2D, timeMs: number, lives: number) {
	const lost = Math.max(0, STARTING_LIVES - lives);
	context.save();
	outline(context, 2.5);
	// Tanks
	const tanks = [
		{ x: 566, y: 270, w: 34, h: 82 },
		{ x: 604, y: 288, w: 34, h: 64 }
	];
	tanks.forEach((tank, i) => {
		context.fillStyle = lost > i + 1 ? '#3b3232' : '#9aa3b2';
		roundRect(context, tank.x, tank.y, tank.w, tank.h, 6);
		context.fill();
		context.stroke();
		context.beginPath();
		context.moveTo(tank.x + 2, tank.y + tank.h * 0.35);
		context.lineTo(tank.x + tank.w - 2, tank.y + tank.h * 0.35);
		context.stroke();
	});
	// Tower and flare stack
	context.fillStyle = '#6a7384';
	context.fillRect(552, 232, 7, 120);
	context.strokeRect(552, 232, 7, 120);
	context.fillStyle = FLAME;
	const flicker = 1 + 0.15 * Math.sin(timeMs / 90);
	context.beginPath();
	context.ellipse(555.5, 222, 6 * flicker, 12 * flicker, 0, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = EXPLOSION_YELLOW;
	context.beginPath();
	context.ellipse(555.5, 224, 3, 7 * flicker, 0, 0, Math.PI * 2);
	context.fill();
	// One fire per lost heart, with a column of smoke rising from it
	for (let i = 0; i < lost; i++) {
		const fx = [583, 621, 556][i];
		const fy = [262, 280, 296][i];
		for (let puff = 0; puff < 4; puff++) {
			const age = (((timeMs / 1400 + puff / 4 + i * 0.3) % 1) + 1) % 1;
			context.globalAlpha = 0.45 * (1 - age);
			context.fillStyle = '#2a2a30';
			context.beginPath();
			context.arc(
				fx + Math.sin(age * 5 + i) * 6 + age * 10,
				fy - 14 - age * 70,
				7 + age * 14,
				0,
				Math.PI * 2
			);
			context.fill();
		}
		context.globalAlpha = 1;
		const wobble = 1 + 0.2 * Math.sin(timeMs / 80 + i);
		context.fillStyle = TIE_RED;
		context.beginPath();
		context.ellipse(fx, fy, 11 * wobble, 20 * wobble, 0, 0, Math.PI * 2);
		context.fill();
		context.fillStyle = EXPLOSION_YELLOW;
		context.beginPath();
		context.ellipse(fx, fy + 4, 6, 11 * wobble, 0, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();
}

function drawLinkBadge(context: CanvasRenderingContext2D, target: Target, timeMs: number) {
	if (target.state === 'falling') return;
	context.save();
	context.translate(0, -badgeOffset(target));
	const dead = target.state === 'stalled';
	const offline = target.state === 'offline';
	const blink = offline && Math.floor(timeMs / 160) % 2 === 0;
	context.fillStyle = dead || offline ? TIE_RED : LINK;
	if (blink) context.fillStyle = EXPLOSION_YELLOW;
	outline(context, 2);
	context.beginPath();
	context.arc(0, 0, 10, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	context.strokeStyle = PAPER;
	context.lineWidth = 2;
	if (dead || offline) {
		context.beginPath();
		context.moveTo(-4, -4);
		context.lineTo(4, 4);
		context.moveTo(4, -4);
		context.lineTo(-4, 4);
		context.stroke();
	} else {
		context.beginPath();
		context.arc(0, 3, 3, Math.PI * 1.15, Math.PI * 1.85);
		context.stroke();
		context.beginPath();
		context.arc(0, 3, 7, Math.PI * 1.2, Math.PI * 1.8);
		context.stroke();
		context.fillStyle = PAPER;
		context.beginPath();
		context.arc(0, 3, 1.5, 0, Math.PI * 2);
		context.fill();
	}
	if (offline) {
		// A pulsing ring tells the player this one needs a tap to come back
		context.strokeStyle = EXPLOSION_YELLOW;
		context.lineWidth = 2;
		context.beginPath();
		context.arc(0, 0, 13 + 3 * Math.sin(timeMs / 120), 0, Math.PI * 2);
		context.stroke();
	}
	context.restore();
}

const DRONE_SCALE: Record<DroneKind, number> = { drone: 1, fast: 0.85, swarm: 0.62, hardened: 1.2 };
const DRONE_COLOR: Record<DroneKind, string> = {
	drone: DRONE_GREY,
	fast: '#5c2f33',
	swarm: '#4a4f3a',
	hardened: '#2d3b57'
};

function drawDrone(context: CanvasRenderingContext2D, target: Target, timeMs: number) {
	const kind = target.kind as DroneKind;
	const flying = target.state === 'flying';
	const angle = flying ? Math.atan2(target.vy, target.vx) : target.spin;
	const scale = DRONE_SCALE[kind];

	if (flying && kind === 'fast') {
		// Speed streaks behind the fast ones
		context.strokeStyle = 'rgba(255,255,255,0.35)';
		context.lineWidth = 1.5;
		for (let i = -1; i <= 1; i++) {
			context.beginPath();
			context.moveTo(-24, i * 8);
			context.lineTo(-48 - Math.abs(i) * -6, i * 8);
			context.stroke();
		}
	}

	context.save();
	context.rotate(angle);
	context.scale(scale, scale);
	outline(context, 2.5 / scale);
	context.fillStyle =
		target.flashMs > 0 && Math.floor(timeMs / 50) % 2 === 0 ? PAPER : DRONE_COLOR[kind];
	// Delta wing with the nose to the right
	context.beginPath();
	context.moveTo(20, 0);
	context.lineTo(-16, -17);
	context.lineTo(-10, 0);
	context.lineTo(-16, 17);
	context.closePath();
	context.fill();
	context.stroke();
	context.fillStyle = TIE_RED;
	context.fillRect(8, -2, 8, 4);
	if (kind === 'hardened') {
		// Armour plates
		context.fillStyle = '#6f7d99';
		context.fillRect(-6, -6, 10, 12);
		context.strokeRect(-6, -6, 10, 12);
	}
	// Little propeller blur at the back
	context.strokeStyle = INK;
	context.lineWidth = 2 / scale;
	context.beginPath();
	const prop = Math.sin(timeMs / 30 + target.id) * 7;
	context.moveTo(-13, -prop);
	context.lineTo(-13, prop);
	context.stroke();
	if (!flying) {
		context.fillStyle = FLAME;
		context.beginPath();
		context.arc(-12, 0, 5 + Math.sin(timeMs / 40) * 1.5, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();

	if (flying && kind === 'hardened') {
		// The jammer shield: whole at full strength, cracked after the first cut
		const cracked = target.hp < 2;
		context.strokeStyle = cracked ? 'rgba(245,200,58,0.9)' : 'rgba(55,212,255,0.9)';
		context.lineWidth = 3;
		context.setLineDash(cracked ? [7, 7] : []);
		context.beginPath();
		context.arc(0, 0, 36 + Math.sin(timeMs / 160) * 1.5, 0, Math.PI * 2);
		context.stroke();
		context.setLineDash([]);
		if (target.flashMs > 0) {
			context.globalAlpha = target.flashMs / 320;
			context.fillStyle = 'rgba(255,255,255,0.7)';
			context.beginPath();
			context.arc(0, 0, 36, 0, Math.PI * 2);
			context.fill();
			context.globalAlpha = 1;
		}
	}
}

function drawWheel(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	timeMs: number
) {
	context.fillStyle = '#23262f';
	context.beginPath();
	context.arc(x, y, r, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	context.fillStyle = '#c9ced9';
	context.beginPath();
	context.arc(x, y, r * 0.4, 0, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 1.5;
	const spin = timeMs / 120;
	context.beginPath();
	context.moveTo(x + Math.cos(spin) * r * 0.4, y + Math.sin(spin) * r * 0.4);
	context.lineTo(x - Math.cos(spin) * r * 0.4, y - Math.sin(spin) * r * 0.4);
	context.stroke();
}

function drawCivilian(context: CanvasRenderingContext2D, kind: CivilianKind, timeMs: number) {
	outline(context, 2.5);
	switch (kind) {
		case 'van':
			context.fillStyle = '#f2f2ee';
			roundRect(context, -26, -18, 52, 26, 5);
			context.fill();
			context.stroke();
			context.fillStyle = '#8fd0e8';
			context.fillRect(10, -14, 12, 10);
			context.strokeRect(10, -14, 12, 10);
			context.fillStyle = TIE_RED;
			context.fillRect(-22, -8, 26, 5);
			drawWheel(context, -14, 9, 6, timeMs);
			drawWheel(context, 14, 9, 6, timeMs);
			break;
		case 'tractor':
			context.fillStyle = '#4c9a4a';
			roundRect(context, -8, -10, 30, 14, 4);
			context.fill();
			context.stroke();
			context.fillStyle = '#3c7c3a';
			roundRect(context, -22, -26, 22, 22, 4);
			context.fill();
			context.stroke();
			context.fillStyle = '#8fd0e8';
			context.fillRect(-18, -22, 14, 11);
			drawWheel(context, -14, 6, 11, timeMs);
			drawWheel(context, 16, 9, 6, timeMs);
			break;
		case 'bus':
			context.fillStyle = '#f2c230';
			roundRect(context, -34, -22, 68, 30, 5);
			context.fill();
			context.stroke();
			context.fillStyle = '#8fd0e8';
			for (let i = 0; i < 5; i++) context.fillRect(-29 + i * 12, -17, 9, 9);
			context.fillStyle = INK;
			context.fillRect(-34, -2, 68, 3);
			drawWheel(context, -20, 9, 6, timeMs);
			drawWheel(context, 20, 9, 6, timeMs);
			break;
		case 'boat': {
			const bob = Math.sin(timeMs / 420) * 2;
			context.translate(0, bob);
			context.fillStyle = '#e5ede8';
			context.beginPath();
			context.moveTo(-26, -4);
			context.lineTo(26, -4);
			context.lineTo(18, 10);
			context.lineTo(-18, 10);
			context.closePath();
			context.fill();
			context.stroke();
			context.fillStyle = TIE_RED;
			roundRect(context, -8, -18, 16, 14, 3);
			context.fill();
			context.stroke();
			context.beginPath();
			context.moveTo(12, -4);
			context.lineTo(12, -26);
			context.stroke();
			context.fillStyle = EXPLOSION_YELLOW;
			context.beginPath();
			context.moveTo(12, -26);
			context.lineTo(24, -16);
			context.lineTo(12, -8);
			context.closePath();
			context.fill();
			context.stroke();
			break;
		}
		case 'heli': {
			// A news helicopter: round white cabin, red stripe, a spinning rotor
			const bob = Math.sin(timeMs / 300) * 1.5;
			context.translate(0, bob);
			context.fillStyle = '#f2f2ee';
			context.beginPath();
			context.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
			context.fill();
			context.stroke();
			context.fillStyle = '#8fd0e8';
			context.beginPath();
			context.ellipse(11, -2, 9, 8, 0, 0, Math.PI * 2);
			context.fill();
			context.stroke();
			context.fillStyle = TIE_RED;
			context.fillRect(-14, 3, 16, 4);
			context.beginPath();
			context.moveTo(-18, -2);
			context.lineTo(-40, -8);
			context.lineTo(-40, 0);
			context.closePath();
			context.fillStyle = '#f2f2ee';
			context.fill();
			context.stroke();
			context.beginPath();
			context.moveTo(-14, 18);
			context.lineTo(14, 18);
			context.moveTo(-8, 14);
			context.lineTo(-8, 18);
			context.moveTo(8, 14);
			context.lineTo(8, 18);
			context.stroke();
			const blade = 30 * Math.abs(Math.cos(timeMs / 55));
			context.beginPath();
			context.moveTo(0, -14);
			context.lineTo(0, -18);
			context.moveTo(-blade, -18);
			context.lineTo(blade, -18);
			context.stroke();
			break;
		}
	}
}

function drawTarget(context: CanvasRenderingContext2D, target: Target, timeMs: number) {
	context.save();
	context.translate(target.x, target.y);
	if (target.state === 'flying' || target.state === 'offline') {
		// A faint disc shows how much room a finger has around the target
		context.fillStyle = target.civilian ? 'rgba(255,255,255,0.05)' : 'rgba(255,120,120,0.09)';
		context.beginPath();
		context.arc(0, 0, targetRadius(target), 0, Math.PI * 2);
		context.fill();
	}
	if (target.civilian) {
		context.save();
		// Vehicles driving left face left
		if (target.vx < 0) context.scale(-1, 1);
		drawCivilian(context, target.kind as CivilianKind, timeMs);
		context.restore();
		if (target.state === 'stalled') {
			// A stalled vehicle smokes
			for (let puff = 0; puff < 3; puff++) {
				const age = (((target.stateMs / 700 + puff / 3) % 1) + 1) % 1;
				context.globalAlpha = 0.5 * (1 - age);
				context.fillStyle = '#555a66';
				context.beginPath();
				context.arc(puff * 5 - 5, -20 - age * 26, 5 + age * 7, 0, Math.PI * 2);
				context.fill();
			}
			context.globalAlpha = 1;
		}
	} else {
		drawDrone(context, target, timeMs);
	}
	drawLinkBadge(context, target, timeMs);
	context.restore();
}

/** A falling drone leaves a trail of smoke along the way it came */
function drawTrail(context: CanvasRenderingContext2D, target: Target) {
	const age = Math.min(1, target.stateMs / 900);
	context.save();
	for (let i = 1; i <= 5; i++) {
		const back = i * 0.045;
		const x = target.x - target.vx * back;
		const y = target.y - target.vy * back;
		context.globalAlpha = 0.5 * (1 - i / 6) * (1 - age * 0.3);
		context.fillStyle = i % 2 ? '#3a3a40' : '#68626a';
		context.beginPath();
		context.arc(x, y, 9 - i, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();
}

function drawBeams(
	context: CanvasRenderingContext2D,
	state: KillState,
	sats: { x: number; y: number }[],
	ambientMs: number
) {
	context.lineWidth = 1.5;
	context.setLineDash([3, 5]);
	// The dashes march from the satellite to the target, like data on the way down
	context.lineDashOffset = -(ambientMs / 40) % 8;
	for (const target of state.targets) {
		if (target.state !== 'flying') continue;
		let nearest = sats[0];
		for (const sat of sats) {
			if (Math.abs(sat.x - target.x) < Math.abs(nearest.x - target.x)) nearest = sat;
		}
		context.strokeStyle = target.civilian ? 'rgba(55,212,255,0.28)' : 'rgba(55,212,255,0.55)';
		context.beginPath();
		context.moveTo(nearest.x, nearest.y + 4);
		context.lineTo(target.x, target.y - badgeOffset(target));
		context.stroke();
	}
	context.setLineDash([]);
	context.lineDashOffset = 0;
}

function drawFence(context: CanvasRenderingContext2D, state: KillState, timeMs: number) {
	const fence = state.fence;
	if (!fence) return;
	const fade = Math.min(1, fence.leftMs / 800);
	context.save();
	context.globalAlpha = fade;
	context.strokeStyle = LINK;
	context.lineWidth = 4;
	context.shadowColor = LINK;
	context.shadowBlur = 12;
	context.setLineDash([10, 8]);
	context.lineDashOffset = -timeMs / 40;
	context.beginPath();
	context.moveTo(fence.x1, fence.y1);
	context.lineTo(fence.x2, fence.y2);
	context.stroke();
	// Posts at both ends
	context.setLineDash([]);
	context.fillStyle = PAPER;
	for (const [x, y] of [
		[fence.x1, fence.y1],
		[fence.x2, fence.y2]
	]) {
		context.beginPath();
		context.arc(x, y, 5, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();
}

function drawEffect(context: CanvasRenderingContext2D, effect: Effect) {
	const progress = Math.min(1, effect.ageMs / effect.durationMs);
	context.save();
	switch (effect.kind) {
		case 'burst': {
			const r = effect.size * (0.35 + 0.65 * progress);
			context.globalAlpha = 1 - progress;
			context.fillStyle = FLAME;
			context.beginPath();
			context.arc(effect.x, effect.y, r, 0, Math.PI * 2);
			context.fill();
			context.fillStyle = EXPLOSION_YELLOW;
			context.beginPath();
			context.arc(effect.x, effect.y, r * 0.55, 0, Math.PI * 2);
			context.fill();
			break;
		}
		case 'splash': {
			context.globalAlpha = 1 - progress;
			context.strokeStyle = PAPER;
			context.lineWidth = 2.5;
			context.beginPath();
			context.ellipse(effect.x, LAKE_Y + 3, 8 + progress * 34, 3 + progress * 7, 0, 0, Math.PI * 2);
			context.stroke();
			context.fillStyle = PAPER;
			for (let i = -2; i <= 2; i++) {
				const lift = Math.sin(progress * Math.PI) * (24 - Math.abs(i) * 6);
				context.beginPath();
				context.arc(effect.x + i * 7 * (0.5 + progress), LAKE_Y - lift, 2.4, 0, Math.PI * 2);
				context.fill();
			}
			break;
		}
		case 'popup': {
			const base = effect.size ?? 20;
			// A quick overshoot at the start makes the number feel like it pops out
			const pop = 1 + 0.4 * Math.max(0, 1 - progress * 5);
			context.globalAlpha = 1 - progress * progress;
			context.font = `800 ${base * pop}px ${DISPLAY_FONT}`;
			context.textAlign = 'center';
			context.lineJoin = 'round';
			context.lineWidth = 4;
			context.strokeStyle = INK;
			context.fillStyle = effect.color;
			const y = effect.y - 26 - progress * 30;
			context.strokeText(effect.text, effect.x, y);
			context.fillText(effect.text, effect.x, y);
			break;
		}
		case 'ping':
			context.globalAlpha = 0.55 * (1 - progress);
			context.strokeStyle = effect.color ?? PAPER;
			context.lineWidth = 2;
			context.beginPath();
			context.arc(effect.x, effect.y, 6 + progress * 16, 0, Math.PI * 2);
			context.stroke();
			break;
		case 'snap': {
			// A jagged flash along the old beam, which then fades
			context.globalAlpha = 1 - progress;
			context.strokeStyle = progress < 0.4 ? PAPER : LINK;
			context.lineWidth = 3 - progress * 2;
			context.shadowColor = LINK;
			context.shadowBlur = 8;
			context.beginPath();
			const steps = 7;
			const dx = effect.x2 - effect.x1;
			const dy = effect.y2 - effect.y1;
			const length = Math.hypot(dx, dy) || 1;
			context.moveTo(effect.x1, effect.y1);
			for (let i = 1; i < steps; i++) {
				const t = i / steps;
				const jitter = (i % 2 ? 1 : -1) * 7 * (1 - progress);
				context.lineTo(
					effect.x1 + dx * t - (dy / length) * jitter,
					effect.y1 + dy * t + (dx / length) * jitter
				);
			}
			context.lineTo(effect.x2, effect.y2);
			context.stroke();
			break;
		}
		case 'ring':
			context.globalAlpha = 1 - progress;
			context.strokeStyle = effect.color;
			context.lineWidth = 4 * (1 - progress) + 1;
			context.beginPath();
			context.arc(effect.x, effect.y, effect.size * (0.25 + 0.75 * progress), 0, Math.PI * 2);
			context.stroke();
			break;
		case 'sparks': {
			context.globalAlpha = 1 - progress;
			context.fillStyle = effect.color;
			for (let i = 0; i < effect.count; i++) {
				const angle = (i / effect.count) * Math.PI * 2 + effect.seed;
				const reach = effect.size * (0.55 + (0.45 * ((i * 7) % 5)) / 4);
				const x = effect.x + Math.cos(angle) * reach * progress;
				const y = effect.y + Math.sin(angle) * reach * progress + 38 * progress * progress;
				context.fillRect(x - 1.5, y - 1.5, 3, 3);
			}
			break;
		}
		case 'flash':
			context.globalAlpha = effect.strength * (1 - progress);
			context.fillStyle = effect.color;
			context.fillRect(-20, -20, WORLD_WIDTH + 40, WORLD_HEIGHT + 40);
			break;
	}
	context.restore();
}

export function drawScene(
	context: CanvasRenderingContext2D,
	state: KillState,
	extras: SceneExtras
) {
	const ambientMs = extras.reducedMotion ? 0 : extras.timeMs;
	context.save();
	context.translate(extras.shakeX, extras.shakeY);
	drawBackground(context, ambientMs);
	const sats = satellites(ambientMs);
	drawBeams(context, state, sats, ambientMs);
	for (const sat of sats) drawSatellite(context, sat.x, sat.y);
	if (!extras.reducedMotion) drawSatellitePings(context, sats, ambientMs);
	drawRocket(context, extras.timeMs);
	drawRefinery(context, extras.timeMs, state.lives);
	// Warning line where the refinery starts
	context.strokeStyle = 'rgba(229,72,77,0.35)';
	context.lineWidth = 2;
	context.setLineDash([6, 8]);
	context.beginPath();
	context.moveTo(REFINERY_X, 40);
	context.lineTo(REFINERY_X, 300);
	context.stroke();
	context.setLineDash([]);

	// Vehicles under drones, so a low drone never hides the link of a van
	for (const target of state.targets)
		if (target.civilian) drawTarget(context, target, extras.timeMs);
	for (const target of state.targets) {
		if (target.civilian) continue;
		if (target.state === 'falling') drawTrail(context, target);
		drawTarget(context, target, extras.timeMs);
	}
	drawFence(context, state, extras.timeMs);
	if (extras.preview) {
		context.strokeStyle = 'rgba(55,212,255,0.8)';
		context.lineWidth = 3;
		context.setLineDash([6, 6]);
		context.beginPath();
		context.moveTo(extras.preview.x1, extras.preview.y1);
		context.lineTo(extras.preview.x2, extras.preview.y2);
		context.stroke();
		context.setLineDash([]);
	}
	for (const effect of extras.effects) drawEffect(context, effect);
	context.restore();
}

/** Draws the final scene onto the shared score card: the whole world, fitted into a square */
export function drawScenePreview(
	context: CanvasRenderingContext2D,
	state: KillState,
	extras: SceneExtras,
	x: number,
	y: number,
	size: number
) {
	const scale = size / WORLD_WIDTH;
	const height = WORLD_HEIGHT * scale;
	context.save();
	context.beginPath();
	context.rect(x, y, size, size);
	context.clip();
	context.translate(x, y + (size - height) / 2);
	context.scale(scale, scale);
	drawScene(context, state, extras);
	context.restore();
}

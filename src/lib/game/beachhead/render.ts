/*
 * Canvas drawing for Beachhead. Everything is drawn in grid cells (the caller scales the canvas to
 * the 12 × 8 world) as flat shapes with thick ink outlines, matching the other game boards: no
 * photographs, no gradients that stop working on a dark theme.
 */
import type { BattleState, Building, Projectile, SkillStrike, SkillZone, Troop } from './battle.js';
import { COLUMNS, ROWS, SHORE_X, TROOP, type BuildingKind } from './config.js';

// Design tokens (src/lib/styles/tokens.css); a canvas cannot read Tailwind utilities
const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const SAND_DARK = '#d6cb9c';
const KHAKI = '#7c8c5c';
const SEA = '#4fa8d8';
const SEA_DARK = '#3d8cba';
const TIE_RED = '#e5484d';
const SKIN = '#f6c9a0';
const BANNER_SLATE = '#6a7c9b';
const EXPLOSION_YELLOW = '#f5c83a';
const MUSTARD = '#ddb93c';
const STEEL = '#3b4048';
const SMOKE = '#5d6470';
const HEAL_GREEN = '#3fa65a';
const FLARE_ORANGE = '#f28c28';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

/** Guns that get a muzzle flash on the left, towards the beach */
const BUILDING_MUZZLE = new Set<BuildingKind>([
	'field-cannon',
	'mortar',
	'sniper',
	'mg',
	'flame',
	'air-defence',
	'fpv-nest'
]);

export type Effect =
	| {
			kind: 'tracer';
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
			friendly: boolean;
			ageMs: number;
			durationMs: number;
	  }
	| { kind: 'explosion'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'splash'; x: number; y: number; ageMs: number; durationMs: number }
	| { kind: 'down'; x: number; y: number; ageMs: number; durationMs: number }
	| {
			kind: 'flame';
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
			ageMs: number;
			durationMs: number;
	  }
	| {
			kind: 'debris';
			x: number;
			y: number;
			size: number;
			seed: number;
			ageMs: number;
			durationMs: number;
	  }
	| {
			kind: 'float';
			x: number;
			y: number;
			text: string;
			color: string;
			ageMs: number;
			durationMs: number;
	  }
	| {
			kind: 'ring';
			x: number;
			y: number;
			radius: number;
			color: string;
			ageMs: number;
			durationMs: number;
	  };

export interface SceneExtras {
	effects: readonly Effect[];
	/** Running time for the waves, the flag and the focus flare */
	timeMs: number;
	/** Screen shake in grid cells, already decayed by the game loop */
	shake?: number;
	reducedMotion?: boolean;
}

const PALMS: readonly { x: number; y: number }[] = [
	{ x: 2.65, y: 0.45 },
	{ x: 2.65, y: 7.35 },
	{ x: 11.15, y: 7.35 },
	{ x: 10.85, y: 0.45 }
];

function rect(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	fill: string,
	lineWidth = 0.06
) {
	context.fillStyle = fill;
	context.fillRect(x, y, width, height);
	context.lineWidth = lineWidth;
	context.strokeStyle = INK;
	context.strokeRect(x, y, width, height);
}

function circle(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	fill: string,
	lineWidth = 0.05
) {
	context.beginPath();
	context.arc(x, y, radius, 0, Math.PI * 2);
	context.fillStyle = fill;
	context.fill();
	if (lineWidth > 0) {
		context.lineWidth = lineWidth;
		context.strokeStyle = INK;
		context.stroke();
	}
}

function healthBar(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	ratio: number,
	fill: string
) {
	context.fillStyle = INK;
	context.fillRect(x, y, width, 0.12);
	context.fillStyle = fill;
	context.fillRect(x + 0.025, y + 0.025, Math.max(0, width - 0.05) * ratio, 0.07);
}

function drawSea(context: CanvasRenderingContext2D, timeMs: number) {
	context.fillStyle = SEA;
	context.fillRect(0, 0, COLUMNS, ROWS);
	// Soft cloud borders along top/edges
	context.fillStyle = 'rgba(255,255,255,0.35)';
	context.beginPath();
	for (let x = 0; x < COLUMNS; x += 0.3) {
		const offset = Math.sin(x * 2 + timeMs / 900) * 0.15;
		context.arc(x, offset - 0.1, 0.35 + Math.abs(offset) * 0.3, 0, Math.PI * 2);
	}
	context.fill();
	context.strokeStyle = SEA_DARK;
	context.lineWidth = 0.06;
	for (let row = 0; row < ROWS; row += 2) {
		context.beginPath();
		const y = row + 0.7;
		for (let x = 0; x <= SHORE_X; x += 0.15) {
			const wave = Math.sin(x * 4 + timeMs / 700 + row) * 0.06;
			if (x === 0) context.moveTo(x, y + wave);
			else context.lineTo(x, y + wave);
		}
		context.stroke();
	}
}

function drawLandingCraft(context: CanvasRenderingContext2D, count: number, timeMs: number) {
	// Up to eight craft wait offshore, spread over the whole beach rather than in one column
	const gap = count > 1 ? (ROWS - 1.3) / (count - 1) : 0;
	for (let index = 0; index < count; index++) {
		const bob = Math.sin(timeMs / 650 + index * 1.8) * 0.05;
		const x = 0.34 + Math.sin(timeMs / 1400 + index) * 0.03;
		const y = 0.65 + (count > 1 ? index * gap : (ROWS - 1) / 2) + bob;
		// Wake, then a blunt little craft with a ramp down towards the beach
		context.strokeStyle = 'rgba(255,255,255,0.55)';
		context.lineWidth = 0.04;
		context.beginPath();
		context.moveTo(x - 0.2, y + 0.2);
		context.quadraticCurveTo(x - 0.4, y + 0.12, x - 0.5, y + 0.24);
		context.stroke();
		context.fillStyle = STEEL;
		context.beginPath();
		context.moveTo(x - 0.2, y - 0.14);
		context.lineTo(x + 0.3, y - 0.2);
		context.lineTo(x + 0.42, y);
		context.lineTo(x + 0.3, y + 0.2);
		context.lineTo(x - 0.2, y + 0.14);
		context.closePath();
		context.fill();
		context.strokeStyle = INK;
		context.lineWidth = 0.04;
		context.stroke();
		context.fillStyle = KHAKI;
		context.fillRect(x - 0.08, y - 0.1, 0.25, 0.16);
		context.fillStyle = EXPLOSION_YELLOW;
		context.fillRect(x + 0.16, y - 0.3, 0.08, 0.1);
	}
}

function drawIsland(context: CanvasRenderingContext2D, timeMs: number) {
	// A wavy foam edge, then the sand: the foam slides a little so the water reads as alive
	const shore = SHORE_X - 0.15;
	context.beginPath();
	context.moveTo(shore, 0);
	for (let y = 0; y <= ROWS; y += 0.2) {
		context.lineTo(shore + Math.sin(y * 2.4 + timeMs / 900) * 0.1, y);
	}
	context.lineTo(COLUMNS, ROWS);
	context.lineTo(COLUMNS, 0);
	context.closePath();
	context.fillStyle = SAND;
	context.fill();
	context.lineWidth = 0.09;
	context.strokeStyle = INK;
	context.stroke();

	context.strokeStyle = PAPER;
	context.lineWidth = 0.14;
	context.beginPath();
	context.moveTo(shore, 0);
	for (let y = 0; y <= ROWS; y += 0.2) {
		context.lineTo(shore + Math.sin(y * 2.4 + timeMs / 900) * 0.1 - 0.18, y);
	}
	context.stroke();

	// A few patches of dry grass, kept out of the way of the buildings
	context.fillStyle = SAND_DARK;
	for (const patch of [
		{ x: 3.1, y: 2.2 },
		{ x: 3.4, y: 5.6 },
		{ x: 9.4, y: 6.7 },
		{ x: 8.4, y: 1.2 }
	]) {
		context.beginPath();
		context.ellipse(patch.x, patch.y, 0.34, 0.18, -0.3, 0, Math.PI * 2);
		context.fill();
	}

	for (const palm of PALMS) drawPalm(context, palm.x, palm.y, timeMs);
}

function drawPalm(context: CanvasRenderingContext2D, x: number, y: number, timeMs: number) {
	context.lineWidth = 0.1;
	context.strokeStyle = INK;
	context.beginPath();
	context.moveTo(x, y + 0.55);
	context.quadraticCurveTo(x + 0.1, y + 0.25, x + 0.02, y + 0.05);
	context.stroke();
	context.strokeStyle = KHAKI;
	context.lineWidth = 0.06;
	context.stroke();
	const sway = Math.sin(timeMs / 800 + x) * 0.04;
	for (const angle of [-0.9, -0.3, 0.3, 0.9]) {
		context.beginPath();
		context.moveTo(x + 0.02, y + 0.05);
		context.quadraticCurveTo(
			x + Math.cos(angle) * 0.3 + sway,
			y + 0.05 + Math.sin(angle) * 0.22,
			x + Math.cos(angle) * 0.45 + sway,
			y + 0.05 + Math.sin(angle) * 0.36
		);
		context.strokeStyle = INK;
		context.lineWidth = 0.08;
		context.stroke();
		context.strokeStyle = KHAKI;
		context.lineWidth = 0.045;
		context.stroke();
	}
}

function drawRubble(context: CanvasRenderingContext2D, building: Building, timeMs: number) {
	const x = building.x + building.width / 2;
	const y = building.y + building.height / 2;
	context.fillStyle = SMOKE;
	context.globalAlpha = 0.35;
	for (let puff = 0; puff < 3; puff++) {
		const rise = ((timeMs / 1600 + puff / 3) % 1) * 0.5;
		context.beginPath();
		context.arc(
			x + Math.sin(puff * 2 + timeMs / 1200) * 0.12,
			y - 0.2 - rise,
			0.18,
			0,
			Math.PI * 2
		);
		context.fill();
	}
	context.globalAlpha = 1;
	rect(
		context,
		building.x + 0.12,
		building.y + 0.16,
		building.width * 0.5,
		building.height * 0.35,
		STEEL
	);
	rect(
		context,
		building.x + building.width * 0.42,
		building.y + building.height * 0.5,
		building.width * 0.4,
		building.height * 0.28,
		SMOKE
	);
}

function drawHq(context: CanvasRenderingContext2D, building: Building, timeMs: number) {
	const { x, y, width, height } = building;
	rect(context, x + 0.12, y + 0.35, width - 0.24, height - 0.5, BANNER_SLATE);
	rect(context, x + 0.05, y + 0.18, width - 0.1, 0.42, STEEL);
	rect(context, x + 0.5, y + height - 0.62, width - 1, 0.4, INK);
	// The flag: a pole and a waving triangle, so the headquarters reads at a glance
	context.strokeStyle = INK;
	context.lineWidth = 0.09;
	context.beginPath();
	context.moveTo(x + width / 2, y + 0.18);
	context.lineTo(x + width / 2, y - 0.38);
	context.stroke();
	const wave = Math.sin(timeMs / 260) * 0.07;
	context.beginPath();
	context.moveTo(x + width / 2, y - 0.38);
	context.lineTo(x + width / 2 + 0.55, y - 0.3 + wave);
	context.lineTo(x + width / 2, y - 0.16);
	context.closePath();
	context.fillStyle = TIE_RED;
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.05;
	context.stroke();
	circle(context, x + width / 2, y + height / 2 + 0.12, 0.22, EXPLOSION_YELLOW);
	context.fillStyle = INK;
	context.font = `bold 0.26px ${DISPLAY_FONT}`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText('★', x + width / 2, y + height / 2 + 0.14);
}

function drawCannon(context: CanvasRenderingContext2D, building: Building) {
	const cx = building.x + 0.5;
	const cy = building.y + 0.5;
	rect(context, building.x + 0.16, building.y + 0.28, 0.68, 0.55, KHAKI);
	circle(context, cx, cy + 0.12, 0.22, STEEL);
	context.strokeStyle = INK;
	context.lineWidth = 0.16;
	context.beginPath();
	context.moveTo(cx, cy);
	context.lineTo(cx - 0.42, cy - 0.18);
	context.stroke();
	context.strokeStyle = STEEL;
	context.lineWidth = 0.09;
	context.stroke();
}

function drawSniper(context: CanvasRenderingContext2D, building: Building) {
	const cx = building.x + 0.5;
	rect(context, building.x + 0.32, building.y + 0.38, 0.36, 0.5, BANNER_SLATE);
	rect(context, building.x + 0.24, building.y + 0.14, 0.52, 0.3, STEEL);
	context.strokeStyle = INK;
	context.lineWidth = 0.12;
	context.beginPath();
	context.moveTo(cx, building.y + 0.24);
	context.lineTo(cx - 0.4, building.y + 0.08);
	context.stroke();
	circle(context, cx, building.y + 0.16, 0.12, EXPLOSION_YELLOW);
}

function drawMg(context: CanvasRenderingContext2D, building: Building) {
	const cx = building.x + 0.5;
	const cy = building.y + 0.5;
	// Sandbags, then the gun behind them
	context.fillStyle = KHAKI;
	for (let bag = 0; bag < 4; bag++) {
		const angle = Math.PI + (bag / 3) * Math.PI;
		circle(
			context,
			cx + Math.cos(angle) * 0.32,
			cy + 0.2 + Math.sin(angle) * 0.24,
			0.13,
			KHAKI,
			0.04
		);
	}
	circle(context, cx, cy, 0.14, STEEL);
	context.strokeStyle = INK;
	context.lineWidth = 0.14;
	context.beginPath();
	context.moveTo(cx, cy);
	context.lineTo(cx - 0.42, cy - 0.1);
	context.stroke();
	context.strokeStyle = STEEL;
	context.lineWidth = 0.07;
	context.stroke();
}

function drawMortar(context: CanvasRenderingContext2D, building: Building) {
	const cx = building.x + 0.5;
	const cy = building.y + 0.55;
	// Sandbags around the base plate, then the steep tube
	context.fillStyle = KHAKI;
	for (let bag = 0; bag < 5; bag++) {
		const angle = Math.PI + (bag / 4) * Math.PI;
		circle(
			context,
			cx + Math.cos(angle) * 0.33,
			cy + 0.16 + Math.sin(angle) * 0.2,
			0.12,
			KHAKI,
			0.04
		);
	}
	circle(context, cx, cy, 0.24, STEEL);
	context.strokeStyle = INK;
	context.lineWidth = 0.2;
	context.beginPath();
	context.moveTo(cx, cy);
	context.lineTo(cx + 0.34, cy - 0.46);
	context.stroke();
	context.strokeStyle = STEEL;
	context.lineWidth = 0.12;
	context.stroke();
	circle(context, cx + 0.36, cy - 0.48, 0.1, INK);
}

function drawFpvNest(context: CanvasRenderingContext2D, building: Building, timeMs: number) {
	const cx = building.x + 0.5;
	// A short mast with an antenna, and a drone circling above it
	rect(context, building.x + 0.3, building.y + 0.52, 0.4, 0.32, STEEL);
	context.strokeStyle = INK;
	context.lineWidth = 0.09;
	context.beginPath();
	context.moveTo(cx, building.y + 0.52);
	context.lineTo(cx, building.y + 0.08);
	context.stroke();
	circle(context, cx, building.y + 0.06, 0.09, EXPLOSION_YELLOW);
	const droneX = cx + Math.cos(timeMs / 520) * 0.34;
	const droneY = building.y + 0.12 + Math.sin(timeMs / 520) * 0.12;
	context.strokeStyle = 'rgba(17,17,17,0.35)';
	context.lineWidth = 0.04;
	context.setLineDash([0.06, 0.06]);
	context.beginPath();
	context.moveTo(cx, building.y + 0.12);
	context.lineTo(droneX, droneY);
	context.stroke();
	context.setLineDash([]);
	for (const [dx, dy] of [
		[-0.11, -0.05],
		[0.11, -0.05],
		[-0.11, 0.05],
		[0.11, 0.05]
	] as const) {
		circle(context, droneX + dx, droneY + dy, 0.055, INK, 0);
	}
	circle(context, droneX, droneY, 0.05, TIE_RED, 0.02);
}

function drawAirDefence(context: CanvasRenderingContext2D, building: Building) {
	const cx = building.x + 0.5;
	// A rotating launcher box with three missiles and a small radar dish
	rect(context, building.x + 0.18, building.y + 0.42, 0.64, 0.34, KHAKI);
	context.strokeStyle = INK;
	context.lineWidth = 0.09;
	for (const offset of [-0.16, 0, 0.16]) {
		context.beginPath();
		context.moveTo(cx + offset, building.y + 0.48);
		context.lineTo(cx + offset + 0.1, building.y + 0.12);
		context.stroke();
		circle(context, cx + offset + 0.1, building.y + 0.12, 0.065, TIE_RED, 0.03);
	}
	context.beginPath();
	context.arc(cx, building.y + 0.38, 0.14, Math.PI, Math.PI * 2);
	context.strokeStyle = STEEL;
	context.lineWidth = 0.06;
	context.stroke();
}

function drawFlame(context: CanvasRenderingContext2D, building: Building, timeMs: number) {
	const cx = building.x + 0.5;
	// Two fuel drums and a short nozzle, with a pilot flame flickering
	rect(context, building.x + 0.16, building.y + 0.42, 0.28, 0.38, TIE_RED);
	rect(context, building.x + 0.48, building.y + 0.42, 0.24, 0.38, MUSTARD);
	context.strokeStyle = INK;
	context.lineWidth = 0.12;
	context.beginPath();
	context.moveTo(cx, building.y + 0.46);
	context.lineTo(cx - 0.36, building.y + 0.34);
	context.stroke();
	const flicker = 0.05 + Math.sin(timeMs / 90) * 0.02;
	circle(context, cx - 0.4, building.y + 0.33, flicker, EXPLOSION_YELLOW, 0);
	context.fillStyle = TIE_RED;
	context.beginPath();
	context.moveTo(cx - 0.4, building.y + 0.3);
	context.lineTo(cx - 0.4, building.y + 0.38);
	context.lineTo(cx - 0.48, building.y + 0.34);
	context.closePath();
	context.fill();
}

function drawDepot(context: CanvasRenderingContext2D, building: Building) {
	const x = building.x;
	const y = building.y;
	rect(context, x + 0.12, y + 0.36, 0.44, 0.44, MUSTARD);
	rect(context, x + 0.46, y + 0.24, 0.38, 0.38, SAND_DARK);
	context.strokeStyle = INK;
	context.lineWidth = 0.035;
	context.beginPath();
	context.moveTo(x + 0.12, y + 0.58);
	context.lineTo(x + 0.56, y + 0.58);
	context.moveTo(x + 0.46, y + 0.43);
	context.lineTo(x + 0.84, y + 0.43);
	context.stroke();
}

function drawDamageSmoke(context: CanvasRenderingContext2D, building: Building, timeMs: number) {
	const ratio = building.hp / building.maxHp;
	if (ratio > 0.55) return;
	context.fillStyle = SMOKE;
	const puffs = ratio < 0.25 ? 4 : 2;
	for (let puff = 0; puff < puffs; puff++) {
		const drift = ((timeMs / 1800 + puff / puffs) % 1) * 0.45;
		const x = building.x + 0.25 + puff * 0.16 + Math.sin(timeMs / 500 + puff) * 0.05;
		const y = building.y + 0.25 - drift;
		context.globalAlpha = 0.32 * (1 - drift / 0.45);
		context.beginPath();
		context.arc(x, y, 0.09 + drift * 0.35, 0, Math.PI * 2);
		context.fill();
	}
	context.globalAlpha = 1;
}

function drawBuilding(context: CanvasRenderingContext2D, building: Building, timeMs: number) {
	if (building.destroyed) {
		drawRubble(context, building, timeMs);
		return;
	}
	context.save();
	if (building.recoilMs > 0) {
		const kick = building.recoilMs / 170;
		context.translate(Math.sin(building.recoilMs * 0.19) * 0.035 * kick, 0.02 * kick);
	}
	switch (building.kind) {
		case 'hq':
			drawHq(context, building, timeMs);
			break;
		case 'field-cannon':
			drawCannon(context, building);
			break;
		case 'mortar':
			drawMortar(context, building);
			break;
		case 'fpv-nest':
			drawFpvNest(context, building, timeMs);
			break;
		case 'air-defence':
			drawAirDefence(context, building);
			break;
		case 'sniper':
			drawSniper(context, building);
			break;
		case 'mg':
			drawMg(context, building);
			break;
		case 'flame':
			drawFlame(context, building, timeMs);
			break;
		case 'depot':
			drawDepot(context, building);
			break;
	}
	if (building.recoilMs > 0 && BUILDING_MUZZLE.has(building.kind)) {
		const flash = building.recoilMs / 170;
		const cx = building.x + 0.1;
		const cy = building.y + 0.42;
		context.fillStyle = EXPLOSION_YELLOW;
		context.globalAlpha = flash;
		context.beginPath();
		context.moveTo(cx, cy);
		context.lineTo(cx - 0.28 * flash, cy - 0.11 * flash);
		context.lineTo(cx - 0.18 * flash, cy + 0.06 * flash);
		context.closePath();
		context.fill();
		context.globalAlpha = 1;
	}
	context.restore();
	drawDamageSmoke(context, building, timeMs);
	if (building.hp < building.maxHp) {
		healthBar(
			context,
			building.x + 0.15,
			building.y - 0.16,
			building.width - 0.3,
			building.hp / building.maxHp,
			TIE_RED
		);
	}
	if (building.flashMs > 0) {
		context.globalAlpha = Math.min(0.6, building.flashMs / 160);
		rect(context, building.x, building.y, building.width, building.height, PAPER, 0);
		context.globalAlpha = 1;
	}
}

/** A pair of walking legs, drawn in the troop's own rotated frame */
function drawLegs(context: CanvasRenderingContext2D, troop: Troop) {
	const stride = troop.moving ? Math.sin(troop.walkPhase) * 0.06 : 0;
	context.strokeStyle = INK;
	context.lineWidth = 0.035;
	context.beginPath();
	context.moveTo(-0.02, 0.05);
	context.lineTo(-0.02 + stride, 0.17);
	context.moveTo(0.05, 0.05);
	context.lineTo(0.05 - stride, 0.17);
	context.stroke();
}

function drawMuzzle(
	context: CanvasRenderingContext2D,
	troop: Troop,
	length: number,
	spread: number
) {
	if (troop.muzzleMs <= 0) return;
	const flash = troop.muzzleMs / TROOP.muzzleMs;
	context.fillStyle = EXPLOSION_YELLOW;
	context.globalAlpha = flash;
	context.beginPath();
	context.moveTo(length, -0.02);
	context.lineTo(length + 0.12, -spread * flash);
	context.lineTo(length + 0.07, 0.02);
	context.closePath();
	context.fill();
	context.globalAlpha = 1;
}

function drawRifleman(context: CanvasRenderingContext2D, troop: Troop) {
	drawLegs(context, troop);
	circle(context, 0, 0, 0.115, KHAKI, 0.035);
	circle(context, 0.03, -0.1, 0.07, SKIN, 0.03);
	context.fillStyle = KHAKI;
	context.beginPath();
	context.arc(0.03, -0.11, 0.075, Math.PI, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.025;
	context.stroke();
	context.strokeStyle = INK;
	context.lineWidth = 0.035;
	context.beginPath();
	context.moveTo(0.05, -0.02);
	context.lineTo(0.28, -0.02);
	context.stroke();
	drawMuzzle(context, troop, 0.28, 0.08);
}

function drawTank(context: CanvasRenderingContext2D, troop: Troop) {
	// Treads with rolling links, a squat hull and a turret with a long barrel
	context.fillStyle = STEEL;
	context.strokeStyle = INK;
	context.lineWidth = 0.035;
	for (const side of [-1, 1]) {
		context.beginPath();
		context.roundRect(-0.24, side * 0.1 - 0.06, 0.48, 0.12, 0.03);
		context.fill();
		context.stroke();
		const roll = troop.moving ? (troop.walkPhase * 0.06) % 0.12 : 0;
		context.fillStyle = KHAKI;
		for (let link = 0; link < 4; link++) {
			context.fillRect(-0.2 + ((link * 0.12 + roll) % 0.44), side * 0.1 - 0.03, 0.05, 0.06);
		}
		context.fillStyle = STEEL;
	}
	const hull = KHAKI;
	context.beginPath();
	context.roundRect(-0.2, -0.15, 0.4, 0.3, 0.06);
	context.fillStyle = hull;
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.035;
	context.stroke();
	// A lighter stripe, so the hull reads as painted metal
	context.fillStyle = SAND_DARK;
	context.fillRect(-0.16, 0.01, 0.32, 0.035);
	circle(context, 0.02, -0.02, 0.1, KHAKI, 0.035);
	context.strokeStyle = INK;
	context.lineWidth = 0.05;
	context.beginPath();
	context.moveTo(0.06, -0.03);
	context.lineTo(0.4, -0.03);
	context.stroke();
	drawMuzzle(context, troop, 0.4, 0.1);
}

function drawMortarTeam(context: CanvasRenderingContext2D, troop: Troop) {
	// Two kneeling crew behind a steep tube, so the lobbed shots read at a glance
	drawLegs(context, troop);
	circle(context, -0.04, 0.02, 0.1, KHAKI, 0.03);
	circle(context, 0.02, -0.09, 0.06, SKIN, 0.025);
	context.fillStyle = STEEL;
	context.beginPath();
	context.roundRect(-0.12, -0.02, 0.24, 0.14, 0.03);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.03;
	context.stroke();
	context.strokeStyle = INK;
	context.lineWidth = 0.07;
	context.beginPath();
	context.moveTo(-0.04, 0.02);
	context.lineTo(0.2, -0.18);
	context.stroke();
	context.strokeStyle = STEEL;
	context.lineWidth = 0.045;
	context.stroke();
	circle(context, -0.06, 0.1, 0.06, MUSTARD, 0.025);
	if (troop.muzzleMs > 0) {
		const flash = troop.muzzleMs / TROOP.muzzleMs;
		context.globalAlpha = flash;
		circle(context, 0.23, -0.21, 0.06 + flash * 0.04, EXPLOSION_YELLOW, 0);
		context.globalAlpha = 1;
	}
}

function drawDroneOperator(context: CanvasRenderingContext2D, troop: Troop, timeMs: number) {
	drawLegs(context, troop);
	circle(context, 0, 0, 0.115, BANNER_SLATE, 0.035);
	circle(context, 0.03, -0.1, 0.07, SKIN, 0.03);
	context.fillStyle = BANNER_SLATE;
	context.beginPath();
	context.arc(0.03, -0.11, 0.075, Math.PI, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.025;
	context.stroke();
	// The controller and its antenna
	context.strokeStyle = INK;
	context.lineWidth = 0.03;
	context.beginPath();
	context.moveTo(0.04, 0.04);
	context.lineTo(0.16, -0.02);
	context.stroke();
	context.beginPath();
	context.moveTo(0.12, -0.02);
	context.lineTo(0.12, -0.12);
	context.stroke();
	// The quadcopter hovers above, its rotors a blur
	const hover = Math.sin(timeMs / 220 + troop.id) * 0.03;
	const dx = 0.02;
	const dy = -0.32 + hover;
	context.strokeStyle = 'rgba(17,17,17,0.35)';
	context.lineWidth = 0.02;
	context.setLineDash([0.04, 0.05]);
	context.beginPath();
	context.moveTo(0.12, -0.12);
	context.lineTo(dx, dy + 0.04);
	context.stroke();
	context.setLineDash([]);
	for (const [ox, oy] of [
		[-0.09, -0.04],
		[0.09, -0.04],
		[-0.09, 0.04],
		[0.09, 0.04]
	] as const) {
		circle(context, dx + ox, dy + oy, 0.045, INK, 0);
	}
	circle(context, dx, dy, 0.045, TIE_RED, 0.02);
}

function drawMedic(context: CanvasRenderingContext2D, troop: Troop) {
	drawLegs(context, troop);
	circle(context, 0, 0, 0.115, PAPER, 0.035);
	// A red cross on the chest
	context.fillStyle = TIE_RED;
	context.fillRect(-0.03, -0.07, 0.06, 0.14);
	context.fillRect(-0.07, -0.03, 0.14, 0.06);
	circle(context, 0.03, -0.11, 0.07, SKIN, 0.03);
	context.fillStyle = PAPER;
	context.beginPath();
	context.arc(0.03, -0.12, 0.075, Math.PI, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.025;
	context.stroke();
	// A small satchel with another cross
	rect(context, -0.16, 0.0, 0.09, 0.1, PAPER, 0.02);
	context.fillStyle = TIE_RED;
	context.fillRect(-0.13, 0.02, 0.03, 0.06);
	context.fillRect(-0.145, 0.035, 0.06, 0.03);
	context.strokeStyle = INK;
	context.lineWidth = 0.03;
	context.beginPath();
	context.moveTo(0.05, -0.02);
	context.lineTo(0.2, -0.02);
	context.stroke();
	drawMuzzle(context, troop, 0.2, 0.05);
}

function drawHero(context: CanvasRenderingContext2D, troop: Troop, timeMs: number) {
	// Bigger than the troops, shaven head, grey beard, black jacket and the healing hammer
	context.save();
	context.scale(1.25, 1.25);
	drawLegs(context, troop);
	circle(context, 0, 0, 0.13, STEEL, 0.04);
	context.fillStyle = KHAKI;
	context.fillRect(-0.1, 0.02, 0.2, 0.05);
	circle(context, 0.03, -0.12, 0.08, SKIN, 0.03);
	// Grey beard and a flat cap
	context.fillStyle = '#c9c4bb';
	context.beginPath();
	context.arc(0.05, -0.1, 0.06, 0, Math.PI);
	context.fill();
	context.fillStyle = STEEL;
	context.beginPath();
	context.arc(0.03, -0.14, 0.08, Math.PI, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.025;
	context.stroke();
	context.fillRect(-0.01, -0.2, 0.14, 0.025);
	// The hammer swings while it is on cooldown, then rests on the shoulder
	const swing =
		troop.attackMs > 0
			? Math.sin((1 - Math.min(1, troop.cooldownMs / troop.attackMs)) * Math.PI) * 0.9
			: 0;
	context.save();
	context.translate(-0.02, -0.06);
	context.rotate(-0.5 - swing);
	context.strokeStyle = INK;
	context.lineWidth = 0.05;
	context.beginPath();
	context.moveTo(0, 0);
	context.lineTo(0, -0.34);
	context.stroke();
	rect(context, -0.09, -0.46, 0.18, 0.14, MUSTARD, 0.03);
	context.restore();
	// A faint pulse while the heal is ready to fire
	if (troop.healEveryMs && troop.healCooldownMs < 400) {
		context.globalAlpha = 0.35;
		circle(context, 0, 0.05, 0.24 + Math.sin(timeMs / 120) * 0.03, HEAL_GREEN, 0);
		context.globalAlpha = 1;
	}
	context.restore();
}

function drawArtillery(context: CanvasRenderingContext2D, troop: Troop) {
	// A towed howitzer: split trail, two wheels and a long barrel pointed at the island
	context.strokeStyle = INK;
	context.lineWidth = 0.04;
	context.beginPath();
	context.moveTo(-0.2, 0.14);
	context.lineTo(0.12, 0.02);
	context.moveTo(-0.2, -0.14);
	context.lineTo(0.12, -0.02);
	context.stroke();
	for (const side of [-1, 1]) {
		circle(context, -0.02, side * 0.12, 0.075, STEEL, 0.03);
		circle(context, -0.02, side * 0.12, 0.028, SAND_DARK, 0);
	}
	rect(context, -0.12, -0.07, 0.24, 0.14, KHAKI, 0.03);
	context.strokeStyle = INK;
	context.lineWidth = 0.07;
	context.beginPath();
	context.moveTo(0.02, -0.02);
	context.lineTo(0.42, -0.13);
	context.stroke();
	context.strokeStyle = STEEL;
	context.lineWidth = 0.04;
	context.stroke();
	circle(context, 0.02, -0.02, 0.05, MUSTARD, 0.02);
	// The crewman crouches behind the breech
	circle(context, -0.16, 0.02, 0.075, KHAKI, 0.03);
	circle(context, -0.14, -0.07, 0.05, SKIN, 0.02);
	drawMuzzle(context, troop, 0.42, 0.08);
}

function drawApc(context: CanvasRenderingContext2D, troop: Troop) {
	// A boxy M113: sloped front, tracks and a rear ramp the reinforcements walk out of
	context.fillStyle = STEEL;
	context.strokeStyle = INK;
	context.lineWidth = 0.035;
	for (const side of [-1, 1]) {
		context.beginPath();
		context.roundRect(-0.27, side * 0.11 - 0.07, 0.54, 0.14, 0.03);
		context.fill();
		context.stroke();
		const roll = troop.moving ? (troop.walkPhase * 0.07) % 0.14 : 0;
		context.fillStyle = KHAKI;
		for (let link = 0; link < 4; link++) {
			context.fillRect(-0.23 + ((link * 0.14 + roll) % 0.5), side * 0.11 - 0.04, 0.06, 0.08);
		}
		context.fillStyle = STEEL;
	}
	context.beginPath();
	context.moveTo(-0.24, -0.1);
	context.lineTo(0.16, -0.13);
	context.lineTo(0.27, -0.03);
	context.lineTo(0.27, 0.06);
	context.lineTo(0.16, 0.13);
	context.lineTo(-0.24, 0.1);
	context.closePath();
	context.fillStyle = KHAKI;
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.04;
	context.stroke();
	// A hatch, a vision block and the ramp at the back
	rect(context, -0.04, -0.09, 0.14, 0.1, SAND_DARK, 0.025);
	context.fillStyle = STEEL;
	context.fillRect(0.14, -0.04, 0.08, 0.045);
	rect(context, -0.28, -0.11, 0.06, 0.22, STEEL, 0.025);
	context.fillStyle = EXPLOSION_YELLOW;
	context.fillRect(-0.3, -0.03, 0.03, 0.06);
}

function drawDemo(context: CanvasRenderingContext2D, troop: Troop, timeMs: number) {
	// A small, fast sapper with a bundle of dynamite and a burning fuse
	drawLegs(context, troop);
	circle(context, 0, 0, 0.105, TIE_RED, 0.035);
	context.fillStyle = MUSTARD;
	context.fillRect(-0.02, -0.06, 0.05, 0.12);
	circle(context, 0.03, -0.1, 0.065, SKIN, 0.03);
	context.fillStyle = TIE_RED;
	context.beginPath();
	context.arc(0.03, -0.115, 0.068, Math.PI, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.025;
	context.stroke();
	// The charge, carried in both hands in front
	const bundle = 0.16;
	rect(context, bundle, -0.06, 0.12, 0.12, MUSTARD, 0.025);
	context.strokeStyle = INK;
	context.lineWidth = 0.02;
	context.beginPath();
	context.moveTo(bundle + 0.02, -0.02);
	context.lineTo(bundle + 0.04, 0.06);
	context.moveTo(bundle + 0.06, -0.02);
	context.lineTo(bundle + 0.06, 0.06);
	context.stroke();
	const spark = 0.02 + Math.abs(Math.sin(timeMs / 90 + troop.id)) * 0.025;
	circle(context, bundle + 0.06, -0.09, spark, EXPLOSION_YELLOW, 0);
}

function drawHeavy(context: CanvasRenderingContext2D, troop: Troop) {
	// A bulky gunner behind a six-barrel minigun; the barrels spin while it fires
	context.save();
	context.scale(1.12, 1.12);
	drawLegs(context, troop);
	circle(context, -0.02, 0, 0.13, KHAKI, 0.04);
	context.fillStyle = STEEL;
	context.fillRect(-0.16, -0.06, 0.1, 0.14);
	circle(context, -0.02, -0.11, 0.075, SKIN, 0.03);
	context.fillStyle = BANNER_SLATE;
	context.beginPath();
	context.arc(-0.02, -0.12, 0.08, Math.PI, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.03;
	context.stroke();
	// The gun body, then the spinning barrel cluster
	const spin = troop.cooldownMs > 0 ? troop.cooldownMs / Math.max(1, troop.attackMs) : 0;
	rect(context, 0.02, -0.08, 0.14, 0.15, STEEL, 0.025);
	context.save();
	context.translate(0.16, -0.01);
	for (let barrel = 0; barrel < 6; barrel++) {
		const angle = spin * Math.PI * 6 + (barrel / 6) * Math.PI * 2;
		context.strokeStyle = barrel % 2 === 0 ? INK : STEEL;
		context.lineWidth = 0.035;
		context.beginPath();
		context.moveTo(0, 0);
		context.lineTo(0.24, Math.sin(angle) * 0.055);
		context.stroke();
	}
	context.restore();
	drawMuzzle(context, troop, 0.4, 0.07);
	context.restore();
}

function drawOrc(context: CanvasRenderingContext2D, troop: Troop) {
	// Simple green orc silhouette: broad shoulders, green skin, red eyes, club
	context.save();
	drawLegs(context, troop);
	context.fillStyle = '#3a6b1f';
	context.beginPath();
	context.arc(-0.02, -0.05, 0.14, Math.PI, 0);
	context.fill();
	context.fillStyle = '#2a4f14';
	context.fillRect(-0.1, -0.05, 0.08, 0.1);
	context.fillStyle = '#7a1a1a';
	context.beginPath();
	context.arc(0.06, -0.08, 0.03, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = '#5a3a18';
	context.fillRect(0.1, -0.02, 0.08, 0.06);
	context.restore();
}

function drawTroop(context: CanvasRenderingContext2D, troop: Troop, timeMs: number) {
	context.fillStyle = 'rgba(17,17,17,0.25)';
	context.beginPath();
	context.ellipse(
		troop.x,
		troop.y + (troop.kind === 'tank' ? 0.2 : 0.16),
		troop.kind === 'tank' ? 0.28 : 0.14,
		troop.kind === 'tank' ? 0.1 : 0.06,
		0,
		0,
		Math.PI * 2
	);
	context.fill();

	const walking = troop.moving;
	const bob = walking
		? Math.abs(Math.sin(troop.walkPhase)) * 0.025
		: Math.sin(timeMs / 700 + troop.id) * 0.006;
	const angle = Math.atan2(troop.aimY, troop.aimX);
	context.save();
	context.translate(troop.x, troop.y - 0.02 + bob);
	context.rotate(angle);

	switch (troop.kind) {
		case 'tank':
			drawTank(context, troop);
			break;
		case 'mortar':
			drawMortarTeam(context, troop);
			break;
		case 'drone':
			drawDroneOperator(context, troop, timeMs);
			break;
		case 'medic':
			drawMedic(context, troop);
			break;
		case 'hero':
			drawHero(context, troop, timeMs);
			break;
		case 'artillery':
			drawArtillery(context, troop);
			break;
		case 'apc':
			drawApc(context, troop);
			break;
		case 'demo':
			drawDemo(context, troop, timeMs);
			break;
		case 'heavy':
			drawHeavy(context, troop);
			break;
		case 'orc':
			drawOrc(context, troop);
			break;
		default:
			drawRifleman(context, troop);
			break;
	}
	context.restore();

	if (troop.stunMs > 0) {
		context.fillStyle = EXPLOSION_YELLOW;
		for (let star = 0; star < 3; star++) {
			const orbit = timeMs / 160 + (star / 3) * Math.PI * 2;
			context.beginPath();
			context.arc(
				troop.x + Math.cos(orbit) * 0.18,
				troop.y - 0.25 + Math.sin(orbit) * 0.06,
				0.028,
				0,
				Math.PI * 2
			);
			context.fill();
		}
	}

	if (troop.flashMs > 0) {
		context.globalAlpha = Math.min(0.7, troop.flashMs / 150);
		circle(context, troop.x, troop.y, 0.16, PAPER, 0);
		context.globalAlpha = 1;
	}
	if (troop.hp < troop.maxHp) {
		healthBar(
			context,
			troop.x - 0.18,
			troop.y - (troop.kind === 'tank' ? 0.42 : 0.3),
			0.36,
			troop.hp / troop.maxHp,
			TIE_RED
		);
	}
}

function drawProjectile(context: CanvasRenderingContext2D, projectile: Projectile) {
	const progress = Math.min(1, projectile.ageMs / projectile.flightMs);
	const distance = Math.hypot(projectile.toX - projectile.fromX, projectile.toY - projectile.fromY);
	const arc =
		projectile.kind === 'shell'
			? Math.min(1.15, 0.3 + distance * 0.14)
			: projectile.kind === 'rocket'
				? 0.22
				: 0.4;
	const lift = Math.sin(progress * Math.PI) * arc;

	// A shadow on the ground and a faint trail behind the shot
	context.fillStyle = 'rgba(17,17,17,0.18)';
	context.beginPath();
	context.ellipse(projectile.x, projectile.y + 0.06, 0.1, 0.04, 0, 0, Math.PI * 2);
	context.fill();

	context.strokeStyle =
		projectile.kind === 'shell' ? 'rgba(255,255,255,0.4)' : 'rgba(229,72,77,0.35)';
	context.lineWidth = 0.03;
	context.beginPath();
	context.moveTo(projectile.fromX, projectile.fromY - 0.1);
	for (let step = 1; step <= 8; step++) {
		const t = (step / 8) * progress;
		context.lineTo(
			projectile.fromX + (projectile.toX - projectile.fromX) * t,
			projectile.fromY + (projectile.toY - projectile.fromY) * t - Math.sin(t * Math.PI) * arc
		);
	}
	context.stroke();

	const x = projectile.x;
	const y = projectile.y - lift;
	if (projectile.kind === 'shell') {
		circle(context, x, y, 0.1, STEEL);
		context.fillStyle = EXPLOSION_YELLOW;
		context.beginPath();
		context.arc(x - 0.04, y, 0.04, 0, Math.PI * 2);
		context.fill();
	} else if (projectile.kind === 'rocket') {
		context.save();
		context.translate(x, y);
		context.rotate(
			Math.atan2(projectile.toY - projectile.fromY, projectile.toX - projectile.fromX)
		);
		rect(context, -0.14, -0.055, 0.28, 0.11, TIE_RED, 0.025);
		context.fillStyle = EXPLOSION_YELLOW;
		context.beginPath();
		context.moveTo(-0.14, -0.05);
		context.lineTo(-0.28, 0);
		context.lineTo(-0.14, 0.05);
		context.closePath();
		context.fill();
		context.restore();
	} else {
		// A tiny quadcopter, rotors blurred into X shapes
		context.strokeStyle = INK;
		context.lineWidth = 0.03;
		context.beginPath();
		context.moveTo(x - 0.1, y - 0.06);
		context.lineTo(x + 0.1, y + 0.06);
		context.moveTo(x + 0.1, y - 0.06);
		context.lineTo(x - 0.1, y + 0.06);
		context.stroke();
		circle(context, x, y, 0.055, TIE_RED, 0.02);
	}
}

function drawGroundZones(context: CanvasRenderingContext2D, state: BattleState, timeMs: number) {
	const heal = state.heal;
	if (heal) {
		const fade = Math.min(1, heal.remainingMs / 700);
		context.globalAlpha = 0.22 * fade;
		circle(context, heal.x, heal.y, heal.radius, HEAL_GREEN, 0);
		context.globalAlpha = 0.7 * fade;
		context.strokeStyle = HEAL_GREEN;
		context.lineWidth = 0.06;
		context.setLineDash([0.2, 0.14]);
		context.beginPath();
		context.arc(
			heal.x,
			heal.y,
			heal.radius * (0.92 + Math.sin(timeMs / 320) * 0.05),
			0,
			Math.PI * 2
		);
		context.stroke();
		context.setLineDash([]);
		// A soft cross in the middle marks the circle as healing rather than damage
		context.fillStyle = HEAL_GREEN;
		context.fillRect(heal.x - 0.06, heal.y - 0.24, 0.12, 0.48);
		context.fillRect(heal.x - 0.24, heal.y - 0.06, 0.48, 0.12);
		context.globalAlpha = 1;
	}

	const flare = state.flare;
	if (flare) {
		const pulse = 1 + Math.sin(timeMs / 150) * 0.16;
		const fade = Math.min(1, flare.remainingMs / 600);
		context.globalAlpha = 0.75 * fade;
		context.strokeStyle = TIE_RED;
		context.lineWidth = 0.09;
		context.beginPath();
		context.arc(flare.x, flare.y, 0.34 * pulse, 0, Math.PI * 2);
		context.stroke();
		context.strokeStyle = FLARE_ORANGE;
		context.lineWidth = 0.05;
		context.beginPath();
		context.arc(flare.x, flare.y, 0.58 * pulse, 0, Math.PI * 2);
		context.stroke();
		context.fillStyle = FLARE_ORANGE;
		context.beginPath();
		context.arc(flare.x, flare.y, 0.12, 0, Math.PI * 2);
		context.fill();
		// A thin beam, so the marker is visible even over a building
		context.globalAlpha = 0.28 * fade;
		context.fillRect(flare.x - 0.035, flare.y - 1.4, 0.07, 1.3);
		context.globalAlpha = 1;
	}
}

function drawSmokeScreen(context: CanvasRenderingContext2D, smoke: SkillZone, timeMs: number) {
	const fade = Math.min(1, smoke.remainingMs / 900);
	context.globalAlpha = 0.72 * fade;
	for (let puff = 0; puff < 12; puff++) {
		const angle = (puff / 12) * Math.PI * 2;
		const orbit = smoke.radius * (0.35 + (puff % 4) * 0.16);
		const x = smoke.x + Math.cos(angle + timeMs / 2600) * orbit;
		const y = smoke.y + Math.sin(angle + timeMs / 2600) * orbit * 0.62;
		circle(context, x, y, 0.38 + (puff % 3) * 0.1, puff % 2 === 0 ? SMOKE : '#8a919c', 0);
	}
	context.globalAlpha = 1;
}

function drawSkillStrike(context: CanvasRenderingContext2D, strike: SkillStrike, timeMs: number) {
	const progress = Math.min(1, Math.max(0, strike.ageMs / strike.delayMs));
	const travel = 1 - progress;
	const x = strike.x + 4.6 * travel;
	const y = strike.y - 5.2 * travel;
	const angle = Math.atan2(strike.y - y, strike.x - x);

	// Ground marker, so the player can see where the strike is aimed
	context.globalAlpha = 0.45 * (0.6 + progress * 0.4);
	context.strokeStyle = TIE_RED;
	context.lineWidth = 0.06;
	context.setLineDash([0.18, 0.12]);
	context.beginPath();
	context.arc(strike.x, strike.y, strike.radius, 0, Math.PI * 2);
	context.stroke();
	context.setLineDash([]);
	context.globalAlpha = 1;

	// A faint trail behind the falling shot
	context.strokeStyle =
		strike.skill === 'flamingo' ? 'rgba(229,72,77,0.45)' : 'rgba(245,200,58,0.4)';
	context.lineWidth = 0.05;
	context.beginPath();
	context.moveTo(x + Math.cos(angle) * -0.9, y + Math.sin(angle) * -0.9);
	context.lineTo(x, y);
	context.stroke();

	context.save();
	context.translate(x, y);
	context.rotate(angle);
	if (strike.skill === 'flamingo') {
		rect(context, -0.28, -0.09, 0.55, 0.18, PAPER, 0.035);
		context.fillStyle = TIE_RED;
		context.beginPath();
		context.moveTo(0.27, -0.09);
		context.lineTo(0.46, 0);
		context.lineTo(0.27, 0.09);
		context.closePath();
		context.fill();
		context.fillStyle = EXPLOSION_YELLOW;
		context.beginPath();
		context.moveTo(-0.28, -0.07);
		context.lineTo(-0.5 - Math.sin(timeMs / 26) * 0.08, 0);
		context.lineTo(-0.28, 0.07);
		context.closePath();
		context.fill();
	} else {
		circle(context, 0, 0, 0.11, EXPLOSION_YELLOW, 0.03);
		context.fillStyle = STEEL;
		context.beginPath();
		context.arc(-0.03, 0, 0.05, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();
}

function drawFocus(context: CanvasRenderingContext2D, state: BattleState, timeMs: number) {
	const building = state.buildings.find((candidate) => candidate.id === state.focusId);
	if (!building || building.destroyed) return;
	const cx = building.x + building.width / 2;
	const cy = building.y + building.height / 2;
	const pulse = 1 + Math.sin(timeMs / 180) * 0.12;
	context.strokeStyle = EXPLOSION_YELLOW;
	context.lineWidth = 0.09;
	context.setLineDash([0.18, 0.12]);
	context.beginPath();
	context.arc(cx, cy, Math.max(building.width, building.height) * 0.75 * pulse, 0, Math.PI * 2);
	context.stroke();
	context.setLineDash([]);
}

function drawDeployHint(context: CanvasRenderingContext2D, state: BattleState, timeMs: number) {
	if (state.status !== 'playing' || state.squadsLeft <= 0) return;
	context.globalAlpha = 0.5 + Math.sin(timeMs / 420) * 0.18;
	context.strokeStyle = PAPER;
	context.fillStyle = PAPER;
	context.lineWidth = 0.05;
	for (let row = 0; row < ROWS; row++) {
		const x = 1.35;
		const y = row + 0.5;
		context.beginPath();
		context.moveTo(x - 0.12, y - 0.1);
		context.lineTo(x + 0.12, y);
		context.lineTo(x - 0.12, y + 0.1);
		context.stroke();
	}
	context.globalAlpha = 1;
}

function drawEffect(context: CanvasRenderingContext2D, effect: Effect) {
	const progress = Math.min(1, effect.ageMs / effect.durationMs);
	switch (effect.kind) {
		case 'tracer': {
			context.globalAlpha = 1 - progress;
			context.strokeStyle = effect.friendly ? EXPLOSION_YELLOW : TIE_RED;
			context.lineWidth = 0.05;
			context.beginPath();
			context.moveTo(effect.fromX, effect.fromY);
			context.lineTo(effect.toX, effect.toY);
			context.stroke();
			context.globalAlpha = 1;
			break;
		}
		case 'explosion': {
			const radius = effect.size * (0.3 + progress * 0.9);
			context.globalAlpha = 1 - progress;
			circle(context, effect.x, effect.y, radius, TIE_RED, 0);
			circle(context, effect.x, effect.y, radius * 0.6, EXPLOSION_YELLOW, 0);
			context.fillStyle = SMOKE;
			for (let particle = 0; particle < 6; particle++) {
				const angle = (particle / 6) * Math.PI * 2;
				const distance = radius * 1.4;
				context.beginPath();
				context.arc(
					effect.x + Math.cos(angle) * distance,
					effect.y + Math.sin(angle) * distance,
					0.06 * (1 - progress),
					0,
					Math.PI * 2
				);
				context.fill();
			}
			context.globalAlpha = 1;
			break;
		}
		case 'splash': {
			context.globalAlpha = 1 - progress;
			context.strokeStyle = PAPER;
			context.lineWidth = 0.05;
			context.beginPath();
			context.arc(effect.x, effect.y, 0.12 + progress * 0.3, 0, Math.PI * 2);
			context.stroke();
			context.globalAlpha = 1;
			break;
		}
		case 'down': {
			context.globalAlpha = 1 - progress;
			context.fillStyle = SMOKE;
			for (let puff = 0; puff < 3; puff++) {
				context.beginPath();
				context.arc(
					effect.x + (puff - 1) * 0.07,
					effect.y - progress * 0.3,
					0.06 + progress * 0.04,
					0,
					Math.PI * 2
				);
				context.fill();
			}
			context.globalAlpha = 1;
			break;
		}
		case 'flame': {
			const dx = effect.toX - effect.fromX;
			const dy = effect.toY - effect.fromY;
			const length = Math.hypot(dx, dy) || 1;
			const nx = dx / length;
			const ny = dy / length;
			context.globalAlpha = 1 - progress;
			for (let puff = 0; puff < 9; puff++) {
				const t = (puff / 8) * (0.25 + progress * 0.75);
				const wobble = Math.sin(puff * 2.1 + progress * 12) * 0.08 * t;
				context.fillStyle = puff % 2 === 0 ? EXPLOSION_YELLOW : TIE_RED;
				context.beginPath();
				context.arc(
					effect.fromX + nx * length * t - ny * wobble,
					effect.fromY + ny * length * t + nx * wobble,
					0.1 * (1 - t * 0.5) * (1 - progress * 0.4),
					0,
					Math.PI * 2
				);
				context.fill();
			}
			context.globalAlpha = 1;
			break;
		}
		case 'debris': {
			// Deterministic little chunks fly out and fall back down under gravity
			context.globalAlpha = 1 - progress;
			for (let piece = 0; piece < 9; piece++) {
				const angle = effect.seed + piece * 2.399;
				const speed = 0.7 + (piece % 4) * 0.22;
				const x = effect.x + Math.cos(angle) * speed * progress;
				const y = effect.y + Math.sin(angle) * speed * progress * 0.6 + progress * progress * 0.8;
				context.fillStyle = piece % 3 === 0 ? EXPLOSION_YELLOW : STEEL;
				context.save();
				context.translate(x, y);
				context.rotate(angle + progress * 5);
				context.fillRect(
					-0.05 * effect.size,
					-0.03 * effect.size,
					0.1 * effect.size,
					0.06 * effect.size
				);
				context.restore();
			}
			context.globalAlpha = 1;
			break;
		}
		case 'float': {
			const rise = progress * 0.55;
			context.globalAlpha = 1 - progress * progress;
			context.font = `bold 0.34px ${DISPLAY_FONT}`;
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.lineWidth = 0.08;
			context.strokeStyle = INK;
			context.strokeText(effect.text, effect.x, effect.y - rise);
			context.fillStyle = effect.color;
			context.fillText(effect.text, effect.x, effect.y - rise);
			context.globalAlpha = 1;
			break;
		}
		case 'ring': {
			context.globalAlpha = (1 - progress) * 0.85;
			context.strokeStyle = effect.color;
			context.lineWidth = 0.08;
			context.beginPath();
			context.arc(effect.x, effect.y, effect.radius * (0.15 + progress * 0.85), 0, Math.PI * 2);
			context.stroke();
			context.globalAlpha = (1 - progress) * 0.35;
			context.beginPath();
			context.arc(effect.x, effect.y, effect.radius * (0.05 + progress * 0.65), 0, Math.PI * 2);
			context.stroke();
			context.globalAlpha = 1;
			break;
		}
	}
}

/** Draws one frame; the context is already scaled so a unit is one grid cell */
export function drawScene(
	context: CanvasRenderingContext2D,
	state: BattleState,
	extras: SceneExtras
) {
	const { effects, timeMs } = extras;
	context.save();
	if (extras.shake && !extras.reducedMotion) {
		const shake = extras.shake;
		context.translate(
			Math.sin(timeMs / 18) * shake + Math.sin(timeMs / 7) * shake * 0.25,
			Math.cos(timeMs / 13) * shake * 0.7
		);
	}
	drawSea(context, timeMs);
	drawLandingCraft(context, state.squadsLeft, timeMs);
	drawIsland(context, timeMs);
	drawGroundZones(context, state, timeMs);

	// Depots sit behind the guns, and everything sits behind the troops
	const ordered = [...state.buildings].sort((a, b) => {
		if (a.kind === 'depot' && b.kind !== 'depot') return -1;
		if (b.kind === 'depot' && a.kind !== 'depot') return 1;
		return a.y - b.y;
	});
	for (const building of ordered) drawBuilding(context, building, timeMs);

	for (const effect of effects) if (effect.kind === 'splash') drawEffect(context, effect);

	for (const troop of [...state.troops].sort((a, b) => a.y - b.y))
		drawTroop(context, troop, timeMs);

	if (state.smoke) drawSmokeScreen(context, state.smoke, timeMs);

	for (const projectile of state.projectiles) drawProjectile(context, projectile);
	for (const strike of state.strikes) drawSkillStrike(context, strike, timeMs);

	for (const effect of effects) if (effect.kind !== 'splash') drawEffect(context, effect);

	drawFocus(context, state, timeMs);
	drawDeployHint(context, state, timeMs);

	// A small header strip is left to the page; the board itself carries no text
	context.lineWidth = 0.08;
	context.strokeStyle = INK;
	context.strokeRect(0.04, 0.04, COLUMNS - 0.08, ROWS - 0.08);
	context.restore();
}

/** Draws the island into a square share-card slot */
export function drawBattlePreview(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	state: BattleState
) {
	context.save();
	const scale = size / COLUMNS;
	// The island is 12 by 8 cells, so it is centred vertically in the square card
	context.translate(x, y + (size - ROWS * scale) / 2);
	context.scale(scale, scale);
	drawScene(context, state, { effects: [], timeMs: 0 });
	context.restore();
}

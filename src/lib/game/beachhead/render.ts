/*
 * Canvas drawing for Beachhead. Everything is drawn in grid cells (the caller scales the canvas to
 * the 12 × 8 world) as flat shapes with thick ink outlines, matching the other game boards: no
 * photographs, no gradients that stop working on a dark theme.
 */
import type { BattleState, Building, Troop } from './battle.js';
import { COLUMNS, ROWS, SHORE_X } from './config.js';

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
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

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
	| { kind: 'down'; x: number; y: number; ageMs: number; durationMs: number };

export interface SceneExtras {
	effects: readonly Effect[];
	/** Running time for the waves, the flag and the focus flare */
	timeMs: number;
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

function drawBuilding(context: CanvasRenderingContext2D, building: Building, timeMs: number) {
	if (building.destroyed) {
		drawRubble(context, building, timeMs);
		return;
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

function drawTroop(context: CanvasRenderingContext2D, troop: Troop) {
	context.fillStyle = 'rgba(17,17,17,0.25)';
	context.beginPath();
	context.ellipse(troop.x, troop.y + 0.16, 0.14, 0.06, 0, 0, Math.PI * 2);
	context.fill();

	// torso, head and helmet, then the rifle pointing inland
	circle(context, troop.x, troop.y, 0.115, KHAKI, 0.035);
	circle(context, troop.x + 0.03, troop.y - 0.1, 0.07, SKIN, 0.03);
	context.fillStyle = KHAKI;
	context.beginPath();
	context.arc(troop.x + 0.03, troop.y - 0.11, 0.075, Math.PI, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 0.025;
	context.stroke();
	context.strokeStyle = INK;
	context.lineWidth = 0.035;
	context.beginPath();
	context.moveTo(troop.x + 0.05, troop.y - 0.02);
	context.lineTo(troop.x + 0.26, troop.y - 0.05);
	context.stroke();

	if (troop.flashMs > 0) {
		context.globalAlpha = Math.min(0.7, troop.flashMs / 150);
		circle(context, troop.x, troop.y, 0.16, PAPER, 0);
		context.globalAlpha = 1;
	}
	if (troop.hp < troop.maxHp) {
		healthBar(context, troop.x - 0.18, troop.y - 0.3, 0.36, troop.hp / troop.maxHp, TIE_RED);
	}
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
	}
}

/** Draws one frame; the context is already scaled so a unit is one grid cell */
export function drawScene(
	context: CanvasRenderingContext2D,
	state: BattleState,
	extras: SceneExtras
) {
	const { effects, timeMs } = extras;
	drawSea(context, timeMs);
	drawIsland(context, timeMs);

	// Depots sit behind the guns, and everything sits behind the troops
	const ordered = [...state.buildings].sort((a, b) => {
		if (a.kind === 'depot' && b.kind !== 'depot') return -1;
		if (b.kind === 'depot' && a.kind !== 'depot') return 1;
		return a.y - b.y;
	});
	for (const building of ordered) drawBuilding(context, building, timeMs);

	for (const effect of effects) if (effect.kind === 'splash') drawEffect(context, effect);

	for (const troop of [...state.troops].sort((a, b) => a.y - b.y)) drawTroop(context, troop);

	for (const effect of effects) if (effect.kind !== 'splash') drawEffect(context, effect);

	drawFocus(context, state, timeMs);
	drawDeployHint(context, state, timeMs);

	// A small header strip is left to the page; the board itself carries no text
	context.lineWidth = 0.08;
	context.strokeStyle = INK;
	context.strokeRect(0.04, 0.04, COLUMNS - 0.08, ROWS - 0.08);
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

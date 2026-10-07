/*
 * Canvas drawing for Spokesperson Whack, all in world units (see config.ts) and scaled by the
 * caller: the board's backdrop, a podium per cell, the figures popping up behind them, the
 * statement bubbles, short effects and the combo meter. Bloodless: bonked figures just see stars.
 */
import {
	CELL_HEIGHT,
	CELL_WIDTH,
	COLUMNS,
	FIELD_TOP,
	HOLE_COUNT,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	isDecoy,
	type BoardId
} from './config';
import { INK, PAPER, SAND, TIE_RED, YELLOW, drawFigure, type Pose } from './art';
import { holeBase, holeRect } from './layout';
import { comboActive, comboTimeLeft, currentMultiplier } from './scoring';
import { riseOf, type Mole, type WhackState } from './state';

const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";
/** How far a figure sinks below its feet line when hidden (more than its height) */
const HIDE_DEPTH = 96;

export type Effect =
	| {
			kind: 'popup';
			x: number;
			y: number;
			text: string;
			big: boolean;
			ageMs: number;
			durationMs: number;
	  }
	| { kind: 'bonk'; x: number; y: number; ageMs: number; durationMs: number }
	| { kind: 'ring'; x: number; y: number; ageMs: number; durationMs: number };

export interface SceneExtras {
	effects: readonly Effect[];
	/** Skip the flapping mouths and swaying banners */
	reducedMotion: boolean;
}

const NO_EXTRAS: SceneExtras = { effects: [], reducedMotion: true };

function rect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: string
) {
	ctx.fillStyle = fill;
	ctx.fillRect(x, y, w, h);
}

function stroked(ctx: CanvasRenderingContext2D, fill: string, width = 2.5) {
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = width;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = INK;
	ctx.stroke();
}

/** A generic round patch with a chevron: a made-up emblem, not any real one */
function drawPatch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	stroked(ctx, color, 2.5);
	ctx.beginPath();
	ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
	ctx.lineWidth = 2;
	ctx.strokeStyle = PAPER;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x - r * 0.35, y + r * 0.2);
	ctx.lineTo(x, y - r * 0.25);
	ctx.lineTo(x + r * 0.35, y + r * 0.2);
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.strokeStyle = PAPER;
	ctx.stroke();
}

function drawRegimeBackdrop(ctx: CanvasRenderingContext2D, timeMs: number, calm: boolean) {
	// Plaster wall with a banner between two heavy curtains
	rect(ctx, 0, 0, WORLD_WIDTH, FIELD_TOP, '#dccaa4');
	for (let x = 20; x < WORLD_WIDTH; x += 40)
		rect(ctx, x, 0, 2, FIELD_TOP, 'rgba(120, 90, 50, 0.12)');
	rect(ctx, 0, FIELD_TOP - 14, WORLD_WIDTH, 14, '#8a5a36');

	const sway = calm ? 0 : Math.sin(timeMs / 700) * 3;
	ctx.beginPath();
	ctx.moveTo(98, 14);
	ctx.lineTo(262, 14);
	ctx.lineTo(262, 108 + sway);
	ctx.lineTo(180, 128 + sway * 0.5);
	ctx.lineTo(98, 108 - sway);
	ctx.closePath();
	stroked(ctx, '#22304f', 3);
	drawPatch(ctx, 180, 62, 26, '#c9a227');
	rect(ctx, 86, 6, 188, 8, '#6b4a2f');

	for (const side of [0, 1]) {
		const x = side === 0 ? 0 : WORLD_WIDTH - 70;
		ctx.beginPath();
		ctx.rect(x, 0, 70, FIELD_TOP - 14);
		stroked(ctx, '#9b2d30', 3);
		for (let i = 1; i < 5; i++) rect(ctx, x + i * 14, 0, 3, FIELD_TOP - 14, 'rgba(60, 0, 10, 0.3)');
		ctx.beginPath();
		ctx.ellipse(side === 0 ? 70 : WORLD_WIDTH - 70, 70, 8, 22, 0, 0, Math.PI * 2);
		stroked(ctx, '#c9a227', 2.5);
	}

	// Carpeted floor
	rect(ctx, 0, FIELD_TOP, WORLD_WIDTH, WORLD_HEIGHT - FIELD_TOP, '#7d2a33');
	for (let row = 0; row < 3; row++) {
		rect(ctx, 0, FIELD_TOP + row * CELL_HEIGHT, WORLD_WIDTH, 3, 'rgba(201, 162, 39, 0.55)');
	}
}

function drawMilitantBackdrop(ctx: CanvasRenderingContext2D, timeMs: number, calm: boolean) {
	// Dusty dusk with hills, camouflage netting and a plain two-tone banner
	const sky = ctx.createLinearGradient(0, 0, 0, FIELD_TOP);
	sky.addColorStop(0, '#e6a86b');
	sky.addColorStop(1, '#f4dfae');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, WORLD_WIDTH, FIELD_TOP);
	ctx.beginPath();
	ctx.arc(250, 80, 22, 0, Math.PI * 2);
	ctx.fillStyle = '#fbe9b9';
	ctx.fill();

	ctx.beginPath();
	ctx.moveTo(0, FIELD_TOP);
	ctx.lineTo(0, 110);
	ctx.quadraticCurveTo(70, 70, 140, 112);
	ctx.quadraticCurveTo(220, 150, 290, 98);
	ctx.quadraticCurveTo(330, 80, 360, 100);
	ctx.lineTo(WORLD_WIDTH, FIELD_TOP);
	ctx.closePath();
	ctx.fillStyle = '#b58a5a';
	ctx.fill();

	// Camouflage net across the top, held up by two poles
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(WORLD_WIDTH, 0);
	ctx.lineTo(WORLD_WIDTH, 40);
	for (let x = WORLD_WIDTH; x >= 0; x -= 40) {
		ctx.quadraticCurveTo(x - 20, 62, x - 40, 40);
	}
	ctx.closePath();
	stroked(ctx, '#6f7d55', 3);
	for (const [x, y, w] of [
		[40, 14, 26],
		[120, 28, 20],
		[200, 12, 30],
		[290, 26, 24],
		[330, 10, 16]
	]) {
		ctx.beginPath();
		ctx.ellipse(x, y, w, w * 0.4, 0.3, 0, Math.PI * 2);
		ctx.fillStyle = '#4b5a36';
		ctx.fill();
	}
	for (const x of [16, WORLD_WIDTH - 16]) rect(ctx, x - 3, 40, 6, FIELD_TOP - 40, '#5a432c');

	// A dark banner with a made-up patch, waving gently
	const wave = calm ? 0 : Math.sin(timeMs / 500) * 3;
	rect(ctx, 96, 52, 4, 94, '#5a432c');
	ctx.beginPath();
	ctx.moveTo(100, 56);
	ctx.quadraticCurveTo(140, 50 + wave, 180, 58);
	ctx.lineTo(180, 100);
	ctx.quadraticCurveTo(140, 92 - wave, 100, 100);
	ctx.closePath();
	stroked(ctx, '#2b2b2b', 2.5);
	drawPatch(ctx, 140, 77, 12, '#7a1f2b');

	// Dirt ground with pebbles
	rect(ctx, 0, FIELD_TOP, WORLD_WIDTH, WORLD_HEIGHT - FIELD_TOP, '#a58a63');
	ctx.fillStyle = 'rgba(80, 55, 30, 0.35)';
	for (let i = 0; i < 40; i++) {
		const x = (i * 97) % WORLD_WIDTH;
		const y = FIELD_TOP + ((i * 53) % (WORLD_HEIGHT - FIELD_TOP));
		ctx.beginPath();
		ctx.ellipse(x, y, 4 + (i % 3), 2 + (i % 2), 0, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawDome(
	ctx: CanvasRenderingContext2D,
	x: number,
	baseY: number,
	size: number,
	color: string
) {
	rect(ctx, x - size * 0.35, baseY - size * 0.9, size * 0.7, size * 0.9, '#efe6d2');
	ctx.strokeStyle = INK;
	ctx.lineWidth = 2.5;
	ctx.strokeRect(x - size * 0.35, baseY - size * 0.9, size * 0.7, size * 0.9);
	ctx.beginPath();
	const top = baseY - size * 0.9;
	ctx.moveTo(x - size * 0.5, top);
	ctx.bezierCurveTo(
		x - size * 0.6,
		top - size * 0.55,
		x - size * 0.1,
		top - size * 0.75,
		x,
		top - size * 1.25
	);
	ctx.bezierCurveTo(
		x + size * 0.1,
		top - size * 0.75,
		x + size * 0.6,
		top - size * 0.55,
		x + size * 0.5,
		top
	);
	ctx.closePath();
	stroked(ctx, color, 2.5);
	ctx.beginPath();
	ctx.moveTo(x, top - size * 1.25);
	ctx.lineTo(x, top - size * 1.55);
	ctx.lineWidth = 2.5;
	ctx.strokeStyle = INK;
	ctx.stroke();
}

function drawKremlinBackdrop(ctx: CanvasRenderingContext2D) {
	// Cold sky, onion-domed towers and a crenellated red brick wall
	const sky = ctx.createLinearGradient(0, 0, 0, FIELD_TOP);
	sky.addColorStop(0, '#9fc3dc');
	sky.addColorStop(1, '#e3eef5');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, WORLD_WIDTH, FIELD_TOP);

	drawDome(ctx, 62, 118, 40, '#c9a227');
	drawDome(ctx, 180, 118, 56, '#2e8b7a');
	drawDome(ctx, 298, 118, 40, '#c9a227');

	const wallTop = 104;
	rect(ctx, 0, wallTop, WORLD_WIDTH, FIELD_TOP - wallTop, '#a8362d');
	for (let x = 0; x < WORLD_WIDTH; x += 30) {
		ctx.beginPath();
		ctx.rect(x + 3, wallTop - 14, 24, 16);
		stroked(ctx, '#a8362d', 2.5);
	}
	ctx.strokeStyle = '#7e231c';
	ctx.lineWidth = 1.5;
	for (let y = wallTop + 8; y < FIELD_TOP; y += 10) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(WORLD_WIDTH, y);
		ctx.stroke();
		const offset = ((y - wallTop) / 10) % 2 === 0 ? 0 : 14;
		for (let x = offset; x < WORLD_WIDTH; x += 28) {
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x, y + 10);
			ctx.stroke();
		}
	}
	rect(ctx, 0, FIELD_TOP - 6, WORLD_WIDTH, 6, '#5a1a14');

	// Marble hall floor, checkered per cell
	for (let hole = 0; hole < HOLE_COUNT; hole++) {
		const cell = holeRect(hole);
		const light = (Math.floor(hole / COLUMNS) + (hole % COLUMNS)) % 2 === 0;
		rect(ctx, cell.x, cell.y, cell.width, cell.height, light ? '#d6cfc0' : '#aaa291');
	}
}

function drawBackdrop(
	ctx: CanvasRenderingContext2D,
	board: BoardId,
	timeMs: number,
	calm: boolean
) {
	switch (board) {
		case 'regime':
			drawRegimeBackdrop(ctx, timeMs, calm);
			break;
		case 'militant':
			drawMilitantBackdrop(ctx, timeMs, calm);
			break;
		case 'kremlin':
			drawKremlinBackdrop(ctx);
			break;
	}
}

/** The front of one podium, drawn over the figure's lower part; the feet line is the origin */
function drawPodiumFront(ctx: CanvasRenderingContext2D, board: BoardId) {
	switch (board) {
		case 'regime':
			// A wooden lectern with a gold stripe
			ctx.beginPath();
			ctx.moveTo(-42, -2);
			ctx.lineTo(42, -2);
			ctx.lineTo(36, 24);
			ctx.lineTo(-36, 24);
			ctx.closePath();
			stroked(ctx, '#8a5a36', 2.5);
			rect(ctx, -39, 8, 78, 4, '#c9a227');
			ctx.beginPath();
			ctx.roundRect(-48, -9, 96, 9, 3);
			stroked(ctx, '#b07b4a', 2.5);
			break;
		case 'militant':
			// A low wall of sandbags
			for (const [x, y, w] of [
				[-27, 2, 26],
				[27, 2, 26],
				[0, 16, 28]
			]) {
				ctx.beginPath();
				ctx.ellipse(x, y, w, 12, 0, 0, Math.PI * 2);
				stroked(ctx, '#c9b27c', 2.5);
				ctx.beginPath();
				ctx.moveTo(x - w * 0.5, y);
				ctx.lineTo(x + w * 0.5, y);
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = 'rgba(80, 60, 30, 0.6)';
				ctx.stroke();
			}
			break;
		case 'kremlin':
			// A long dark desk with gold trim and a name plate
			ctx.beginPath();
			ctx.roundRect(-50, -8, 100, 32, 4);
			stroked(ctx, '#6e2a2a', 2.5);
			rect(ctx, -48, -6, 96, 5, '#c9a227');
			ctx.beginPath();
			ctx.roundRect(-18, 6, 36, 10, 2);
			stroked(ctx, '#e9dfc4', 2);
			break;
	}
}

function poseFor(mole: Mole, timeMs: number, calm: boolean): Pose {
	return {
		seconds: timeMs / 1000,
		calm,
		phase: mole.id * 1.7,
		talking: !isDecoy(mole.kind) && mole.phase === 'up',
		dazed: mole.phase === 'whacked'
	};
}

function drawMole(
	ctx: CanvasRenderingContext2D,
	board: BoardId,
	mole: Mole,
	timeMs: number,
	calm: boolean
) {
	const base = holeBase(mole.hole);
	const rise = riseOf(mole);
	ctx.save();
	ctx.translate(base.x, base.y);
	// Only what is above the feet line shows; the podium front covers the rest
	ctx.beginPath();
	ctx.rect(-CELL_WIDTH / 2, -140, CELL_WIDTH, 140);
	ctx.clip();
	if (rise > 0) {
		const shake =
			!calm && mole.phase === 'up' && mole.progress > 0.7 && !isDecoy(mole.kind)
				? Math.sin(timeMs / 35) * 1.6 * ((mole.progress - 0.7) / 0.3)
				: 0;
		ctx.translate(shake, (1 - rise) * HIDE_DEPTH);
		drawFigure(ctx, mole.kind, poseFor(mole, timeMs, calm));
	}
	ctx.restore();
	ctx.save();
	ctx.translate(base.x, base.y);
	drawPodiumFront(ctx, board);
	ctx.restore();
}

function drawEmptyPodium(ctx: CanvasRenderingContext2D, board: BoardId, hole: number) {
	const base = holeBase(hole);
	ctx.save();
	ctx.translate(base.x, base.y);
	drawPodiumFront(ctx, board);
	ctx.restore();
}

/** The statement bubble: a bar that fills while the target talks; at the end you lose a heart */
function drawBubble(ctx: CanvasRenderingContext2D, mole: Mole, timeMs: number, calm: boolean) {
	if (mole.phase !== 'up' || isDecoy(mole.kind)) return;
	const rise = riseOf(mole);
	if (rise < 0.5) return;
	const base = holeBase(mole.hole);
	const width = 68;
	const height = 17;
	const x = base.x - width / 2;
	const y = base.y - 86 * rise - height - 4;
	const urgent = mole.progress > 0.7;
	const blink = urgent && !calm && Math.floor(timeMs / 120) % 2 === 0;

	ctx.beginPath();
	ctx.roundRect(x, y, width, height, 7);
	ctx.moveTo(base.x - 5, y + height);
	ctx.lineTo(base.x, y + height + 6);
	ctx.lineTo(base.x + 5, y + height);
	stroked(ctx, blink ? '#ffe3e3' : PAPER, 2.2);

	const trackX = x + 5;
	const trackY = y + 4.5;
	const trackW = width - 10;
	ctx.beginPath();
	ctx.roundRect(trackX, trackY, trackW, 8, 4);
	ctx.fillStyle = '#d8d8d8';
	ctx.fill();
	if (mole.progress > 0) {
		ctx.beginPath();
		ctx.roundRect(trackX, trackY, Math.max(8, trackW * mole.progress), 8, 4);
		ctx.fillStyle = urgent ? TIE_RED : YELLOW;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.roundRect(trackX, trackY, trackW, 8, 4);
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = INK;
	ctx.stroke();
}

function drawComboPill(ctx: CanvasRenderingContext2D, state: WhackState) {
	if (!comboActive(state.combo, state.timeMs)) return;
	const multiplier = currentMultiplier(state.combo, state.timeMs);
	const left = comboTimeLeft(state.combo, state.timeMs);
	const x = 8;
	const y = FIELD_TOP - 34;
	const width = 86;
	const height = 26;
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, 9);
	stroked(ctx, PAPER, 2.5);
	ctx.beginPath();
	ctx.roundRect(x + 4, y + height - 7, (width - 8) * left, 4, 2);
	ctx.fillStyle = multiplier > 1 ? TIE_RED : YELLOW;
	ctx.fill();
	ctx.font = `700 15px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = INK;
	ctx.fillText(`${state.combo.streak} · x${multiplier}`, x + width / 2, y + 10);
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: Effect) {
	const p = Math.min(1, effect.ageMs / effect.durationMs);
	switch (effect.kind) {
		case 'popup': {
			ctx.globalAlpha = 1 - p * p;
			ctx.font = `700 ${effect.big ? 24 : 18}px ${DISPLAY_FONT}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 5;
			ctx.lineJoin = 'round';
			ctx.strokeStyle = INK;
			ctx.fillStyle = effect.big ? YELLOW : PAPER;
			const y = effect.y - 14 - p * 28;
			ctx.strokeText(effect.text, effect.x, y);
			ctx.fillText(effect.text, effect.x, y);
			ctx.globalAlpha = 1;
			break;
		}
		case 'bonk': {
			// A comic burst of spikes
			const size = 14 + p * 22;
			ctx.globalAlpha = 1 - p;
			ctx.beginPath();
			for (let i = 0; i < 16; i++) {
				const r = i % 2 === 0 ? size : size * 0.55;
				const angle = (Math.PI / 8) * i;
				const px = effect.x + Math.cos(angle) * r;
				const py = effect.y + Math.sin(angle) * r;
				if (i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
			stroked(ctx, YELLOW, 2.5);
			ctx.globalAlpha = 1;
			break;
		}
		case 'ring': {
			ctx.globalAlpha = 1 - p;
			ctx.beginPath();
			ctx.arc(effect.x, effect.y, 12 + p * 30, 0, Math.PI * 2);
			ctx.lineWidth = 4;
			ctx.strokeStyle = TIE_RED;
			ctx.stroke();
			ctx.globalAlpha = 1;
			break;
		}
	}
}

export function drawScene(ctx: CanvasRenderingContext2D, state: WhackState, extras: SceneExtras) {
	const calm = extras.reducedMotion;
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	ctx.clip();
	drawBackdrop(ctx, state.board, state.timeMs, calm);

	// Back row first, so a figure's podium and bubble overlap what is behind it correctly
	const byHole = new Map(state.moles.map((mole) => [mole.hole, mole]));
	for (let hole = 0; hole < HOLE_COUNT; hole++) {
		const mole = byHole.get(hole);
		if (mole) drawMole(ctx, state.board, mole, state.timeMs, calm);
		else drawEmptyPodium(ctx, state.board, hole);
	}
	for (const mole of state.moles) drawBubble(ctx, mole, state.timeMs, calm);
	drawComboPill(ctx, state);
	for (const effect of extras.effects) drawEffect(ctx, effect);
	ctx.restore();
}

/** Draws the final field onto the shared score card */
export function drawScenePreview(
	ctx: CanvasRenderingContext2D,
	state: WhackState,
	x: number,
	y: number,
	size: number
) {
	const scale = size / WORLD_HEIGHT;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, size, size);
	ctx.clip();
	ctx.fillStyle = SAND;
	ctx.fillRect(x, y, size, size);
	ctx.translate(x + (size - WORLD_WIDTH * scale) / 2, y);
	ctx.scale(scale, scale);
	drawScene(ctx, state, NO_EXTRAS);
	ctx.restore();
}

/** Draws just a board's backdrop and an empty podium row, for the board picker thumbnails */
export function drawBoardThumbnail(
	ctx: CanvasRenderingContext2D,
	board: BoardId,
	width: number,
	height: number
) {
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, width, height);
	ctx.clip();
	const scale = width / WORLD_WIDTH;
	// Show the top of the backdrop and the first row of podiums
	ctx.scale(scale, scale);
	ctx.translate(0, -Math.max(0, FIELD_TOP + CELL_HEIGHT - height / scale));
	drawBackdrop(ctx, board, 0, true);
	for (let hole = 0; hole < COLUMNS; hole++) drawEmptyPodium(ctx, board, hole);
	ctx.restore();
}

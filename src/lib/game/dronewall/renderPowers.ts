/*
 * Drawing of what lands on the road and what the player calls in: artillery shells, HIMARS
 * rockets, F-16 bombs, the Storm Shadow cruise missile, the F-16 bombing run and the aiming
 * preview of the two powers.
 */
import { AIRSTRIKE, STORM_SHADOW, WORLD_WIDTH, type PowerKind } from './config';
import {
	FLAG_BLUE,
	INK,
	PAPER,
	TIE_RED,
	YELLOW,
	clamp,
	inkEllipse,
	inkPoly,
	inkRect,
	stroke,
	type Ctx
} from './drawKit';
import type { AirRun, Shell } from './state';

export interface StrikePreview {
	power: PowerKind;
	x: number;
	y: number;
}

const RED = 'rgba(229,72,77,';

/** The red landing marker of a shell: a filled disc with a dashed ring */
function drawLandingMarker(ctx: Ctx, shell: Shell, strength: number, timeMs: number) {
	ctx.beginPath();
	ctx.arc(shell.toX, shell.toY, shell.radius, 0, Math.PI * 2);
	ctx.fillStyle = `${RED}${0.08 * strength + 0.04})`;
	ctx.fill();
	ctx.setLineDash([5, 5]);
	ctx.lineDashOffset = shell.kind === 'shell' ? 0 : -timeMs / 80;
	ctx.lineWidth = 2;
	ctx.strokeStyle = `${RED}${0.8 * Math.min(1, strength + 0.2)})`;
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.lineDashOffset = 0;
}

/** The big red target of a Storm Shadow: rings, cross hairs and a pulsing fill */
function drawTarget(
	ctx: Ctx,
	x: number,
	y: number,
	radius: number,
	strength: number,
	timeMs: number
) {
	const pulse = 0.5 + 0.5 * Math.sin(timeMs / 140);
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fillStyle = `${RED}${(0.08 + 0.1 * pulse) * strength + 0.02})`;
	ctx.fill();
	// The outer ring: an ink edge, then red dashes that turn slowly
	ctx.lineWidth = 5;
	ctx.strokeStyle = `rgba(17,17,17,${0.5 * strength})`;
	ctx.stroke();
	ctx.setLineDash([12, 8]);
	ctx.lineDashOffset = -timeMs / 30;
	ctx.lineWidth = 3;
	ctx.strokeStyle = `${RED}${0.95 * strength})`;
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.lineDashOffset = 0;
	ctx.beginPath();
	ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
	ctx.lineWidth = 2;
	ctx.strokeStyle = `${RED}${0.8 * strength})`;
	ctx.stroke();
	// Cross hairs reaching a little beyond the ring, with a gap in the middle
	ctx.beginPath();
	for (const [dx, dy] of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	]) {
		ctx.moveTo(x + dx * radius * 0.2, y + dy * radius * 0.2);
		ctx.lineTo(x + dx * (radius + 10), y + dy * (radius + 10));
	}
	ctx.lineWidth = 2;
	ctx.strokeStyle = `${RED}${0.9 * strength})`;
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(x, y, 3, 0, Math.PI * 2);
	ctx.fillStyle = `${RED}${strength})`;
	ctx.fill();
}

function drawArtilleryShell(ctx: Ctx, shell: Shell, t: number, timeMs: number) {
	const x = shell.fromX + (shell.toX - shell.fromX) * t;
	const ground = shell.fromY + (shell.toY - shell.fromY) * t;
	// Slow, heavy shells fly a longer arc
	const arc = 40 + shell.flightMs * 0.05;
	const y = ground - Math.sin(Math.PI * t) * arc;
	drawLandingMarker(ctx, shell, t, timeMs);
	ctx.beginPath();
	ctx.ellipse(x, ground, 4, 2, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.3)';
	ctx.fill();
	// The shell grows with the blast it carries: a mortar bomb is small, a Pion round big and dark
	const size = clamp(shell.radius * 0.1, 4, 8);
	inkEllipse(ctx, x, y, size, size, size > 5.5 ? '#1f2227' : '#2f343b', 1.8);
	ctx.beginPath();
	ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.25, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	ctx.fill();
	if (size > 5.5) {
		// A copper band round the heavy shell
		ctx.beginPath();
		ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = '#b8742c';
		ctx.stroke();
	}
}

function rocketPoint(shell: Shell, t: number) {
	const arc = 85;
	const gx = shell.fromX + (shell.toX - shell.fromX) * t;
	const gy = shell.fromY + (shell.toY - shell.fromY) * t;
	return { x: gx, y: gy - Math.sin(Math.PI * t) * arc, ground: gy };
}

function drawRocket(ctx: Ctx, shell: Shell, t: number, timeMs: number) {
	const here = rocketPoint(shell, t);
	// Smoke trail: puffs sampled earlier along the same arc
	for (let k = 7; k >= 1; k--) {
		const tt = t - k * 0.03;
		if (tt < 0) continue;
		const p = rocketPoint(shell, tt);
		ctx.beginPath();
		ctx.arc(p.x, p.y, 1.8 + k * 0.5, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255,255,255,${0.62 * (1 - k / 8)})`;
		ctx.fill();
	}
	drawLandingMarker(ctx, shell, t, timeMs);
	ctx.beginPath();
	ctx.ellipse(here.x, here.ground, 3.4, 1.7, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.3)';
	ctx.fill();
	// Heading from the slope of the arc
	const next = rocketPoint(shell, Math.min(1, t + 0.02));
	const angle = Math.atan2(next.y - here.y, next.x - here.x);
	ctx.save();
	ctx.translate(here.x, here.y);
	ctx.rotate(angle);
	ctx.beginPath();
	ctx.ellipse(-9 - Math.sin(timeMs / 30) * 1.2, 0, 4.2, 2.2, 0, 0, Math.PI * 2);
	ctx.fillStyle = YELLOW;
	ctx.fill();
	inkPoly(ctx, [-5, -2, -8.5, -5, -8.5, -1], '#8a8f98', 1.2);
	inkPoly(ctx, [-5, 2, -8.5, 5, -8.5, 1], '#8a8f98', 1.2);
	inkRect(ctx, -7, -2.1, 13, 4.2, '#e8e4d0', 1.6, 2);
	inkPoly(ctx, [6, -2.1, 10.5, 0, 6, 2.1], TIE_RED, 1.4);
	ctx.restore();
}

function drawBomb(ctx: Ctx, shell: Shell, t: number, timeMs: number) {
	const fall = t * t;
	const x = shell.fromX + (shell.toX - shell.fromX) * fall;
	const y = shell.fromY + (shell.toY - shell.fromY) * fall;
	// The marker is faint, and its shadow on the ground grows as the bomb comes down
	drawLandingMarker(ctx, shell, t * 0.6, timeMs);
	ctx.beginPath();
	ctx.ellipse(shell.toX, shell.toY, 2.5 + 7 * t, 1.4 + 3.6 * t, 0, 0, Math.PI * 2);
	ctx.fillStyle = `rgba(17,17,17,${0.12 + 0.25 * t})`;
	ctx.fill();
	// The bomb falls nose down, with fins on top and a streak above it
	ctx.save();
	ctx.translate(x, y);
	stroke(ctx, 0, -9, 0, -20, 2, 'rgba(255,255,255,0.45)');
	inkPoly(
		ctx,
		[-5.2, -10, -1.4, -5, 1.4, -5, 5.2, -10, 2.4, -10, 0, -7, -2.4, -10],
		'#59604d',
		1.4
	);
	inkEllipse(ctx, 0, 0, 3.8, 7.2, '#4b5320', 1.8);
	ctx.fillStyle = YELLOW;
	ctx.fillRect(-3.5, -1.2, 7, 2.2);
	ctx.restore();
}

function drawCruise(ctx: Ctx, shell: Shell, t: number, timeMs: number) {
	const x = shell.fromX + (shell.toX - shell.fromX) * t;
	const y = shell.fromY + (shell.toY - shell.fromY) * t;
	const angle = Math.atan2(shell.toY - shell.fromY, shell.toX - shell.fromX);
	drawTarget(ctx, shell.toX, shell.toY, shell.radius, 0.4 + 0.6 * t, timeMs);
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	// A long smoke trail that fades away behind the missile
	const trail = ctx.createLinearGradient(x, y, x - dx * 90, y - dy * 90);
	trail.addColorStop(0, 'rgba(255,255,255,0.8)');
	trail.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.lineCap = 'round';
	stroke(ctx, x, y, x - dx * 90, y - dy * 90, 6, trail);
	ctx.lineCap = 'butt';
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	// Flame, then wings, body and nose
	inkEllipse(ctx, -17 - Math.sin(timeMs / 28) * 2, 0, 8, 3.4, '#ff9a2e', 1.4);
	ctx.beginPath();
	ctx.ellipse(-16, 0, 4.5, 1.8, 0, 0, Math.PI * 2);
	ctx.fillStyle = PAPER;
	ctx.fill();
	for (const s of [-1, 1]) {
		inkPoly(ctx, [-1, s * 3, -7, s * 10.5, -10, s * 10.5, -8, s * 3], '#8d99a8', 1.6);
		inkPoly(ctx, [-12, s * 3, -15.5, s * 6.5, -17, s * 6.5, -16, s * 3], '#8d99a8', 1.4);
	}
	inkRect(ctx, -15, -3.2, 29, 6.4, '#d8dce2', 2, 3);
	inkPoly(ctx, [14, -3.2, 22, 0, 14, 3.2], '#3a3f48', 1.8);
	ctx.fillStyle = FLAG_BLUE;
	ctx.fillRect(3, -3.2, 3, 6.4);
	ctx.fillStyle = YELLOW;
	ctx.fillRect(6, -3.2, 3, 6.4);
	ctx.restore();
}

/** Anything that lands on the road. A shell that waits to be launched is not drawn. */
export function drawShell(ctx: Ctx, shell: Shell, timeMs: number) {
	if (shell.ageMs < 0) {
		// A bomb or a missile that is on its way is shown by a faint landing marker only
		if (shell.kind === 'bomb') drawLandingMarker(ctx, shell, 0.15, timeMs);
		else if (shell.kind === 'cruise')
			drawTarget(ctx, shell.toX, shell.toY, shell.radius, 0.35, timeMs);
		return;
	}
	const t = Math.min(1, shell.ageMs / Math.max(1, shell.flightMs));
	switch (shell.kind) {
		case 'shell':
			drawArtilleryShell(ctx, shell, t, timeMs);
			break;
		case 'rocket':
			drawRocket(ctx, shell, t, timeMs);
			break;
		case 'bomb':
			drawBomb(ctx, shell, t, timeMs);
			break;
		case 'cruise':
			drawCruise(ctx, shell, t, timeMs);
			break;
	}
}

/** A cartoon F-16 pointing right, about 48 units long, with blue-and-yellow marks and eyes in the canopy */
export function drawJet(ctx: Ctx, x: number, y: number, timeMs: number, scale = 1) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	ctx.lineJoin = 'round';
	const hull = '#9aa7b6';
	const wing = '#7d8b9b';
	// Wings and tailplanes, one pair above and one below the fuselage
	for (const s of [-1, 1]) {
		inkPoly(ctx, [6, s * 3, -8, s * 17, -14, s * 17, -9, s * 3], wing, 2);
		inkPoly(ctx, [-14, s * 3, -21, s * 9.5, -25, s * 9.5, -21, s * 3], wing, 2);
		// A blue-and-yellow mark on each wing
		ctx.beginPath();
		ctx.arc(-6, s * 11.5, 2.8, 0, Math.PI * 2);
		ctx.fillStyle = FLAG_BLUE;
		ctx.fill();
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(-6, s * 11.5, 1.1, 0, Math.PI * 2);
		ctx.fillStyle = YELLOW;
		ctx.fill();
	}
	// The exhaust flame
	ctx.beginPath();
	ctx.ellipse(-27 - Math.sin(timeMs / 35) * 2, 0, 6, 2.6, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#ff9a2e';
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(-25, 0, 3, 1.4, 0, 0, Math.PI * 2);
	ctx.fillStyle = PAPER;
	ctx.fill();
	// The fuselage, a pointed nose and the tail marks
	inkEllipse(ctx, -2, 0, 23, 4.8, hull, 2.2);
	inkPoly(ctx, [15, -3.6, 28, 0, 15, 3.6], hull, 2.2);
	ctx.fillStyle = FLAG_BLUE;
	ctx.fillRect(-20, -4.2, 5, 2.1);
	ctx.fillStyle = YELLOW;
	ctx.fillRect(-20, -2.1, 5, 2.1);
	// The canopy with two blob eyes
	inkEllipse(ctx, 9, 0, 7, 3.2, '#9fe0ff', 1.8);
	for (const dy of [-1.4, 1.4]) {
		ctx.beginPath();
		ctx.arc(10.5, dy, 1.5, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(11.2, dy, 0.7, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	ctx.restore();
}

/** The two F-16s of a bombing run crossing the field, left to right, with the band they bomb */
export function drawAirRun(ctx: Ctx, run: AirRun, timeMs: number, top: number, bottom: number) {
	const half = AIRSTRIKE.halfBand;
	if (run.y + half + 60 < top || run.y - half - 60 > bottom) return;
	const p = clamp(run.ageMs / run.durationMs, 0, 1);
	// The bombed band fades as the run goes on
	const fade = 1 - p;
	ctx.fillStyle = `${RED}${0.2 * fade})`;
	ctx.fillRect(0, run.y - half, WORLD_WIDTH, half * 2);
	ctx.lineWidth = 2.5;
	ctx.setLineDash([12, 8]);
	ctx.lineDashOffset = -timeMs / 40;
	ctx.strokeStyle = `rgba(245,200,58,${0.8 * fade})`;
	for (const y of [run.y - half, run.y + half]) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(WORLD_WIDTH, y);
		ctx.stroke();
	}
	ctx.setLineDash([]);
	ctx.lineDashOffset = 0;

	const x = -50 + p * (WORLD_WIDTH + 100);
	const jets = [
		{ x, y: run.y },
		{ x: x - 30, y: run.y - 14 }
	];
	// Shadows and contrails first, then the jets above them
	for (const jet of jets) {
		ctx.beginPath();
		ctx.ellipse(jet.x + 10, jet.y + 30, 24, 7, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(17,17,17,0.22)';
		ctx.fill();
		const trail = ctx.createLinearGradient(jet.x - 14, 0, jet.x - 110, 0);
		trail.addColorStop(0, 'rgba(255,255,255,0.75)');
		trail.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.strokeStyle = trail;
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		for (const dy of [-15, 15]) {
			ctx.beginPath();
			ctx.moveTo(jet.x - 14, jet.y + dy);
			ctx.lineTo(jet.x - 110, jet.y + dy);
			ctx.stroke();
		}
		ctx.lineCap = 'butt';
	}
	for (const jet of jets) drawJet(ctx, jet.x, jet.y, timeMs);
}

/** The aiming aid while the player places a power: a bombing band or a Storm Shadow reticle */
export function drawStrikePreview(
	ctx: Ctx,
	preview: StrikePreview,
	timeMs: number,
	top: number,
	bottom: number
) {
	const pulse = 0.5 + 0.5 * Math.sin(timeMs / 170);
	if (preview.power === 'airstrike') {
		const half = AIRSTRIKE.halfBand;
		if (preview.y + half < top || preview.y - half > bottom) return;
		ctx.fillStyle = `${RED}${0.14 + 0.1 * pulse})`;
		ctx.fillRect(0, preview.y - half, WORLD_WIDTH, half * 2);
		// Dashed edges in red and yellow, marching along
		ctx.lineWidth = 3;
		for (const [color, offset] of [
			[`${RED}0.95)`, 0],
			['rgba(245,200,58,0.95)', 12]
		] as const) {
			ctx.setLineDash([12, 12]);
			ctx.lineDashOffset = -timeMs / 30 - offset;
			ctx.strokeStyle = color;
			for (const y of [preview.y - half, preview.y + half]) {
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(WORLD_WIDTH, y);
				ctx.stroke();
			}
		}
		ctx.setLineDash([]);
		ctx.lineDashOffset = 0;
		// A jet at the left edge, flying in, and a stack of arrows at the right edge
		drawJet(ctx, 34 + pulse * 4, preview.y, timeMs, 0.8);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		for (const [width, color] of [
			[6, INK],
			[3, TIE_RED]
		] as const) {
			ctx.beginPath();
			for (let k = 0; k < 3; k++) {
				const ax = WORLD_WIDTH - 40 + k * 10 + pulse * 3;
				ctx.moveTo(ax, preview.y - 9);
				ctx.lineTo(ax + 7, preview.y);
				ctx.lineTo(ax, preview.y + 9);
			}
			ctx.lineWidth = width;
			ctx.strokeStyle = color;
			ctx.stroke();
		}
		ctx.lineCap = 'butt';
		return;
	}
	const radius = STORM_SHADOW.radius;
	if (preview.y + radius + 10 < top || preview.y - radius - 10 > bottom) return;
	drawTarget(ctx, preview.x, preview.y, radius * (0.97 + 0.03 * pulse), 1, timeMs);
}

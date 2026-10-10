/*
 * Drawing of the enemies: chunky blob soldiers (and the vehicles that march down the road with
 * them) and the aircraft. Everything is drawn about (0, 0) of the current transform.
 */
import { FLYERS, SOLDIERS, type FlyerKind, type SoldierKind } from './config';
import {
	INK,
	PAPER,
	TIE_RED,
	YELLOW,
	angryEyes,
	inkEllipse,
	inkPoly,
	inkRect,
	stroke,
	type Ctx
} from './drawKit';
import { pointAt, type Path } from './path';
import type { Flyer, Soldier } from './state';

const BODY: Record<SoldierKind, string> = {
	scout: '#c9aa82',
	grunt: '#a58e75',
	brute: '#7a655a',
	runner: '#d6b985',
	shield: '#8f8a7a',
	btr: '#6c7358',
	medic: '#d3d2c2',
	officer: '#8c8666',
	sapper: '#a89a6c',
	tank: '#5b6046',
	buggy: '#a8935a'
};
const HAT: Record<SoldierKind, string> = {
	scout: '#5e6168',
	grunt: '#4b4f55',
	brute: '#35383d',
	runner: '#8a3b36',
	shield: '#2f4a6b',
	btr: '#59604d',
	medic: '#f3f3ee',
	officer: '#3c4a36',
	sapper: '#e8892a',
	tank: '#474c37',
	buggy: '#4b4f55'
};

/** An armored car with angry eyes behind the windscreen, standing at (0, 0) */
function drawBtr(ctx: Ctx, t: number, phase: number, flash: boolean) {
	const r = SOLDIERS.btr.radius;
	const rumble = Math.sin(t / 55 + phase) * 0.6;
	// Wheels
	for (const dx of [-0.95, -0.32, 0.32, 0.95]) {
		inkEllipse(ctx, dx * r, r * 0.78 + rumble * 0.4, r * 0.24, r * 0.26, INK, 1.2);
	}
	ctx.beginPath();
	ctx.roundRect(-r * 1.25, -r * 0.7 + rumble, r * 2.5, r * 1.5, 7);
	ctx.fillStyle = flash ? PAPER : BODY.btr;
	ctx.fill();
	ctx.lineWidth = 2.6;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// A turret with a stubby gun
	ctx.fillStyle = flash ? PAPER : HAT.btr;
	ctx.fillRect(-2, -r * 1.35 + rumble, 4, r * 0.55);
	ctx.strokeRect(-2, -r * 1.35 + rumble, 4, r * 0.55);
	ctx.beginPath();
	ctx.ellipse(0, -r * 0.7 + rumble, r * 0.62, r * 0.38, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	// The windscreen with the eyes
	ctx.beginPath();
	ctx.roundRect(-r * 0.85, -r * 0.2 + rumble, r * 1.7, r * 0.6, 4);
	ctx.fillStyle = flash ? PAPER : '#9fc4d6';
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.stroke();
	for (const dx of [-0.38, 0.38]) {
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.1 + rumble, r * 0.17, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.16 + rumble, r * 0.08, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(-r * 0.62, -r * 0.02 + rumble);
	ctx.lineTo(-r * 0.15, r * 0.06 + rumble);
	ctx.moveTo(r * 0.62, -r * 0.02 + rumble);
	ctx.lineTo(r * 0.15, r * 0.06 + rumble);
	ctx.lineWidth = 1.6;
	ctx.stroke();
}

/** A main battle tank rolling toward the viewer: tracks, hull with angry eyes, turret and a long gun */
function drawTank(ctx: Ctx, t: number, phase: number, flash: boolean) {
	const r = SOLDIERS.tank.radius;
	const rumble = Math.sin(t / 70 + phase) * 0.7;
	const hull = flash ? PAPER : BODY.tank;
	const dark = flash ? PAPER : HAT.tank;
	// Tracks on both sides, with treads that roll down the road
	const roll = (t * 0.035) % 6;
	for (const side of [-1, 1]) {
		const tx = side < 0 ? -r * 1.28 : r * 0.86;
		ctx.beginPath();
		ctx.roundRect(tx, -r * 0.92 + rumble, r * 0.42, r * 1.95, 5);
		ctx.fillStyle = flash ? PAPER : '#2f343b';
		ctx.fill();
		ctx.lineWidth = 2.4;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		for (let y = -r * 0.82 + roll; y < r * 0.95; y += 6) {
			ctx.moveTo(tx + 1.5, y + rumble);
			ctx.lineTo(tx + r * 0.42 - 1.5, y + rumble);
		}
		ctx.lineWidth = 1.4;
		ctx.strokeStyle = 'rgba(160,168,180,0.7)';
		ctx.stroke();
	}
	// The hull, with a sloped darker front
	ctx.beginPath();
	ctx.roundRect(-r * 0.95, -r * 0.8 + rumble, r * 1.9, r * 1.65, 6);
	ctx.fillStyle = hull;
	ctx.fill();
	ctx.lineWidth = 2.6;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.beginPath();
	ctx.roundRect(-r * 0.85, r * 0.12 + rumble, r * 1.7, r * 0.66, 4);
	ctx.fillStyle = dark;
	ctx.fill();
	ctx.lineWidth = 1.6;
	ctx.stroke();
	// The gun first, so the turret sits on top of it; it points down the road
	ctx.fillStyle = flash ? PAPER : '#3a3e2e';
	ctx.fillRect(-2.5, -r * 0.15 + rumble, 5, r * 1.18);
	ctx.lineWidth = 2;
	ctx.strokeRect(-2.5, -r * 0.15 + rumble, 5, r * 1.18);
	ctx.fillRect(-3.8, r * 0.88 + rumble, 7.6, 4.2);
	ctx.strokeRect(-3.8, r * 0.88 + rumble, 7.6, 4.2);
	// Angry eyes on the hull
	ctx.save();
	ctx.translate(0, rumble);
	for (const dx of [-0.52, 0.52]) {
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.4, r * 0.2, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.lineWidth = 1.6;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.46, r * 0.09, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(-r * 0.82, r * 0.12);
	ctx.lineTo(-r * 0.3, r * 0.3);
	ctx.moveTo(r * 0.82, r * 0.12);
	ctx.lineTo(r * 0.3, r * 0.3);
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.restore();
	// The turret with a hatch and an antenna
	ctx.beginPath();
	ctx.ellipse(0, -r * 0.3 + rumble, r * 0.66, r * 0.48, 0, 0, Math.PI * 2);
	ctx.fillStyle = dark;
	ctx.fill();
	ctx.lineWidth = 2.4;
	ctx.stroke();
	inkEllipse(ctx, -r * 0.22, -r * 0.4 + rumble, r * 0.17, r * 0.14, flash ? PAPER : '#2f343b', 1.4);
	stroke(ctx, r * 0.4, -r * 0.55 + rumble, r * 0.55, -r * 1.2 + rumble, 1.4, INK);
}

/** A fast, light open buggy with a gunner standing on the back, coming down the road */
function drawBuggy(ctx: Ctx, t: number, phase: number, flash: boolean) {
	const r = SOLDIERS.buggy.radius;
	const bump = Math.sin(t / 42 + phase) * 0.8;
	const body = flash ? PAPER : BODY.buggy;
	// Dust trailing up the road
	ctx.lineCap = 'round';
	ctx.strokeStyle = 'rgba(17,17,17,0.35)';
	ctx.lineWidth = 1.6;
	for (const dx of [-0.55, 0.55]) {
		ctx.beginPath();
		ctx.moveTo(dx * r, -r * 1.25 + bump);
		ctx.lineTo(dx * r, -r * 2 + bump);
		ctx.stroke();
	}
	ctx.lineCap = 'butt';
	// Fat wheels at the corners
	for (const [dx, dy] of [
		[-1, -0.3],
		[1, -0.3],
		[-1, 0.62],
		[1, 0.62]
	]) {
		inkEllipse(ctx, dx * r * 0.98, dy * r + bump * 0.5, r * 0.27, r * 0.38, INK, 1.2);
		ctx.beginPath();
		ctx.arc(dx * r * 0.98, dy * r + bump * 0.5, r * 0.09, 0, Math.PI * 2);
		ctx.fillStyle = '#9aa0a8';
		ctx.fill();
	}
	// The chassis and the hood
	inkRect(ctx, -r * 0.72, -r * 0.62 + bump, r * 1.44, r * 1.6, body, 2.2, 4);
	// A roll cage over the back
	ctx.beginPath();
	ctx.moveTo(-r * 0.7, -r * 0.1 + bump);
	ctx.lineTo(-r * 0.55, -r * 1.05 + bump);
	ctx.lineTo(r * 0.55, -r * 1.05 + bump);
	ctx.lineTo(r * 0.7, -r * 0.1 + bump);
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// The gunner, with a machine gun pointing forward
	inkEllipse(ctx, 0, -r * 0.5 + bump, r * 0.5, r * 0.56, flash ? PAPER : '#a58e75', 1.8);
	ctx.beginPath();
	ctx.ellipse(0, -r * 0.7 + bump, r * 0.52, r * 0.38, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = flash ? PAPER : HAT.buggy;
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.stroke();
	ctx.fillStyle = flash ? PAPER : '#2f343b';
	ctx.fillRect(r * 0.2, -r * 0.3 + bump, r * 0.22, r * 0.95);
	ctx.strokeRect(r * 0.2, -r * 0.3 + bump, r * 0.22, r * 0.95);
	// The grumpy headlights on the hood
	ctx.save();
	ctx.translate(0, bump);
	angryEyes(ctx, 0, r * 0.52, r * 0.38, r * 0.17);
	ctx.restore();
}

/** Green plus signs floating up from a medic */
function drawHealPluses(ctx: Ctx, r: number, t: number, phase: number) {
	ctx.lineCap = 'round';
	for (let i = 0; i < 3; i++) {
		const p = (t / 1100 + i / 3 + phase * 0.37) % 1;
		const x = (i - 1) * r * 0.85 + Math.sin(p * 6 + i * 2) * 2;
		const y = -r * 1.45 - p * 15;
		const s = r * 0.26 * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, p * 1.3)));
		ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
		ctx.beginPath();
		ctx.moveTo(x - s, y);
		ctx.lineTo(x + s, y);
		ctx.moveTo(x, y - s);
		ctx.lineTo(x, y + s);
		ctx.lineWidth = 3.6;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.lineWidth = 1.9;
		ctx.strokeStyle = '#59d96a';
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	ctx.lineCap = 'butt';
}

/** A chunky blob soldier or vehicle standing at (0, 0) of the current transform */
export function drawBlob(
	ctx: Ctx,
	kind: SoldierKind,
	t: number,
	phase: number,
	flash: boolean,
	grumpy = true
) {
	if (kind === 'btr') {
		drawBtr(ctx, t, phase, flash);
		return;
	}
	if (kind === 'tank') {
		drawTank(ctx, t, phase, flash);
		return;
	}
	if (kind === 'buggy') {
		drawBuggy(ctx, t, phase, flash);
		return;
	}
	const r = SOLDIERS[kind].radius;
	const stride = Math.sin(t / 95 + phase) * (kind === 'runner' ? 3 : 2);
	// Stubby feet
	inkEllipse(ctx, -r * 0.45, r * 0.95 + stride * 0.5, r * 0.35, r * 0.24, INK, 1);
	inkEllipse(ctx, r * 0.45, r * 0.95 - stride * 0.5, r * 0.35, r * 0.24, INK, 1);
	// Body
	inkEllipse(ctx, 0, 0, r, r * 1.05, flash ? PAPER : BODY[kind], 2.2);
	// Helmet, or the officer's peaked cap
	ctx.beginPath();
	ctx.ellipse(0, -r * 0.35, r * 1.02, r * 0.78, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = flash ? PAPER : HAT[kind];
	ctx.fill();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (kind === 'officer') {
		// A flat red band, a shiny peak and a gold badge
		ctx.fillStyle = flash ? PAPER : '#c9252b';
		ctx.fillRect(-r * 1, -r * 0.62, r * 2, r * 0.26);
		ctx.lineWidth = 1.4;
		ctx.strokeRect(-r * 1, -r * 0.62, r * 2, r * 0.26);
		ctx.beginPath();
		ctx.roundRect(-r * 0.78, -r * 0.4, r * 1.56, r * 0.2, r * 0.1);
		ctx.fillStyle = flash ? PAPER : '#1f2620';
		ctx.fill();
		ctx.lineWidth = 1.6;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(0, -r * 0.5, r * 0.11, 0, Math.PI * 2);
		ctx.fillStyle = YELLOW;
		ctx.fill();
	}
	if (kind === 'sapper') {
		// An orange hard hat with a brim and a little lamp
		ctx.beginPath();
		ctx.roundRect(-r * 1.15, -r * 0.5, r * 2.3, r * 0.2, r * 0.1);
		ctx.fillStyle = flash ? PAPER : '#c4651a';
		ctx.fill();
		ctx.lineWidth = 1.6;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(0, -r * 0.88, r * 0.2, 0, Math.PI * 2);
		ctx.fillStyle = flash ? PAPER : YELLOW;
		ctx.fill();
		ctx.lineWidth = 1.2;
		ctx.stroke();
	}
	// Face
	for (const dx of [-0.38, 0.38]) {
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.08, r * 0.2, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.14, r * 0.09, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	if (grumpy && kind !== 'medic') {
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.moveTo(-r * 0.62, -r * 0.1);
		ctx.lineTo(-r * 0.15, r * 0.02);
		ctx.moveTo(r * 0.62, -r * 0.1);
		ctx.lineTo(r * 0.15, r * 0.02);
		ctx.stroke();
	}
	if (kind === 'brute') {
		// A big belt, because chunky
		ctx.fillStyle = '#4a3b30';
		ctx.fillRect(-r * 0.95, r * 0.45, r * 1.9, r * 0.22);
	}
	if (kind === 'shield') {
		// A riot shield held in front
		ctx.beginPath();
		ctx.roundRect(-r * 1.3, -r * 0.5, r * 1.05, r * 1.75, 4);
		ctx.fillStyle = flash ? PAPER : '#9aa6b4';
		ctx.fill();
		ctx.lineWidth = 2.2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(-r * 1.05, -r * 0.2);
		ctx.lineTo(-r * 1.05, r * 0.95);
		ctx.lineWidth = 1.4;
		ctx.stroke();
	}
	if (kind === 'runner') {
		// Speed lines trailing up the road
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = 'rgba(17,17,17,0.45)';
		for (const dx of [-0.5, 0.5]) {
			ctx.beginPath();
			ctx.moveTo(dx * r, -r * 1.35);
			ctx.lineTo(dx * r, -r * 2.1);
			ctx.stroke();
		}
	}
	if (kind === 'medic') {
		// A red cross on the white helmet, and a medical bag on the side
		ctx.fillStyle = flash ? PAPER : TIE_RED;
		ctx.fillRect(-r * 0.12, -r * 1.02, r * 0.24, r * 0.52);
		ctx.fillRect(-r * 0.26, -r * 0.88, r * 0.52, r * 0.24);
		ctx.beginPath();
		ctx.roundRect(r * 0.72, r * 0.1, r * 0.7, r * 0.62, 2.5);
		ctx.fillStyle = flash ? PAPER : '#e6e1c4';
		ctx.fill();
		ctx.lineWidth = 1.8;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.fillStyle = flash ? PAPER : TIE_RED;
		ctx.fillRect(r * 1.02, r * 0.18, r * 0.1, r * 0.46);
		ctx.fillRect(r * 0.84, r * 0.36, r * 0.46, r * 0.1);
		drawHealPluses(ctx, r, t, phase);
	}
	if (kind === 'officer') {
		// Gold shoulder boards
		ctx.fillStyle = flash ? PAPER : YELLOW;
		for (const side of [-1, 1]) {
			ctx.fillRect(side * r * 0.82 - r * 0.2, -r * 0.02, r * 0.4, r * 0.18);
			ctx.strokeRect(side * r * 0.82 - r * 0.2, -r * 0.02, r * 0.4, r * 0.18);
		}
	}
	if (kind === 'sapper') {
		// A shovel over the shoulder
		ctx.lineCap = 'round';
		stroke(ctx, r * 0.95, r * 0.9, r * 1.28, -r * 1.05, 4, INK);
		stroke(ctx, r * 0.95, r * 0.9, r * 1.28, -r * 1.05, 2, '#9a7b4f');
		ctx.lineCap = 'butt';
		ctx.beginPath();
		ctx.ellipse(r * 1.3, -r * 1.35, r * 0.34, r * 0.5, 0.15, 0, Math.PI * 2);
		ctx.fillStyle = flash ? PAPER : '#aab2bc';
		ctx.fill();
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = INK;
		ctx.stroke();
	}
}

/** The faint ring of an officer's rallying shout, drawn under the crowd */
export function drawOfficerAura(ctx: Ctx, soldier: Soldier, t: number, radius = 85) {
	const pulse = (t / 1500 + soldier.id * 0.37) % 1;
	ctx.beginPath();
	ctx.arc(soldier.x, soldier.y, radius, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(229,72,77,0.06)';
	ctx.fill();
	ctx.lineWidth = 1.6;
	ctx.strokeStyle = `rgba(229,72,77,${0.2 + 0.08 * Math.sin(t / 300)})`;
	ctx.stroke();
	// A second ring sweeps outward from the officer
	ctx.beginPath();
	ctx.arc(soldier.x, soldier.y, radius * (0.25 + 0.75 * pulse), 0, Math.PI * 2);
	ctx.lineWidth = 2;
	ctx.strokeStyle = `rgba(229,72,77,${0.28 * (1 - pulse)})`;
	ctx.stroke();
}

/** Ice-blue shell and crystals over a soldier frozen solid in the snow */
function drawIce(ctx: Ctx, r: number) {
	const spikes = [
		[-2.5, 0.6],
		[-1.7, 0.85],
		[-0.85, 0.6],
		[0.1, 0.5],
		[0.95, 0.55],
		[2.2, 0.5]
	];
	ctx.lineJoin = 'round';
	for (const [angle, length] of spikes) {
		const near = r * 1.02;
		const tipX = Math.cos(angle) * (near + r * length);
		const tipY = Math.sin(angle) * (near + r * length) * 1.05;
		inkPoly(
			ctx,
			[
				Math.cos(angle - 0.3) * near,
				Math.sin(angle - 0.3) * near * 1.05,
				tipX,
				tipY,
				Math.cos(angle + 0.3) * near,
				Math.sin(angle + 0.3) * near * 1.05
			],
			'#d3f0ff',
			1.5
		);
	}
	ctx.beginPath();
	ctx.ellipse(0, r * 0.02, r * 1.12, r * 1.2, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(150,214,250,0.5)';
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'rgba(226,247,255,0.95)';
	ctx.stroke();
	// A glassy shine
	ctx.beginPath();
	ctx.arc(0, 0, r * 0.82, Math.PI * 1.1, Math.PI * 1.5);
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'rgba(255,255,255,0.85)';
	ctx.stroke();
}

/** The little red chevrons of an officer's boost, hopping up beside a soldier */
function drawRally(ctx: Ctx, r: number, t: number, phase: number) {
	const bob = Math.sin(t / 150 + phase) * 1;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	for (const [width, color] of [
		[4.2, INK],
		[2, TIE_RED]
	] as const) {
		ctx.beginPath();
		for (const k of [0, 1]) {
			const y = -r * 1.05 - k * 4.2 + bob;
			ctx.moveTo(r * 1.05 - 3, y + 2);
			ctx.lineTo(r * 1.05, y - 1);
			ctx.lineTo(r * 1.05 + 3, y + 2);
		}
		ctx.lineWidth = width;
		ctx.strokeStyle = color;
		ctx.stroke();
	}
	ctx.lineCap = 'butt';
}

export function drawSoldier(ctx: Ctx, soldier: Soldier, timeMs: number, road: Path) {
	const r = SOLDIERS[soldier.kind].radius;
	const frozen = soldier.frozenMs > 0;
	const sample = pointAt(road, soldier.progress);
	// Spread the crowd across the width of the road
	const side = soldier.lane * 8;
	// A soldier in a melee shakes on the spot instead of hopping along; a frozen one is a statue
	const shake = soldier.engaged && !frozen ? Math.sin(timeMs / 38 + soldier.id) * 1.4 : 0;
	const x = soldier.x - Math.sin(sample.angle) * side + shake;
	const y = soldier.y + Math.cos(sample.angle) * side;
	const hop =
		soldier.engaged || frozen
			? 0
			: Math.abs(Math.sin(timeMs / 130 + soldier.id)) * 2 * soldier.slow;
	ctx.save();
	ctx.translate(x, y - hop);
	ctx.beginPath();
	ctx.ellipse(0, r * 1.1 + hop, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.25)';
	ctx.fill();
	drawBlob(ctx, soldier.kind, frozen ? 0 : timeMs, soldier.id, soldier.hitMs > 0);
	if (frozen) drawIce(ctx, r);
	else if (soldier.rally > 1) drawRally(ctx, r, timeMs, soldier.id);
	if (soldier.hp < soldier.maxHp) {
		const w = r * 2;
		ctx.fillStyle = PAPER;
		ctx.fillRect(-w / 2, -r * 1.7, w, 4);
		ctx.fillStyle = soldier.hp / soldier.maxHp > 0.4 ? '#6ac05c' : TIE_RED;
		ctx.fillRect(-w / 2, -r * 1.7, w * Math.max(0, soldier.hp / soldier.maxHp), 4);
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = INK;
		ctx.strokeRect(-w / 2, -r * 1.7, w, 4);
	}
	ctx.restore();
}

/** The big twin-engine bomber seen from above, flying toward the bottom of the field */
function drawBomber(ctx: Ctx, t: number, flash: boolean) {
	const r = FLYERS.bomber.radius;
	const skin = flash ? PAPER : '#8a909a';
	const wing = flash ? PAPER : '#767c87';
	ctx.lineJoin = 'round';
	for (const s of [-1, 1]) {
		// Swept-back wings and the tailplane
		inkPoly(
			ctx,
			[
				s * r * 0.3,
				r * 0.2,
				s * r * 1.75,
				-r * 0.5,
				s * r * 1.75,
				-r * 0.85,
				s * r * 0.3,
				-r * 0.5
			],
			wing,
			2.4
		);
		inkPoly(
			ctx,
			[
				s * r * 0.28,
				-r * 0.7,
				s * r * 0.85,
				-r * 1.02,
				s * r * 0.85,
				-r * 0.82,
				s * r * 0.28,
				-r * 0.5
			],
			wing,
			2
		);
		// A red stripe on each wing tip
		stroke(ctx, s * r * 1.5, -r * 0.57, s * r * 1.5, -r * 0.8, 3.4, TIE_RED);
	}
	// The engines, with propellers that blur
	const buzz = Math.sin(t / 20) > 0 ? 1 : 0.7;
	for (const s of [-1, 1]) {
		const cx = s * r * 0.82;
		inkEllipse(ctx, cx, -r * 0.1, r * 0.17, r * 0.42, flash ? PAPER : '#5d636d', 2);
		ctx.beginPath();
		ctx.ellipse(cx, r * 0.36, r * 0.34 * buzz, 2, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.7)';
		ctx.fill();
		ctx.lineWidth = 1.4;
		ctx.stroke();
	}
	// The fuselage with a dark bomb-bay door
	inkEllipse(ctx, 0, 0, r * 0.34, r * 1.12, skin, 2.6);
	inkRect(ctx, -r * 0.13, -r * 0.5, r * 0.26, r * 0.8, flash ? PAPER : '#4b505a', 1.6, 2);
	// The cockpit glass with angry eyes
	ctx.beginPath();
	ctx.ellipse(0, r * 0.64, r * 0.25, r * 0.3, 0, 0, Math.PI * 2);
	ctx.fillStyle = flash ? PAPER : '#9fc4d6';
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.stroke();
	angryEyes(ctx, 0, r * 0.66, r * 0.1, r * 0.075);
}

/** A tiny kamikaze drone, drawn simply because they come in clouds */
function drawSwarmDrone(ctx: Ctx, t: number, flash: boolean) {
	const r = FLYERS.swarm.radius;
	const buzz = Math.sin(t / 18) > 0 ? 1 : 0.55;
	ctx.beginPath();
	ctx.ellipse(0, -r * 0.7, r * 1.15 * buzz, r * 0.2, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.75)';
	ctx.fill();
	inkPoly(
		ctx,
		[0, r * 1.05, r * 0.85, -r * 0.5, 0, -r * 0.15, -r * 0.85, -r * 0.5],
		flash ? PAPER : '#b4ae98',
		1.7
	);
	ctx.beginPath();
	ctx.arc(0, r * 0.12, r * 0.22, 0, Math.PI * 2);
	ctx.fillStyle = TIE_RED;
	ctx.fill();
}

/** The body of an aerial enemy about (0, 0), flying toward the bottom of the field */
export function drawFlyerBody(ctx: Ctx, kind: FlyerKind, t: number, flash: boolean) {
	const r = FLYERS[kind].radius;
	if (kind === 'bomber') {
		drawBomber(ctx, t, flash);
		return;
	}
	if (kind === 'swarm') {
		drawSwarmDrone(ctx, t, flash);
		return;
	}
	if (kind === 'shahed') {
		// A delta-wing kamikaze drone with a buzzing propeller and a grumpy face
		const buzz = Math.sin(t / 22) > 0 ? 1 : 0.6;
		ctx.beginPath();
		ctx.ellipse(0, -r * 1.05, r * 0.7 * buzz, r * 0.2, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.7)';
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0, r * 1.15);
		ctx.lineTo(r * 1.25, -r * 0.85);
		ctx.lineTo(0, -r * 0.45);
		ctx.lineTo(-r * 1.25, -r * 0.85);
		ctx.closePath();
		ctx.fillStyle = flash ? PAPER : '#b9b4a0';
		ctx.fill();
		ctx.lineWidth = 2.2;
		ctx.stroke();
		for (const dx of [-0.26, 0.26]) {
			ctx.beginPath();
			ctx.arc(dx * r, r * 0.12, r * 0.17, 0, Math.PI * 2);
			ctx.fillStyle = PAPER;
			ctx.fill();
			ctx.beginPath();
			ctx.arc(dx * r, r * 0.2, r * 0.08, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
		}
		ctx.beginPath();
		ctx.moveTo(-r * 0.48, -r * 0.05);
		ctx.lineTo(-r * 0.1, r * 0.06);
		ctx.moveTo(r * 0.48, -r * 0.05);
		ctx.lineTo(r * 0.1, r * 0.06);
		ctx.lineWidth = 1.5;
		ctx.stroke();
		// A red band on each wing
		ctx.beginPath();
		ctx.moveTo(-r * 0.8, -r * 0.55);
		ctx.lineTo(-r * 1.1, -r * 0.75);
		ctx.moveTo(r * 0.8, -r * 0.55);
		ctx.lineTo(r * 1.1, -r * 0.75);
		ctx.lineWidth = 3;
		ctx.strokeStyle = TIE_RED;
		ctx.stroke();
		return;
	}
	// A helicopter: tail boom up, canopy with eyes down, spinning rotor on top
	ctx.beginPath();
	ctx.roundRect(-r * 0.12, -r * 1.9, r * 0.24, r * 1.2, 2);
	ctx.fillStyle = flash ? PAPER : '#59604d';
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(0, -r * 1.85, r * 0.45, r * 0.12, t / 35, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.7)';
	ctx.fill();
	ctx.stroke();
	inkEllipse(ctx, 0, 0, r * 0.95, r * 0.85, flash ? PAPER : '#6b705f', 2.4);
	// The canopy glass with angry eyes
	ctx.beginPath();
	ctx.ellipse(0, r * 0.28, r * 0.68, r * 0.5, 0, 0, Math.PI * 2);
	ctx.fillStyle = flash ? PAPER : '#9fc4d6';
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.stroke();
	for (const dx of [-0.3, 0.3]) {
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.3, r * 0.15, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.36, r * 0.07, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(-r * 0.5, r * 0.1);
	ctx.lineTo(-r * 0.12, r * 0.2);
	ctx.moveTo(r * 0.5, r * 0.1);
	ctx.lineTo(r * 0.12, r * 0.2);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	// The main rotor: two blades and a faint disc
	ctx.beginPath();
	ctx.arc(0, -r * 0.1, r * 1.9, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.18)';
	ctx.fill();
	ctx.save();
	ctx.translate(0, -r * 0.1);
	ctx.rotate(t / 45);
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.strokeStyle = INK;
	ctx.beginPath();
	ctx.moveTo(-r * 1.9, 0);
	ctx.lineTo(r * 1.9, 0);
	ctx.stroke();
	ctx.restore();
	ctx.lineCap = 'butt';
	inkEllipse(ctx, 0, -r * 0.1, 2.6, 2.6, '#2f343b', 1.4);
}

export function drawFlyer(ctx: Ctx, flyer: Flyer, timeMs: number) {
	const r = FLYERS[flyer.kind].radius;
	const tiny = flyer.kind === 'swarm';
	// Its shadow slides over the ground below
	ctx.beginPath();
	ctx.ellipse(
		flyer.x + (tiny ? 4 : 8),
		flyer.y + r * (tiny ? 3 : 2.1),
		r * 0.95,
		r * 0.4,
		0,
		0,
		Math.PI * 2
	);
	ctx.fillStyle = 'rgba(17,17,17,0.22)';
	ctx.fill();
	ctx.save();
	// A swarm drone buzzes about a little
	const jitter = tiny ? Math.sin(timeMs / 33 + flyer.id * 5) * 0.9 : 0;
	ctx.translate(flyer.x + jitter, flyer.y + Math.sin(timeMs / 170 + flyer.id) * (tiny ? 0.8 : 1.5));
	drawFlyerBody(ctx, flyer.kind, timeMs + flyer.id * 37, flyer.hitMs > 0);
	if (flyer.hp < flyer.maxHp) {
		const w = r * 2;
		const top = -r * (tiny ? 2.6 : 2.3);
		ctx.fillStyle = PAPER;
		ctx.fillRect(-w / 2, top, w, 4);
		ctx.fillStyle = flyer.hp / flyer.maxHp > 0.4 ? '#6ac05c' : TIE_RED;
		ctx.fillRect(-w / 2, top, w * Math.max(0, flyer.hp / flyer.maxHp), 4);
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = INK;
		ctx.strokeRect(-w / 2, top, w, 4);
	}
	ctx.restore();
}

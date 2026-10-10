/*
 * Drawing of the player's side: the slots, the range ring, the twelve defenses and the units that
 * walk around the garrison posts. Levels 1 to 3 are the normal look (olive paint, sandbags); the
 * elite levels 4 to 6 (tier 1 to 3) are black-and-gold with a glowing plate under the post, and
 * every tier adds more parts: more barrels, tubes, drones, dishes, lamps.
 */
import { NORMAL_LEVELS, defenseStats, isElite, type GarrisonKind, type Point } from './config';
import {
	BLACK,
	BLACK_DEEP,
	BLACK_LIGHT,
	ELITE_RED,
	FLAG_BLUE,
	GOLD,
	GOLD_DARK,
	INK,
	PAPER,
	SANDBAG,
	SOVIET_GREEN_DARK,
	TIE_RED,
	YELLOW,
	DISPLAY_FONT,
	clamp,
	inkEllipse,
	inkPoly,
	inkRect,
	skin,
	starPath,
	stroke,
	type Ctx,
	type Skin
} from './drawKit';
import type { Defense, Unit } from './state';

const GLOW_RGB = ['245,200,58', '255,154,46', '255,74,58'];
const OLIVE = '#4d5a38';

/** The pale rubble-and-sandbag colour of a post's base */
const bagColor = (sk: Skin) => (sk.elite ? '#8a7f5c' : SANDBAG);

export function drawSlot(
	ctx: Ctx,
	slots: readonly Point[],
	slot: number,
	selected: boolean,
	showEmpty: boolean,
	occupied: boolean
) {
	const { x, y } = slots[slot];
	if (!occupied) {
		ctx.beginPath();
		ctx.arc(x, y, 21, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.4)';
		ctx.fill();
		ctx.lineWidth = 2.5;
		ctx.setLineDash([6, 5]);
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.setLineDash([]);
		if (showEmpty) {
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(x - 7, y);
			ctx.lineTo(x + 7, y);
			ctx.moveTo(x, y - 7);
			ctx.lineTo(x, y + 7);
			ctx.stroke();
		}
	}
	if (selected) {
		ctx.beginPath();
		ctx.arc(x, y, 26, 0, Math.PI * 2);
		ctx.lineWidth = 4;
		ctx.strokeStyle = YELLOW;
		ctx.stroke();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = INK;
		ctx.stroke();
	}
}

/** The reach of the selected defense; artillery shows the hole it cannot hit */
export function drawRangeRing(
	ctx: Ctx,
	slots: readonly Point[],
	slot: number,
	defense: Defense | null
) {
	if (!defense) return;
	const { x, y } = slots[slot];
	const stats = defenseStats(defense.kind, defense.level);
	const cyan = defense.kind === 'jammer';
	ctx.beginPath();
	ctx.arc(x, y, stats.range, 0, Math.PI * 2);
	if (stats.minRange > 0) ctx.arc(x, y, stats.minRange, 0, Math.PI * 2, true);
	ctx.fillStyle =
		defense.kind === 'trench'
			? 'rgba(120,80,40,0.14)'
			: cyan
				? 'rgba(70,217,232,0.14)'
				: 'rgba(255,255,255,0.14)';
	ctx.fill('evenodd');
	ctx.lineWidth = 2;
	ctx.setLineDash([8, 6]);
	ctx.strokeStyle = cyan ? 'rgba(17,90,100,0.6)' : 'rgba(17,17,17,0.55)';
	ctx.beginPath();
	ctx.arc(x, y, stats.range, 0, Math.PI * 2);
	ctx.stroke();
	if (stats.minRange > 0) {
		ctx.beginPath();
		ctx.arc(x, y, stats.minRange, 0, Math.PI * 2);
		ctx.strokeStyle = 'rgba(229,72,77,0.6)';
		ctx.stroke();
	}
	ctx.setLineDash([]);
}

/** Three pips for the normal levels; for the elite levels a dark rank plate with three gold stars */
export function drawPips(ctx: Ctx, x: number, y: number, level: number) {
	if (isElite(level)) {
		const tier = skin(level).tier;
		ctx.beginPath();
		ctx.roundRect(x - 18, y - 6.5, 36, 13, 6.5);
		ctx.fillStyle = BLACK;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = GOLD;
		ctx.stroke();
		ctx.lineWidth = 1;
		ctx.strokeStyle = INK;
		ctx.beginPath();
		ctx.roundRect(x - 19.5, y - 8, 39, 16, 8);
		ctx.stroke();
		for (let i = 0; i < 3; i++) {
			starPath(ctx, x + (i - 1) * 10.5, y + 0.4, 5.6, 2.5);
			ctx.fillStyle = i < tier ? GOLD : '#4a4d55';
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = i < tier ? INK : '#26282e';
			ctx.stroke();
		}
		return;
	}
	for (let i = 0; i < NORMAL_LEVELS; i++) {
		ctx.beginPath();
		ctx.arc(x + (i - 1) * 8, y, 3, 0, Math.PI * 2);
		ctx.fillStyle = i < level ? YELLOW : 'rgba(255,255,255,0.6)';
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = INK;
		ctx.stroke();
	}
}

/** The glowing plate an elite post stands on: gold rim, tier rings, spikes at the top tier */
function drawElitePlate(ctx: Ctx, x: number, y: number, sk: Skin, t: number) {
	const rgb = GLOW_RGB[sk.tier - 1];
	const pulse = 0.5 + 0.5 * Math.sin(t / 380 + sk.tier);
	const cy = y + 9;
	// The glow around it
	for (let i = sk.tier >= 2 ? 1 : 0; i >= 0; i--) {
		ctx.beginPath();
		ctx.ellipse(x, cy, 31 + sk.tier * 3 + i * 7, 16 + sk.tier * 1.5 + i * 4, 0, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(${rgb},${(0.15 + 0.1 * pulse) / (1 + i)})`;
		ctx.fill();
	}
	// Spikes around the rim of the top tier
	if (sk.tier >= 3) {
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2 + 0.2;
			const px = Math.cos(a) * 29;
			const py = Math.sin(a) * 13;
			inkPoly(
				ctx,
				[
					x + px * 0.95 - Math.sin(a) * 2.4,
					cy + py * 0.95 + Math.cos(a) * 1.2,
					x + px * 1.28,
					cy + py * 1.28,
					x + px * 0.95 + Math.sin(a) * 2.4,
					cy + py * 0.95 - Math.cos(a) * 1.2
				],
				GOLD,
				1.2
			);
		}
	}
	// The dark plate with its gold rim
	inkEllipse(ctx, x, cy, 28, 12.5, '#1a1b20', 2.4);
	ctx.beginPath();
	ctx.ellipse(x, cy, 26.5, 11.2, 0, 0, Math.PI * 2);
	ctx.lineWidth = 2;
	ctx.strokeStyle = GOLD;
	ctx.stroke();
	if (sk.tier >= 2) {
		ctx.beginPath();
		ctx.ellipse(x, cy, 21, 8.4, 0, 0, Math.PI * 2);
		ctx.lineWidth = 1.5;
		ctx.setLineDash([5, 4]);
		ctx.lineDashOffset = -t / 60;
		ctx.strokeStyle = sk.glow;
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.lineDashOffset = 0;
	}
	// Gold ticks at the sides: one, two or three per side
	for (let i = 0; i < sk.tier; i++) {
		for (const s of [-1, 1]) {
			ctx.fillStyle = GOLD;
			ctx.fillRect(x + s * (24 - i * 4) - 1.2, cy - 1.6, 2.4, 3.2);
		}
	}
}

/** Sparks rising off an elite post */
function drawEliteSparks(ctx: Ctx, x: number, y: number, sk: Skin, t: number) {
	const n = sk.tier + 1;
	for (let i = 0; i < n; i++) {
		const p = (t / 1500 + i / n + sk.tier * 0.13) % 1;
		const px = x + (i - (n - 1) / 2) * 11 + Math.sin(p * 7 + i * 2) * 3;
		const py = y + 6 - p * 30;
		ctx.globalAlpha = (1 - p) * 0.9;
		ctx.beginPath();
		ctx.arc(px, py, 1.9 - p, 0, Math.PI * 2);
		ctx.fillStyle = sk.tier === 3 ? '#ff8a6a' : sk.glow;
		ctx.fill();
	}
	ctx.globalAlpha = 1;
}

/** A defender blob seen from the side: body, helmet and a gold-rimmed black look when elite */
function crewBlob(
	ctx: Ctx,
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	sk: Skin,
	plume = false,
	t = 0
) {
	inkEllipse(ctx, cx, cy, rx, ry, sk.elite ? BLACK_LIGHT : FLAG_BLUE);
	ctx.beginPath();
	ctx.ellipse(cx, cy - ry * 0.66, rx, ry * 0.68, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = sk.elite ? BLACK : OLIVE;
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (sk.elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(cx - rx * 0.92, cy - ry * 0.74, rx * 1.84, 1.8);
		if (plume) {
			const sway = Math.sin(t / 260) * 1.2;
			inkPoly(
				ctx,
				[
					cx,
					cy - ry * 1.3,
					cx - rx * 0.6,
					cy - ry * 2 + sway,
					cx - rx * 1.6,
					cy - ry * 1.5 + sway,
					cx - rx * 0.4,
					cy - ry * 1.1
				],
				ELITE_RED,
				1.4
			);
		}
	}
}

/** A friendly blob with a generic round patch on the chest (no real insignia) */
function drawSquad(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	const elite = sk.elite;
	inkEllipse(ctx, x, y + 9, 21, 9, bagColor(sk));
	const recoil = defense.firedMs > 0 ? Math.sin(t / 25) * 1.2 : 0;
	const bob = Math.sin(t / 300) * 0.8;
	// Rifles toward the target: a second one from tier 2
	const racks = sk.tier >= 2 ? [-3.8, 3.8] : [0];
	for (const k of racks) {
		ctx.save();
		ctx.translate(x, y - 2 + bob);
		ctx.rotate(defense.aim);
		const len = elite ? 21 : 17;
		inkRect(ctx, 6 + recoil, k - 2, len, 4, elite ? BLACK : '#3b4048', 1.5);
		if (elite) {
			inkRect(ctx, 11 + recoil, k - 4.4, 7, 2.6, GOLD_DARK, 1.2);
			ctx.fillStyle = GOLD;
			ctx.fillRect(6 + len - 3 + recoil, k - 2, 2.6, 4);
		}
		if (defense.firedMs > 90) {
			ctx.beginPath();
			ctx.arc(9 + len, k, elite ? 6 : 4.5, 0, Math.PI * 2);
			ctx.fillStyle = elite ? '#ffd66a' : YELLOW;
			ctx.fill();
		}
		ctx.restore();
	}
	inkEllipse(ctx, x, y + bob, 12, 13, elite ? BLACK_LIGHT : FLAG_BLUE);
	if (elite) {
		// Gold sash and shoulder pads
		stroke(ctx, x - 9, y - 5 + bob, x + 8, y + 6 + bob, 3.2, GOLD);
		for (const s of [-1, 1]) inkEllipse(ctx, x + s * 11, y - 3 + bob, 3.6, 3.2, GOLD, 1.5);
	}
	// Helmet
	ctx.beginPath();
	ctx.ellipse(x, y - 9 + bob, 12, 8, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = elite ? BLACK_DEEP : OLIVE;
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(x - 11.5, y - 10.6 + bob, 23, 2);
		// The dark visor with two glowing red eyes
		inkRect(ctx, x - 9, y - 6.2 + bob, 18, 6, BLACK_DEEP, 1.6, 2.5);
		for (const dx of [-4, 4]) {
			ctx.beginPath();
			ctx.arc(x + dx, y - 3.2 + bob, 3.6, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,60,60,0.35)';
			ctx.fill();
			ctx.beginPath();
			ctx.arc(x + dx + Math.cos(defense.aim) * 0.8, y - 3.2 + bob, 1.7, 0, Math.PI * 2);
			ctx.fillStyle = '#ff5050';
			ctx.fill();
		}
		// A red plume that waves, bigger at every tier
		const sway = Math.sin(t / 240) * 1.6;
		const lift = sk.tier * 2.2;
		inkPoly(
			ctx,
			[
				x + 1,
				y - 16 + bob,
				x - 5,
				y - 25 + bob - lift,
				x - 13 - sk.tier * 1.4,
				y - 21 + bob - lift * 0.4 + sway,
				x - 6,
				y - 17.5 + bob
			],
			ELITE_RED,
			1.8
		);
		if (sk.tier >= 3) {
			inkPoly(ctx, [x + 1, y - 16 + bob, x + 8, y - 26 + bob, x + 4, y - 15.5 + bob], GOLD, 1.5);
		}
	} else {
		// Eyes
		for (const dx of [-4, 4]) {
			ctx.beginPath();
			ctx.arc(x + dx, y - 3 + bob, 2.2, 0, Math.PI * 2);
			ctx.fillStyle = PAPER;
			ctx.fill();
			ctx.beginPath();
			ctx.arc(
				x + dx + Math.cos(defense.aim),
				y - 3 + bob + Math.sin(defense.aim),
				1.1,
				0,
				Math.PI * 2
			);
			ctx.fillStyle = INK;
			ctx.fill();
		}
	}
	// The patch: a round badge with a chevron (a gold star when elite)
	ctx.beginPath();
	ctx.arc(x, y + 6 + bob, 5.5, 0, Math.PI * 2);
	ctx.fillStyle = elite ? BLACK : PAPER;
	ctx.fill();
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = elite ? GOLD : INK;
	ctx.stroke();
	if (elite) {
		starPath(ctx, x, y + 6 + bob, 4, 1.8);
		ctx.fillStyle = GOLD;
		ctx.fill();
	} else {
		ctx.beginPath();
		ctx.moveTo(x - 3, y + 7.5 + bob);
		ctx.lineTo(x, y + 4 + bob);
		ctx.lineTo(x + 3, y + 7.5 + bob);
		ctx.lineWidth = 1.8;
		ctx.strokeStyle = TIE_RED;
		ctx.stroke();
	}
	ctx.strokeStyle = INK;
}

function drawMortar(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	const elite = sk.elite;
	inkEllipse(ctx, x, y + 8, 21, 10, bagColor(sk));
	inkEllipse(ctx, x, y + 6, 12, 5, elite ? BLACK_DEEP : '#4a4f57');
	// Tubes, tilted toward the target; they kick back when they fire (elite: 1, 2 and 3 heavy tubes)
	const kick = defense.firedMs > 0 ? -3 : 0;
	const width = sk.tier <= 1 ? (elite ? 11.5 : 10) : sk.tier === 2 ? 8.6 : 7.2;
	const offsets = sk.tier === 3 ? [-6.8, 0, 6.8] : sk.tier === 2 ? [-4.4, 4.4] : [0];
	for (const k of offsets) {
		ctx.save();
		ctx.translate(x, y + 2);
		ctx.rotate(defense.aim);
		inkRect(ctx, -4 + kick, k - width / 2, elite ? 26 : 24, width, elite ? BLACK : '#2f343b', 2);
		if (elite) {
			ctx.fillStyle = GOLD;
			ctx.fillRect(4 + kick, k - width / 2, 2.4, width);
			ctx.fillRect(13 + kick, k - width / 2, 2.4, width);
		}
		inkRect(
			ctx,
			(elite ? 20 : 18) + kick,
			k - width / 2 - 1.5,
			5,
			width + 3,
			elite ? GOLD_DARK : '#555c66',
			2
		);
		ctx.restore();
		if (defense.firedMs > 90) {
			const flash = defense.firedMs / 160;
			const reach = elite ? 27 : 24;
			ctx.beginPath();
			ctx.arc(
				x + Math.cos(defense.aim) * reach - Math.sin(defense.aim) * k,
				y + 2 + Math.sin(defense.aim) * reach + Math.cos(defense.aim) * k,
				(elite ? 8.5 : 8) * flash,
				0,
				Math.PI * 2
			);
			ctx.fillStyle = elite ? '#ffd66a' : YELLOW;
			ctx.fill();
		}
	}
	// A crew blob peeking out behind the sandbags
	const peek = Math.sin(t / 420) * 0.8;
	crewBlob(ctx, x - 12, y - 6 + peek, 7, 7.5, sk, elite, t);
}

function drawDrone(
	ctx: Ctx,
	cx: number,
	cy: number,
	scale: number,
	t: number,
	sk: Skin,
	led: string
) {
	const elite = sk.elite;
	const spin = Math.sin(t / 28) > 0 ? 7 : 5;
	if (elite) {
		ctx.beginPath();
		ctx.arc(cx, cy, 10 * scale, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,60,60,0.22)';
		ctx.fill();
	}
	for (const dx of [-11, 11]) {
		ctx.beginPath();
		ctx.ellipse(cx + dx * scale, cy - 4 * scale, spin * scale, 2 * scale, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.75)';
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + dx * scale, cy - 3 * scale);
		ctx.stroke();
	}
	inkEllipse(ctx, cx, cy, 7 * scale, 4.5 * scale, elite ? BLACK_DEEP : '#3b4048');
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(cx - 6 * scale, cy - 0.8, 12 * scale, 1.6);
	}
	ctx.beginPath();
	ctx.arc(cx, cy, 1.8 * scale, 0, Math.PI * 2);
	ctx.fillStyle = led;
	ctx.fill();
}

function drawNest(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	const elite = sk.elite;
	inkEllipse(ctx, x, y + 9, 21, 9, bagColor(sk));
	// A little crate with an FPV sign
	inkRect(ctx, x - 11, y - 2, 22, 14, elite ? BLACK_LIGHT : '#9a7b4f', 2);
	if (elite) {
		ctx.strokeStyle = GOLD;
		ctx.lineWidth = 1.4;
		ctx.strokeRect(x - 9.5, y - 0.5, 19, 11);
	}
	ctx.font = `700 11px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = elite ? GOLD : INK;
	ctx.fillText('FPV', x, y + 5.5);
	// The drone hovers above, rotors a blur: bigger and black when elite, with more of them
	const led = defense.cooldownMs > 0 ? TIE_RED : '#6ef07a';
	const hover = Math.sin(t / 240) * 2;
	if (sk.tier >= 2) {
		drawDrone(ctx, x - 19, y - 8 + Math.sin(t / 210 + 1) * 2, 0.7, t, sk, led);
	}
	if (sk.tier >= 3) {
		drawDrone(ctx, x + 19, y - 10 + Math.sin(t / 260 + 2) * 2, 0.7, t, sk, led);
	}
	drawDrone(ctx, x, y - 13 + hover, elite ? 1.25 : 1, t, sk, elite ? '#ff4040' : led);
}

/** A Patriot launcher: a truck bed with canisters that swing toward the aircraft */
function drawPatriot(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	const elite = sk.elite;
	inkEllipse(ctx, x, y + 10, 23, 9, bagColor(sk));
	// The truck bed and a radar dish on a post
	inkRect(ctx, x - 18, y + 1, 36, 10, elite ? BLACK_LIGHT : SOVIET_GREEN_DARK, 2, 3);
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(x - 17, y + 5, 34, 2);
	}
	for (const dx of [-11, 11]) inkEllipse(ctx, x + dx, y + 12, 3.6, 3.6, '#2f343b', 1.5);
	const dish = Math.sin(t / 500) * 0.4;
	const bigDish = elite ? 1.5 : 1;
	ctx.save();
	ctx.translate(x + 15, y - 1);
	ctx.rotate(dish);
	inkEllipse(ctx, 0, -5 * bigDish, 2.6 * bigDish, 6.5 * bigDish, elite ? GOLD_DARK : '#d9d6c3', 2);
	ctx.restore();
	if (sk.tier >= 3) {
		// A second radar on the rear of the bed
		ctx.save();
		ctx.translate(x - 17, y - 1);
		ctx.rotate(-dish);
		inkEllipse(ctx, 0, -5, 2.4, 6, GOLD_DARK, 2);
		ctx.restore();
	}
	// Four canisters (elite: eight, in black with gold bands), tilted toward the target
	const angle = clamp(defense.aim, -Math.PI + 0.35, -0.35);
	const kick = defense.firedMs > 0 ? -2 : 0;
	const rows = elite ? [-9.8, -7, -4.2, -1.4, 1.4, 4.2, 7, 9.8] : [-6.5, -2.2, 2.2, 6.5];
	const thick = elite ? 2.8 : 3.6;
	ctx.save();
	ctx.translate(x - 2, y - 2);
	ctx.rotate(angle);
	ctx.lineWidth = elite ? 1.2 : 1.5;
	ctx.strokeStyle = INK;
	for (const dy of rows) {
		ctx.fillStyle = elite ? BLACK : '#e8e4d0';
		ctx.fillRect(-4 + kick, dy - thick / 2, 22, thick);
		ctx.strokeRect(-4 + kick, dy - thick / 2, 22, thick);
		ctx.fillStyle = elite ? (sk.tier >= 2 ? '#ff4a3a' : ELITE_RED) : TIE_RED;
		ctx.fillRect(15 + kick, dy - thick / 2, 3, thick);
		if (sk.tier >= 3) {
			ctx.fillStyle = GOLD;
			ctx.fillRect(5 + kick, dy - thick / 2, 1.8, thick);
			ctx.fillRect(10 + kick, dy - thick / 2, 1.8, thick);
		}
	}
	ctx.restore();
	if (defense.firedMs > 90) {
		const flash = defense.firedMs / 160;
		ctx.beginPath();
		ctx.arc(
			x - 2 + Math.cos(angle) * 22,
			y - 2 + Math.sin(angle) * 22,
			(elite ? 12 : 9) * flash,
			0,
			Math.PI * 2
		);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.stroke();
	}
	// The crew, peeking over the bed
	const peek = Math.sin(t / 380) * 0.8;
	crewBlob(ctx, x - 14, y + 2 + peek, 6.5, 6.5, sk, elite, t);
}

function drawTrench(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	if (sk.elite) {
		drawBunker(ctx, x, y, t, sk);
		return;
	}
	// A dug-in strip with sandbags along its lip
	ctx.beginPath();
	ctx.roundRect(x - 20, y - 8, 40, 18, 7);
	ctx.fillStyle = '#6f5b3d';
	ctx.fill();
	ctx.lineWidth = 2.5;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.strokeStyle = 'rgba(17,17,17,0.35)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x - 14, y + 1);
	ctx.lineTo(x - 7, y - 3);
	ctx.lineTo(x, y + 1);
	ctx.lineTo(x + 7, y - 3);
	ctx.lineTo(x + 14, y + 1);
	ctx.stroke();
	for (const dx of [-14, 0, 14]) inkEllipse(ctx, x + dx, y - 9, 8, 4.5, SANDBAG, 1.8);
	// Mines from level 2: little round buttons with spikes
	if (defense.level >= 2) {
		for (const [dx, dy] of defense.level >= 3
			? [
					[-26, 12],
					[0, 18],
					[26, 12]
				]
			: [
					[-26, 12],
					[26, 12]
				]) {
			ctx.save();
			ctx.translate(x + dx, y + dy);
			ctx.strokeStyle = INK;
			ctx.lineWidth = 1.8;
			for (let i = 0; i < 6; i++) {
				const a = (i / 6) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
				ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
				ctx.stroke();
			}
			inkEllipse(ctx, 0, 0, 4.5, 4.5, TIE_RED, 1.8);
			ctx.restore();
		}
	}
}

/** The elite trench: a concrete bunker with a machine-gun slit, razor wire and czech hedgehogs */
function drawBunker(ctx: Ctx, x: number, y: number, t: number, sk: Skin) {
	// The main block and a roof slab with a gold stripe
	inkRect(ctx, x - 22, y - 9, 44, 20, '#8e9097', 2.6, 4);
	ctx.strokeStyle = 'rgba(17,17,17,0.3)';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo(x - 22, y + 5);
	ctx.lineTo(x + 22, y + 5);
	ctx.moveTo(x - 8, y + 5);
	ctx.lineTo(x - 8, y + 11);
	ctx.moveTo(x + 10, y + 5);
	ctx.lineTo(x + 10, y + 11);
	ctx.stroke();
	inkRect(ctx, x - 25, y - 14, 50, 8, '#6a6d75', 2.6, 3);
	ctx.fillStyle = GOLD;
	ctx.fillRect(x - 23, y - 11.4, 46, 1.8);
	// The slit, with a barrel and two red eyes in the dark
	inkRect(ctx, x - 15, y - 3, 30, 7, BLACK_DEEP, 1.8, 2.5);
	stroke(ctx, x - 1, y + 0.5, x + 15, y + 0.5, 2.6, '#4b4f58');
	for (const dx of [-8, 5]) {
		ctx.beginPath();
		ctx.arc(x + dx, y + 0.5, 1.7, 0, Math.PI * 2);
		ctx.fillStyle = '#ff4a4a';
		ctx.fill();
	}
	// Razor wire along the front: more loops at every tier
	const loops = 7 + sk.tier * 2;
	const step = 56 / loops;
	for (const [width, color] of [
		[3.4, INK],
		[1.5, '#cfd3da']
	] as const) {
		ctx.beginPath();
		for (let i = 0; i < loops; i++) {
			const cx = x - 28 + (i + 0.5) * step;
			ctx.moveTo(cx + 4.6, y + 13);
			ctx.ellipse(cx, y + 13, 4.6, 3.4, 0, 0, Math.PI * 2);
		}
		ctx.lineWidth = width;
		ctx.strokeStyle = color;
		ctx.stroke();
	}
	// Czech hedgehogs at the corners from tier 2
	if (sk.tier >= 2) {
		for (const s of [-1, 1]) {
			const hx = x + s * 29;
			const hy = y + 4;
			for (const [width, color] of [
				[4.4, INK],
				[2.2, '#7f838c']
			] as const) {
				ctx.beginPath();
				ctx.moveTo(hx - 5, hy - 5);
				ctx.lineTo(hx + 5, hy + 5);
				ctx.moveTo(hx + 5, hy - 5);
				ctx.lineTo(hx - 5, hy + 5);
				ctx.moveTo(hx, hy - 6);
				ctx.lineTo(hx, hy + 6);
				ctx.lineWidth = width;
				ctx.strokeStyle = color;
				ctx.stroke();
			}
		}
	}
	// A gold star plaque and a blinking red lamp on the top tier
	if (sk.tier >= 3) {
		starPath(ctx, x, y - 10.4, 4.2, 1.9);
		ctx.fillStyle = GOLD;
		ctx.fill();
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(x + 19, y - 16, 2.4, 0, Math.PI * 2);
		ctx.fillStyle = Math.sin(t / 220) > 0 ? '#ff4a4a' : '#7a2020';
		ctx.fill();
		ctx.stroke();
	}
}

function drawFlag(ctx: Ctx, x: number, y: number, t: number, black: boolean, scale: number) {
	const wave = Math.sin(t / 220) * 1.2;
	const w = 12 * scale;
	const h = 4 * scale;
	ctx.beginPath();
	ctx.moveTo(x, y + 30);
	ctx.lineTo(x, y);
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (black) {
		ctx.fillStyle = BLACK;
		ctx.fillRect(x, y, w, h * 2 + wave * 0.6);
		ctx.fillStyle = GOLD;
		ctx.fillRect(x, y + h * 0.9 + wave * 0.3, w, h * 0.5);
		ctx.lineWidth = 1.5;
		ctx.strokeRect(x, y, w, h * 2 + wave * 0.6);
		return;
	}
	ctx.fillStyle = FLAG_BLUE;
	ctx.fillRect(x, y, w, h + wave * 0.3);
	ctx.fillStyle = YELLOW;
	ctx.fillRect(x, y + h + wave * 0.3, w, h + wave * 0.3);
	ctx.lineWidth = 1.5;
	ctx.strokeRect(x, y, w, h * 2 + wave * 0.6);
}

/** A little spotlight on a roof, its beam sweeping slowly over the ground */
function drawSpotlight(ctx: Ctx, x: number, y: number, t: number, index: number) {
	const sweep = Math.sin(t / 900 + index * 2.1) * 0.55;
	const a = Math.PI / 2 + sweep;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + Math.cos(a - 0.2) * 34, y + Math.sin(a - 0.2) * 34);
	ctx.lineTo(x + Math.cos(a + 0.2) * 34, y + Math.sin(a + 0.2) * 34);
	ctx.closePath();
	ctx.fillStyle = 'rgba(255,246,190,0.22)';
	ctx.fill();
	inkRect(ctx, x - 3, y - 2.5, 6, 5, '#d9d6c3', 1.4, 1.5);
	ctx.beginPath();
	ctx.arc(x, y + 2.6, 1.8, 0, Math.PI * 2);
	ctx.fillStyle = PAPER;
	ctx.fill();
}

/** A sandbag post with a tent (Azov) or a vehicle shed (Leopard) and a flag; elite ones are fortified */
function drawGarrisonPost(ctx: Ctx, x: number, y: number, kind: GarrisonKind, t: number, sk: Skin) {
	inkEllipse(ctx, x, y + 10, 24, 10, bagColor(sk));
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	if (kind === 'azov' && sk.elite) {
		drawAzovFort(ctx, x, y, t, sk);
	} else if (kind === 'azov') {
		// A tent
		ctx.beginPath();
		ctx.moveTo(x - 17, y + 8);
		ctx.lineTo(x - 2, y - 14);
		ctx.lineTo(x + 13, y + 8);
		ctx.closePath();
		ctx.fillStyle = '#5d6b45';
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - 2, y - 14);
		ctx.lineTo(x - 2, y + 8);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - 6, y + 8);
		ctx.lineTo(x - 2, y - 1);
		ctx.lineTo(x + 2, y + 8);
		ctx.fillStyle = '#2b3022';
		ctx.fill();
	} else if (sk.elite) {
		drawLeopardShed(ctx, x, y, t, sk);
	} else {
		// A shed with an arched door for the tank
		ctx.beginPath();
		ctx.roundRect(x - 19, y - 9, 34, 19, 3);
		ctx.fillStyle = '#6b705f';
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - 12, y + 10);
		ctx.lineTo(x - 12, y);
		ctx.quadraticCurveTo(x - 2, y - 9, x + 8, y);
		ctx.lineTo(x + 8, y + 10);
		ctx.closePath();
		ctx.fillStyle = '#2b3022';
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#59604d';
		ctx.fillRect(x - 19, y - 12, 34, 4);
		ctx.strokeRect(x - 19, y - 12, 34, 4);
	}
	// The flag on its pole, waving a little (black with gold for the elite Azov)
	if (sk.elite) {
		drawFlag(ctx, x + 19, y - 24 - sk.tier, t, kind === 'azov', 1 + sk.tier * 0.12);
	} else {
		drawFlag(ctx, x + 17, y - 22, t, false, 1);
	}
}

/** The fortified Azov post: a black concrete bunker with a slit, spotlights and a black flag */
function drawAzovFort(ctx: Ctx, x: number, y: number, t: number, sk: Skin) {
	// A double wall of sandbags in front from tier 2
	inkRect(ctx, x - 19, y - 8, 38, 19, '#2a2d33', 2.6, 3);
	inkPoly(ctx, [x - 22, y - 8, x - 15, y - 16, x + 15, y - 16, x + 22, y - 8], BLACK_LIGHT, 2.6);
	ctx.fillStyle = GOLD;
	ctx.fillRect(x - 17, y - 9.8, 34, 1.8);
	// The slit glows red from inside
	inkRect(ctx, x - 12, y - 3, 24, 6, ELITE_RED, 1.8, 2.5);
	ctx.fillStyle = BLACK_DEEP;
	for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 8 - 1, y - 3, 2, 6);
	// A gold plaque on the roof
	starPath(ctx, x, y - 12.5, 3.6, 1.6);
	ctx.fillStyle = GOLD;
	ctx.fill();
	ctx.lineWidth = 1.2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// Spotlights on the roof: one, two or three
	const lamps = sk.tier === 1 ? [-13] : sk.tier === 2 ? [-14, 14] : [-15, 0, 15];
	lamps.forEach((dx, i) => drawSpotlight(ctx, x + dx, y - 16, t, i));
	if (sk.tier >= 2) {
		for (const dx of [-13, 0, 13]) inkEllipse(ctx, x + dx, y + 9, 6.5, 3.6, '#8a7f5c', 1.6);
	}
}

/** The hardened Leopard shed: black armoured walls, hazard stripes and a glowing armoured door */
function drawLeopardShed(ctx: Ctx, x: number, y: number, t: number, sk: Skin) {
	inkRect(ctx, x - 20, y - 9, 36, 19, '#34373d', 2.6, 3);
	inkRect(ctx, x - 22, y - 14, 40, 6, '#4a4d55', 2.4, 2);
	ctx.fillStyle = GOLD;
	ctx.fillRect(x - 20, y - 12, 36, 1.6);
	// The armoured door
	ctx.beginPath();
	ctx.moveTo(x - 12, y + 10);
	ctx.lineTo(x - 12, y);
	ctx.quadraticCurveTo(x - 2, y - 9, x + 8, y);
	ctx.lineTo(x + 8, y + 10);
	ctx.closePath();
	ctx.fillStyle = sk.tier >= 2 ? '#5a1a1c' : BLACK_DEEP;
	ctx.fill();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.beginPath();
	for (const dx of [-8, -4, 0, 4]) {
		ctx.moveTo(x + dx, y + 10);
		ctx.lineTo(x + dx, y + 1);
	}
	ctx.lineWidth = 1.2;
	ctx.strokeStyle = '#6b6e77';
	ctx.stroke();
	// Hazard stripes across the bottom
	ctx.save();
	ctx.beginPath();
	ctx.rect(x - 20, y + 6, 36, 4);
	ctx.clip();
	for (let i = -1; i < 10; i++) {
		ctx.beginPath();
		ctx.moveTo(x - 20 + i * 6, y + 10);
		ctx.lineTo(x - 17 + i * 6, y + 10);
		ctx.lineTo(x - 14 + i * 6, y + 6);
		ctx.lineTo(x - 17 + i * 6, y + 6);
		ctx.closePath();
		ctx.fillStyle = GOLD;
		ctx.fill();
	}
	ctx.restore();
	// Reactive plates on the sides from tier 2, a radar mast and a blinking lamp on the top tier
	if (sk.tier >= 2) {
		for (const dx of [-24, 18]) inkRect(ctx, x + dx, y - 6, 5, 12, GOLD_DARK, 1.8, 1.5);
	}
	if (sk.tier >= 3) {
		stroke(ctx, x - 10, y - 14, x - 10, y - 24, 2, INK);
		inkEllipse(ctx, x - 10, y - 25, 4.5, 1.8, GOLD, 1.5);
		ctx.beginPath();
		ctx.arc(x + 9, y - 16, 2.2, 0, Math.PI * 2);
		ctx.fillStyle = Math.sin(t / 200) > 0 ? '#ff4a4a' : '#7a2020';
		ctx.fill();
	}
}

/** One HIMARS pod: a box of rocket tubes, loaded ones light, fired ones dark */
function drawPod(
	ctx: Ctx,
	offset: number,
	thick: number,
	cols: number,
	loaded: number,
	kick: number,
	sk: Skin
) {
	inkRect(
		ctx,
		-6 + kick,
		offset - thick / 2,
		24 + cols * 1.5,
		thick,
		sk.elite ? BLACK : '#566033',
		2,
		2
	);
	const cell = (24 + cols * 1.5 - 4) / cols;
	const rh = (thick - 3) / 2;
	for (let c = 0; c < cols; c++) {
		for (let r = 0; r < 2; r++) {
			const index = c * 2 + r;
			const px = -4 + kick + c * cell;
			const py = offset - thick / 2 + 1.5 + r * rh;
			ctx.beginPath();
			ctx.roundRect(px, py, cell - 1, rh - 0.4, rh / 2);
			ctx.fillStyle = index < loaded ? '#e8e4d0' : 'rgba(10,10,10,0.55)';
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = INK;
			ctx.stroke();
			if (index < loaded) {
				ctx.fillStyle = sk.elite ? '#ff4a3a' : TIE_RED;
				ctx.fillRect(px + cell - 3.8, py + 0.5, 2.6, rh - 1.4);
			}
		}
	}
	if (sk.elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(-6 + kick, offset - thick / 2, 24 + cols * 1.5, 1.2);
		ctx.fillRect(-6 + kick, offset + thick / 2 - 1.2, 24 + cols * 1.5, 1.2);
	}
}

/** A HIMARS: a rocket launcher truck with a tilting pod of rockets that empties as it fires */
function drawHimars(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	const elite = sk.elite;
	inkEllipse(ctx, x, y + 10, 24, 9, bagColor(sk));
	// The truck: chassis, a cab on the right and three wheels
	inkRect(ctx, x - 20, y + 2, 40, 9, elite ? BLACK_LIGHT : '#5f6a3e', 2.2, 3);
	inkRect(ctx, x + 8, y - 5, 13, 15, elite ? BLACK : '#6c7a47', 2.2, 3);
	inkRect(ctx, x + 12.5, y - 3, 7, 5.5, '#9fc4d6', 1.5, 1.5);
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(x - 19, y + 6, 27, 1.8);
	}
	for (const dx of [-13, 0, 14]) {
		inkEllipse(ctx, x + dx, y + 12, 4.2, 4.2, INK, 1.4);
		ctx.beginPath();
		ctx.arc(x + dx, y + 12, 1.5, 0, Math.PI * 2);
		ctx.fillStyle = '#9aa0a8';
		ctx.fill();
	}
	// The pod(s), tilted toward the target (never pointing at the ground)
	const angle = clamp(defense.aim, -Math.PI + 0.3, -0.3);
	const kick = defense.firedMs > 0 ? -2.5 : 0;
	const stats = defenseStats(defense.kind, defense.level);
	const ready = stats.intervalMs > 0 ? 1 - clamp(defense.cooldownMs / stats.intervalMs, 0, 1) : 1;
	const pods = sk.tier === 3 ? [-8.6, 0, 8.6] : sk.tier === 2 ? [-5.5, 5.5] : [0];
	const thick = sk.tier === 3 ? 8.4 : sk.tier === 2 ? 10.4 : elite ? 14 : 13;
	const cols = elite ? 4 : 3;
	const loaded = Math.ceil(cols * 2 * ready - 0.001);
	ctx.save();
	ctx.translate(x - 4, y - 2);
	ctx.rotate(angle);
	for (const offset of pods) drawPod(ctx, offset, thick, cols, loaded, kick, sk);
	ctx.restore();
	if (defense.firedMs > 60) {
		const flash = defense.firedMs / 160;
		const reach = 28 + cols * 1.5;
		ctx.beginPath();
		ctx.arc(
			x - 4 + Math.cos(angle) * reach,
			y - 2 + Math.sin(angle) * reach,
			(elite ? 13 : 10) * flash,
			0,
			Math.PI * 2
		);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		// A puff of smoke behind the pod
		inkEllipse(
			ctx,
			x - 4 - Math.cos(angle) * 6,
			y - 2 - Math.sin(angle) * 6 + 3,
			5 * flash,
			4 * flash,
			'rgba(255,255,255,0.8)',
			1.2
		);
	}
	// The crew peeks out of the cab
	const peek = Math.sin(t / 400) * 0.7;
	crewBlob(ctx, x - 15, y + 3 + peek, 5.5, 5.5, sk, elite, t);
}

/** A sniper lying behind sandbags with a long rifle, a glinting scope and (elite) a laser */
function drawSniper(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	const elite = sk.elite;
	const cosA = Math.cos(defense.aim);
	const recoil = defense.firedMs > 0 ? -2.5 : 0;
	// The prone body with leafy camouflage, and the head looking down the scope
	inkEllipse(ctx, x - 3, y + 2, 12, 7, elite ? BLACK : '#5f7a3a', 2.2);
	if (!elite) {
		for (const [dx, dy, c] of [
			[-9, -2, '#7a9a4a'],
			[-4, -4, '#4f6a30'],
			[2, -3, '#7a9a4a']
		] as const) {
			inkEllipse(ctx, x + dx, y + dy + 2, 3.2, 2.2, c, 1.2);
		}
	} else {
		stroke(ctx, x - 12, y + 1, x + 4, y + 1, 2, GOLD);
	}
	const hx = x + cosA * 5;
	const hy = y - 3.5;
	inkEllipse(ctx, hx, hy, 6.4, 6.2, elite ? BLACK_LIGHT : FLAG_BLUE, 2);
	ctx.beginPath();
	ctx.ellipse(hx, hy - 2.6, 6.6, 4.8, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = elite ? BLACK_DEEP : OLIVE;
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(hx - 6, hy - 3.6, 12, 1.4);
		ctx.beginPath();
		ctx.arc(hx + cosA * 2.4, hy, 1.7, 0, Math.PI * 2);
		ctx.fillStyle = '#ff5050';
		ctx.fill();
	} else {
		for (const dx of [-2.2, 2.2]) {
			ctx.beginPath();
			ctx.arc(hx + dx + cosA * 0.8, hy + 0.2, 1.4, 0, Math.PI * 2);
			ctx.fillStyle = PAPER;
			ctx.fill();
			ctx.beginPath();
			ctx.arc(hx + dx + cosA * 1.4, hy + 0.5, 0.7, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
		}
	}
	// The long rifle along the aim, with the scope on the upper side
	const len = elite ? 40 : 33;
	const up = cosA >= 0 ? -1 : 1;
	ctx.save();
	ctx.translate(x, y + 0.5);
	ctx.rotate(defense.aim);
	inkRect(ctx, -7 + recoil, -1.8, 9, 4.4, elite ? BLACK : '#7a5a3a', 1.5);
	inkRect(ctx, 2 + recoil, -1.4, len, 2.8, elite ? BLACK_DEEP : '#3b4048', 1.5);
	inkRect(ctx, 11 + recoil, up * 4.6 - 1.6, 8, 3.2, elite ? GOLD_DARK : '#2f343b', 1.4, 1);
	ctx.beginPath();
	ctx.arc(19.4 + recoil, up * 4.6, 1.6, 0, Math.PI * 2);
	ctx.fillStyle = '#9fe0ff';
	ctx.fill();
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(2 + len - 4 + recoil, -1.4, 3, 2.8);
	}
	// Bipod legs
	ctx.beginPath();
	ctx.moveTo(18, 1);
	ctx.lineTo(16, 5.5);
	ctx.moveTo(18, 1);
	ctx.lineTo(21, 5.5);
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// The laser sight of the elite tiers
	if (sk.tier >= 2) {
		ctx.strokeStyle = `rgba(255,50,50,${0.35 + 0.25 * Math.sin(t / 130)})`;
		ctx.lineWidth = 1.2;
		ctx.setLineDash([3, 3]);
		ctx.beginPath();
		ctx.moveTo(len + 2, 0);
		ctx.lineTo(len + 40 + sk.tier * 10, 0);
		ctx.stroke();
		ctx.setLineDash([]);
	}
	// The glint on the scope, flashing now and then
	const g = Math.max(0, Math.sin(t / 640 + 1));
	const glint = g * g * g * g * g * g;
	if (glint > 0.05) {
		const s = 5.5 * glint;
		ctx.strokeStyle = PAPER;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(19.4 + recoil - s, up * 4.6);
		ctx.lineTo(19.4 + recoil + s, up * 4.6);
		ctx.moveTo(19.4 + recoil, up * 4.6 - s);
		ctx.lineTo(19.4 + recoil, up * 4.6 + s);
		ctx.stroke();
	}
	// The muzzle flash
	if (defense.firedMs > 90) {
		const f = defense.firedMs / 160;
		ctx.beginPath();
		ctx.moveTo(len + 2, 0);
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * Math.PI * 2;
			const r = i % 2 === 0 ? 8 * f : 3.4 * f;
			ctx.lineTo(len + 5 + Math.cos(a) * r, Math.sin(a) * r);
		}
		ctx.closePath();
		ctx.fillStyle = elite ? '#ffd66a' : YELLOW;
		ctx.fill();
		ctx.lineWidth = 1.2;
		ctx.stroke();
	}
	ctx.restore();
	// A spotter with binoculars beside the sniper on the top tier
	if (sk.tier >= 3) {
		crewBlob(ctx, x + 15, y + 0.5, 5.5, 5.5, sk, true, t);
		for (const dx of [-1.8, 1.8]) inkEllipse(ctx, x + 15 + dx, y - 1.5, 1.6, 1.6, '#4a4f57', 1);
	}
	// The sandbag wall in front
	for (const dx of [-14, 0, 14]) inkEllipse(ctx, x + dx, y + 8, 9, 5, bagColor(sk), 1.8);
}

/** An electronic warfare station: a mast with a spinning radar, a dish, and rings of jamming */
function drawJammer(ctx: Ctx, x: number, y: number, t: number, sk: Skin) {
	const elite = sk.elite;
	inkEllipse(ctx, x, y + 10, 23, 9, bagColor(sk));
	// The jamming rings pulse out from the mast head (a little farther out and more of them when elite)
	const rings = 3 + sk.tier;
	const cy = y - 12;
	for (let i = 0; i < rings; i++) {
		const p = (t / 1400 + i / rings) % 1;
		const rx = 7 + p * (elite ? 30 + sk.tier * 2 : 27);
		const ry = rx * 0.62;
		const alpha = (1 - p) * 0.85;
		ctx.beginPath();
		ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
		ctx.lineWidth = 4.4;
		ctx.strokeStyle = `rgba(17,17,17,${alpha * 0.35})`;
		ctx.stroke();
		ctx.lineWidth = 2.2;
		ctx.strokeStyle =
			elite && i % 3 === 2
				? `rgba(255,214,90,${alpha})`
				: i % 2 === 0
					? `rgba(70,217,232,${alpha})`
					: `rgba(110,240,122,${alpha})`;
		ctx.stroke();
	}
	// The container
	inkRect(ctx, x - 15, y, 30, 11, elite ? BLACK_LIGHT : '#6f7d6a', 2.2, 3);
	ctx.strokeStyle = 'rgba(17,17,17,0.4)';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	for (const dx of [-5, 0, 5]) {
		ctx.moveTo(x + dx + 5, y + 3);
		ctx.lineTo(x + dx + 5, y + 8);
	}
	ctx.stroke();
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(x - 14, y + 1.2, 28, 1.6);
	}
	ctx.beginPath();
	ctx.arc(x - 10, y + 5.8, 1.5, 0, Math.PI * 2);
	ctx.fillStyle = Math.sin(t / 160) > 0 ? '#6ef07a' : '#2f6a38';
	ctx.fill();
	// Whip antennas on the roof
	stroke(ctx, x - 12, y, x - 15, y - 11, 1.6, INK);
	stroke(ctx, x + 12, y, x + 15, y - 8, 1.6, INK);
	inkEllipse(ctx, x - 15, y - 11.5, 1.5, 1.5, TIE_RED, 1);
	inkEllipse(ctx, x + 15, y - 8.5, 1.5, 1.5, TIE_RED, 1);
	// The mast and the spinning radar bar
	stroke(ctx, x, y + 1, x, y - 17, 4.4, INK);
	stroke(ctx, x, y + 1, x, y - 17, 2.2, '#9aa0a8');
	const hw = Math.abs(Math.cos(t / 450)) * 11 + 1.8;
	inkRect(ctx, x - hw, y - 21, hw * 2, 4.2, elite ? GOLD : '#d9d6c3', 1.8, 2);
	// An elite dish (two from the top tier), turning slowly
	if (elite) {
		const dishes = sk.tier >= 3 ? [-1, 1] : [1];
		for (const s of dishes) {
			const sx = x + s * 10;
			const w = 3 + Math.abs(Math.cos(t / 700 + s)) * 7;
			stroke(ctx, sx, y, sx, y - 5, 2, INK);
			ctx.beginPath();
			ctx.ellipse(sx, y - 7, w, 5, -0.3 * s, 0, Math.PI * 2);
			ctx.fillStyle = GOLD_DARK;
			ctx.fill();
			ctx.lineWidth = 1.8;
			ctx.strokeStyle = INK;
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(sx, y - 7, 1.4, 0, Math.PI * 2);
			ctx.fillStyle = '#ff4a4a';
			ctx.fill();
		}
	}
}

/** A Gepard flak tank: tracked chassis, a turret that swings to the aim with twin (or more) autocannons */
function drawGepard(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	const elite = sk.elite;
	inkEllipse(ctx, x, y + 11, 24, 8, bagColor(sk));
	// Tracks with road wheels, then the hull
	inkRect(ctx, x - 19, y + 3, 38, 9, '#2f343b', 2.2, 4);
	for (let i = -2; i <= 2; i++) {
		ctx.beginPath();
		ctx.arc(x + i * 7, y + 7.5, 2.4, 0, Math.PI * 2);
		ctx.fillStyle = '#6b727c';
		ctx.fill();
	}
	inkRect(ctx, x - 17, y - 3, 34, 9, elite ? BLACK_LIGHT : '#6c7358', 2.4, 3);
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(x - 16, y + 1, 32, 1.8);
	}
	if (sk.tier >= 2) {
		// Armoured side skirts
		inkRect(ctx, x - 19, y + 3, 38, 4.5, BLACK, 1.8, 2);
		ctx.fillStyle = GOLD;
		ctx.fillRect(x - 18, y + 3.4, 36, 1);
	}
	// A radar dish on a mast behind the turret, turning
	const dishW = 2.5 + Math.abs(Math.cos(t / 360)) * 6.5 * (elite ? 1.2 : 1);
	stroke(ctx, x - 9, y - 7, x - 9, y - 13, 2, INK);
	inkEllipse(
		ctx,
		x - 9,
		y - 14,
		dishW,
		3.6 * (elite ? 1.3 : 1),
		elite ? GOLD_DARK : '#d9d6c3',
		1.8
	);
	if (sk.tier >= 2) {
		stroke(ctx, x + 12, y - 5, x + 12, y - 10, 2, INK);
		inkEllipse(ctx, x + 12, y - 11, 5.5 - dishW * 0.3, 3, GOLD_DARK, 1.6);
	}
	// The turret and its barrels, turned to the aim
	const tx = x - 1;
	const ty = y - 7;
	ctx.save();
	ctx.translate(tx, ty);
	ctx.rotate(defense.aim);
	const barrels = sk.tier >= 3 ? [-7.2, -2.4, 2.4, 7.2] : [-3.4, 3.4];
	const bw = elite ? (sk.tier >= 3 ? 2.8 : 3.4) : 2.6;
	const firing = defense.firedMs > 0;
	const lit = Math.floor(t / 55);
	barrels.forEach((k, i) => {
		const kick = firing && (lit + i) % 2 === 0 ? -1.6 : 0;
		inkRect(ctx, 4 + kick, k - bw / 2, 25, bw, elite ? BLACK : '#3b4048', 1.5);
		inkRect(ctx, 27 + kick, k - bw / 2 - 0.8, 3.4, bw + 1.6, elite ? GOLD : '#555c66', 1.4);
		if (firing && (lit + i) % 2 === 0) {
			ctx.beginPath();
			ctx.arc(32 + kick, k, elite ? 6 : 4.6, 0, Math.PI * 2);
			ctx.fillStyle = elite ? '#ffd66a' : YELLOW;
			ctx.fill();
			ctx.beginPath();
			ctx.arc(32 + kick, k, elite ? 3 : 2.2, 0, Math.PI * 2);
			ctx.fillStyle = PAPER;
			ctx.fill();
		}
	});
	ctx.restore();
	inkEllipse(ctx, tx, ty, 10, 6.5, elite ? BLACK : '#7a8360', 2.2);
	if (elite) {
		ctx.beginPath();
		ctx.ellipse(tx, ty, 8, 4.6, 0, 0, Math.PI * 2);
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = GOLD;
		ctx.stroke();
	}
	// The commander's hatch with a blob peeking out
	const peek = Math.sin(t / 360) * 0.6;
	crewBlob(ctx, tx - 2, ty - 3 + peek, 4.2, 4.2, sk, elite, t);
}

/** A Pion: a huge self-propelled gun with a very long barrel, a big recoil and a big blast */
function drawPion(ctx: Ctx, x: number, y: number, defense: Defense, t: number, sk: Skin) {
	const elite = sk.elite;
	inkEllipse(ctx, x, y + 11, 27, 8, bagColor(sk));
	// Tracks, hull and the cab at the back
	inkRect(ctx, x - 22, y + 2, 44, 10, '#2f343b', 2.2, 4);
	for (let i = -3; i <= 3; i++) {
		ctx.beginPath();
		ctx.arc(x + i * 6.4, y + 7, 2.3, 0, Math.PI * 2);
		ctx.fillStyle = '#6b727c';
		ctx.fill();
	}
	inkRect(ctx, x - 25, y + 1, 5, 11, elite ? GOLD_DARK : '#59604d', 2, 1.5);
	inkRect(ctx, x - 20, y - 5, 40, 10, elite ? BLACK_LIGHT : '#6c7358', 2.4, 3);
	inkRect(ctx, x - 20, y - 12, 15, 8, elite ? BLACK : '#59604d', 2.2, 2);
	inkRect(ctx, x - 17, y - 10.4, 8, 4, '#9fc4d6', 1.4, 1);
	if (elite) {
		ctx.fillStyle = GOLD;
		ctx.fillRect(x - 19, y - 1.4, 38, 2);
	}
	// A crew blob in the cab window
	const peek = Math.sin(t / 400) * 0.6;
	crewBlob(ctx, x - 11, y - 8 + peek, 3.6, 3.6, sk, elite, t);

	// The gun: it slides back on its cradle when it fires, a blast flares at the muzzle
	const f = defense.firedMs > 0 ? defense.firedMs / 160 : 0;
	const recoil = -9 * f;
	const px = x - 2;
	const py = y - 6;
	ctx.save();
	ctx.translate(px, py);
	ctx.rotate(defense.aim);
	// The cradle and (top tier) an armoured shield
	if (sk.tier >= 3) {
		inkPoly(ctx, [-6, -8, 8, -6.5, 8, 6.5, -6, 8], BLACK, 2);
	}
	inkRect(ctx, -5, -4.8, 16, 9.6, elite ? BLACK_LIGHT : '#4a4f57', 2.2, 2);
	const barrels = sk.tier >= 2 ? [-3.4, 3.4] : [0];
	const bw = sk.tier >= 2 ? 3.6 : elite ? 5.2 : 4.4;
	for (const k of barrels) {
		inkRect(ctx, 8 + recoil, k - bw / 2, 46, bw, elite ? BLACK : '#3b4048', 2);
		// Bore reinforcement and the muzzle brake with its slits
		inkRect(ctx, 24 + recoil, k - bw / 2 - 1, 3.4, bw + 2, elite ? GOLD_DARK : '#555c66', 1.6);
		inkRect(ctx, 51 + recoil, k - bw / 2 - 1.6, 8, bw + 3.2, elite ? GOLD : '#555c66', 2);
		stroke(ctx, 54 + recoil, k - bw / 2 - 1.2, 54 + recoil, k + bw / 2 + 1.2, 1.2, INK);
		stroke(ctx, 57 + recoil, k - bw / 2 - 1.2, 57 + recoil, k + bw / 2 + 1.2, 1.2, INK);
		if (elite) {
			ctx.fillStyle = sk.tier === 3 ? '#ff4a3a' : ELITE_RED;
			ctx.fillRect(14 + recoil, k - bw / 2, 2, bw);
		}
	}
	if (f > 0) {
		// The muzzle blast: a flare, a white core and a couple of smoke puffs
		const big = elite ? 1.3 : 1;
		const bx = 62 + recoil * 0.2;
		inkEllipse(ctx, bx + 5 * f, 0, 15 * f * big, 12 * f * big, elite ? '#ffd66a' : YELLOW, 2.4);
		inkEllipse(ctx, bx + 3 * f, 0, 8 * f * big, 6.5 * f * big, PAPER, 1.6);
		inkEllipse(ctx, bx + 22 * (1 - f) + 6, -6, 6 * big, 5 * big, 'rgba(255,255,255,0.85)', 1.6);
		inkEllipse(ctx, bx + 18 * (1 - f) + 6, 7, 5 * big, 4 * big, 'rgba(255,255,255,0.85)', 1.6);
	}
	ctx.restore();
}

export function drawDefense(
	ctx: Ctx,
	slots: readonly Point[],
	slot: number,
	defense: Defense,
	timeMs: number
) {
	const { x, y } = slots[slot];
	const sk = skin(defense.level);
	if (sk.elite) drawElitePlate(ctx, x, y, sk, timeMs);
	ctx.save();
	if (sk.elite) {
		// The whole post is a little bigger at every tier, growing from its ground plate
		ctx.translate(x, y + 10);
		ctx.scale(sk.scale, sk.scale);
		ctx.translate(-x, -(y + 10));
	}
	switch (defense.kind) {
		case 'squad':
			drawSquad(ctx, x, y, defense, timeMs, sk);
			break;
		case 'mortar':
			drawMortar(ctx, x, y, defense, timeMs, sk);
			break;
		case 'nest':
			drawNest(ctx, x, y, defense, timeMs, sk);
			break;
		case 'patriot':
			drawPatriot(ctx, x, y, defense, timeMs, sk);
			break;
		case 'azov':
		case 'leopard':
			drawGarrisonPost(ctx, x, y, defense.kind, timeMs, sk);
			break;
		case 'trench':
			drawTrench(ctx, x, y, defense, timeMs, sk);
			break;
		case 'himars':
			drawHimars(ctx, x, y, defense, timeMs, sk);
			break;
		case 'sniper':
			drawSniper(ctx, x, y, defense, timeMs, sk);
			break;
		case 'jammer':
			drawJammer(ctx, x, y, timeMs, sk);
			break;
		case 'gepard':
			drawGepard(ctx, x, y, defense, timeMs, sk);
			break;
		case 'pion':
			drawPion(ctx, x, y, defense, timeMs, sk);
			break;
	}
	ctx.restore();
	if (sk.elite) drawEliteSparks(ctx, x, y, sk, timeMs);
	drawPips(ctx, x, y + 25, defense.level);
}

/** A friendly unit of a garrison post: an Azov fighter with a club, or a Leopard 2 tank */
export function drawUnit(ctx: Ctx, unit: Unit, timeMs: number, level: number) {
	const sk = skin(level);
	const elite = sk.elite;
	const flash = unit.hitMs > 0;
	const tank = unit.kind === 'leopard';
	const size = tank ? 20 : 10;
	const grow = 1 + sk.tier * (tank ? 0.07 : 0.1);
	ctx.save();
	ctx.translate(unit.x, unit.y);
	ctx.save();
	ctx.scale(grow, grow);
	// Its shadow (elite units carry a faint glow on the ground)
	if (elite) {
		ctx.beginPath();
		ctx.ellipse(0, size * 0.95, size * (tank ? 1.7 : 1.5), size * 0.45, 0, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(${GLOW_RGB[sk.tier - 1]},0.28)`;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.ellipse(0, size * 0.95, size * (tank ? 1.5 : 1), size * 0.32, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.25)';
	ctx.fill();

	if (tank) drawLeopardUnit(ctx, unit, timeMs, flash, sk);
	else drawAzovUnit(ctx, unit, timeMs, flash, sk);
	ctx.restore();

	if (unit.hp < unit.maxHp) {
		const w = size * 2 * grow;
		const top = -size * grow * (tank ? 1.1 : 1.6);
		ctx.fillStyle = PAPER;
		ctx.fillRect(-w / 2, top, w, 4);
		ctx.fillStyle = unit.hp / unit.maxHp > 0.4 ? '#6ac05c' : TIE_RED;
		ctx.fillRect(-w / 2, top, w * Math.max(0, unit.hp / unit.maxHp), 4);
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = INK;
		ctx.strokeRect(-w / 2, top, w, 4);
	}
	ctx.restore();
}

function drawLeopardUnit(ctx: Ctx, unit: Unit, timeMs: number, flash: boolean, sk: Skin) {
	const elite = sk.elite;
	ctx.rotate(unit.facing);
	const recoil = unit.swingMs > 0 ? -4 * Math.sin((unit.swingMs / 220) * Math.PI) : 0;
	// Exhaust smoke puffing out of the rear (elite: more of it)
	if (elite) {
		for (let k = 0; k < 2 + sk.tier; k++) {
			const p = (timeMs / 520 + k / (2 + sk.tier)) % 1;
			ctx.beginPath();
			ctx.arc(
				-22 - p * 15,
				(k % 2 === 0 ? -3 : 3) + Math.sin(p * 6 + k) * 1.5,
				2 + p * 4,
				0,
				Math.PI * 2
			);
			ctx.fillStyle = `rgba(90,90,96,${0.5 * (1 - p)})`;
			ctx.fill();
		}
	}
	// Tracks with wheels, then the hull
	for (const dy of [-14, 7]) {
		ctx.beginPath();
		ctx.roundRect(-20, dy, 40, 7, 3.5);
		ctx.fillStyle = elite ? BLACK_DEEP : '#2f343b';
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		for (let i = -3; i <= 3; i++) {
			ctx.beginPath();
			ctx.arc(i * 5.5, dy + 3.5, 2, 0, Math.PI * 2);
			ctx.fillStyle = '#6b727c';
			ctx.fill();
		}
	}
	ctx.beginPath();
	ctx.roundRect(-18, -9, 36, 18, 5);
	ctx.fillStyle = flash ? PAPER : elite ? '#2a2e34' : '#5f6a4a';
	ctx.fill();
	ctx.lineWidth = 2.4;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (elite) {
		// Side skirts over the tracks, with a gold edge
		for (const dy of [-16, 10.5]) {
			inkRect(ctx, -19, dy, 38, 5.5, flash ? PAPER : BLACK_LIGHT, 1.8, 2);
			ctx.fillStyle = GOLD;
			ctx.fillRect(-18, dy + (dy < 0 ? 0.8 : 3.6), 36, 1.1);
		}
		ctx.fillStyle = GOLD;
		ctx.fillRect(-17, -1, 34, 1.8);
	}
	// The gun first, so the turret sits on top of it
	const barrel = elite ? 31 : 26;
	const thick = elite ? 5.4 : 4.4;
	ctx.fillStyle = flash ? PAPER : elite ? BLACK : '#3b4048';
	ctx.fillRect(4 + recoil, -thick / 2, barrel, thick);
	ctx.strokeRect(4 + recoil, -thick / 2, barrel, thick);
	if (elite) {
		// The fume extractor and a gold muzzle brake, twin barrels at the top tier
		ctx.fillRect(16 + recoil, -thick / 2 - 1.2, 4, thick + 2.4);
		ctx.strokeRect(16 + recoil, -thick / 2 - 1.2, 4, thick + 2.4);
		ctx.fillStyle = flash ? PAPER : GOLD;
		ctx.fillRect(4 + barrel - 1 + recoil, -thick / 2 - 1.4, 5.6, thick + 2.8);
		ctx.strokeRect(4 + barrel - 1 + recoil, -thick / 2 - 1.4, 5.6, thick + 2.8);
	} else {
		ctx.fillRect(28 + recoil, -3.4, 5, 6.8);
		ctx.strokeRect(28 + recoil, -3.4, 5, 6.8);
	}
	if (unit.swingMs > 110) {
		ctx.beginPath();
		ctx.arc((elite ? 40 : 36) + recoil, 0, elite ? 8 : 6, 0, Math.PI * 2);
		ctx.fillStyle = elite ? '#ffd66a' : YELLOW;
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.stroke();
	}
	if (elite) {
		// A wedge-shaped Leopard 2A7 turret with gold trim
		inkPoly(
			ctx,
			[-13, -7.5, 4, -9.6, 12, -4.2, 12, 4.2, 4, 9.6, -13, 7.5],
			flash ? PAPER : '#343840',
			2.4
		);
		ctx.beginPath();
		ctx.moveTo(-10, -5.5);
		ctx.lineTo(3, -7.2);
		ctx.moveTo(-10, 5.5);
		ctx.lineTo(3, 7.2);
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = GOLD;
		ctx.stroke();
		if (sk.tier >= 3) {
			starPath(ctx, 5, 0, 3.4, 1.5);
			ctx.fillStyle = GOLD;
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = INK;
			ctx.stroke();
		}
		// The red light of the commander's sight
		ctx.beginPath();
		ctx.arc(8, -6.4, 1.6, 0, Math.PI * 2);
		ctx.fillStyle = Math.sin(timeMs / 180) > 0 ? '#ff4a4a' : '#7a2020';
		ctx.fill();
	} else {
		ctx.beginPath();
		ctx.ellipse(-2, 0, 12, 9.5, 0, 0, Math.PI * 2);
		ctx.fillStyle = flash ? PAPER : '#6c7858';
		ctx.fill();
		ctx.lineWidth = 2.4;
		ctx.strokeStyle = INK;
		ctx.stroke();
	}
	// The commander, popping out of the hatch
	inkEllipse(ctx, -5, 0, 4.6, 4.6, elite ? BLACK_LIGHT : FLAG_BLUE, 1.6);
	ctx.beginPath();
	ctx.ellipse(-5, -2, 4.8, 3.2, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = elite ? BLACK_DEEP : OLIVE;
	ctx.fill();
	ctx.lineWidth = 1.6;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (elite) {
		ctx.beginPath();
		ctx.arc(-5, 0.4, 1.2, 0, Math.PI * 2);
		ctx.fillStyle = '#ff5050';
		ctx.fill();
	}
	ctx.rotate(-unit.facing);
}

function drawAzovUnit(ctx: Ctx, unit: Unit, timeMs: number, flash: boolean, sk: Skin) {
	const elite = sk.elite;
	const stride = Math.sin(timeMs / 80 + unit.id) * 1.5;
	// Boots, body, helmet and a patch, like the assault squad
	inkEllipse(ctx, -4, 9 + stride * 0.4, 3.3, 2.4, INK, 1);
	inkEllipse(ctx, 4, 9 - stride * 0.4, 3.3, 2.4, INK, 1);
	inkEllipse(ctx, 0, 0, 9.5, 10, flash ? PAPER : elite ? BLACK_LIGHT : FLAG_BLUE, 2.2);
	if (elite && sk.tier >= 2) {
		// Gold shoulder pads
		for (const s of [-1, 1]) inkEllipse(ctx, s * 9, -3.5, 3.4, 3, flash ? PAPER : GOLD, 1.4);
	}
	ctx.beginPath();
	ctx.ellipse(0, -3.5, 9.8, 7.5, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = flash ? PAPER : elite ? BLACK_DEEP : OLIVE;
	ctx.fill();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (elite) {
		// A red plume on the helmet
		const sway = Math.sin(timeMs / 200 + unit.id) * 1.2;
		inkPoly(
			ctx,
			[0.5, -10.5, -3, -17 - sk.tier, -9 - sk.tier, -14 + sway, -3.5, -9],
			flash ? PAPER : ELITE_RED,
			1.5
		);
		if (sk.tier >= 3) inkPoly(ctx, [0.5, -10.5, 5, -18, 3, -9.5], flash ? PAPER : GOLD, 1.3);
	}
	for (const dx of [-3.5, 3.5]) {
		if (elite) {
			ctx.beginPath();
			ctx.arc(dx, -0.5, 3.2, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,60,60,0.35)';
			ctx.fill();
		}
		ctx.beginPath();
		ctx.arc(dx, -0.5, 2, 0, Math.PI * 2);
		ctx.fillStyle = elite ? '#ff5a4a' : PAPER;
		ctx.fill();
		if (!elite) {
			ctx.beginPath();
			ctx.arc(dx + Math.cos(unit.facing), -0.5 + Math.sin(unit.facing), 1, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
		}
	}
	// The belt: yellow, or gold when elite
	ctx.fillStyle = elite ? GOLD : YELLOW;
	ctx.fillRect(-9, 4, 18, 3);
	// The club swings toward the enemy (elite: a studded mace)
	const swing =
		unit.swingMs > 0
			? -1.1 + (1 - unit.swingMs / 220) * 2.2
			: Math.sin(timeMs / 300 + unit.id) * 0.15;
	ctx.save();
	ctx.rotate(unit.facing + swing);
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(6, 0);
	ctx.lineTo(17, 0);
	ctx.lineWidth = 5;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.lineWidth = 2.6;
	ctx.strokeStyle = elite ? '#3a3d45' : '#9a7b4f';
	ctx.stroke();
	ctx.lineCap = 'butt';
	if (elite) inkEllipse(ctx, 17.5, 0, 4.2, 4.2, GOLD, 1.6);
	ctx.restore();
}

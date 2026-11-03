/*
 * Canvas drawing for Beachhead, in isometric view. The simulation runs on a flat 12 × 8 grid; this
 * file projects it into a 2:1 diamond (see iso.ts). Flat things (water, sand, blast rings, zones) are
 * drawn straight in grid coordinates under the projection matrix; solid things (buildings) are built
 * from blocks; soldiers are upright figures standing on their projected spot, mirrored to face the
 * way they walk, and the vehicles lie on the ground as top-down models. Flat shapes with thick ink
 * outlines match the other game boards: no photographs, no gradients that stop working on a dark theme.
 */
import type { BattleState, Building, Projectile, SkillStrike, SkillZone, Troop } from './battle.js';
import {
	COLUMNS,
	ROWS,
	SHORE_X,
	TROOP,
	VEHICLE_TROOPS,
	isMine,
	type BuildingKind,
	type IslandTheme
} from './config.js';
import { drawResourceGlyph, type ResourceId } from './resourceIcons.js';
import { drawEnemyBuilding, drawHitFlash, drawMineArt, drawRubbleArt } from './buildingArt.js';
import {
	createShoreView,
	mix,
	drawBlob,
	drawBox,
	onGround,
	paletteOf,
	shade,
	type ShoreView
} from './iso.js';
import {
	BANNER_SLATE,
	DIRT,
	DISPLAY_FONT,
	EXPLOSION_YELLOW,
	FLARE_ORANGE,
	HEAL_GREEN,
	INK,
	KHAKI,
	MUSTARD,
	PAPER,
	SAND,
	SAND_DARK,
	SEA,
	SEA_DARK,
	SKIN,
	SMOKE,
	STEEL,
	TIE_RED
} from './palette.js';

/** Painter's order in the turned view: nearer the bottom of the screen means a larger y and a smaller x */
function shoreDepth(x: number, y: number): number {
	return y - x;
}

/** The battle seen from the south: the beach is the bottom-left edge, the headquarters sits far up on the right */
export const BATTLE_VIEW: ShoreView = createShoreView(COLUMNS, ROWS, {
	pad: 0.6,
	headroom: 2.2,
	depth: 0.7
});

/** Guns that get a muzzle flash on the left, towards the beach */
const BUILDING_MUZZLE = new Set<BuildingKind>([
	'field-cannon',
	'mortar',
	'sniper',
	'mg',
	'flame',
	'air-defence',
	'fpv-nest',
	'catapult',
	'ballista',
	'ice-cannon',
	'ice-spire',
	'dart-hut',
	'sand-mortar',
	'scorpion-nest'
]);

/** How tall each building stands, for its health bar and damage smoke */
const BUILDING_TOP: Partial<Record<BuildingKind, number>> = {
	hq: 1.9,
	catapult: 1.1,
	'ice-spire': 1.7,
	totem: 1.3,
	'dart-hut': 1.0,
	sniper: 1.4,
	'fpv-nest': 1.3,
	'air-defence': 1.1,
	depot: 0.8
};

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
			kind: 'loot';
			resource: ResourceId;
			amount: number;
			fromX: number;
			fromY: number;
			seed: number;
			/** Milliseconds to wait before the piece leaves, so the loot streams out */
			delayMs: number;
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
	/** A small picture of the island on the sea chart: no sea, craft, hints or frame around it */
	map?: boolean;
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

function drawSea(context: CanvasRenderingContext2D, view: ShoreView, timeMs: number) {
	context.fillStyle = SEA;
	context.fillRect(0, 0, view.width, view.height);
	// Soft cloud bank along the top edge of the picture
	context.fillStyle = 'rgba(255,255,255,0.35)';
	context.beginPath();
	for (let x = 0; x < view.width; x += 0.5) {
		const offset = Math.sin(x * 1.3 + timeMs / 900) * 0.2;
		context.arc(x, offset - 0.2, 0.5 + Math.abs(offset) * 0.4, 0, Math.PI * 2);
	}
	context.fill();
	// Wave lines run across the whole water, in grid coordinates under the projection
	onGround(context, view, () => {
		context.strokeStyle = SEA_DARK;
		context.lineWidth = 0.06;
		for (let row = -10; row < ROWS + 10; row += 2) {
			context.beginPath();
			const y = row + 0.7;
			for (let x = -10; x <= COLUMNS + 10; x += 0.25) {
				const wave = Math.sin(x * 2.2 + timeMs / 700 + row) * 0.08;
				if (x === -10) context.moveTo(x, y + wave);
				else context.lineTo(x, y + wave);
			}
			context.stroke();
		}
	});
}

function drawLandingCraft(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	count: number,
	timeMs: number
) {
	// Up to eight craft wait offshore, spread over the whole beach rather than in one column
	const gap = count > 1 ? (ROWS - 1.3) / (count - 1) : 0;
	for (let index = 0; index < count; index++) {
		const bob = Math.sin(timeMs / 650 + index * 1.8) * 0.05;
		const x = 0.4 + Math.sin(timeMs / 1400 + index) * 0.04;
		const y = 0.65 + (count > 1 ? index * gap : (ROWS - 1) / 2);
		const at = view.project(x, y, bob);
		// Wake behind the craft, then a blunt hull with a ramp pointing at the beach
		context.strokeStyle = 'rgba(255,255,255,0.6)';
		context.lineWidth = 0.05;
		context.beginPath();
		context.ellipse(at.x - 0.1, at.y + 0.18, 0.7, 0.24, 0, 0, Math.PI * 2);
		context.stroke();
		const hull = view.gridPlacement({ x: x - 0.3, y: y - 0.2, width: 0.7, height: 0.4 });
		const cabin = view.gridPlacement({ x: x - 0.15, y: y - 0.12, width: 0.34, height: 0.24 });
		drawBox(
			context,
			view.grid,
			hull.x,
			hull.y,
			hull.width,
			hull.height,
			bob,
			0.2 + bob,
			paletteOf(STEEL)
		);
		drawBox(
			context,
			view.grid,
			cabin.x,
			cabin.y,
			cabin.width,
			cabin.height,
			0.2 + bob,
			0.42 + bob,
			paletteOf(KHAKI)
		);
		drawBlob(context, view, x + 0.02, y, 0.5 + bob, 0.05, EXPLOSION_YELLOW, 0.02);
	}
}

interface Ground {
	sand: string;
	earth: string;
	patch: string;
}

/** The ground of each biome; frost whitens the north the further inland an island lies */
function groundOf(theme: IslandTheme | undefined, frost = 0): Ground {
	const base: Ground =
		theme === 'orc'
			? { sand: '#8a8f6a', earth: '#6b5a48', patch: '#6f7456' }
			: theme === 'ice'
				? { sand: '#dcebf3', earth: '#8fb3c6', patch: '#bcd6e4' }
				: theme === 'jungle'
					? { sand: '#a9c47a', earth: '#5b6b3a', patch: '#5f9a49' }
					: theme === 'desert'
						? { sand: '#ecd49a', earth: '#c9a35a', patch: '#d8bb7a' }
						: { sand: SAND, earth: DIRT, patch: SAND_DARK };
	if (frost <= 0) return base;
	const snow = '#f1f8fc';
	return {
		sand: mix(base.sand, snow, frost * 0.85),
		earth: mix(base.earth, '#9fc0d2', frost * 0.7),
		patch: mix(base.patch, '#ffffff', frost * 0.8)
	};
}

function drawIsland(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	timeMs: number,
	theme?: IslandTheme,
	frost = 0
) {
	const ground = groundOf(theme, frost);
	const shore = SHORE_X - 0.15;
	const thickness = 0.55;
	const p = view.project;
	// The island is a slab: dirt walls under the two edges that face the camera
	const wall = (from: [number, number], to: [number, number], fill: string) => {
		context.beginPath();
		context.moveTo(p(from[0], from[1]).x, p(from[0], from[1]).y);
		context.lineTo(p(to[0], to[1]).x, p(to[0], to[1]).y);
		context.lineTo(p(to[0], to[1], -thickness).x, p(to[0], to[1], -thickness).y);
		context.lineTo(p(from[0], from[1], -thickness).x, p(from[0], from[1], -thickness).y);
		context.closePath();
		context.fillStyle = fill;
		context.fill();
		context.lineWidth = 0.07;
		context.lineJoin = 'round';
		context.strokeStyle = INK;
		context.stroke();
	};
	// The two edges that face the camera are the shore (left) and the far-right side of the island
	const earth = ground.earth;
	wall([shore, 0], [shore, ROWS], shade(earth, -0.2));
	wall([shore, ROWS], [COLUMNS, ROWS], earth);

	onGround(context, view, () => {
		// A wavy foam edge, then the sand: the foam slides a little so the water reads as alive
		context.beginPath();
		context.moveTo(shore, 0);
		for (let y = 0; y <= ROWS; y += 0.2) {
			context.lineTo(shore + Math.sin(y * 2.4 + timeMs / 900) * 0.1, y);
		}
		context.lineTo(COLUMNS, ROWS);
		context.lineTo(COLUMNS, 0);
		context.closePath();
		context.fillStyle = ground.sand;
		context.fill();
		context.lineWidth = 0.05;
		context.strokeStyle = INK;
		context.stroke();

		context.strokeStyle = PAPER;
		context.lineWidth = 0.1;
		context.beginPath();
		context.moveTo(shore, 0);
		for (let y = 0; y <= ROWS; y += 0.2) {
			context.lineTo(shore + Math.sin(y * 2.4 + timeMs / 900) * 0.1 - 0.15, y);
		}
		context.stroke();

		// A few patches of dry grass, kept out of the way of the buildings
		context.fillStyle = ground.patch;
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
	});
}

/** More palms on the jungle islands, a few anywhere else; cacti and crystals take their place in the desert and the north */
const JUNGLE_PALMS: readonly { x: number; y: number }[] = [
	...PALMS,
	{ x: 3.4, y: 3.4 },
	{ x: 6.6, y: 0.4 },
	{ x: 6.2, y: 7.3 },
	{ x: 9.6, y: 4.6 },
	{ x: 4.4, y: 6.6 },
	{ x: 8.2, y: 2.4 }
];

function decorFor(theme?: IslandTheme): readonly { x: number; y: number }[] {
	return theme === 'jungle' ? JUNGLE_PALMS : PALMS;
}

function drawCactus(context: CanvasRenderingContext2D) {
	context.lineJoin = 'round';
	context.lineCap = 'round';
	for (const [width, color] of [
		[0.2, INK],
		[0.13, '#4f9a4a']
	] as const) {
		context.strokeStyle = color;
		context.lineWidth = width;
		context.beginPath();
		context.moveTo(0, 0);
		context.lineTo(0, -0.6);
		context.moveTo(0, -0.28);
		context.lineTo(-0.2, -0.28);
		context.lineTo(-0.2, -0.46);
		context.moveTo(0, -0.18);
		context.lineTo(0.2, -0.18);
		context.lineTo(0.2, -0.34);
		context.stroke();
	}
}

/** Shards of ice standing out of the snow; icier islands grow bigger ones, and the rocky orc lands dead bare trees */
function drawCrystals(context: CanvasRenderingContext2D, frost: number, seed: number) {
	context.lineJoin = 'round';
	const size = 0.55 + frost * 0.7;
	const shards = [
		{ x: -0.16, h: size * 0.8, w: 0.14 },
		{ x: 0.02, h: size, w: 0.18 },
		{ x: 0.2, h: size * 0.6, w: 0.12 }
	];
	for (const shard of shards) {
		context.beginPath();
		context.moveTo(shard.x - shard.w, 0);
		context.lineTo(shard.x, -shard.h);
		context.lineTo(shard.x + shard.w, 0);
		context.closePath();
		context.fillStyle = frost > 0.25 ? '#c9e7f5' : '#8d8f7a';
		context.fill();
		context.lineWidth = 0.04;
		context.strokeStyle = INK;
		context.stroke();
		if (frost > 0.25) {
			context.beginPath();
			context.moveTo(shard.x - shard.w * 0.2, -shard.h * 0.25);
			context.lineTo(shard.x, -shard.h * 0.9);
			context.strokeStyle = 'rgba(255,255,255,0.85)';
			context.lineWidth = 0.04;
			context.stroke();
		}
	}
	void seed;
}

/** The crater a mine leaves, flat on the sand */
function drawCrater(context: CanvasRenderingContext2D, view: ShoreView, mine: Building) {
	onGround(context, view, () => {
		context.beginPath();
		context.ellipse(mine.x + 0.5, mine.y + 0.5, 0.36, 0.3, 0, 0, Math.PI * 2);
		context.fillStyle = 'rgba(60,45,25,0.5)';
		context.fill();
		context.lineWidth = 0.03;
		context.strokeStyle = INK;
		context.stroke();
	});
}

function drawDamageSmoke(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	building: Building,
	timeMs: number
) {
	const ratio = building.hp / building.maxHp;
	if (ratio > 0.55) return;
	context.fillStyle = SMOKE;
	const puffs = ratio < 0.25 ? 4 : 2;
	const top = BUILDING_TOP[building.kind] ?? 0.7;
	for (let puff = 0; puff < puffs; puff++) {
		const drift = ((timeMs / 1800 + puff / puffs) % 1) * 0.9;
		const at = view.project(
			building.x + building.width * (0.3 + puff * 0.15) + Math.sin(timeMs / 500 + puff) * 0.05,
			building.y + building.height * 0.5,
			top * 0.7 + drift
		);
		context.globalAlpha = 0.34 * (1 - drift / 0.9);
		context.beginPath();
		context.arc(at.x, at.y, 0.13 + drift * 0.3, 0, Math.PI * 2);
		context.fill();
	}
	context.globalAlpha = 1;
}

function drawBuilding(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	building: Building,
	timeMs: number,
	theme?: IslandTheme
) {
	if (building.destroyed) {
		drawRubbleArt(context, view.grid, view.gridPlacement(building), timeMs);
		return;
	}
	context.save();
	if (building.recoilMs > 0) {
		const kick = building.recoilMs / 170;
		context.translate(Math.sin(building.recoilMs * 0.19) * 0.05 * kick, 0.03 * kick);
	}
	drawEnemyBuilding(
		context,
		view.grid,
		{ ...building, ...view.gridPlacement(building) },
		timeMs,
		theme
	);
	if (building.recoilMs > 0 && BUILDING_MUZZLE.has(building.kind)) {
		const flash = building.recoilMs / 170;
		const muzzle = view.project(building.x - 0.1, building.y + 0.5, 0.5);
		context.fillStyle = EXPLOSION_YELLOW;
		context.globalAlpha = flash;
		context.beginPath();
		context.moveTo(muzzle.x, muzzle.y);
		context.lineTo(muzzle.x - 0.4 * flash, muzzle.y + 0.1 * flash);
		context.lineTo(muzzle.x - 0.2 * flash, muzzle.y - 0.14 * flash);
		context.closePath();
		context.fill();
		context.globalAlpha = 1;
	}
	context.restore();
	drawDamageSmoke(context, view, building, timeMs);
	if (building.hp < building.maxHp) {
		const top = view.project(
			building.x + building.width / 2,
			building.y + building.height / 2,
			(BUILDING_TOP[building.kind] ?? 0.75) + 0.2
		);
		const width = Math.min(1.4, 0.55 + building.width * 0.25);
		healthBar(context, top.x - width / 2, top.y, width, building.hp / building.maxHp, TIE_RED);
	}
	if (building.flashMs > 0) {
		drawHitFlash(
			context,
			view.grid,
			view.gridPlacement(building),
			Math.min(0.55, building.flashMs / 160),
			BUILDING_TOP[building.kind] ?? 0.7
		);
	}
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

function isVehicle(troop: Troop): boolean {
	return VEHICLE_TROOPS.includes(troop.kind);
}

function drawTroop(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	troop: Troop,
	timeMs: number
) {
	const base = view.project(troop.x, troop.y);
	const vehicle = isVehicle(troop);
	context.fillStyle = 'rgba(17,17,17,0.25)';
	context.beginPath();
	context.ellipse(
		base.x,
		base.y + 0.02,
		vehicle ? 0.5 : 0.22,
		vehicle ? 0.22 : 0.1,
		0,
		0,
		Math.PI * 2
	);
	context.fill();

	const bob = troop.moving
		? Math.abs(Math.sin(troop.walkPhase)) * 0.04
		: Math.sin(timeMs / 700 + troop.id) * 0.01;

	if (vehicle) {
		// Tanks, personnel carriers and guns lie on the ground as top-down models, turned the way they drive
		const angle = Math.atan2(troop.aimY, troop.aimX);
		onGround(context, view, () => {
			context.save();
			context.translate(troop.x, troop.y);
			context.rotate(angle);
			context.scale(1.25, 1.25);
			if (troop.kind === 'tank') drawTank(context, troop);
			else if (troop.kind === 'apc') drawApc(context, troop);
			else drawArtillery(context, troop);
			context.restore();
		});
	} else {
		// Soldiers stand upright and face the way they walk on screen
		const facing = troop.aimX + troop.aimY >= 0 ? 1 : -1;
		context.save();
		context.translate(base.x, base.y - 0.27 - bob);
		context.scale(1.7 * facing, 1.7);
		switch (troop.kind) {
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
	}

	const head = base.y - (vehicle ? 0.55 : 0.85);
	if (troop.stunMs > 0) {
		context.fillStyle = EXPLOSION_YELLOW;
		for (let star = 0; star < 3; star++) {
			const orbit = timeMs / 160 + (star / 3) * Math.PI * 2;
			context.beginPath();
			context.arc(
				base.x + Math.cos(orbit) * 0.3,
				head + Math.sin(orbit) * 0.08,
				0.045,
				0,
				Math.PI * 2
			);
			context.fill();
		}
	}

	if (troop.flashMs > 0) {
		context.globalAlpha = Math.min(0.7, troop.flashMs / 150);
		circle(context, base.x, base.y - 0.3, 0.3, PAPER, 0);
		context.globalAlpha = 1;
	}
	if (troop.hp < troop.maxHp) {
		healthBar(context, base.x - 0.3, head - 0.12, 0.6, troop.hp / troop.maxHp, TIE_RED);
	}
}

function drawProjectile(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	projectile: Projectile
) {
	const progress = Math.min(1, projectile.ageMs / projectile.flightMs);
	const distance = Math.hypot(projectile.toX - projectile.fromX, projectile.toY - projectile.fromY);
	const arc =
		projectile.kind === 'shell'
			? Math.min(2.2, 0.5 + distance * 0.26)
			: projectile.kind === 'rocket'
				? 0.45
				: 0.8;
	const lift = Math.sin(progress * Math.PI) * arc;
	const ground = view.project(projectile.x, projectile.y);

	// A shadow on the ground and a faint trail behind the shot
	context.fillStyle = 'rgba(17,17,17,0.18)';
	context.beginPath();
	context.ellipse(ground.x, ground.y, 0.16, 0.07, 0, 0, Math.PI * 2);
	context.fill();

	context.strokeStyle =
		projectile.kind === 'shell' ? 'rgba(255,255,255,0.45)' : 'rgba(229,72,77,0.4)';
	context.lineWidth = 0.05;
	context.beginPath();
	const start = view.project(projectile.fromX, projectile.fromY, 0.3);
	context.moveTo(start.x, start.y);
	for (let step = 1; step <= 8; step++) {
		const t = (step / 8) * progress;
		const at = view.project(
			projectile.fromX + (projectile.toX - projectile.fromX) * t,
			projectile.fromY + (projectile.toY - projectile.fromY) * t,
			0.3 + Math.sin(t * Math.PI) * arc
		);
		context.lineTo(at.x, at.y);
	}
	context.stroke();

	const at = view.project(projectile.x, projectile.y, 0.3 + lift);
	if (projectile.kind === 'shell') {
		circle(context, at.x, at.y, 0.15, STEEL);
		context.fillStyle = EXPLOSION_YELLOW;
		context.beginPath();
		context.arc(at.x - 0.05, at.y, 0.06, 0, Math.PI * 2);
		context.fill();
	} else if (projectile.kind === 'rocket') {
		const from = view.project(projectile.fromX, projectile.fromY);
		const to = view.project(projectile.toX, projectile.toY);
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		context.save();
		context.translate(at.x, at.y);
		context.rotate(Math.atan2(dy, dx));
		rect(context, -0.2, -0.07, 0.4, 0.14, TIE_RED, 0.03);
		context.fillStyle = EXPLOSION_YELLOW;
		context.beginPath();
		context.moveTo(-0.2, -0.06);
		context.lineTo(-0.4, 0);
		context.lineTo(-0.2, 0.06);
		context.closePath();
		context.fill();
		context.restore();
	} else {
		// A tiny quadcopter, rotors blurred into X shapes
		context.strokeStyle = INK;
		context.lineWidth = 0.045;
		context.beginPath();
		context.moveTo(at.x - 0.15, at.y - 0.08);
		context.lineTo(at.x + 0.15, at.y + 0.08);
		context.moveTo(at.x + 0.15, at.y - 0.08);
		context.lineTo(at.x - 0.15, at.y + 0.08);
		context.stroke();
		circle(context, at.x, at.y, 0.08, TIE_RED, 0.025);
	}
}

function drawGroundZones(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	state: BattleState,
	timeMs: number
) {
	const heal = state.heal;
	if (heal) {
		onGround(context, view, () => {
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
		});
	}

	const flare = state.flare;
	if (flare) {
		const pulse = 1 + Math.sin(timeMs / 150) * 0.16;
		const fade = Math.min(1, flare.remainingMs / 600);
		onGround(context, view, () => {
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
			context.globalAlpha = 1;
		});
		// A thin beam, so the marker is visible even over a building
		const at = view.project(flare.x, flare.y);
		context.fillStyle = FLARE_ORANGE;
		context.globalAlpha = 0.3 * fade;
		context.fillRect(at.x - 0.04, at.y - 2.6, 0.08, 2.6);
		context.globalAlpha = 1;
	}
}

function drawSmokeScreen(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	smoke: SkillZone,
	timeMs: number
) {
	const fade = Math.min(1, smoke.remainingMs / 900);
	context.globalAlpha = 0.72 * fade;
	for (let puff = 0; puff < 12; puff++) {
		const angle = (puff / 12) * Math.PI * 2;
		const orbit = smoke.radius * (0.35 + (puff % 4) * 0.16);
		const at = view.project(
			smoke.x + Math.cos(angle + timeMs / 2600) * orbit,
			smoke.y + Math.sin(angle + timeMs / 2600) * orbit,
			0.45
		);
		circle(context, at.x, at.y, 0.5 + (puff % 3) * 0.14, puff % 2 === 0 ? SMOKE : '#8a919c', 0);
	}
	context.globalAlpha = 1;
}

function drawSkillStrike(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	strike: SkillStrike,
	timeMs: number
) {
	const progress = Math.min(1, Math.max(0, strike.ageMs / strike.delayMs));
	const travel = 1 - progress;
	const ground = view.project(strike.x, strike.y, 0.3);
	const x = ground.x + 5.2 * travel;
	const y = ground.y - 7 * travel;
	const angle = Math.atan2(ground.y - y, ground.x - x);

	// Ground marker, so the player can see where the strike is aimed
	onGround(context, view, () => {
		context.globalAlpha = 0.45 * (0.6 + progress * 0.4);
		context.strokeStyle = TIE_RED;
		context.lineWidth = 0.06;
		context.setLineDash([0.18, 0.12]);
		context.beginPath();
		context.arc(strike.x, strike.y, strike.radius, 0, Math.PI * 2);
		context.stroke();
		context.setLineDash([]);
		context.globalAlpha = 1;
	});

	// A faint trail behind the falling shot
	context.strokeStyle =
		strike.skill === 'flamingo' ? 'rgba(229,72,77,0.45)' : 'rgba(245,200,58,0.4)';
	context.lineWidth = 0.08;
	context.beginPath();
	context.moveTo(x + Math.cos(angle) * -1.4, y + Math.sin(angle) * -1.4);
	context.lineTo(x, y);
	context.stroke();

	context.save();
	context.translate(x, y);
	context.rotate(angle);
	context.scale(1.5, 1.5);
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

function drawFocus(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	state: BattleState,
	timeMs: number
) {
	const building = state.buildings.find((candidate) => candidate.id === state.focusId);
	if (!building || building.destroyed) return;
	const cx = building.x + building.width / 2;
	const cy = building.y + building.height / 2;
	const pulse = 1 + Math.sin(timeMs / 180) * 0.12;
	onGround(context, view, () => {
		context.strokeStyle = EXPLOSION_YELLOW;
		context.lineWidth = 0.09;
		context.setLineDash([0.18, 0.12]);
		context.beginPath();
		context.arc(cx, cy, Math.max(building.width, building.height) * 0.75 * pulse, 0, Math.PI * 2);
		context.stroke();
		context.setLineDash([]);
	});
}

function drawDeployHint(
	context: CanvasRenderingContext2D,
	view: ShoreView,
	state: BattleState,
	timeMs: number
) {
	if (state.status !== 'playing' || state.squadsLeft <= 0) return;
	onGround(context, view, () => {
		context.globalAlpha = 0.5 + Math.sin(timeMs / 420) * 0.18;
		context.strokeStyle = PAPER;
		context.lineWidth = 0.07;
		for (let row = 0; row < ROWS; row++) {
			const x = 1.35;
			const y = row + 0.5;
			context.beginPath();
			context.moveTo(x - 0.15, y - 0.15);
			context.lineTo(x + 0.15, y);
			context.lineTo(x - 0.15, y + 0.15);
			context.stroke();
		}
		context.globalAlpha = 1;
	});
}

/** Where the loot lands: the resource counters in the top-right corner of the picture */
function lootTarget(view: ShoreView): { x: number; y: number } {
	return { x: view.width - 1.4, y: 1.1 };
}

function drawEffect(context: CanvasRenderingContext2D, view: ShoreView, effect: Effect) {
	if (effect.kind === 'loot') {
		const flight = (effect.ageMs - effect.delayMs) / effect.durationMs;
		if (flight < 0 || flight > 1) return;
		const from = view.project(effect.fromX, effect.fromY, 0.5);
		const to = lootTarget(view);
		// Pop up out of the building first, then swing across to the stockpile
		const ease = flight * flight * (3 - 2 * flight);
		const pop = Math.sin(Math.min(1, flight * 3) * Math.PI) * 0.5;
		const x =
			from.x + (to.x - from.x) * ease + Math.sin(effect.seed) * 0.4 * Math.sin(flight * Math.PI);
		const y = from.y + (to.y - from.y) * ease - Math.sin(flight * Math.PI) * 1.6 - pop;
		context.globalAlpha = Math.min(1, (1 - flight) * 4);
		drawResourceGlyph(context, effect.resource, x, y, 0.95 - flight * 0.35);
		context.globalAlpha = 1;
		// A little sparkle trail
		context.fillStyle = PAPER;
		for (let spark = 1; spark <= 3; spark++) {
			const t = Math.max(0, flight - spark * 0.05);
			const tx = from.x + (to.x - from.x) * (t * t * (3 - 2 * t));
			const ty = from.y + (to.y - from.y) * (t * t * (3 - 2 * t)) - Math.sin(t * Math.PI) * 1.6;
			context.globalAlpha = 0.5 / spark;
			context.beginPath();
			context.arc(tx, ty, 0.07, 0, Math.PI * 2);
			context.fill();
		}
		context.globalAlpha = 1;
		return;
	}
	const progress = Math.min(1, effect.ageMs / effect.durationMs);
	switch (effect.kind) {
		case 'tracer': {
			const from = view.project(effect.fromX, effect.fromY, 0.4);
			const to = view.project(effect.toX, effect.toY, 0.4);
			context.globalAlpha = 1 - progress;
			context.strokeStyle = effect.friendly ? EXPLOSION_YELLOW : TIE_RED;
			context.lineWidth = 0.07;
			context.beginPath();
			context.moveTo(from.x, from.y);
			context.lineTo(to.x, to.y);
			context.stroke();
			context.globalAlpha = 1;
			break;
		}
		case 'explosion': {
			const at = view.project(effect.x, effect.y, 0.3);
			const radius = effect.size * (0.3 + progress * 0.9) * 1.3;
			context.globalAlpha = 1 - progress;
			context.fillStyle = TIE_RED;
			context.beginPath();
			context.ellipse(at.x, at.y, radius, radius * 0.85, 0, 0, Math.PI * 2);
			context.fill();
			context.fillStyle = EXPLOSION_YELLOW;
			context.beginPath();
			context.ellipse(at.x, at.y, radius * 0.6, radius * 0.5, 0, 0, Math.PI * 2);
			context.fill();
			context.fillStyle = SMOKE;
			for (let particle = 0; particle < 6; particle++) {
				const angle = (particle / 6) * Math.PI * 2;
				const distance = radius * 1.4;
				context.beginPath();
				context.arc(
					at.x + Math.cos(angle) * distance,
					at.y + Math.sin(angle) * distance * 0.8,
					0.09 * (1 - progress),
					0,
					Math.PI * 2
				);
				context.fill();
			}
			context.globalAlpha = 1;
			break;
		}
		case 'splash': {
			onGround(context, view, () => {
				context.globalAlpha = 1 - progress;
				context.strokeStyle = PAPER;
				context.lineWidth = 0.05;
				context.beginPath();
				context.arc(effect.x, effect.y, 0.12 + progress * 0.3, 0, Math.PI * 2);
				context.stroke();
				context.globalAlpha = 1;
			});
			break;
		}
		case 'down': {
			const at = view.project(effect.x, effect.y, 0.3);
			context.globalAlpha = 1 - progress;
			context.fillStyle = SMOKE;
			for (let puff = 0; puff < 3; puff++) {
				context.beginPath();
				context.arc(
					at.x + (puff - 1) * 0.12,
					at.y - progress * 0.5,
					0.1 + progress * 0.07,
					0,
					Math.PI * 2
				);
				context.fill();
			}
			context.globalAlpha = 1;
			break;
		}
		case 'flame': {
			const from = view.project(effect.fromX, effect.fromY, 0.4);
			const to = view.project(effect.toX, effect.toY, 0.3);
			const dx = to.x - from.x;
			const dy = to.y - from.y;
			const length = Math.hypot(dx, dy) || 1;
			const nx = dx / length;
			const ny = dy / length;
			context.globalAlpha = 1 - progress;
			for (let puff = 0; puff < 9; puff++) {
				const t = (puff / 8) * (0.25 + progress * 0.75);
				const wobble = Math.sin(puff * 2.1 + progress * 12) * 0.12 * t;
				context.fillStyle = puff % 2 === 0 ? EXPLOSION_YELLOW : TIE_RED;
				context.beginPath();
				context.arc(
					from.x + nx * length * t - ny * wobble,
					from.y + ny * length * t + nx * wobble,
					0.16 * (1 - t * 0.5) * (1 - progress * 0.4),
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
			const at = view.project(effect.x, effect.y, 0.3);
			context.globalAlpha = 1 - progress;
			for (let piece = 0; piece < 9; piece++) {
				const angle = effect.seed + piece * 2.399;
				const speed = 1.1 + (piece % 4) * 0.35;
				const x = at.x + Math.cos(angle) * speed * progress;
				const y = at.y + Math.sin(angle) * speed * progress * 0.6 + progress * progress * 1.3;
				context.fillStyle = piece % 3 === 0 ? EXPLOSION_YELLOW : STEEL;
				context.save();
				context.translate(x, y);
				context.rotate(angle + progress * 5);
				context.fillRect(
					-0.08 * effect.size,
					-0.05 * effect.size,
					0.16 * effect.size,
					0.1 * effect.size
				);
				context.restore();
			}
			context.globalAlpha = 1;
			break;
		}
		case 'float': {
			const at = view.project(effect.x, effect.y, 0.9);
			const rise = progress * 0.7;
			context.globalAlpha = 1 - progress * progress;
			context.font = `bold 0.46px ${DISPLAY_FONT}`;
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.lineWidth = 0.1;
			context.strokeStyle = INK;
			context.strokeText(effect.text, at.x, at.y - rise);
			context.fillStyle = effect.color;
			context.fillText(effect.text, at.x, at.y - rise);
			context.globalAlpha = 1;
			break;
		}
		case 'ring': {
			onGround(context, view, () => {
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
			});
			break;
		}
	}
}

/** Draws one frame; the context is already scaled so a unit is one cell-width of the isometric view */
export function drawScene(
	context: CanvasRenderingContext2D,
	state: BattleState,
	extras: SceneExtras,
	view: ShoreView = BATTLE_VIEW
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
	if (!extras.map) {
		drawSea(context, view, timeMs);
		drawLandingCraft(context, view, state.squadsLeft, timeMs);
	}
	drawIsland(context, view, timeMs, state.island.theme, state.island.frost);
	drawGroundZones(context, view, state, timeMs);

	// Mines lie flat on the sand, so they go under everything that stands up
	for (const building of state.buildings) {
		if (!isMine(building.kind)) continue;
		if (building.destroyed) drawCrater(context, view, building);
		else drawMineArt(context, view, building.kind, building.x, building.y, timeMs);
	}

	// Palms, buildings and troops share one painter's order: the further down the screen, the later
	const standing: { depth: number; draw: () => void }[] = [];
	for (const palm of decorFor(state.island.theme)) {
		standing.push({
			depth: shoreDepth(palm.x, palm.y + 0.55),
			draw: () => {
				const at = view.project(palm.x, palm.y + 0.55);
				context.save();
				context.translate(at.x, at.y);
				if (state.island.theme === 'desert') {
					context.scale(1.4, 1.4);
					drawCactus(context);
				} else if (state.island.theme === 'ice' || state.island.theme === 'orc') {
					context.scale(1.4, 1.4);
					drawCrystals(context, state.island.frost ?? 0, palm.x);
				} else {
					context.scale(
						state.island.theme === 'jungle' ? 2 : 1.6,
						state.island.theme === 'jungle' ? 2 : 1.6
					);
					drawPalm(context, 0, -0.55, timeMs);
				}
				context.restore();
			}
		});
	}
	for (const building of state.buildings) {
		if (isMine(building.kind)) continue;
		standing.push({
			depth: shoreDepth(building.x + building.width / 2, building.y + building.height / 2),
			draw: () => drawBuilding(context, view, building, timeMs, state.island.theme)
		});
	}
	for (const troop of state.troops) {
		standing.push({
			depth: shoreDepth(troop.x, troop.y) + 0.001,
			draw: () => drawTroop(context, view, troop, timeMs)
		});
	}
	standing.sort((a, b) => a.depth - b.depth);
	for (const item of standing) item.draw();

	for (const effect of effects) if (effect.kind === 'splash') drawEffect(context, view, effect);

	if (state.smoke) drawSmokeScreen(context, view, state.smoke, timeMs);

	for (const projectile of state.projectiles) drawProjectile(context, view, projectile);
	for (const strike of state.strikes) drawSkillStrike(context, view, strike, timeMs);

	for (const effect of effects) if (effect.kind !== 'splash') drawEffect(context, view, effect);

	drawFocus(context, view, state, timeMs);
	if (!extras.map) drawDeployHint(context, view, state, timeMs);

	// A small header strip is left to the page; the board itself carries no text
	if (!extras.map) {
		context.lineWidth = 0.1;
		context.strokeStyle = INK;
		context.strokeRect(0.05, 0.05, view.width - 0.1, view.height - 0.1);
	}
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
	const scale = size / BATTLE_VIEW.width;
	// The picture is wider than tall, so it is centred vertically in the square card
	context.translate(x, y + (size - BATTLE_VIEW.height * scale) / 2);
	context.scale(scale, scale);
	drawScene(context, state, { effects: [], timeMs: 0 });
	context.restore();
}

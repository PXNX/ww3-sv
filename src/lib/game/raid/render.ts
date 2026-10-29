/*
 * Canvas drawing for the raid, top-down in the collection's cartoon style (thick ink outlines,
 * flat colours). The camera follows the player and shows VIEW_HEIGHT units of the map in
 * landscape. Each map has its own ground, cover and enemy cast: soldiers, drones and a crowned
 * tank in the sunflower field, oil blobs, scorpions and a kraken in the strait, penguins, yetis
 * and a polar bear icebreaker in the arctic. Kamikaze drones, medics, mortar crews and Pion guns
 * turn up everywhere, and the elite Pion tank glows orange. Super enemies wear a golden aura,
 * mega ones a red one. Drones are drawn above the cover they fly over, with their shadow far below
 * them. In a defense the command post stands in the middle with its own health bar.
 */
import {
	ALLY_CRATE_MS,
	ALLY_RADIUS,
	ARTILLERY_RADIUS,
	BOSS_SLAM_RADIUS,
	CRYSTAL_COLOR,
	BOSS_SLAM_WINDUP_MS,
	GRENADE_FUSE_MS,
	MINE_ARM_MS,
	MINE_TRIGGER_RADIUS,
	GRENADE_RADIUS,
	JAMMER_RADIUS,
	MEDIC_HEAL_RADIUS,
	NEST_LIFETIME_MS,
	OBJECTIVE_RADIUS,
	OVERHEAT_STUN_MS,
	PLAYER_RADIUS,
	RARITY_COLOR,
	SPRINT_COOLDOWN_MS,
	ICE_FREEZE_MS,
	isElite,
	VIEW_HEIGHT,
	VIEW_MAX_WIDTH,
	type Archetype,
	type CrystalKind,
	type MapId,
	type Rarity,
	type WeaponKind
} from './config';
import type { AvatarLook } from '#lib/game/avatar/look.js';
import { perkOf, type GearItem } from './items';
import type { Decor, Obstacle, Terrain } from './maps';
import type {
	Ally,
	Bullet,
	Enemy,
	FirePool,
	FriendlyDrone,
	Loot,
	Mine,
	Nest,
	RaidState,
	Shell
} from './state';
import { TORNADO_LIFE_MS, type Tornado } from './sandstorm';

const INK = '#111111';
const PAPER = '#ffffff';
const RED = '#e5484d';
const YELLOW = '#f5c83a';
/** Elite enemies glow in this, on the field and on the map */
const ELITE = '#ff8a1a';

function drawFreezeIndicator(context: CanvasRenderingContext2D, x: number, y: number, progress: number) {
	const r = 10;
	const cx = x;
	const cy = y - 18;
	context.save();
	// Background ring
	context.strokeStyle = '#aaccff';
	context.lineWidth = 2.5;
	context.beginPath();
	context.arc(cx, cy, r, 0, Math.PI * 2);
	context.stroke();
	// Progress arc
	context.strokeStyle = '#4fa8ff';
	context.lineWidth = 2.5;
	context.beginPath();
	context.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
	context.stroke();
	// Freeze icon (small snowflake)
	context.fillStyle = '#ffffff';
	context.strokeStyle = '#111111';
	context.lineWidth = 1;
	context.beginPath();
	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * Math.PI * 2;
		const len = 5;
		context.moveTo(cx + Math.cos(angle) * 2, cy + Math.sin(angle) * 2);
		context.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
	}
	context.stroke();
	context.restore();
}

export type Effect =
	| {
			kind: 'text';
			x: number;
			y: number;
			text: string;
			color: string;
			size: number;
			ageMs: number;
			durationMs: number;
	  }
	| {
			kind: 'cone';
			x: number;
			y: number;
			angle: number;
			spread: number;
			radius: number;
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
	  }
	| {
			/** A crystal bursting into sparkling shards as it is picked up */
			kind: 'shards';
			x: number;
			y: number;
			color: string;
			glow: string;
			seed: number;
			ageMs: number;
			durationMs: number;
	  };

export interface SceneExtras {
	effects: readonly Effect[];
	reducedMotion: boolean;
	/** Closer than the raid's camera, for small views such as the weapon demos */
	zoom?: number;
	/** Where the camera looks, if not at the player */
	center?: { x: number; y: number };
	/** The player's own agent; without it the raider wears the stock olive kit */
	look?: RaiderLook;
}

/** The colours of the player's agent that the small raider sprite can show */
export interface RaiderLook {
	shirt: string;
	skin: string;
	/** Null for a bald agent */
	hair: string | null;
}

/** Picks the sprite colours out of the player's avatar */
export function raiderLook(look: AvatarLook): RaiderLook {
	return {
		shirt: look.shirtColor,
		skin: look.skin,
		hair: look.hair === 'bald' ? null : look.hairColor
	};
}

export interface Camera {
	/** CSS pixels per world unit */
	scale: number;
	/** World position of the top-left corner of the view */
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Zoom for a canvas of this size: VIEW_HEIGHT units tall, never wider than VIEW_MAX_WIDTH */
export function cameraScale(cssWidth: number, cssHeight: number): number {
	const shortSide = Math.min(cssWidth, cssHeight);
	return Math.max(shortSide / VIEW_HEIGHT, cssWidth / VIEW_MAX_WIDTH, 0.01);
}

export function cameraFor(
	state: RaidState,
	cssWidth: number,
	cssHeight: number,
	zoom = 1,
	center: { x: number; y: number } = state.player
): Camera {
	const scale = cameraScale(cssWidth, cssHeight) * zoom;
	const width = cssWidth / scale;
	const height = cssHeight / scale;
	const { map } = state;
	const clamp = (value: number, size: number, total: number) =>
		size >= total ? (total - size) / 2 : Math.max(0, Math.min(total - size, value - size / 2));
	return {
		scale,
		left: clamp(center.x, width, map.width),
		top: clamp(center.y, height, map.height),
		width,
		height
	};
}

function visible(camera: Camera, x: number, y: number, margin: number): boolean {
	return (
		x > camera.left - margin &&
		x < camera.left + camera.width + margin &&
		y > camera.top - margin &&
		y < camera.top + camera.height + margin
	);
}

/** Draws the whole scene; the context must already be scaled to CSS pixels */
export function drawRaid(
	context: CanvasRenderingContext2D,
	state: RaidState,
	cssWidth: number,
	cssHeight: number,
	extras: SceneExtras
) {
	const camera = cameraFor(state, cssWidth, cssHeight, extras.zoom, extras.center);
	context.save();
	context.fillStyle = state.map.palette.edge;
	context.fillRect(0, 0, cssWidth, cssHeight);
	context.scale(camera.scale, camera.scale);
	context.translate(-camera.left, -camera.top);
	drawWorld(context, state, camera, extras);
	context.restore();
}

function drawWorld(
	context: CanvasRenderingContext2D,
	state: RaidState,
	camera: Camera,
	extras: SceneExtras
) {
	const { map } = state;
	const time = extras.reducedMotion ? 0 : state.timeMs;
	context.fillStyle = map.palette.ground;
	context.fillRect(0, 0, map.width, map.height);
	context.lineWidth = 6;
	context.strokeStyle = INK;
	context.strokeRect(0, 0, map.width, map.height);

	for (const patch of map.terrain) {
		if (visible(camera, patch.x, patch.y, patch.r)) drawTerrain(context, patch, time);
	}
	for (const decor of map.decor) {
		if (visible(camera, decor.x, decor.y, decor.size)) drawDecor(context, decor, state.mapId);
	}
	for (const enemy of state.enemies) {
		if (enemy.archetype === 'boss' && enemy.slamWindupMs > 0) drawSlamWarning(context, enemy);
	}
	if (state.defense) drawPost(context, state.defense.objective, time);
	for (const shell of state.shells) drawShellMarker(context, shell);
	for (const fire of state.fires) {
		if (visible(camera, fire.x, fire.y, fire.radius)) drawFirePool(context, fire, time);
	}
	for (const mine of state.mines) drawMine(context, mine, time);
	for (const nest of state.nests) drawNest(context, nest, time);
	for (const loot of state.loot) {
		if (visible(camera, loot.x, loot.y, 60)) drawLoot(context, loot, time);
	}
	// Shadows under everything that stands; flying drones cast theirs far below
	context.fillStyle = 'rgba(0, 0, 0, 0.16)';
	for (const enemy of state.enemies) {
		if (!visible(camera, enemy.x, enemy.y, enemy.radius + 40)) continue;
		if (enemy.flying) ellipse(context, enemy.x + 10, enemy.y + 34, enemy.radius * 0.8, 5);
		else
			ellipse(context, enemy.x + 4, enemy.y + enemy.radius * 0.7, enemy.radius, enemy.radius * 0.4);
	}
	for (const drone of state.drones) ellipse(context, drone.x + 8, drone.y + 28, 9, 4);
	for (const ally of state.allies)
		ellipse(context, ally.x + 3, ally.y + ALLY_RADIUS * 0.7, ALLY_RADIUS, ALLY_RADIUS * 0.4);
	ellipse(context, state.player.x + 3, state.player.y + 15, 20, 8);

	for (const enemy of state.enemies) {
		if (!enemy.flying && visible(camera, enemy.x, enemy.y, enemy.radius + 30))
			drawEnemy(context, enemy, state.mapId, time);
	}
	for (const ally of state.allies) {
		if (visible(camera, ally.x, ally.y, ALLY_RADIUS + 30)) drawAlly(context, ally);
	}
	if (state.player.warcryMs > 0) drawWarcry(context, state, time);
	drawPlayer(context, state, time, extras.look);
	for (const obstacle of map.obstacles) {
		if (visible(camera, obstacle.x, obstacle.y, obstacle.r + 20)) drawObstacle(context, obstacle);
	}
	// Drones fly above the cover
	for (const enemy of state.enemies) {
		if (enemy.flying && visible(camera, enemy.x, enemy.y, enemy.radius + 30))
			drawEnemy(context, enemy, state.mapId, time);
	}
	for (const drone of state.drones) drawFriendlyDrone(context, drone, time);
	for (const bullet of state.bullets) drawBullet(context, bullet, time);
	for (const bullet of state.enemyBullets) {
		circle(context, bullet.x, bullet.y, bullet.big ? 8 : 6, '#ff6a2b', 2.5);
		circle(context, bullet.x - 1.5, bullet.y - 1.5, 2, YELLOW, 0);
	}
	for (const shell of state.shells) drawShell(context, shell);
	// Dust devils are tall: drawn over whoever they hold
	for (const tornado of state.tornadoes) {
		if (visible(camera, tornado.x, tornado.y - 50, 90)) drawTornado(context, tornado, time);
	}
	for (const grenade of state.grenades)
		drawGrenade(context, grenade.fromX, grenade.fromY, grenade.x, grenade.y, grenade.ageMs);
	for (const enemy of state.enemies) {
		if (visible(camera, enemy.x, enemy.y, enemy.radius + 40)) drawEnemyBar(context, enemy);
	}
	if (state.defense) drawPostBar(context, state.defense.objective);
	drawPlayerTag(context, state);
	if (state.player.stunMs > 0) drawStun(context, state, time);
	for (const effect of extras.effects) drawEffect(context, effect);
}

/** A dust devil: a swaying funnel of sand with streaks spinning round it and grit flying up */
function drawTornado(context: CanvasRenderingContext2D, tornado: Tornado, time: number) {
	const { x, y } = tornado;
	const grow = Math.min(1, tornado.ageMs / 600);
	const fade = tornado.captives.length > 0
		? 1
		: Math.min(grow, Math.max(0, (TORNADO_LIFE_MS - tornado.ageMs) / 1500));
	if (fade <= 0) return;
	context.save();
	// Dust whirling on the ground
	context.globalAlpha = 0.3 * fade;
	context.fillStyle = '#b08a4a';
	ellipse(context, x, y + 4, 34 * grow, 12 * grow);
	const layers = 7;
	for (let i = 0; i < layers; i++) {
		const t = i / (layers - 1);
		const sway = Math.sin(time / 260 + i * 0.7 + tornado.id) * 7 * t;
		const cy = y - t * 95 * grow;
		const rx = (7 + t * 30) * grow;
		const ry = rx * 0.32;
		context.globalAlpha = (0.7 - t * 0.25) * fade;
		context.fillStyle = i % 2 === 0 ? '#d9b56a' : '#c9a35d';
		ellipse(context, x + sway, cy, rx, ry);
		context.lineWidth = 2;
		context.strokeStyle = INK;
		context.stroke();
		// A streak of lighter sand spinning round this layer
		const start = (time / 90 + i * 1.3) % (Math.PI * 2);
		context.beginPath();
		context.ellipse(x + sway, cy, rx * 0.8, ry * 0.8, 0, start, start + 1.6);
		context.strokeStyle = '#fff3d0';
		context.lineWidth = 2.5;
		context.stroke();
	}
	// Grit flying up the funnel
	context.fillStyle = '#8a6a32';
	for (let i = 0; i < 7; i++) {
		const rise = (time / 7 + i * 15) % 95;
		const angle = time / 140 + i * 0.9;
		const reach = 10 + rise * 0.32;
		context.globalAlpha = fade * (1 - rise / 95);
		circle(
			context,
			x + Math.cos(angle) * reach,
			y - rise * grow + Math.sin(angle) * reach * 0.3,
			2.2,
			'#8a6a32',
			0
		);
	}
	context.restore();
}

/** The command post of a defense: sandbags around a bunker with an antenna and a flag */
function drawPost(
	context: CanvasRenderingContext2D,
	post: { x: number; y: number; hp: number; maxHp: number },
	time: number
) {
	const { x, y } = post;
	const r = OBJECTIVE_RADIUS;
	const hurt = post.hp / post.maxHp;
	// The ring enemies go for
	context.save();
	context.globalAlpha = 0.25;
	circle(context, x, y, r * 1.6, '#22c3b0', 0);
	context.globalAlpha = 1;
	context.setLineDash([10, 8]);
	context.lineDashOffset = -time / 40;
	context.beginPath();
	context.arc(x, y, r * 1.6, 0, Math.PI * 2);
	context.strokeStyle = '#22c3b0';
	context.lineWidth = 3;
	context.stroke();
	context.restore();
	// Sandbags
	for (let i = 0; i < 10; i++) {
		const angle = (i / 10) * Math.PI * 2;
		context.fillStyle = '#c9b07a';
		ellipse(context, x + Math.cos(angle) * r * 0.95, y + Math.sin(angle) * r * 0.95, 13, 8);
		context.lineWidth = 2.5;
		context.strokeStyle = INK;
		context.stroke();
	}
	// The bunker, darker the more it is hurt
	roundRect(
		context,
		x - r * 0.62,
		y - r * 0.5,
		r * 1.24,
		r * 1.0,
		8,
		hurt > 0.35 ? '#6d7c45' : '#5a4a3a'
	);
	roundRect(context, x - r * 0.4, y - r * 0.1, r * 0.8, r * 0.16, 3, INK, 0);
	// Antenna and flag
	context.beginPath();
	context.moveTo(x + r * 0.35, y - r * 0.5);
	context.lineTo(x + r * 0.35, y - r * 1.4);
	context.lineWidth = 3;
	context.strokeStyle = INK;
	context.stroke();
	const wave = Math.sin(time / 180) * 4;
	context.beginPath();
	context.moveTo(x + r * 0.35, y - r * 1.4);
	context.lineTo(x + r * 0.35 + 26, y - r * 1.3 + wave);
	context.lineTo(x + r * 0.35, y - r * 1.15);
	context.closePath();
	context.fillStyle = '#22c3b0';
	context.fill();
	context.lineWidth = 2;
	context.stroke();
	if (hurt <= 0.35) drawFlames(context, x - r * 0.2, y - r * 0.3, 16, time);
}

/** The command post's health over it */
function drawPostBar(
	context: CanvasRenderingContext2D,
	post: { x: number; y: number; hp: number; maxHp: number }
) {
	const width = 96;
	const left = post.x - width / 2;
	const top = post.y - OBJECTIVE_RADIUS * 1.5 - 18;
	const share = Math.max(0, Math.min(1, post.hp / post.maxHp));
	roundRect(context, left, top, width, 12, 4, INK, 0);
	context.fillStyle = share > 0.35 ? '#22c3b0' : RED;
	context.fillRect(left + 2, top + 2, (width - 4) * share, 8);
}

/** Warcry: a red aura and shouting arcs around the player while it lasts */
function drawWarcry(context: CanvasRenderingContext2D, state: RaidState, time: number) {
	const { player } = state;
	const pulse = 1 + Math.sin(time / 120) * 0.08;
	context.save();
	context.globalAlpha = 0.25;
	circle(context, player.x, player.y, 44 * pulse, '#e5484d', 0);
	context.globalAlpha = 0.8;
	for (let i = 0; i < 3; i++) {
		const reach = 30 + ((time / 8 + i * 14) % 42);
		context.globalAlpha = 0.8 * (1 - (reach - 30) / 42);
		context.beginPath();
		context.arc(player.x, player.y, reach, -Math.PI * 0.85, -Math.PI * 0.15);
		context.strokeStyle = '#e5484d';
		context.lineWidth = 3;
		context.stroke();
	}
	context.restore();
}

/** Stunned (an overheated flamethrower): stars circle over the player's head */
function drawStun(context: CanvasRenderingContext2D, state: RaidState, time: number) {
	const { player } = state;
	const fade = Math.min(1, player.stunMs / (OVERHEAT_STUN_MS * 0.25));
	context.save();
	context.globalAlpha = fade;
	for (let i = 0; i < 3; i++) {
		const angle = time / 180 + (i * Math.PI * 2) / 3;
		drawStar(
			context,
			player.x + 9 + Math.cos(angle) * 20,
			player.y - 68 + Math.sin(angle) * 6,
			7,
			YELLOW
		);
	}
	context.restore();
}

// ---------------------------------------------------------------------------------------------
// Primitives

function ellipse(context: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
	context.beginPath();
	context.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
	context.fill();
}

function circle(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	fill: string,
	stroke = 3
) {
	context.beginPath();
	context.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
	context.fillStyle = fill;
	context.fill();
	if (stroke > 0) {
		context.lineWidth = stroke;
		context.strokeStyle = INK;
		context.stroke();
	}
}

function roundRect(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
	fill: string,
	stroke = 3
) {
	context.beginPath();
	context.roundRect(x, y, w, h, r);
	context.fillStyle = fill;
	context.fill();
	if (stroke > 0) {
		context.lineWidth = stroke;
		context.strokeStyle = INK;
		context.stroke();
	}
}

function eyes(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	facing: number,
	gap: number,
	size: number,
	angry = true
) {
	const fx = Math.cos(facing);
	const fy = Math.sin(facing);
	const px = -fy;
	const py = fx;
	for (const side of [-1, 1]) {
		const ex = x + fx * size * 1.2 + px * gap * side;
		const ey = y + fy * size * 1.2 + py * gap * side;
		circle(context, ex, ey, size, PAPER, 1.5);
		circle(context, ex + fx * size * 0.35, ey + fy * size * 0.35, size * 0.5, INK, 0);
		if (angry) {
			context.beginPath();
			context.moveTo(ex - px * size * side - fx * size, ey - py * size * side - fy * size);
			context.lineTo(
				ex + px * size * side * 0.6 - fx * size * 1.6,
				ey + py * size * side * 0.6 - fy * size * 1.6
			);
			context.lineWidth = 2;
			context.strokeStyle = INK;
			context.stroke();
		}
	}
}

/** Draws in a frame rotated to face a direction, with x pointing forward */
function facingFrame(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	angle: number,
	draw: () => void
) {
	context.save();
	context.translate(x, y);
	context.rotate(angle);
	draw();
	context.restore();
}

// ---------------------------------------------------------------------------------------------
// Ground and cover

function drawDecor(context: CanvasRenderingContext2D, decor: Decor, mapId: MapId) {
	const { x, y, size, seed } = decor;
	switch (decor.kind) {
		case 'mud':
			context.fillStyle = 'rgba(110, 90, 50, 0.35)';
			ellipse(context, x, y, size, size * 0.6);
			break;
		case 'oil':
			context.fillStyle = 'rgba(25, 20, 30, 0.75)';
			ellipse(context, x, y, size, size * 0.55);
			context.fillStyle = 'rgba(150, 120, 255, 0.35)';
			ellipse(context, x - size * 0.3, y - size * 0.15, size * 0.3, size * 0.12);
			break;
		case 'dune':
		case 'drift':
			context.strokeStyle =
				decor.kind === 'dune' ? 'rgba(160, 120, 60, 0.4)' : 'rgba(120, 160, 190, 0.45)';
			context.lineWidth = 3;
			for (let i = 0; i < 3; i++) {
				context.beginPath();
				context.arc(x, y + i * 12, size * (1 - i * 0.2), Math.PI * 1.15, Math.PI * 1.85);
				context.stroke();
			}
			break;
		case 'crack':
			context.strokeStyle = 'rgba(90, 130, 160, 0.6)';
			context.lineWidth = 2;
			context.beginPath();
			context.moveTo(x - size / 2, y);
			context.lineTo(x - size / 6, y + ((seed % 7) - 3) * 3);
			context.lineTo(x + size / 6, y - 6);
			context.lineTo(x + size / 2, y + 4);
			context.moveTo(x - size / 6, y + ((seed % 7) - 3) * 3);
			context.lineTo(x - size / 8, y + size / 3);
			context.stroke();
			break;
		case 'crater': {
			const dark = mapId === 'arctic' ? 'rgba(80, 100, 120, 0.3)' : 'rgba(60, 45, 20, 0.35)';
			context.fillStyle = dark;
			ellipse(context, x, y, size, size * 0.75);
			context.fillStyle = 'rgba(0, 0, 0, 0.18)';
			ellipse(context, x + size * 0.1, y + size * 0.1, size * 0.6, size * 0.45);
			break;
		}
		case 'tracks':
			context.strokeStyle = 'rgba(80, 110, 140, 0.35)';
			context.lineWidth = 7;
			context.setLineDash([6, 8]);
			context.beginPath();
			context.moveTo(x - size, y - 10);
			context.lineTo(x + size, y + (seed % 40) - 30);
			context.moveTo(x - size, y + 14);
			context.lineTo(x + size, y + (seed % 40) - 6);
			context.stroke();
			context.setLineDash([]);
			break;
		case 'grass':
			context.strokeStyle = '#6e8a32';
			context.lineWidth = 2.5;
			context.beginPath();
			for (let i = -1; i <= 1; i++) {
				context.moveTo(x + i * 4, y);
				context.lineTo(x + i * 6, y - size);
			}
			context.stroke();
			break;
		case 'shell':
			context.fillStyle = 'rgba(150, 110, 60, 0.6)';
			ellipse(context, x, y, size * 0.5, size * 0.3);
			break;
		case 'sunflowers': {
			const count = 3 + (seed % 4);
			for (let i = 0; i < count; i++) {
				const angle = (i / count) * Math.PI * 2 + seed;
				const fx = x + Math.cos(angle) * size * 0.45;
				const fy = y + Math.sin(angle) * size * 0.35;
				circle(context, fx, fy, 11, YELLOW, 2);
				circle(context, fx, fy, 5, '#5a3a1a', 0);
			}
			break;
		}
	}
}

function drawObstacle(context: CanvasRenderingContext2D, obstacle: Obstacle) {
	const { x, y, r, seed } = obstacle;
	switch (obstacle.kind) {
		case 'tree':
			circle(context, x, y, r, '#4f7d2c');
			circle(context, x - r * 0.3, y - r * 0.3, r * 0.55, '#6a9c3a', 0);
			circle(context, x + r * 0.35, y + r * 0.1, r * 0.35, '#5d8f33', 0);
			break;
		case 'pine':
			for (let layer = 0; layer < 3; layer++) {
				const radius = r * (1 - layer * 0.28);
				context.beginPath();
				for (let i = 0; i < 8; i++) {
					const angle = (i / 8) * Math.PI * 2 + layer * 0.4;
					const reach = i % 2 === 0 ? radius : radius * 0.7;
					context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
				}
				context.closePath();
				context.fillStyle = layer === 2 ? '#f4f9ff' : layer === 1 ? '#2f6b4f' : '#245a41';
				context.fill();
				context.lineWidth = 3;
				context.strokeStyle = INK;
				context.stroke();
			}
			break;
		case 'palm':
			for (let i = 0; i < 6; i++) {
				const angle = (i / 6) * Math.PI * 2 + seed;
				context.beginPath();
				context.ellipse(
					x + Math.cos(angle) * r * 0.55,
					y + Math.sin(angle) * r * 0.55,
					r * 0.6,
					r * 0.22,
					angle,
					0,
					Math.PI * 2
				);
				context.fillStyle = i % 2 ? '#3f8f3a' : '#55a845';
				context.fill();
				context.lineWidth = 2.5;
				context.strokeStyle = INK;
				context.stroke();
			}
			circle(context, x, y, r * 0.25, '#8a5a2b');
			break;
		case 'haybale':
			circle(context, x, y, r, '#e3b94a');
			context.strokeStyle = '#a77d24';
			context.lineWidth = 2;
			for (let ring = 0.3; ring < 1; ring += 0.25) {
				context.beginPath();
				context.arc(x, y, r * ring, 0, Math.PI * 2);
				context.stroke();
			}
			break;
		case 'rock':
		case 'iceblock': {
			const sides = 7;
			context.beginPath();
			for (let i = 0; i < sides; i++) {
				const angle = (i / sides) * Math.PI * 2 + seed;
				const reach = r * (0.88 + ((seed * (i + 3)) % 13) / 100);
				context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
			}
			context.closePath();
			context.fillStyle = obstacle.kind === 'rock' ? '#9a958c' : '#bfe6fa';
			context.fill();
			context.lineWidth = 3;
			context.strokeStyle = INK;
			context.stroke();
			context.fillStyle = obstacle.kind === 'rock' ? '#b8b3a8' : '#ecf9ff';
			ellipse(context, x - r * 0.25, y - r * 0.3, r * 0.35, r * 0.2);
			break;
		}
		case 'wreck':
			facingFrame(context, x, y, (seed % 6) * 0.5, () => {
				roundRect(context, -r, -r * 0.7, r * 2, r * 1.4, 10, '#6b6f5a');
				roundRect(context, -r * 1.05, -r * 0.85, r * 2.1, r * 0.3, 6, '#3d4033');
				roundRect(context, -r * 1.05, r * 0.55, r * 2.1, r * 0.3, 6, '#3d4033');
				circle(context, -r * 0.1, 0, r * 0.45, '#585c49');
				// The bent barrel
				context.beginPath();
				context.moveTo(r * 0.3, 0);
				context.quadraticCurveTo(r * 0.9, -r * 0.1, r * 1.1, r * 0.5);
				context.lineWidth = 9;
				context.strokeStyle = INK;
				context.stroke();
				context.lineWidth = 5;
				context.strokeStyle = '#585c49';
				context.stroke();
			});
			break;
		case 'barrels':
			for (let i = 0; i < 3; i++) {
				const angle = (i / 3) * Math.PI * 2 + seed;
				const bx = x + Math.cos(angle) * r * 0.45;
				const by = y + Math.sin(angle) * r * 0.45;
				circle(context, bx, by, r * 0.5, i === 1 ? '#2f6fb3' : '#c43c2c');
				circle(context, bx, by, r * 0.22, 'rgba(0,0,0,0.25)', 1.5);
			}
			break;
		case 'derrick':
			roundRect(context, x - r, y - r, r * 2, r * 2, 6, '#8a8f99');
			context.strokeStyle = INK;
			context.lineWidth = 4;
			context.beginPath();
			context.moveTo(x - r, y - r);
			context.lineTo(x + r, y + r);
			context.moveTo(x + r, y - r);
			context.lineTo(x - r, y + r);
			context.stroke();
			circle(context, x, y, r * 0.35, '#2b2b2b');
			circle(context, x, y, r * 0.15, YELLOW, 2);
			break;
		case 'crates': {
			const size = r * 0.95;
			for (const [dx, dy] of [
				[-0.5, -0.5],
				[0.5, -0.4],
				[0, 0.5]
			]) {
				roundRect(
					context,
					x + dx * size - size / 2,
					y + dy * size - size / 2,
					size,
					size,
					3,
					'#b07a3c'
				);
				context.strokeStyle = '#6b4520';
				context.lineWidth = 2;
				context.beginPath();
				context.moveTo(x + dx * size - size / 2, y + dy * size - size / 2);
				context.lineTo(x + dx * size + size / 2, y + dy * size + size / 2);
				context.stroke();
			}
			break;
		}
		case 'radar':
			circle(context, x, y, r, '#f2f5f8');
			context.strokeStyle = '#9fb3c4';
			context.lineWidth = 2;
			for (let i = 0; i < 6; i++) {
				context.beginPath();
				context.ellipse(x, y, r * 0.95, r * (0.15 + i * 0.15), 0, 0, Math.PI * 2);
				context.stroke();
			}
			circle(context, x, y, r * 0.12, RED, 2);
			break;
	}
}

// ---------------------------------------------------------------------------------------------
// Player

const WEAPON_LOOK: Record<WeaponKind, { length: number; width: number; color: string }> = {
	rifle: { length: 30, width: 6, color: '#3b3f2f' },
	marksman: { length: 42, width: 5, color: '#2a2f3a' },
	shotgun: { length: 26, width: 9, color: '#6b4520' },
	smg: { length: 22, width: 7, color: '#2b2b2b' },
	launcher: { length: 36, width: 12, color: '#55603a' },
	flamethrower: { length: 30, width: 10, color: '#8a2f1f' },
	dronenest: { length: 16, width: 14, color: '#4a5a6a' },
	hammer: { length: 34, width: 6, color: '#6b4a2a' }
};

function drawPlayer(
	context: CanvasRenderingContext2D,
	state: RaidState,
	time: number,
	agent: RaiderLook | undefined
) {
	const { player, loadout } = state;
	if (player.invulnerableMs > 0 && Math.floor(time / 90) % 2 === 0) context.globalAlpha = 0.55;
	const bob = player.moving ? Math.sin(player.stepPhase) * 2 : 0;
	const x = player.x;
	const y = player.y + bob;
	const weapon = loadout[player.held];
	const look = WEAPON_LOOK[weapon.kind];

	// Skill cues: speed lines while dashing, an orange glow in overdrive
	if (player.dashMs > 0) {
		context.strokeStyle = 'rgba(17, 17, 17, 0.45)';
		context.lineWidth = 3;
		context.beginPath();
		for (const side of [-10, 0, 10]) {
			const sx = x - player.dashY * side;
			const sy = y + player.dashX * side;
			context.moveTo(sx - player.dashX * 26, sy - player.dashY * 26);
			context.lineTo(sx - player.dashX * 60, sy - player.dashY * 60);
		}
		context.stroke();
	}
	if (player.overdriveMs > 0) {
		context.globalAlpha = 0.35 + Math.sin(time / 70) * 0.1;
		circle(context, x, y, PLAYER_RADIUS + 12, '#ff8a2b', 0);
		context.globalAlpha = player.invulnerableMs > 0 && Math.floor(time / 90) % 2 === 0 ? 0.55 : 1;
	}

	// Boots, in the colour of their rarity when worn; fire boots glow
	const boots = loadout.boots;
	const swing = player.moving ? Math.sin(player.stepPhase) * 6 : 0;
	const bootColor = boots ? RARITY_COLOR[boots.rarity] : '#3b2a1a';
	if (perkOf(boots) === 'trail') {
		context.globalAlpha = 0.5 + Math.sin(time / 60) * 0.2;
		circle(context, x - 7, y + 17 + swing, 6, '#ff8a2b', 0);
		circle(context, x + 7, y + 17 - swing, 6, '#ff8a2b', 0);
		context.globalAlpha = 1;
	}
	if (player.moving || boots) {
		circle(context, x - 7, y + 14 + swing, 5, bootColor, 2);
		circle(context, x + 7, y + 14 - swing, 5, bootColor, 2);
	}
	// Spiked vest: a ring of spikes around the body
	if (perkOf(loadout.vest) === 'spikes') {
		context.fillStyle = '#c9ced4';
		context.strokeStyle = INK;
		context.lineWidth = 1.5;
		for (let i = 0; i < 10; i++) {
			const angle = (i / 10) * Math.PI * 2;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			context.beginPath();
			context.moveTo(x + cos * (PLAYER_RADIUS + 8), y + sin * (PLAYER_RADIUS + 8));
			context.lineTo(x + cos * PLAYER_RADIUS - sin * 4, y + sin * PLAYER_RADIUS + cos * 4);
			context.lineTo(x + cos * PLAYER_RADIUS + sin * 4, y + sin * PLAYER_RADIUS - cos * 4);
			context.closePath();
			context.fill();
			context.stroke();
		}
	}
	facingFrame(context, x, y, player.aim, () => {
		roundRect(context, 4, -look.width / 2 + 6, look.length, look.width, 2, look.color, 2.5);
		if (weapon.rarity !== 'common') {
			context.fillStyle = RARITY_COLOR[weapon.rarity];
			context.fillRect(8, 6 - look.width / 2 + 1, 6, look.width - 2);
		}
	});
	circle(context, x, y, PLAYER_RADIUS, agent?.shirt ?? '#7c8c5c');
	if (loadout.vest) {
		context.save();
		context.beginPath();
		context.arc(x, y, PLAYER_RADIUS - 1.5, 0, Math.PI * 2);
		context.clip();
		context.fillStyle = RARITY_COLOR[loadout.vest.rarity];
		context.fillRect(x - PLAYER_RADIUS, y - 2, PLAYER_RADIUS * 2, 8);
		context.restore();
	}
	// Face towards the aim, helmet on top
	circle(
		context,
		x + Math.cos(player.aim) * 3,
		y - 4 + Math.sin(player.aim) * 2,
		11,
		agent?.skin ?? '#f6c9a0',
		2.5
	);
	// A worn helmet always shows; bareheaded, the agent's own hair does (or nothing when bald)
	const capColor = loadout.helmet
		? RARITY_COLOR[loadout.helmet.rarity]
		: agent
			? agent.hair
			: '#556b2f';
	if (capColor) {
		context.beginPath();
		context.arc(x, y - 7, 13, Math.PI * 1.05, Math.PI * 1.95);
		context.closePath();
		context.fillStyle = capColor;
		context.fill();
		context.lineWidth = 2.5;
		context.strokeStyle = INK;
		context.stroke();
	}
	eyes(context, x, y - 4, player.aim, 4, 2.6, false);
	context.globalAlpha = 1;

	// Jammer helmet: an antenna, and a faint ring showing its reach
	if (perkOf(loadout.helmet) === 'jammer') {
		context.strokeStyle = INK;
		context.lineWidth = 2;
		context.beginPath();
		context.moveTo(x + 6, y - 17);
		context.lineTo(x + 12, y - 32);
		context.stroke();
		circle(context, x + 12, y - 32, 3, player.jammerMs > 0 ? '#5a1a1a' : RED, 1.5);
		context.beginPath();
		context.arc(x, y, JAMMER_RADIUS, 0, Math.PI * 2);
		context.setLineDash([3, 12]);
		context.lineDashOffset = time / 40;
		context.lineWidth = 2;
		context.strokeStyle = 'rgba(61, 201, 245, 0.35)';
		context.stroke();
		context.setLineDash([]);
	}

	// Focus: a red crosshair over the head with one dot per certain crit left
	if (player.focusShots > 0) {
		const cy = y - PLAYER_RADIUS - 16;
		context.strokeStyle = RED;
		context.lineWidth = 2.5;
		context.beginPath();
		context.arc(x, cy, 8, 0, Math.PI * 2);
		context.moveTo(x - 12, cy);
		context.lineTo(x + 12, cy);
		context.moveTo(x, cy - 12);
		context.lineTo(x, cy + 12);
		context.stroke();
		for (let i = 0; i < player.focusShots; i++) {
			circle(context, x - 8 + i * 8, cy - 18, 3, RED, 1.5);
		}
	}

	if (player.invulnerableMs > 0) {
		context.beginPath();
		context.arc(x, y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
		context.strokeStyle = 'rgba(79, 168, 216, 0.8)';
		context.lineWidth = 4;
		context.stroke();
	}
}

// ---------------------------------------------------------------------------------------------
// Enemies

const AURA: Record<'super' | 'mega', string> = { super: '#ffd23a', mega: '#ff2d55' };

function drawEnemy(context: CanvasRenderingContext2D, enemy: Enemy, mapId: MapId, time: number) {
	if (enemy.variant !== 'normal') {
		const pulse = 1 + Math.sin(time / 160 + enemy.id) * 0.06;
		context.save();
		context.globalAlpha = 0.35;
		circle(context, enemy.x, enemy.y, enemy.radius * 1.45 * pulse, AURA[enemy.variant], 0);
		context.globalAlpha = 1;
		context.setLineDash([8, 6]);
		context.lineDashOffset = -time / 30;
		context.beginPath();
		context.arc(enemy.x, enemy.y, enemy.radius * 1.3, 0, Math.PI * 2);
		context.strokeStyle = AURA[enemy.variant];
		context.lineWidth = enemy.variant === 'mega' ? 5 : 3.5;
		context.stroke();
		context.restore();
	}
	const flash = enemy.flashMs > 0;
	if (enemy.archetype === 'pion') drawElitePion(context, enemy, flash, time);
	else if (SUPPORT.includes(enemy.archetype)) drawSupport(context, enemy, mapId, flash, time);
	else drawCast(context, enemy, mapId, flash);
	if (enemy.burnMs > 0) {
		drawFlames(context, enemy.x, enemy.y - enemy.radius * 0.3, enemy.radius, time + enemy.id * 77);
	}
}

/** Small flickering flames over something burning */
function drawFlames(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	time: number
) {
	for (let i = 0; i < 3; i++) {
		const fx = x + (i - 1) * r * 0.55;
		const flicker = 1 + Math.sin(time / 70 + i * 2.1) * 0.25;
		const h = r * 0.75 * flicker * (i === 1 ? 1.3 : 1);
		const w = r * 0.32;
		context.beginPath();
		context.moveTo(fx - w, y);
		context.quadraticCurveTo(fx - w, y - h * 0.6, fx, y - h);
		context.quadraticCurveTo(fx + w, y - h * 0.6, fx + w, y);
		context.closePath();
		context.fillStyle = '#ff6a1a';
		context.fill();
		// Thin outlines on small flames, or they turn into dark ticks
		context.lineWidth = Math.min(1.5, r * 0.07);
		context.strokeStyle = INK;
		context.stroke();
		context.beginPath();
		context.moveTo(fx - w * 0.5, y);
		context.quadraticCurveTo(fx, y - h * 0.7, fx + w * 0.5, y);
		context.fillStyle = YELLOW;
		context.fill();
	}
}

const SUPPORT: readonly Enemy['archetype'][] = ['drone', 'medic', 'mortar', 'artillery'];

/** Camouflage of the enemies that turn up on every map */
const CAMO: Record<MapId, { main: string; dark: string }> = {
	sunflower: { main: '#6d7c45', dark: '#4b5a2e' },
	strait: { main: '#c9a35d', dark: '#8a6a32' },
	arctic: { main: '#e6eef5', dark: '#9fb3c4' }
};

/** A medic glows for a moment after each healing pulse */
const HEAL_GLOW_MS = 2200;

/** Kamikaze drones, medics, mortar crews and Pion guns, in each map's camouflage */
function drawSupport(
	context: CanvasRenderingContext2D,
	enemy: Enemy,
	mapId: MapId,
	flash: boolean,
	time: number
) {
	const { x, y, radius: r, facing } = enemy;
	const camo = CAMO[mapId];
	switch (enemy.archetype) {
		case 'drone': {
			const wobble = enemy.jammed ? Math.sin(time / 40) * 0.6 : 0;
			facingFrame(context, x, y, facing + wobble, () => {
				context.lineWidth = 3;
				context.strokeStyle = INK;
				for (const [dx, dy] of [
					[-1, -1],
					[1, -1],
					[-1, 1],
					[1, 1]
				]) {
					context.beginPath();
					context.moveTo(0, 0);
					context.lineTo(dx * r * 0.9, dy * r * 0.9);
					context.stroke();
					// Spinning props
					context.globalAlpha = 0.55;
					context.beginPath();
					context.ellipse(
						dx * r * 0.9,
						dy * r * 0.9,
						r * 0.55,
						r * 0.18,
						enemy.phase + dx,
						0,
						Math.PI * 2
					);
					context.fillStyle = '#d8dde2';
					context.fill();
					context.globalAlpha = 1;
				}
				roundRect(context, -r * 0.5, -r * 0.35, r * 1.1, r * 0.7, 4, tint(flash, '#3d3d3d'), 2);
				// The warhead strapped under it, pointing forward
				roundRect(
					context,
					r * 0.4,
					-r * 0.22,
					r * 0.75,
					r * 0.44,
					r * 0.22,
					tint(flash, camo.dark),
					2
				);
				const lit = Math.floor(time / 120 + enemy.id) % 2 === 0;
				circle(context, -r * 0.2, 0, r * 0.14, lit ? RED : '#5a1a1a', 0);
			});
			if (enemy.jammed) {
				// Sparks: it has lost its link
				context.strokeStyle = '#3dc9f5';
				context.lineWidth = 2.5;
				context.beginPath();
				context.moveTo(x - r, y - r * 1.2);
				context.lineTo(x - r * 0.3, y - r * 0.8);
				context.lineTo(x - r * 0.1, y - r * 1.4);
				context.lineTo(x + r * 0.6, y - r);
				context.stroke();
			}
			break;
		}
		case 'medic':
			if (enemy.attackMs > HEAL_GLOW_MS) {
				context.globalAlpha = 0.25;
				circle(context, x, y, MEDIC_HEAL_RADIUS * 0.35, '#5bd16b', 0);
				context.globalAlpha = 1;
			}
			facingFrame(context, x, y, facing, () => {
				roundRect(context, -r * 1.05, -r * 0.55, r * 0.6, r * 1.1, 4, tint(flash, PAPER), 2);
				context.fillStyle = RED;
				context.fillRect(-r * 0.95, -r * 0.1, r * 0.4, r * 0.2);
				context.fillRect(-r * 0.85, -r * 0.3, r * 0.2, r * 0.6);
			});
			circle(context, x, y, r, tint(flash, camo.main));
			circle(context, x, y - r * 0.45, r * 0.55, tint(flash, PAPER), 2);
			context.fillStyle = RED;
			context.fillRect(x - r * 0.08, y - r * 0.8, r * 0.16, r * 0.5);
			context.fillRect(x - r * 0.25, y - r * 0.63, r * 0.5, r * 0.16);
			eyes(context, x, y + r * 0.2, facing, r * 0.3, r * 0.18);
			break;
		case 'mortar': {
			// Base plate and tube towards the player, the crewman behind it
			facingFrame(context, x, y, facing, () => {
				circle(context, r * 0.7, 0, r * 0.45, '#5a5a5a', 2);
				roundRect(context, r * 0.3, -r * 0.2, r * 1.2, r * 0.4, 3, tint(flash, camo.dark), 2);
				circle(context, r * 1.5, 0, r * 0.22, INK, 0);
			});
			const bx = x - Math.cos(facing) * r * 0.3;
			const by = y - Math.sin(facing) * r * 0.3;
			circle(context, bx, by, r * 0.8, tint(flash, camo.main));
			context.beginPath();
			context.arc(bx, by - r * 0.15, r * 0.75, Math.PI, Math.PI * 2);
			context.fillStyle = tint(flash, camo.dark);
			context.fill();
			context.lineWidth = 2;
			context.strokeStyle = INK;
			context.stroke();
			eyes(context, bx, by + r * 0.05, facing, r * 0.25, r * 0.16);
			break;
		}
		case 'artillery':
			// The Pion: tracks, a hull, a turret and a very long gun
			facingFrame(context, x, y, facing, () => {
				roundRect(context, -r * 1.1, -r * 0.95, r * 2, r * 0.32, 6, '#2f3324');
				roundRect(context, -r * 1.1, r * 0.63, r * 2, r * 0.32, 6, '#2f3324');
				roundRect(context, -r, -r * 0.7, r * 1.8, r * 1.4, 8, tint(flash, camo.main));
				roundRect(context, -r * 0.2, -r * 0.13, r * 2.6, r * 0.26, 3, tint(flash, camo.dark));
				roundRect(context, r * 2.2, -r * 0.2, r * 0.35, r * 0.4, 2, tint(flash, camo.dark), 2);
				roundRect(context, -r * 0.7, -r * 0.5, r * 0.9, r, 6, tint(flash, camo.dark));
			});
			eyes(
				context,
				x - Math.cos(facing) * r * 0.25,
				y - Math.sin(facing) * r * 0.25,
				facing,
				r * 0.2,
				r * 0.12
			);
			break;
	}
	if (enemy.variant === 'mega') drawCrown(context, x + r * 0.7, y - r * 0.9, r * 0.25, RED);
}

/** The elite Pion: a heavy tank in steel grey with orange elite markings, glowing orange */
function drawElitePion(
	context: CanvasRenderingContext2D,
	enemy: Enemy,
	flash: boolean,
	time: number
) {
	const { x, y, radius: r, facing } = enemy;
	const pulse = 1 + Math.sin(time / 200 + enemy.id) * 0.07;
	context.save();
	context.globalAlpha = 0.28;
	circle(context, x, y, r * 1.55 * pulse, ELITE, 0);
	context.globalAlpha = 1;
	context.setLineDash([10, 7]);
	context.lineDashOffset = -time / 25;
	context.beginPath();
	context.arc(x, y, r * 1.35, 0, Math.PI * 2);
	context.strokeStyle = ELITE;
	context.lineWidth = 4;
	context.stroke();
	context.restore();
	facingFrame(context, x, y, facing, () => {
		// Tracks with their links
		for (const side of [-1, 1]) {
			const top = side < 0 ? -r * 1.0 : r * 0.6;
			roundRect(context, -r * 1.05, top, r * 2.1, r * 0.4, 7, '#26282c');
			context.fillStyle = '#4a4d52';
			for (let i = 0; i < 7; i++) {
				const link = ((i * r * 0.3 + time / 20) % (r * 2.1)) - r * 1.05;
				context.fillRect(link, top + 3, 3, r * 0.4 - 6);
			}
		}
		// The hull, with an orange chevron on the front
		roundRect(context, -r * 0.95, -r * 0.66, r * 1.9, r * 1.32, 9, tint(flash, '#555b63'));
		context.beginPath();
		context.moveTo(r * 0.45, -r * 0.55);
		context.lineTo(r * 0.85, 0);
		context.lineTo(r * 0.45, r * 0.55);
		context.lineWidth = 6;
		context.strokeStyle = flash ? PAPER : ELITE;
		context.stroke();
		// The turret and its thick gun with a muzzle brake
		roundRect(context, r * 0.2, -r * 0.15, r * 1.55, r * 0.3, 3, tint(flash, '#3b4047'));
		roundRect(context, r * 1.7, -r * 0.24, r * 0.34, r * 0.48, 2, tint(flash, ELITE), 2);
		roundRect(context, -r * 0.55, -r * 0.48, r * 0.95, r * 0.96, r * 0.3, tint(flash, '#454a52'));
		circle(context, -r * 0.1, 0, r * 0.16, flash ? PAPER : ELITE, 2);
	});
	eyes(
		context,
		x - Math.cos(facing) * r * 0.1,
		y - Math.sin(facing) * r * 0.1 - r * 0.15,
		facing,
		r * 0.2,
		r * 0.12
	);
}

/** Picks the fill colour, or white while hit */
const tint = (flash: boolean, color: string) => (flash ? PAPER : color);

function drawCast(context: CanvasRenderingContext2D, enemy: Enemy, mapId: MapId, flash: boolean) {
	const { x, y, radius: r, facing } = enemy;
	const wobble = Math.sin(enemy.phase) * 0.12;
	const key = `${mapId}:${enemy.archetype}` as const;
	switch (key) {
		// Sunflower front: helmeted grunts, buzzing quad drones, shovel brutes, mortar crews, a
		// crowned tank
		case 'sunflower:grunt':
			circle(context, x, y, r, tint(flash, '#8c9b6a'));
			context.beginPath();
			context.arc(x, y - r * 0.2, r * 0.95, Math.PI, Math.PI * 2);
			context.fillStyle = tint(flash, '#4b5a2e');
			context.fill();
			context.lineWidth = 2.5;
			context.strokeStyle = INK;
			context.stroke();
			eyes(context, x, y + r * 0.1, facing, r * 0.32, r * 0.2);
			break;
		case 'sunflower:fast':
			// A sprinting scout with a red armband
			circle(context, x, y, r, tint(flash, '#a3a37a'));
			context.fillStyle = tint(flash, RED);
			ellipse(context, x - r * 0.75, y + r * 0.1, r * 0.3, r * 0.42);
			context.beginPath();
			context.arc(x, y - r * 0.15, r * 0.9, Math.PI * 1.1, Math.PI * 1.9);
			context.fillStyle = tint(flash, '#4b5a2e');
			context.fill();
			context.lineWidth = 2;
			context.strokeStyle = INK;
			context.stroke();
			eyes(context, x, y + r * 0.1, facing, r * 0.32, r * 0.22);
			break;
		case 'sunflower:heavy':
			facingFrame(context, x, y, facing, () => {
				roundRect(context, r * 0.4, r * 0.5, r * 1.1, r * 0.2, 2, '#7a5a30', 2);
				roundRect(context, r * 1.3, r * 0.3, r * 0.4, r * 0.6, 3, '#9aa0a6', 2);
			});
			circle(context, x, y, r, tint(flash, '#7d6b55'));
			circle(context, x - r * 0.4, y - r * 0.55, r * 0.35, tint(flash, '#6a5a46'), 2);
			circle(context, x + r * 0.4, y - r * 0.55, r * 0.35, tint(flash, '#6a5a46'), 2);
			eyes(context, x, y, facing, r * 0.3, r * 0.17);
			break;
		case 'sunflower:ranged':
			facingFrame(context, x, y, facing, () => {
				roundRect(context, r * 0.3, -r * 0.3, r * 1.2, r * 0.6, 4, '#4b5a2e', 2);
			});
			circle(context, x, y, r, tint(flash, '#a3a37a'));
			context.fillStyle = tint(flash, '#c43c2c');
			ellipse(context, x, y - r * 0.55, r * 0.8, r * 0.35);
			eyes(context, x, y + r * 0.1, facing, r * 0.32, r * 0.2);
			break;
		case 'sunflower:boss':
			facingFrame(context, x, y, facing, () => {
				roundRect(context, -r * 1.1, -r * 0.95, r * 2.2, r * 0.35, 8, '#2f3324');
				roundRect(context, -r * 1.1, r * 0.6, r * 2.2, r * 0.35, 8, '#2f3324');
				roundRect(context, -r, -r * 0.75, r * 2, r * 1.5, 14, tint(flash, '#5d6b3a'));
				roundRect(context, r * 0.2, -r * 0.12, r * 1.3, r * 0.24, 4, '#3b4228');
				circle(context, -r * 0.1, 0, r * 0.5, tint(flash, '#6d7c45'));
			});
			drawCrown(context, x - r * 0.1, y - r * 0.55, r * 0.45);
			eyes(context, x - r * 0.1, y, facing, r * 0.18, r * 0.12);
			break;

		// Strait: oil blobs, sand scorpions, barrel golems, dune snipers, an oil kraken
		case 'strait:grunt':
			context.beginPath();
			context.ellipse(x, y, r * (1 + wobble), r * (1 - wobble), 0, 0, Math.PI * 2);
			context.fillStyle = tint(flash, '#1e1a24');
			context.fill();
			context.lineWidth = 3;
			context.strokeStyle = INK;
			context.stroke();
			context.fillStyle = 'rgba(170, 140, 255, 0.5)';
			ellipse(context, x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.14);
			eyes(context, x, y, facing, r * 0.32, r * 0.22);
			break;
		case 'strait:fast':
			facingFrame(context, x, y, facing, () => {
				context.lineWidth = 2.5;
				context.strokeStyle = INK;
				for (const side of [-1, 1]) {
					for (let leg = 0; leg < 3; leg++) {
						context.beginPath();
						context.moveTo(-r * 0.3 + leg * r * 0.4, side * r * 0.4);
						context.lineTo(-r * 0.5 + leg * r * 0.5, side * r * (1 + wobble));
						context.stroke();
					}
				}
				context.beginPath();
				context.moveTo(-r * 0.6, 0);
				context.quadraticCurveTo(-r * 1.6, 0, -r * 1.3, -r * 0.8);
				context.lineWidth = 4;
				context.stroke();
				context.beginPath();
				context.ellipse(0, 0, r * 0.75, r * 0.5, 0, 0, Math.PI * 2);
				context.fillStyle = tint(flash, '#c2783a');
				context.fill();
				context.lineWidth = 2.5;
				context.stroke();
			});
			circle(
				context,
				x + Math.cos(facing) * r * 0.45,
				y + Math.sin(facing) * r * 0.45,
				r * 0.16,
				INK,
				0
			);
			break;
		case 'strait:heavy':
			roundRect(context, x - r * 0.8, y - r, r * 1.6, r * 2, 10, tint(flash, '#2f6fb3'));
			context.strokeStyle = INK;
			context.lineWidth = 2;
			for (const band of [-0.5, 0.5]) {
				context.beginPath();
				context.moveTo(x - r * 0.8, y + band * r);
				context.lineTo(x + r * 0.8, y + band * r);
				context.stroke();
			}
			circle(context, x - r * 1, y, r * 0.35, tint(flash, '#2a5a90'), 2);
			circle(context, x + r * 1, y, r * 0.35, tint(flash, '#2a5a90'), 2);
			eyes(context, x, y - r * 0.15, facing, r * 0.3, r * 0.17);
			break;
		case 'strait:ranged':
			facingFrame(context, x, y, facing, () => {
				roundRect(context, r * 0.3, -r * 0.15, r * 1.6, r * 0.3, 2, '#3a2f22', 2);
			});
			circle(context, x, y, r, tint(flash, '#d8b77a'));
			context.fillStyle = tint(flash, '#f2efe6');
			ellipse(context, x, y - r * 0.2, r * 0.95, r * 0.6);
			context.lineWidth = 2;
			context.strokeStyle = INK;
			context.stroke();
			eyes(context, x, y + r * 0.05, facing, r * 0.3, r * 0.18);
			break;
		case 'strait:boss':
			for (let i = 0; i < 8; i++) {
				const angle = (i / 8) * Math.PI * 2 + Math.sin(enemy.phase + i) * 0.25;
				context.beginPath();
				context.moveTo(x + Math.cos(angle) * r * 0.6, y + Math.sin(angle) * r * 0.6);
				context.quadraticCurveTo(
					x + Math.cos(angle + 0.4) * r * 1.3,
					y + Math.sin(angle + 0.4) * r * 1.3,
					x + Math.cos(angle) * r * 1.55,
					y + Math.sin(angle) * r * 1.55
				);
				context.lineWidth = 13;
				context.strokeStyle = INK;
				context.stroke();
				context.lineWidth = 8;
				context.strokeStyle = tint(flash, '#3a2a4a');
				context.stroke();
			}
			circle(context, x, y, r, tint(flash, '#2a1f33'));
			context.fillStyle = 'rgba(170, 140, 255, 0.45)';
			ellipse(context, x - r * 0.35, y - r * 0.45, r * 0.35, r * 0.15);
			drawCrown(context, x, y - r * 0.7, r * 0.4);
			eyes(context, x, y, facing, r * 0.3, r * 0.17);
			break;

		// Arctic: penguin troopers, snowball drones, yetis, snowball throwers, the polar bear
		// icebreaker
		case 'arctic:grunt':
			context.beginPath();
			context.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
			context.fillStyle = tint(flash, '#1d2433');
			context.fill();
			context.lineWidth = 3;
			context.strokeStyle = INK;
			context.stroke();
			context.fillStyle = tint(flash, PAPER);
			ellipse(
				context,
				x + Math.cos(facing) * r * 0.25,
				y + Math.sin(facing) * r * 0.2 + r * 0.15,
				r * 0.55,
				r * 0.65
			);
			circle(
				context,
				x + Math.cos(facing) * r * 0.85,
				y + Math.sin(facing) * r * 0.6,
				r * 0.22,
				'#f5a623',
				1.5
			);
			eyes(context, x, y - r * 0.2, facing, r * 0.28, r * 0.18);
			break;
		case 'arctic:fast':
			// An arctic fox: bushy tail, pointed ears
			facingFrame(context, x, y, facing, () => {
				context.beginPath();
				context.ellipse(
					-r * 1.2,
					Math.sin(enemy.phase) * r * 0.3,
					r * 0.7,
					r * 0.35,
					0,
					0,
					Math.PI * 2
				);
				context.fillStyle = tint(flash, PAPER);
				context.fill();
				context.lineWidth = 2;
				context.strokeStyle = INK;
				context.stroke();
				for (const side of [-1, 1]) {
					context.beginPath();
					context.moveTo(r * 0.2, side * r * 0.4);
					context.lineTo(r * 0.5, side * r * 1.05);
					context.lineTo(r * 0.75, side * r * 0.35);
					context.closePath();
					context.fill();
					context.stroke();
				}
			});
			circle(context, x, y, r, tint(flash, '#f4f9ff'));
			circle(
				context,
				x + Math.cos(facing) * r * 0.9,
				y + Math.sin(facing) * r * 0.9,
				r * 0.18,
				INK,
				0
			);
			eyes(context, x, y, facing, r * 0.3, r * 0.2);
			break;
		case 'arctic:heavy':
			for (let i = 0; i < 10; i++) {
				const angle = (i / 10) * Math.PI * 2;
				circle(
					context,
					x + Math.cos(angle) * r * 0.8,
					y + Math.sin(angle) * r * 0.8,
					r * 0.35,
					tint(flash, '#e6eef5'),
					2
				);
			}
			circle(context, x, y, r * 0.9, tint(flash, '#f2f7fb'), 0);
			circle(
				context,
				x + Math.cos(facing) * r * 0.2,
				y + Math.sin(facing) * r * 0.2,
				r * 0.5,
				tint(flash, '#8fb3cc'),
				2
			);
			eyes(
				context,
				x + Math.cos(facing) * r * 0.2,
				y + Math.sin(facing) * r * 0.2 - r * 0.1,
				facing,
				r * 0.2,
				r * 0.13
			);
			break;
		case 'arctic:ranged':
			context.beginPath();
			context.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
			context.fillStyle = tint(flash, '#1d2433');
			context.fill();
			context.lineWidth = 3;
			context.strokeStyle = INK;
			context.stroke();
			// Ushanka
			roundRect(context, x - r * 0.9, y - r * 1.05, r * 1.8, r * 0.6, 6, tint(flash, '#8a5a2b'), 2);
			circle(context, x + Math.cos(facing) * r, y + Math.sin(facing) * r, r * 0.35, PAPER, 2);
			eyes(context, x, y - r * 0.1, facing, r * 0.28, r * 0.18);
			break;
		case 'arctic:boss':
			facingFrame(context, x, y, facing, () => {
				// The icebreaker hull the bear rides on
				context.beginPath();
				context.moveTo(r * 1.4, 0);
				context.lineTo(r * 0.4, -r * 0.9);
				context.lineTo(-r * 1.1, -r * 0.9);
				context.lineTo(-r * 1.1, r * 0.9);
				context.lineTo(r * 0.4, r * 0.9);
				context.closePath();
				context.fillStyle = tint(flash, '#c43c2c');
				context.fill();
				context.lineWidth = 4;
				context.strokeStyle = INK;
				context.stroke();
			});
			circle(context, x, y, r * 0.62, tint(flash, '#f7f7f2'));
			circle(context, x - r * 0.4, y - r * 0.5, r * 0.18, tint(flash, '#f7f7f2'), 2);
			circle(context, x + r * 0.4, y - r * 0.5, r * 0.18, tint(flash, '#f7f7f2'), 2);
			circle(
				context,
				x + Math.cos(facing) * r * 0.45,
				y + Math.sin(facing) * r * 0.35,
				r * 0.1,
				INK,
				0
			);
			drawCrown(context, x, y - r * 0.7, r * 0.35);
			eyes(context, x, y - r * 0.1, facing, r * 0.2, r * 0.11);
			break;
	}
	if (enemy.variant === 'mega') drawCrown(context, x + r * 0.7, y - r * 0.9, r * 0.25, RED);
}

function drawCrown(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	color = YELLOW
) {
	context.beginPath();
	context.moveTo(x - size, y + size * 0.4);
	context.lineTo(x - size, y - size * 0.4);
	context.lineTo(x - size * 0.5, y);
	context.lineTo(x, y - size * 0.6);
	context.lineTo(x + size * 0.5, y);
	context.lineTo(x + size, y - size * 0.4);
	context.lineTo(x + size, y + size * 0.4);
	context.closePath();
	context.fillStyle = color;
	context.fill();
	context.lineWidth = 2.5;
	context.strokeStyle = INK;
	context.stroke();
}

/** Over the player's head: a badge with their level, the health bar and under it the sprint charge */
function drawPlayerTag(context: CanvasRenderingContext2D, state: RaidState) {
	const { player } = state;
	const width = 64;
	const left = player.x - width / 2 + 9;
	const top = player.y - 54;
	const share = Math.max(0, Math.min(1, player.hp / player.maxHp));
	roundRect(context, left, top, width, 11, 4, INK, 0);
	context.fillStyle = share > 0.3 ? '#3ddc5a' : RED;
	context.fillRect(left + 2, top + 2, (width - 4) * share, 7);
	// The bar under it: the flamethrower's heat (red and blinking near the top), the hammer's
	// rage (gold and pulsing when full), or the sprint for every other weapon
	const kind = state.loadout[player.held].kind;
	const blink = Math.floor(state.timeMs / 120) % 2 === 0;
	let charge = 1 - Math.max(0, player.sprintMs) / SPRINT_COOLDOWN_MS;
	let color = '#4fc8ff';
	if (kind === 'flamethrower') {
		charge = player.heat;
		color =
			player.heat > 0.8 ? (blink ? RED : '#ff9a3c') : player.heat > 0.5 ? '#ff9a3c' : '#4fc8ff';
	} else if (kind === 'hammer') {
		charge = player.rage;
		color = player.rage >= 1 ? (blink ? YELLOW : PAPER) : '#4fc8ff';
	}
	const full = kind === 'hammer' && player.rage >= 1;
	roundRect(context, left, top + 12, width, full ? 7 : 5, 2, INK, 0);
	context.fillStyle = color;
	context.fillRect(
		left + 1.5,
		top + 13,
		(width - 3) * Math.max(0, Math.min(1, charge)),
		full ? 5 : 3
	);

	// The level badge, a purple hexagon over the start of the bars
	const bx = left - 4;
	const by = top + 8;
	context.beginPath();
	for (let i = 0; i < 6; i++) {
		const angle = Math.PI / 6 + (i * Math.PI) / 3;
		context.lineTo(bx + Math.cos(angle) * 13, by + Math.sin(angle) * 13);
	}
	context.closePath();
	context.fillStyle = '#6b3fd4';
	context.fill();
	context.lineWidth = 2.5;
	context.strokeStyle = PAPER;
	context.stroke();
	context.font = '800 12px "Baloo 2", system-ui, sans-serif';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillStyle = PAPER;
	context.fillText(`${state.playerLevel}`, bx, by + 1);
}

function drawEnemyBar(context: CanvasRenderingContext2D, enemy: Enemy) {
	// Bosses have their own bar in the HUD
	if (enemy.archetype === 'boss') return;
	const damaged = enemy.hp < enemy.maxHp;
	const elite = isElite(enemy.archetype);
	const y = enemy.y - enemy.radius * (enemy.variant === 'normal' && !elite ? 1.15 : 1.45) - 10;
	if (elite) {
		const width = Math.max(40, enemy.radius * 2);
		roundRect(context, enemy.x - width / 2, y, width, 8, 3, INK, 0);
		context.fillStyle = ELITE;
		context.fillRect(
			enemy.x - width / 2 + 1.5,
			y + 1.5,
			(width - 3) * Math.max(0, enemy.hp / enemy.maxHp),
			5
		);
		drawStar(context, enemy.x - width / 2 - 4, y + 4, 8, ELITE);
		return;
	}
	if (enemy.variant !== 'normal') {
		const stars = enemy.variant === 'mega' ? 2 : 1;
		for (let i = 0; i < stars; i++)
			drawStar(context, enemy.x + (i - (stars - 1) / 2) * 14, y - 9, 7, AURA[enemy.variant]);
	}
	if (!damaged) return;
	const width = Math.max(28, enemy.radius * 1.8);
	roundRect(context, enemy.x - width / 2, y, width, 6, 3, PAPER, 2);
	context.fillStyle = enemy.variant === 'normal' ? RED : AURA[enemy.variant];
	context.fillRect(
		enemy.x - width / 2 + 1,
		y + 1,
		(width - 2) * Math.max(0, enemy.hp / enemy.maxHp),
		4
	);
}

/**
 * One of the player's helpers: a small khaki soldier with a green ring on the ground, still half
 * inside the little wooden crate it climbed out of for the first moment
 */
function drawAlly(context: CanvasRenderingContext2D, ally: Ally) {
	const { x, y, facing } = ally;
	const r = ALLY_RADIUS;
	const flash = ally.flashMs > 0;
	const bob = Math.sin(ally.phase) * 1.5;
	if (ally.ageMs < ALLY_CRATE_MS) {
		const left = 1 - ally.ageMs / ALLY_CRATE_MS;
		context.save();
		context.globalAlpha = left;
		roundRect(context, x - r * 1.5, y - r * 1.2, r * 3, r * 2.3, 3, '#b07a43', 2.5);
		context.beginPath();
		context.moveTo(x - r * 1.5, y - r * 0.3);
		context.lineTo(x + r * 1.5, y - r * 0.3);
		context.moveTo(x - r * 1.5, y + r * 0.55);
		context.lineTo(x + r * 1.5, y + r * 0.55);
		context.lineWidth = 2;
		context.strokeStyle = '#7d5227';
		context.stroke();
		// A lid flipped open behind them
		context.fillStyle = '#8a5c2f';
		context.beginPath();
		context.rect(x - r * 1.5, y - r * 1.9, r * 3, r * 0.7);
		context.fill();
		context.stroke();
		context.restore();
	}
	// The green ring marks the squad as friendly, on the field and against the enemies' red
	context.beginPath();
	context.arc(x, y + r * 0.6, r * 1.6, 0, Math.PI * 2);
	context.strokeStyle = 'rgba(126, 217, 87, 0.55)';
	context.lineWidth = 2;
	context.stroke();
	circle(context, x, y - bob, r, tint(flash, '#c9b98c'), 2.5);
	context.beginPath();
	context.arc(x, y - bob - r * 0.1, r * 0.95, Math.PI, Math.PI * 2);
	context.fillStyle = tint(flash, '#6d7c45');
	context.fill();
	context.lineWidth = 2;
	context.strokeStyle = INK;
	context.stroke();
	eyes(context, x, y - bob + r * 0.1, facing, r * 0.34, r * 0.2, true);
	// The rifle, held out front
	context.beginPath();
	context.moveTo(x + Math.cos(facing) * r * 0.4, y - bob + Math.sin(facing) * r * 0.4);
	context.lineTo(x + Math.cos(facing) * r * 1.7, y - bob + Math.sin(facing) * r * 1.7);
	context.lineWidth = 2.5;
	context.strokeStyle = INK;
	context.stroke();
	// Only once hurt, a bar over their head
	if (ally.hp < ally.maxHp) {
		const width = 24;
		const top = y - r * 2.6;
		roundRect(context, x - width / 2, top, width, 5, 2.5, PAPER, 1.5);
		context.fillStyle = '#6fd05e';
		context.fillRect(
			x - width / 2 + 1,
			top + 1,
			(width - 2) * Math.max(0, ally.hp / ally.maxHp),
			3
		);
	}
}

function drawStar(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	color: string
) {	context.beginPath();
	for (let i = 0; i < 10; i++) {
		const angle = -Math.PI / 2 + (i * Math.PI) / 5;
		const reach = i % 2 === 0 ? r : r * 0.45;
		context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
	}
	context.closePath();
	context.fillStyle = color;
	context.fill();
	context.lineWidth = 1.8;
	context.strokeStyle = INK;
	context.stroke();
}

function drawSlamWarning(context: CanvasRenderingContext2D, boss: Enemy) {
	const progress = 1 - boss.slamWindupMs / BOSS_SLAM_WINDUP_MS;
	context.fillStyle = 'rgba(229, 72, 77, 0.18)';
	ellipse(context, boss.x, boss.y, BOSS_SLAM_RADIUS, BOSS_SLAM_RADIUS);
	context.fillStyle = 'rgba(229, 72, 77, 0.35)';
	ellipse(context, boss.x, boss.y, BOSS_SLAM_RADIUS * progress, BOSS_SLAM_RADIUS * progress);
	context.beginPath();
	context.arc(boss.x, boss.y, BOSS_SLAM_RADIUS, 0, Math.PI * 2);
	context.setLineDash([10, 8]);
	context.lineWidth = 3;
	context.strokeStyle = RED;
	context.stroke();
	context.setLineDash([]);
}

// ---------------------------------------------------------------------------------------------
// Shots, loot, effects

function drawBullet(context: CanvasRenderingContext2D, bullet: Bullet, time: number) {
	const { x, y, vx, vy, kind, crit } = bullet;
	const angle = Math.atan2(vy, vx);
	if (bullet.flame) {
		// A puff of flame that swells and fades as it flies
		const grown = Math.max(0, Math.min(1, 1 - bullet.rangeLeft / 210));
		const size = 7 + grown * 13 + Math.sin(time / 40 + x) * 1.5;
		context.globalAlpha = 0.9 - grown * 0.55;
		circle(context, x, y, size, '#ff6a1a', 0);
		circle(context, x, y, size * 0.55, YELLOW, 0);
		context.globalAlpha = 1;
		return;
	}
	facingFrame(context, x, y, angle, () => {
		if (bullet.rail) {
			context.lineCap = 'round';
			context.lineWidth = 12;
			context.strokeStyle = INK;
			context.beginPath();
			context.moveTo(-90, 0);
			context.lineTo(0, 0);
			context.stroke();
			context.lineWidth = 7;
			context.strokeStyle = RED;
			context.stroke();
			context.lineWidth = 2.5;
			context.strokeStyle = PAPER;
			context.stroke();
			context.lineCap = 'butt';
			return;
		}
		if (kind === 'launcher' && bullet.splash > 0) {
			roundRect(context, -12, -5, 22, 10, 5, '#55603a', 2);
			circle(context, 10, 0, 4, RED, 1.5);
			context.fillStyle = 'rgba(245, 200, 58, 0.8)';
			ellipse(context, -16, 0, 6, 3);
			return;
		}
		const length = kind === 'marksman' ? 22 : 12;
		context.lineCap = 'round';
		context.lineWidth = crit ? 6 : 4;
		context.strokeStyle = INK;
		context.beginPath();
		context.moveTo(-length, 0);
		context.lineTo(0, 0);
		context.stroke();
		context.lineWidth = crit ? 3.5 : 2;
		context.strokeStyle = crit ? RED : YELLOW;
		context.stroke();
		context.lineCap = 'butt';
	});
}

// ---------------------------------------------------------------------------------------------
// Terrain, fire, nests, drones and shells

function drawTerrain(context: CanvasRenderingContext2D, patch: Terrain, time: number) {
	const { x, y, r, seed } = patch;
	// A soft blob rather than a perfect circle
	context.beginPath();
	for (let i = 0; i < 14; i++) {
		const angle = (i / 14) * Math.PI * 2;
		const reach = r * (0.92 + ((seed * (i + 5)) % 11) / 100);
		context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * 0.85);
	}
	context.closePath();
	if (patch.kind === 'mud') {
		context.fillStyle = 'rgba(96, 70, 38, 0.55)';
		context.fill();
		context.fillStyle = 'rgba(70, 50, 25, 0.5)';
		for (let i = 0; i < 4; i++) {
			const angle = seed + i * 1.7;
			ellipse(
				context,
				x + Math.cos(angle) * r * 0.45,
				y + Math.sin(angle) * r * 0.35,
				r * 0.16,
				r * 0.1
			);
		}
		return;
	}
	if (patch.kind === 'oil') {
		context.fillStyle = 'rgba(20, 16, 26, 0.82)';
		context.fill();
		context.lineWidth = 3;
		context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
		context.stroke();
		const sheen = (time / 1500 + seed) % (Math.PI * 2);
		context.fillStyle = 'rgba(150, 120, 255, 0.35)';
		ellipse(context, x + Math.cos(sheen) * r * 0.2, y - r * 0.25, r * 0.4, r * 0.1);
		context.fillStyle = 'rgba(80, 220, 200, 0.25)';
		ellipse(context, x - r * 0.2, y + r * 0.2, r * 0.3, r * 0.08);
		return;
	}
	// Ice: pale and glossy, with a few scratches
	context.fillStyle = 'rgba(170, 220, 245, 0.75)';
	context.fill();
	context.lineWidth = 3;
	context.strokeStyle = 'rgba(110, 170, 210, 0.8)';
	context.stroke();
	context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
	context.lineWidth = 3;
	context.beginPath();
	context.moveTo(x - r * 0.5, y - r * 0.2);
	context.lineTo(x - r * 0.15, y - r * 0.45);
	context.moveTo(x + r * 0.1, y + r * 0.3);
	context.lineTo(x + r * 0.5, y + r * 0.05);
	context.stroke();
}

function drawFirePool(context: CanvasRenderingContext2D, fire: FirePool, time: number) {
	const left = 1 - fire.ageMs / fire.lifeMs;
	const fade = Math.min(1, left * 4);
	if (fire.hostile) {
		// The ground an elite Pion set burning: scorched black, a red rim, flames all over
		context.globalAlpha = 0.55 * fade;
		circle(context, fire.x, fire.y, fire.radius, '#2a1208', 0);
		context.globalAlpha = 0.5 * fade;
		circle(context, fire.x, fire.y, fire.radius * 0.75, '#e0301a', 0);
		context.globalAlpha = fade;
		context.save();
		context.setLineDash([12, 8]);
		context.lineDashOffset = time / 30;
		context.beginPath();
		context.arc(fire.x, fire.y, fire.radius, 0, Math.PI * 2);
		context.strokeStyle = '#ff4a1a';
		context.lineWidth = 4;
		context.stroke();
		context.restore();
		for (let i = 0; i < 6; i++) {
			const angle = fire.id + i * 1.05;
			const reach = fire.radius * (i % 2 === 0 ? 0.55 : 0.25);
			drawFlames(
				context,
				fire.x + Math.cos(angle) * reach,
				fire.y + Math.sin(angle) * reach * 0.6 + 6,
				18,
				time + fire.id * 53 + i * 90
			);
		}
		context.globalAlpha = 1;
		return;
	}
	context.globalAlpha = 0.45 * fade;
	circle(context, fire.x, fire.y, fire.radius, fire.trail ? '#ff8a2b' : '#ff5a1a', 0);
	context.globalAlpha = 0.6 * fade;
	circle(context, fire.x, fire.y, fire.radius * 0.55, YELLOW, 0);
	context.globalAlpha = fade;
	const flames = fire.trail ? 1 : 4;
	for (let i = 0; i < flames; i++) {
		const angle = fire.id + i * 1.6;
		const reach = fire.trail ? 0 : fire.radius * 0.5;
		drawFlames(
			context,
			fire.x + Math.cos(angle) * reach,
			fire.y + Math.sin(angle) * reach * 0.6 + 6,
			fire.trail ? 9 : 16,
			time + fire.id * 53 + i * 100
		);
	}
	context.globalAlpha = 1;
}

/** A drone nest: a camouflaged crate with a launch rail and an antenna that blinks while armed */
function drawNest(context: CanvasRenderingContext2D, nest: Nest, time: number) {
	const { x, y } = nest;
	const fading = nest.ageMs > NEST_LIFETIME_MS - 2500 && Math.floor(time / 150) % 2 === 0;
	if (fading) context.globalAlpha = 0.5;
	roundRect(context, x - 17, y - 13, 34, 26, 5, '#55603a', 3);
	context.strokeStyle = '#3e4a28';
	context.lineWidth = 2;
	context.beginPath();
	context.moveTo(x - 17, y);
	context.lineTo(x + 17, y);
	context.stroke();
	roundRect(context, x - 8, y - 9, 16, 6, 2, '#2b2b2b', 1.5);
	context.strokeStyle = INK;
	context.lineWidth = 2;
	context.beginPath();
	context.moveTo(x + 12, y - 12);
	context.lineTo(x + 18, y - 28);
	context.stroke();
	const lit = Math.floor((time + nest.id * 97) / 260) % 2 === 0;
	circle(context, x + 18, y - 28, 3, lit ? '#5bd16b' : '#1f4a25', 1.5);
	context.globalAlpha = 1;
}

/** The player's kamikaze drones: small, light and quick */
function drawFriendlyDrone(context: CanvasRenderingContext2D, drone: FriendlyDrone, time: number) {
	const angle = Math.atan2(drone.vy, drone.vx);
	facingFrame(context, drone.x, drone.y, angle, () => {
		context.lineWidth = 2.5;
		context.strokeStyle = INK;
		for (const [dx, dy] of [
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1]
		]) {
			context.beginPath();
			context.moveTo(0, 0);
			context.lineTo(dx * 9, dy * 9);
			context.stroke();
			context.globalAlpha = 0.5;
			context.beginPath();
			context.ellipse(dx * 9, dy * 9, 5, 1.8, time / 25 + dx, 0, Math.PI * 2);
			context.fillStyle = '#e8f1f7';
			context.fill();
			context.globalAlpha = 1;
		}
		roundRect(context, -5, -4, 12, 8, 3, drone.crit ? RED : '#4fa8d8', 2);
	});
}

/** Where a shell is about to land: a red ring that fills up as it falls */
function drawShellMarker(context: CanvasRenderingContext2D, shell: Shell) {
	const progress = Math.min(1, shell.ageMs / shell.flightMs);
	context.fillStyle = 'rgba(229, 72, 77, 0.14)';
	ellipse(context, shell.x, shell.y, shell.radius, shell.radius);
	context.fillStyle = 'rgba(229, 72, 77, 0.32)';
	ellipse(context, shell.x, shell.y, shell.radius * progress, shell.radius * progress);
	context.beginPath();
	context.arc(shell.x, shell.y, shell.radius, 0, Math.PI * 2);
	context.setLineDash([8, 7]);
	context.lineWidth = shell.radius >= ARTILLERY_RADIUS ? 4 : 3;
	context.strokeStyle = RED;
	context.stroke();
	context.setLineDash([]);
}

/** The shell itself on its high arc, coming down on the marker */
function drawShell(context: CanvasRenderingContext2D, shell: Shell) {
	const t = Math.min(1, shell.ageMs / shell.flightMs);
	const x = shell.fromX + (shell.x - shell.fromX) * t;
	const y = shell.fromY + (shell.y - shell.fromY) * t - Math.sin(t * Math.PI) * 220;
	const size = shell.big ? 8 : 6;
	circle(context, x, y, size, '#3b3f2f', 2.5);
	circle(context, x - size * 0.3, y - size * 0.3, size * 0.3, '#9aa0a6', 0);
}

/** A crystal: a cut gem in its kind's colour, ringed in its rarity's colour */
export function drawCrystal(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	kind: CrystalKind,
	rarity: Rarity
) {
	context.beginPath();
	context.arc(x, y, size * 1.15, 0, Math.PI * 2);
	context.lineWidth = 4;
	context.strokeStyle = RARITY_COLOR[rarity];
	context.stroke();
	context.beginPath();
	context.moveTo(x, y - size);
	context.lineTo(x + size * 0.75, y - size * 0.25);
	context.lineTo(x + size * 0.45, y + size * 0.85);
	context.lineTo(x - size * 0.45, y + size * 0.85);
	context.lineTo(x - size * 0.75, y - size * 0.25);
	context.closePath();
	context.fillStyle = CRYSTAL_COLOR[kind];
	context.fill();
	context.lineWidth = 2;
	context.strokeStyle = INK;
	context.stroke();
	context.fillStyle = 'rgba(255, 255, 255, 0.55)';
	context.beginPath();
	context.moveTo(x, y - size);
	context.lineTo(x + size * 0.25, y - size * 0.25);
	context.lineTo(x - size * 0.75, y - size * 0.25);
	context.closePath();
	context.fill();
}

/** A landmine: a flat disc whose light blinks once armed */
function drawMine(context: CanvasRenderingContext2D, mine: Mine, time: number) {
	const armed = mine.ageMs >= MINE_ARM_MS;
	if (armed) {
		context.beginPath();
		context.arc(mine.x, mine.y, MINE_TRIGGER_RADIUS, 0, Math.PI * 2);
		context.setLineDash([4, 6]);
		context.lineWidth = 2;
		context.strokeStyle = 'rgba(229, 72, 77, 0.5)';
		context.stroke();
		context.setLineDash([]);
	}
	circle(context, mine.x, mine.y, 13, '#4b5320', 3);
	circle(context, mine.x, mine.y, 7, '#6b7340', 2);
	const lit = !armed || Math.floor((time + mine.id * 97) / 300) % 2 === 0;
	circle(context, mine.x, mine.y, 3, lit ? RED : '#5a1a1a', 0);
}

function drawGrenade(
	context: CanvasRenderingContext2D,
	fromX: number,
	fromY: number,
	x: number,
	y: number,
	ageMs: number
) {
	const t = Math.min(1, ageMs / (GRENADE_FUSE_MS * 0.7));
	const gx = fromX + (x - fromX) * t;
	const gy = fromY + (y - fromY) * t - Math.sin(t * Math.PI) * 60;
	context.beginPath();
	context.arc(x, y, GRENADE_RADIUS, 0, Math.PI * 2);
	context.setLineDash([6, 8]);
	context.lineWidth = 2;
	context.strokeStyle = 'rgba(229, 72, 77, 0.6)';
	context.stroke();
	context.setLineDash([]);
	circle(context, gx, gy, 8, '#4b5a2e', 2.5);
	circle(context, gx + 3, gy - 6, 3, '#9aa0a6', 1.5);
}

function gearIcon(context: CanvasRenderingContext2D, item: GearItem, x: number, y: number) {
	if (item.type === 'weapon') {
		const look = WEAPON_LOOK[item.kind];
		roundRect(
			context,
			x - look.length / 2,
			y - look.width / 2,
			look.length,
			look.width,
			2,
			look.color,
			2
		);
		roundRect(context, x - look.length / 2 + 4, y + look.width / 2 - 1, 6, 8, 2, look.color, 2);
	} else if (item.slot === 'boots') {
		roundRect(context, x - 11, y - 6, 9, 14, 3, '#5a4630', 2.5);
		roundRect(context, x + 2, y - 6, 9, 14, 3, '#5a4630', 2.5);
	} else if (item.slot === 'helmet') {
		context.beginPath();
		context.arc(x, y + 5, 11, Math.PI, Math.PI * 2);
		context.closePath();
		context.fillStyle = '#556b2f';
		context.fill();
		context.lineWidth = 2.5;
		context.strokeStyle = INK;
		context.stroke();
	} else {
		roundRect(context, x - 10, y - 11, 20, 22, 5, '#556b2f', 2.5);
		context.fillStyle = INK;
		context.fillRect(x - 1, y - 11, 2, 22);
	}
}

function drawLoot(context: CanvasRenderingContext2D, loot: Loot, time: number) {
	const { x, drop } = loot;
	const bounce = Math.sin(time / 220 + loot.id) * 3;
	const y = loot.y + bounce;
	// Blinks for its last few seconds on the ground
	if (drop.type !== 'gear' && loot.ageMs > 40_000 && Math.floor(time / 150) % 2 === 0) return;
	switch (drop.type) {
		case 'gold':
			circle(context, x, y, 8, YELLOW, 2.5);
			circle(context, x - 2, y - 2, 2.5, '#fff3b0', 0);
			break;
		case 'scrap':
			// A bent cog
			context.save();
			context.translate(x, y);
			context.rotate(loot.id);
			for (let i = 0; i < 6; i++) {
				context.rotate(Math.PI / 3);
				roundRect(context, -2.5, -11, 5, 5, 1, '#8a8f99', 1.5);
			}
			context.restore();
			circle(context, x, y, 7, '#a5aab3', 2);
			circle(context, x, y, 2.5, '#5a5f66', 0);
			break;
		case 'crystal': {
			const { kind, rarity } = drop.crystal;
			// Every crystal shines a beam that pulses, taller and wider the rarer it is
			const rank = ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(rarity);
			const reach = 90 + rank * 30;
			const pulse = 0.75 + Math.sin(time / 260 + loot.id) * 0.25;
			const gradient = context.createLinearGradient(x, y - reach, x, y);
			gradient.addColorStop(0, 'rgba(255,255,255,0)');
			gradient.addColorStop(1, RARITY_COLOR[rarity]);
			context.globalAlpha = (0.35 + rank * 0.07) * pulse;
			context.fillStyle = gradient;
			const half = 5 + rank * 1.5;
			context.fillRect(x - half, y - reach, half * 2, reach);
			// A glow on the ground and twinkles around it
			context.globalAlpha = 0.4 * pulse;
			circle(context, x, loot.y + 8, 14 + rank * 2, RARITY_COLOR[rarity], 0);
			context.globalAlpha = 1;
			for (let i = 0; i < 2 + Math.min(2, rank); i++) {
				const angle = time / 500 + i * 2.4 + loot.id;
				const twinkle = Math.max(0, Math.sin(time / 180 + i * 1.7));
				if (twinkle > 0.2) {
					drawStar(
						context,
						x + Math.cos(angle) * 18,
						y - 8 + Math.sin(angle) * 10,
						3.5 * twinkle,
						PAPER
					);
				}
			}
			drawCrystal(context, x, y, 9 + rank * 0.8, kind, rarity);
			break;
		}
		case 'medkit':
			roundRect(context, x - 11, y - 9, 22, 18, 4, PAPER, 2.5);
			context.fillStyle = RED;
			context.fillRect(x - 2.5, y - 6, 5, 12);
			context.fillRect(x - 6, y - 2.5, 12, 5);
			break;
		case 'weapon-kit':
		case 'armor-kit': {
			const color = drop.type === 'weapon-kit' ? '#f08a24' : '#4fa8d8';
			if (drop.type === 'weapon-kit') roundRect(context, x - 12, y - 10, 24, 20, 4, color, 2.5);
			else {
				context.beginPath();
				context.moveTo(x, y - 13);
				context.lineTo(x + 11, y - 8);
				context.lineTo(x + 9, y + 5);
				context.lineTo(x, y + 12);
				context.lineTo(x - 9, y + 5);
				context.lineTo(x - 11, y - 8);
				context.closePath();
				context.fillStyle = color;
				context.fill();
				context.lineWidth = 2.5;
				context.strokeStyle = INK;
				context.stroke();
			}
			// Up arrow
			context.beginPath();
			context.moveTo(x, y - 7);
			context.lineTo(x + 6, y);
			context.lineTo(x + 2.5, y);
			context.lineTo(x + 2.5, y + 6);
			context.lineTo(x - 2.5, y + 6);
			context.lineTo(x - 2.5, y);
			context.lineTo(x - 6, y);
			context.closePath();
			context.fillStyle = PAPER;
			context.fill();
			context.lineWidth = 1.5;
			context.stroke();
			break;
		}
		case 'gear': {
			const color = RARITY_COLOR[drop.item.rarity];
			// A light beam for anything rare or better, so it is seen from afar
			if (drop.item.rarity !== 'common' && drop.item.rarity !== 'uncommon') {
				const gradient = context.createLinearGradient(x, y - 140, x, y);
				gradient.addColorStop(0, 'rgba(255,255,255,0)');
				gradient.addColorStop(1, color);
				context.globalAlpha = 0.55;
				context.fillStyle = gradient;
				context.fillRect(x - 9, y - 140, 18, 140);
				context.globalAlpha = 1;
			}
			context.globalAlpha = 0.45;
			circle(context, x, loot.y + 10, 22, color, 0);
			context.globalAlpha = 1;
			circle(context, x, y, 19, PAPER, 3);
			context.beginPath();
			context.arc(x, y, 19, 0, Math.PI * 2);
			context.lineWidth = 4;
			context.strokeStyle = color;
			context.stroke();
			gearIcon(context, drop.item, x, y);
			break;
		}
	}
}

function drawEffect(context: CanvasRenderingContext2D, effect: Effect) {
	const t = effect.ageMs / effect.durationMs;
	if (effect.kind === 'cone') {
		context.globalAlpha = Math.max(0, 0.6 * (1 - t));
		context.beginPath();
		context.moveTo(effect.x, effect.y);
		context.arc(
			effect.x,
			effect.y,
			effect.radius * (0.4 + 0.6 * t),
			effect.angle - effect.spread / 2,
			effect.angle + effect.spread / 2
		);
		context.closePath();
		context.fillStyle = effect.color;
		context.fill();
		context.globalAlpha = 1;
		return;
	}
	if (effect.kind === 'shards') {
		drawShards(context, effect, t);
		return;
	}
	if (effect.kind === 'ring') {
		context.globalAlpha = Math.max(0, 1 - t);
		context.beginPath();
		context.arc(effect.x, effect.y, effect.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
		context.fillStyle = effect.color;
		context.globalAlpha = Math.max(0, 0.35 * (1 - t));
		context.fill();
		context.globalAlpha = Math.max(0, 1 - t);
		context.lineWidth = 5;
		context.strokeStyle = effect.color;
		context.stroke();
		context.globalAlpha = 1;
		return;
	}
	context.globalAlpha = Math.max(0, 1 - t * t);
	context.font = `700 ${effect.size}px "Baloo 2", system-ui, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.lineJoin = 'round';
	context.lineWidth = 4;
	context.strokeStyle = INK;
	const y = effect.y - t * 34;
	context.strokeText(effect.text, effect.x, y);
	context.fillStyle = effect.color;
	context.fillText(effect.text, effect.x, y);
	context.globalAlpha = 1;
}

/** Shards fly out and spin, a star flashes in the middle, and a glow column rises */
function drawShards(
	context: CanvasRenderingContext2D,
	effect: Extract<Effect, { kind: 'shards' }>,
	t: number
) {
	const fade = Math.max(0, 1 - t);
	const ease = 1 - (1 - t) * (1 - t);
	context.save();
	// The column of light the crystal leaves
	const height = 160 * (0.4 + 0.6 * ease);
	const gradient = context.createLinearGradient(effect.x, effect.y - height, effect.x, effect.y);
	gradient.addColorStop(0, 'rgba(255,255,255,0)');
	gradient.addColorStop(1, effect.glow);
	context.globalAlpha = 0.6 * fade;
	context.fillStyle = gradient;
	context.fillRect(effect.x - 14 * fade, effect.y - height, 28 * fade, height);
	// The star flash
	context.globalAlpha = fade;
	drawStar(
		context,
		effect.x,
		effect.y - 10,
		10 + 22 * Math.sin(Math.min(1, t * 2) * Math.PI),
		PAPER
	);
	// The shards
	for (let i = 0; i < 12; i++) {
		const angle = (i / 12) * Math.PI * 2 + effect.seed;
		const reach = (40 + (i % 3) * 18) * ease;
		const sx = effect.x + Math.cos(angle) * reach;
		const sy = effect.y + Math.sin(angle) * reach - 30 * ease + 40 * t * t;
		context.save();
		context.translate(sx, sy);
		context.rotate(angle + t * 8);
		context.beginPath();
		context.moveTo(0, -6);
		context.lineTo(3.5, 0);
		context.lineTo(0, 6);
		context.lineTo(-3.5, 0);
		context.closePath();
		context.fillStyle = i % 2 === 0 ? effect.color : effect.glow;
		context.fill();
		context.lineWidth = 1.2;
		context.strokeStyle = INK;
		context.stroke();
		context.restore();
	}
	context.restore();
}

/** The score card picture: a square around where the raid ended */
export function drawRaidPreview(
	context: CanvasRenderingContext2D,
	state: RaidState,
	x: number,
	y: number,
	size: number
) {
	context.save();
	context.beginPath();
	context.rect(x, y, size, size);
	context.clip();
	context.translate(x, y);
	drawRaid(context, state, size, size, { effects: [], reducedMotion: true });
	context.restore();
}

/**
 * What a marker on the minimap stands for; the legend on the map overlay explains them. Colours
 * are reserved: red for enemies (shaped by what they do), orange for elites, violet for bosses,
 * blue for squad mates, and green for allies (the player's drones and nests, the command post).
 */
export type MinimapMark =
	| 'fighter'
	| 'shooter'
	| 'drone'
	| 'support'
	| 'elite'
	| 'boss'
	| 'squad'
	| 'ally'
	| 'post';
export type MarkShape = 'circle' | 'diamond' | 'triangle' | 'square' | 'ring';

const ENEMY_RED = '#ff4a4a';

export const MINIMAP_MARKS: Record<MinimapMark, { color: string; shape: MarkShape; size: number }> =
	{
		fighter: { color: ENEMY_RED, shape: 'circle', size: 1.7 },
		shooter: { color: ENEMY_RED, shape: 'diamond', size: 2.3 },
		drone: { color: ENEMY_RED, shape: 'triangle', size: 2.4 },
		support: { color: ENEMY_RED, shape: 'square', size: 2.2 },
		elite: { color: ELITE, shape: 'square', size: 3.4 },
		boss: { color: '#b45cff', shape: 'ring', size: 5 },
		squad: { color: '#3d8bff', shape: 'circle', size: 2.8 },
		ally: { color: '#3ddc5a', shape: 'circle', size: 2.2 },
		post: { color: '#3ddc5a', shape: 'square', size: 4.2 }
	};

/** The marker an enemy of this type gets on the map, whatever is drawn of it */
export const ENEMY_MARK: Record<Enemy['archetype'], MinimapMark> = {
	grunt: 'fighter',
	fast: 'fighter',
	heavy: 'fighter',
	ranged: 'shooter',
	drone: 'drone',
	medic: 'support',
	mortar: 'support',
	artillery: 'support',
	pion: 'elite',
	boss: 'boss'
};

/** Super enemies get one ring around their marker on the map, mega ones two */
export const VARIANT_RINGS: Record<Enemy['variant'], number> = { normal: 0, super: 1, mega: 2 };

/** One marker of the given shape and radius around (x, y), in the context's current units */
export function drawMark(
	context: CanvasRenderingContext2D,
	shape: MarkShape,
	x: number,
	y: number,
	radius: number,
	color: string
) {
	context.beginPath();
	switch (shape) {
		case 'circle':
		case 'ring':
			context.arc(x, y, radius, 0, Math.PI * 2);
			break;
		case 'diamond':
			context.moveTo(x, y - radius);
			context.lineTo(x + radius, y);
			context.lineTo(x, y + radius);
			context.lineTo(x - radius, y);
			context.closePath();
			break;
		case 'triangle':
			context.moveTo(x, y - radius);
			context.lineTo(x + radius, y + radius * 0.8);
			context.lineTo(x - radius, y + radius * 0.8);
			context.closePath();
			break;
		case 'square':
			context.rect(x - radius * 0.8, y - radius * 0.8, radius * 1.6, radius * 1.6);
			break;
	}
	if (shape === 'ring') {
		context.lineWidth = radius * 0.55;
		context.strokeStyle = color;
		context.stroke();
		return;
	}
	context.fillStyle = color;
	context.fill();
}

/**
 * The minimap: the battlefield with its cover and only what is worth walking to, the player's own
 * drones, nests and assault allies, the command post, and the player as an arrow pointing where the
 * weapon aims.
 * Enemies are marked only when they matter: bosses, super and mega enemies (one and two rings),
 * enemy support units, and whatever an open daily quest still asks to be killed (questTargets).
 * Regular fighters, shooters and enemy drones stay off it unless a quest wants them, and so do
 * elites, dust devils and loot, so the crowd never buries the few markers that count. Draws into a
 * width × height box at the origin; the context must already be scaled to CSS pixels. Markers grow
 * with markScale, for the big map of the overlay.
 */
export function drawMinimap(
	context: CanvasRenderingContext2D,
	state: RaidState,
	width: number,
	height: number,
	markScale = 1,
	questTargets: readonly Archetype[] = []
) {
	const { map, player } = state;
	const scale = Math.min(width / map.width, height / map.height);
	context.clearRect(0, 0, width, height);
	context.save();
	context.translate((width - map.width * scale) / 2, (height - map.height * scale) / 2);
	context.scale(scale, scale);
	context.fillStyle = 'rgba(24, 16, 48, 0.82)';
	context.fillRect(0, 0, map.width, map.height);
	context.lineWidth = 2 / scale;
	context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
	context.strokeRect(0, 0, map.width, map.height);
	context.fillStyle = 'rgba(255, 255, 255, 0.2)';
	for (const obstacle of map.obstacles) {
		context.beginPath();
		context.arc(obstacle.x, obstacle.y, obstacle.r, 0, Math.PI * 2);
		context.fill();
	}
	const unit = markScale / scale;
	const mark = (kind: MinimapMark, x: number, y: number, rings = 0) => {
		const { color, shape, size } = MINIMAP_MARKS[kind];
		drawMark(context, shape, x, y, size * unit, color);
		for (let i = 1; i <= rings; i++) {
			context.beginPath();
			context.arc(x, y, (size + 1.6 * i + 0.4) * unit, 0, Math.PI * 2);
			context.lineWidth = 0.8 * unit;
			context.strokeStyle = color;
			context.stroke();
		}
	};
	const quest = new Set(questTargets);
	const worthMarking = (enemy: Enemy) =>
		enemy.archetype === 'boss' ||
		enemy.variant !== 'normal' ||
		ENEMY_MARK[enemy.archetype] === 'support' ||
		quest.has(enemy.archetype);
	if (state.defense) mark('post', state.defense.objective.x, state.defense.objective.y);
	for (const nest of state.nests) mark('ally', nest.x, nest.y);
	for (const drone of state.drones) mark('ally', drone.x, drone.y);
	for (const ally of state.allies) mark('ally', ally.x, ally.y);
	// Regular enemies first, then elites, then bosses, so the crowd never hides them
	const rank = (enemy: Enemy) =>
		enemy.archetype === 'boss' ? 2 : ENEMY_MARK[enemy.archetype] === 'elite' ? 1 : 0;
	for (const level of [0, 1, 2]) {
		for (const enemy of state.enemies) {
			if (rank(enemy) !== level || !worthMarking(enemy)) continue;
			mark(ENEMY_MARK[enemy.archetype], enemy.x, enemy.y, VARIANT_RINGS[enemy.variant]);
		}
	}
	context.translate(player.x, player.y);
	context.scale(markScale / scale, markScale / scale);
	context.rotate(player.aim);
	context.beginPath();
	context.moveTo(8, 0);
	context.lineTo(-6, -6);
	context.lineTo(-3, 0);
	context.lineTo(-6, 6);
	context.closePath();
	context.fillStyle = PAPER;
	context.fill();
	context.lineWidth = 1.5;
	context.strokeStyle = INK;
	context.stroke();
	context.restore();
}

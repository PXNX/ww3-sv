/*
 * Canvas drawing for the raid, top-down in the collection's cartoon style (thick ink outlines,
 * flat colours). The camera follows the player and shows VIEW_HEIGHT units of the map in
 * landscape. Each map has its own ground, cover and enemy cast: soldiers, drones and a crowned
 * tank in the sunflower field, oil blobs, scorpions and a kraken in the strait, penguins, yetis
 * and a polar bear icebreaker in the arctic. Super enemies wear a golden aura, mega ones a red one.
 */
import {
	BOSS_SLAM_RADIUS,
	BOSS_SLAM_WINDUP_MS,
	GRENADE_FUSE_MS,
	GRENADE_RADIUS,
	PLAYER_RADIUS,
	RARITY_COLOR,
	VIEW_HEIGHT,
	VIEW_MAX_WIDTH,
	type MapId,
	type WeaponKind
} from './config';
import type { GearItem } from './items';
import type { Decor, Obstacle } from './maps';
import type { Enemy, Loot, RaidState } from './state';

const INK = '#111111';
const PAPER = '#ffffff';
const RED = '#e5484d';
const YELLOW = '#f5c83a';

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
	reducedMotion: boolean;
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

export function cameraFor(state: RaidState, cssWidth: number, cssHeight: number): Camera {
	const scale = cameraScale(cssWidth, cssHeight);
	const width = cssWidth / scale;
	const height = cssHeight / scale;
	const { map, player } = state;
	const clamp = (value: number, size: number, total: number) =>
		size >= total ? (total - size) / 2 : Math.max(0, Math.min(total - size, value - size / 2));
	return {
		scale,
		left: clamp(player.x, width, map.width),
		top: clamp(player.y, height, map.height),
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
	const camera = cameraFor(state, cssWidth, cssHeight);
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

	for (const decor of map.decor) {
		if (visible(camera, decor.x, decor.y, decor.size)) drawDecor(context, decor, state.mapId);
	}
	for (const enemy of state.enemies) {
		if (enemy.archetype === 'boss' && enemy.slamWindupMs > 0) drawSlamWarning(context, enemy);
	}
	for (const loot of state.loot) {
		if (visible(camera, loot.x, loot.y, 60)) drawLoot(context, loot, time);
	}
	// Shadows under everything that stands
	context.fillStyle = 'rgba(0, 0, 0, 0.16)';
	for (const enemy of state.enemies) {
		if (!visible(camera, enemy.x, enemy.y, enemy.radius + 20)) continue;
		ellipse(context, enemy.x + 4, enemy.y + enemy.radius * 0.7, enemy.radius, enemy.radius * 0.4);
	}
	ellipse(context, state.player.x + 3, state.player.y + 15, 20, 8);

	for (const enemy of state.enemies) {
		if (visible(camera, enemy.x, enemy.y, enemy.radius + 30))
			drawEnemy(context, enemy, state.mapId, time);
	}
	drawPlayer(context, state, time);
	for (const obstacle of map.obstacles) {
		if (visible(camera, obstacle.x, obstacle.y, obstacle.r + 20)) drawObstacle(context, obstacle);
	}
	for (const bullet of state.bullets)
		drawBullet(context, bullet.x, bullet.y, bullet.vx, bullet.vy, bullet.kind, bullet.crit);
	for (const bullet of state.enemyBullets) {
		circle(context, bullet.x, bullet.y, bullet.big ? 8 : 6, '#ff6a2b', 2.5);
		circle(context, bullet.x - 1.5, bullet.y - 1.5, 2, YELLOW, 0);
	}
	for (const grenade of state.grenades)
		drawGrenade(context, grenade.fromX, grenade.fromY, grenade.x, grenade.y, grenade.ageMs);
	for (const enemy of state.enemies) {
		if (visible(camera, enemy.x, enemy.y, enemy.radius + 40)) drawEnemyBar(context, enemy);
	}
	for (const effect of extras.effects) drawEffect(context, effect);
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
	launcher: { length: 36, width: 12, color: '#55603a' }
};

function drawPlayer(context: CanvasRenderingContext2D, state: RaidState, time: number) {
	const { player, loadout } = state;
	if (player.invulnerableMs > 0 && Math.floor(time / 90) % 2 === 0) context.globalAlpha = 0.55;
	const bob = player.moving ? Math.sin(player.stepPhase) * 2 : 0;
	const x = player.x;
	const y = player.y + bob;
	const weapon = loadout[player.held];
	const look = WEAPON_LOOK[weapon.kind];

	// Boots
	if (player.moving) {
		const swing = Math.sin(player.stepPhase) * 6;
		circle(context, x - 7, y + 14 + swing, 5, '#3b2a1a', 2);
		circle(context, x + 7, y + 14 - swing, 5, '#3b2a1a', 2);
	}
	facingFrame(context, x, y, player.aim, () => {
		roundRect(context, 4, -look.width / 2 + 6, look.length, look.width, 2, look.color, 2.5);
		if (weapon.rarity !== 'common') {
			context.fillStyle = RARITY_COLOR[weapon.rarity];
			context.fillRect(8, 6 - look.width / 2 + 1, 6, look.width - 2);
		}
	});
	circle(context, x, y, PLAYER_RADIUS, '#7c8c5c');
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
		'#f6c9a0',
		2.5
	);
	context.beginPath();
	context.arc(x, y - 7, 13, Math.PI * 1.05, Math.PI * 1.95);
	context.closePath();
	context.fillStyle = loadout.helmet ? RARITY_COLOR[loadout.helmet.rarity] : '#556b2f';
	context.fill();
	context.lineWidth = 2.5;
	context.strokeStyle = INK;
	context.stroke();
	eyes(context, x, y - 4, player.aim, 4, 2.6, false);
	context.globalAlpha = 1;

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
	drawCast(context, enemy, mapId, flash);
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
			for (const [dx, dy] of [
				[-1, -1],
				[1, -1],
				[-1, 1],
				[1, 1]
			]) {
				context.beginPath();
				context.moveTo(x, y);
				context.lineTo(x + dx * r, y + dy * r);
				context.lineWidth = 3;
				context.strokeStyle = INK;
				context.stroke();
				circle(context, x + dx * r, y + dy * r, r * 0.45, 'rgba(200,200,200,0.6)', 1.5);
			}
			circle(context, x, y, r * 0.6, tint(flash, '#3d3d3d'));
			circle(
				context,
				x + Math.cos(facing) * r * 0.25,
				y + Math.sin(facing) * r * 0.25,
				r * 0.2,
				RED,
				0
			);
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
			circle(context, x, y, r, tint(flash, '#f4f9ff'));
			context.strokeStyle = INK;
			context.lineWidth = 2;
			context.beginPath();
			context.moveTo(x - r * 1.5, y);
			context.lineTo(x + r * 1.5, y);
			context.stroke();
			circle(context, x - r * 1.5, y, r * 0.4, 'rgba(200,230,255,0.7)', 1.5);
			circle(context, x + r * 1.5, y, r * 0.4, 'rgba(200,230,255,0.7)', 1.5);
			eyes(context, x, y, facing, r * 0.3, r * 0.22);
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

function drawEnemyBar(context: CanvasRenderingContext2D, enemy: Enemy) {
	// Bosses have their own bar in the HUD
	if (enemy.archetype === 'boss') return;
	const damaged = enemy.hp < enemy.maxHp;
	const y = enemy.y - enemy.radius * (enemy.variant === 'normal' ? 1.15 : 1.45) - 10;
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

function drawStar(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	color: string
) {
	context.beginPath();
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

function drawBullet(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	vx: number,
	vy: number,
	kind: WeaponKind,
	crit: boolean
) {
	const angle = Math.atan2(vy, vx);
	facingFrame(context, x, y, angle, () => {
		if (kind === 'launcher') {
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

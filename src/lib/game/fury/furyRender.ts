/*
 * Canvas drawing for Magyar's Birds. Everything is a generic, original placeholder shape in the
 * app's style: thick uniform ink outlines, flat fills, no gradients. The onion domes are plain
 * golden architectural shapes with a simple ball-and-spire finial (no symbols of any kind).
 */
import type { FurySprites } from './assets';
import { BIRDS, type BirdKind } from './birds';
import type { BirdPiece, Effect, EffectTone, FuryWorld, Piece } from './furyWorld';
import { POUCH, SLINGSHOT_X, pullFromAim, type Aim, type Vec } from './launch';
import { DOME_HEIGHT_RATIO, type Material } from './levels/schema';

const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const KHAKI = '#7c8c5c';
const SKY = '#cfe3ec';
const GOLD = '#f5c83a';
const GOLD_LIGHT = '#fbe38e';
const WOOD = '#c98b4e';
const BAND = '#5b3a29';
const EXPLOSION = '#e8562c';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

const MATERIAL_FILL: Record<Material, string> = { wood: WOOD, stone: '#b86a52', ice: '#bfe7f4' };
const TONE_FILL: Record<EffectTone, string> = {
	...MATERIAL_FILL,
	gold: GOLD,
	dust: '#f3eed8',
	feather: PAPER,
	explosion: EXPLOSION
};

/** World height shown above the ground per meter of width, and the ground band below it */
export const VIEW_RATIO = 0.55;
export const GROUND_DEPTH = 1.2;

export interface Camera {
	scale: number;
	/** Screen x of world x = 0 */
	originX: number;
	/** Screen y of the ground (world y = 0) */
	groundY: number;
	width: number;
	height: number;
}

/** Fits the level's field into the view: full width if possible, the ground along the bottom */
export function fitCamera(width: number, height: number, fieldWidth: number): Camera {
	const fieldHeight = fieldWidth * VIEW_RATIO + GROUND_DEPTH;
	const scale = Math.max(1e-6, Math.min(width / fieldWidth, height / fieldHeight));
	return {
		scale,
		originX: (width - fieldWidth * scale) / 2,
		groundY: height - GROUND_DEPTH * scale,
		width,
		height
	};
}

export function worldToScreen(camera: Camera, point: Vec): Vec {
	return { x: camera.originX + point.x * camera.scale, y: camera.groundY - point.y * camera.scale };
}

export function screenToWorld(camera: Camera, point: Vec): Vec {
	return {
		x: (point.x - camera.originX) / camera.scale,
		y: (camera.groundY - point.y) / camera.scale
	};
}

export interface SceneOptions {
	world: FuryWorld;
	/** Bird waiting in the slingshot, drawn at the pulled pouch */
	birdOnSling: BirdKind | null;
	aim: Aim | null;
	/** Preview dots in world coordinates */
	preview: Vec[];
	/** Seconds since start, for idle animation */
	time: number;
	reducedMotion: boolean;
	sprites: FurySprites;
	/** Screen-space camera shake offset */
	shake?: Vec;
}

function outline(context: CanvasRenderingContext2D, camera: Camera) {
	context.lineWidth = Math.max(1.5, camera.scale * 0.07);
	context.strokeStyle = INK;
	context.lineJoin = 'round';
	context.lineCap = 'round';
}

function drawBackground(context: CanvasRenderingContext2D, camera: Camera, fieldWidth: number) {
	context.fillStyle = SKY;
	context.fillRect(0, 0, camera.width, camera.height);
	outline(context, camera);
	const s = camera.scale;

	// Two static clouds
	context.fillStyle = PAPER;
	for (const [cx, cy, r] of [
		[fieldWidth * 0.3, fieldWidth * 0.42, 0.9],
		[fieldWidth * 0.72, fieldWidth * 0.47, 0.7]
	]) {
		const p = worldToScreen(camera, { x: cx, y: cy });
		context.beginPath();
		context.arc(p.x - r * s, p.y, r * 0.7 * s, Math.PI * 0.5, Math.PI * 1.5);
		context.arc(p.x, p.y - r * 0.4 * s, r * s, Math.PI, 0);
		context.arc(p.x + r * 1.1 * s, p.y, r * 0.7 * s, Math.PI * 1.5, Math.PI * 0.5);
		context.closePath();
		context.fill();
		context.stroke();
	}

	// Distant rolling hills, flat khaki
	context.fillStyle = KHAKI;
	context.beginPath();
	const left = screenToWorld(camera, { x: 0, y: 0 }).x - 1;
	const right = screenToWorld(camera, { x: camera.width, y: 0 }).x + 1;
	let p = worldToScreen(camera, { x: left, y: 0 });
	context.moveTo(p.x, p.y);
	for (let x = left; x <= right; x += 0.5) {
		const y = 1.4 + Math.sin(x * 0.35) * 0.6 + Math.sin(x * 0.9 + 1) * 0.25;
		p = worldToScreen(camera, { x, y });
		context.lineTo(p.x, p.y);
	}
	p = worldToScreen(camera, { x: right, y: 0 });
	context.lineTo(p.x, p.y);
	context.closePath();
	context.fill();
	context.stroke();

	// Ground band
	context.fillStyle = SAND;
	context.fillRect(-2, camera.groundY, camera.width + 4, camera.height - camera.groundY + 2);
	context.beginPath();
	context.moveTo(-2, camera.groundY);
	context.lineTo(camera.width + 2, camera.groundY);
	context.stroke();
}

function drawSlingshotBack(context: CanvasRenderingContext2D, camera: Camera) {
	const s = camera.scale;
	const base = worldToScreen(camera, { x: SLINGSHOT_X, y: 0 });
	const fork = worldToScreen(camera, { x: SLINGSHOT_X, y: 1.5 });
	outline(context, camera);
	context.fillStyle = WOOD;
	// Trunk and the rear prong
	context.beginPath();
	context.rect(base.x - 0.14 * s, fork.y, 0.28 * s, base.y - fork.y);
	context.fill();
	context.stroke();
	prong(context, camera, 0.32);
}

function prong(context: CanvasRenderingContext2D, camera: Camera, side: number) {
	const s = camera.scale;
	const fork = worldToScreen(camera, { x: SLINGSHOT_X, y: 1.5 });
	const tip = worldToScreen(camera, { x: SLINGSHOT_X + side, y: POUCH.y + 0.25 });
	context.fillStyle = WOOD;
	context.beginPath();
	context.moveTo(fork.x - 0.14 * s, fork.y + 0.05 * s);
	context.lineTo(tip.x - 0.12 * s, tip.y);
	context.lineTo(tip.x + 0.12 * s, tip.y);
	context.lineTo(fork.x + 0.14 * s, fork.y + 0.05 * s);
	context.closePath();
	context.fill();
	context.stroke();
}

function drawBand(context: CanvasRenderingContext2D, camera: Camera, side: number, pouch: Vec) {
	const tip = worldToScreen(camera, { x: SLINGSHOT_X + side, y: POUCH.y + 0.15 });
	const p = worldToScreen(camera, pouch);
	context.strokeStyle = BAND;
	context.lineWidth = Math.max(2, camera.scale * 0.12);
	context.beginPath();
	context.moveTo(tip.x, tip.y);
	context.lineTo(p.x, p.y);
	context.stroke();
}

function drawBlock(
	context: CanvasRenderingContext2D,
	camera: Camera,
	piece: Piece & { kind: 'block' }
) {
	const s = camera.scale;
	const position = worldToScreen(camera, piece.body.getPosition());
	const w = piece.w * s;
	const h = piece.h * s;
	context.save();
	context.translate(position.x, position.y);
	context.rotate(-piece.body.getAngle());
	outline(context, camera);
	const fill = piece.shape === 'barrel' ? KHAKI : MATERIAL_FILL[piece.material];
	context.fillStyle = fill;

	if (piece.shape === 'ball') {
		context.beginPath();
		context.arc(0, 0, w / 2, 0, Math.PI * 2);
		context.fill();
		context.stroke();
		context.lineWidth = Math.max(1, s * 0.04);
		context.beginPath();
		context.arc(0, 0, w / 4, 0.3, 2.2);
		context.stroke();
	} else if (piece.shape === 'spire') {
		// Origin at the base center; a pointed roof with a small ball finial
		context.beginPath();
		context.moveTo(-w / 2, 0);
		context.lineTo(w / 2, 0);
		context.lineTo(0, -h);
		context.closePath();
		context.fill();
		context.stroke();
		context.lineWidth = Math.max(1, s * 0.04);
		context.beginPath();
		context.moveTo(-w * 0.22, -h * 0.35);
		context.lineTo(w * 0.22, -h * 0.35);
		context.stroke();
		context.fillStyle = GOLD;
		context.beginPath();
		context.arc(0, -h - 0.08 * s, 0.08 * s, 0, Math.PI * 2);
		context.fill();
		outline(context, camera);
		context.stroke();
	} else {
		context.beginPath();
		context.rect(-w / 2, -h / 2, w, h);
		context.fill();
		context.stroke();
		context.lineWidth = Math.max(1, s * 0.035);
		context.beginPath();
		if (piece.shape === 'crate') {
			const inset = Math.min(w, h) * 0.14;
			context.rect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2);
			context.moveTo(-w / 2 + inset, -h / 2 + inset);
			context.lineTo(w / 2 - inset, h / 2 - inset);
		} else if (piece.shape === 'barrel') {
			for (const f of [-0.28, 0.28]) {
				context.moveTo(-w / 2, h * f);
				context.lineTo(w / 2, h * f);
			}
		} else if (piece.material === 'wood') {
			// Grain along the long side
			const long = w >= h;
			for (const f of [-0.2, 0.18]) {
				if (long) {
					context.moveTo(-w * 0.35, h * f);
					context.lineTo(w * 0.3, h * f);
				} else {
					context.moveTo(w * f, -h * 0.35);
					context.lineTo(w * f, h * 0.3);
				}
			}
		} else if (piece.material === 'stone') {
			// Brick courses
			const course = 0.25 * s;
			for (let y = -h / 2 + course; y < h / 2 - 1; y += course) {
				context.moveTo(-w / 2, y);
				context.lineTo(w / 2, y);
			}
		} else {
			// Ice shine
			context.moveTo(-w * 0.3, h * 0.25);
			context.lineTo(-w * 0.05, -h * 0.25);
			context.moveTo(w * 0.05, h * 0.25);
			context.lineTo(w * 0.2, -h * 0.05);
		}
		context.stroke();
	}

	// Cracks as damage builds up
	const damage = 1 - piece.hp / piece.maxHp;
	if (damage > 0.3 && piece.shape !== 'spire') {
		const r = Math.min(w, h) / 2;
		context.lineWidth = Math.max(1, s * 0.04);
		context.beginPath();
		context.moveTo(-r * 0.7, -r * 0.5);
		context.lineTo(-r * 0.1, -r * 0.1);
		context.lineTo(-r * 0.3, r * 0.3);
		context.lineTo(r * 0.3, r * 0.6);
		if (damage > 0.65) {
			context.moveTo(r * 0.6, -r * 0.6);
			context.lineTo(r * 0.1, 0);
		}
		context.stroke();
	}
	context.restore();
}

/** Traces an onion dome of the given width in pixels, origin at the base center, pointing up */
function domePath(context: CanvasRenderingContext2D, size: number) {
	const top = -size * DOME_HEIGHT_RATIO;
	context.beginPath();
	context.moveTo(-size * 0.34, 0);
	context.lineTo(size * 0.34, 0);
	context.lineTo(size * 0.34, -size * 0.12);
	context.bezierCurveTo(
		size * 0.62,
		-size * 0.3,
		size * 0.56,
		-size * 0.66,
		size * 0.1,
		-size * 0.9
	);
	context.quadraticCurveTo(size * 0.03, -size * 0.98, 0, top);
	context.quadraticCurveTo(-size * 0.03, -size * 0.98, -size * 0.1, -size * 0.9);
	context.bezierCurveTo(
		-size * 0.56,
		-size * 0.66,
		-size * 0.62,
		-size * 0.3,
		-size * 0.34,
		-size * 0.12
	);
	context.closePath();
}

function drawDomeShape(context: CanvasRenderingContext2D, camera: Camera, size: number) {
	outline(context, camera);
	context.fillStyle = GOLD;
	domePath(context, size);
	context.fill();
	context.stroke();
	// Flat highlight stripe and ribs
	context.fillStyle = GOLD_LIGHT;
	context.beginPath();
	context.ellipse(-size * 0.2, -size * 0.45, size * 0.07, size * 0.2, 0.25, 0, Math.PI * 2);
	context.fill();
	context.lineWidth = Math.max(1, camera.scale * 0.035);
	context.beginPath();
	context.moveTo(-size * 0.34, -size * 0.12);
	context.lineTo(size * 0.34, -size * 0.12);
	context.moveTo(0, -size * 0.12);
	context.quadraticCurveTo(size * 0.2, -size * 0.5, 0, -size * 0.95);
	context.stroke();
	// Finial: a plain spire with a ball
	const top = -size * DOME_HEIGHT_RATIO;
	outline(context, camera);
	context.beginPath();
	context.moveTo(0, top);
	context.lineTo(0, top - size * 0.26);
	context.stroke();
	context.fillStyle = GOLD;
	context.beginPath();
	context.arc(0, top - size * 0.14, size * 0.06, 0, Math.PI * 2);
	context.fill();
	context.stroke();
}

function drawDome(
	context: CanvasRenderingContext2D,
	camera: Camera,
	piece: Piece & { kind: 'dome' },
	options: SceneOptions
) {
	const s = camera.scale;
	const position = worldToScreen(camera, piece.body.getPosition());
	context.save();
	context.translate(position.x, position.y);
	context.rotate(-piece.body.getAngle());
	// The ridiculous wobble: a jelly squash and a little sway, pivoting on the base
	const amplitude = piece.wobble * (options.reducedMotion ? 0.3 : 1);
	if (amplitude > 0) {
		const phase = options.time * 22 + piece.id;
		context.rotate(Math.sin(phase) * 0.12 * amplitude);
		context.scale(
			1 + Math.sin(phase * 1.3) * 0.12 * amplitude,
			1 - Math.sin(phase * 1.3) * 0.1 * amplitude
		);
	}
	const image = options.sprites.dome;
	if (image) {
		const w = piece.size * s;
		context.drawImage(image, -w / 2, -w * 1.36, w, w * 1.36);
	} else {
		drawDomeShape(context, camera, piece.size * s);
	}
	context.restore();
}

/** A landmark drawn from its sprite (a plain khaki box until one loads), with cracks as it takes damage */
function drawLandmark(
	context: CanvasRenderingContext2D,
	camera: Camera,
	piece: Piece & { kind: 'landmark' },
	sprites: FurySprites
) {
	const s = camera.scale;
	const position = worldToScreen(camera, piece.body.getPosition());
	const w = piece.w * s;
	const h = piece.h * s;
	context.save();
	context.translate(position.x, position.y);
	context.rotate(-piece.body.getAngle());
	const image = sprites[piece.landmark];
	if (image) {
		context.drawImage(image, -w / 2, -h / 2, w, h);
	} else {
		outline(context, camera);
		context.fillStyle = KHAKI;
		context.beginPath();
		context.rect(-w / 2, -h / 2, w, h);
		context.fill();
		context.stroke();
	}

	const damage = 1 - piece.hp / piece.maxHp;
	if (damage > 0.3) {
		const r = Math.min(w, h) / 2;
		outline(context, camera);
		context.lineWidth = Math.max(1, s * 0.04);
		context.beginPath();
		context.moveTo(-r * 0.7, -r * 0.5);
		context.lineTo(-r * 0.1, -r * 0.1);
		context.lineTo(-r * 0.3, r * 0.3);
		context.lineTo(r * 0.3, r * 0.6);
		if (damage > 0.65) {
			context.moveTo(r * 0.6, -r * 0.6);
			context.lineTo(r * 0.1, 0);
		}
		context.stroke();
	}
	context.restore();
}

/** An original side-profile bird: body, head and beak by type, facing along `angle` */
function drawBird(
	context: CanvasRenderingContext2D,
	camera: Camera,
	kind: BirdKind,
	center: Vec,
	radius: number,
	angle: number,
	sprites: FurySprites
) {
	const s = camera.scale;
	const r = radius * s;
	context.save();
	context.translate(center.x, center.y);
	context.rotate(-angle);
	const image = sprites[kind];
	if (image) {
		context.drawImage(image, -r * 1.6, -r * 1.6, r * 3.2, r * 3.2);
		context.restore();
		return;
	}
	outline(context, camera);
	const body = kind === 'flamingo' ? '#f29bb8' : '#efe3c4';
	const wing = kind === 'flamingo' ? '#d9668d' : '#cdbb8e';

	if (kind === 'flamingo') {
		// Long trailing legs
		context.beginPath();
		context.moveTo(-r * 0.7, r * 0.2);
		context.lineTo(-r * 1.9, r * 0.35);
		context.moveTo(-r * 0.7, r * 0.35);
		context.lineTo(-r * 1.8, r * 0.6);
		context.stroke();
	}
	// Neck and head reaching forward
	const headX = kind === 'pelican' ? r * 0.75 : r * 1.05;
	const headY = -r * 0.55;
	const headR = r * (kind === 'pelican' ? 0.42 : 0.36);
	context.fillStyle = body;
	context.beginPath();
	context.moveTo(r * 0.3, -r * 0.35);
	context.quadraticCurveTo(headX * 0.7, headY - r * 0.4, headX, headY);
	context.lineTo(headX, headY + headR);
	context.quadraticCurveTo(headX * 0.6, -r * 0.05, r * 0.4, r * 0.1);
	context.closePath();
	context.fill();
	context.stroke();

	// Body
	context.fillStyle = body;
	context.beginPath();
	context.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
	context.fill();
	context.stroke();

	// Head
	context.fillStyle = body;
	context.beginPath();
	context.arc(headX, headY, headR, 0, Math.PI * 2);
	context.fill();
	context.stroke();

	// Beak by type
	context.fillStyle = kind === 'flamingo' ? PAPER : '#f0913a';
	context.beginPath();
	if (kind === 'flamingo') {
		// Bent beak with a dark tip
		context.moveTo(headX + headR * 0.7, headY - headR * 0.3);
		context.lineTo(headX + headR * 1.9, headY + headR * 0.2);
		context.lineTo(headX + headR * 1.5, headY + headR * 1.1);
		context.lineTo(headX + headR * 0.6, headY + headR * 0.5);
	} else {
		// The pelican's big pouch beak
		context.moveTo(headX + headR * 0.6, headY - headR * 0.4);
		context.lineTo(headX + headR * 3, headY);
		context.quadraticCurveTo(
			headX + headR * 1.6,
			headY + headR * 2.2,
			headX + headR * 0.3,
			headY + headR * 0.8
		);
	}
	context.closePath();
	context.fill();
	context.stroke();
	if (kind === 'flamingo') {
		context.fillStyle = INK;
		context.beginPath();
		context.arc(headX + headR * 1.6, headY + headR * 0.6, headR * 0.28, 0, Math.PI * 2);
		context.fill();
	}

	// Eye: a friendly dot, no eyebrows
	context.fillStyle = PAPER;
	context.beginPath();
	context.arc(headX + headR * 0.2, headY - headR * 0.25, headR * 0.34, 0, Math.PI * 2);
	context.fill();
	context.lineWidth = Math.max(1, s * 0.03);
	context.stroke();
	context.fillStyle = INK;
	context.beginPath();
	context.arc(headX + headR * 0.3, headY - headR * 0.25, headR * 0.15, 0, Math.PI * 2);
	context.fill();

	// Wing
	outline(context, camera);
	context.fillStyle = wing;
	context.beginPath();
	context.moveTo(-r * 0.55, -r * 0.1);
	context.quadraticCurveTo(-r * 0.05, -r * 0.75, r * 0.45, -r * 0.05);
	context.quadraticCurveTo(-r * 0.05, r * 0.3, -r * 0.55, -r * 0.1);
	context.closePath();
	context.fill();
	context.stroke();
	context.restore();
}

function birdAngle(bird: BirdPiece): number {
	const velocity = bird.body.getLinearVelocity();
	if (!bird.hasHit && Math.hypot(velocity.x, velocity.y) > 2) {
		return Math.atan2(velocity.y, velocity.x);
	}
	return bird.body.getAngle();
}

function drawEffect(
	context: CanvasRenderingContext2D,
	camera: Camera,
	effect: Effect,
	options: SceneOptions
) {
	const s = camera.scale;
	const t = effect.age / effect.life;
	const p = worldToScreen(camera, effect);
	outline(context, camera);
	if (effect.kind === 'puff') {
		context.globalAlpha = 1 - t;
		context.fillStyle = TONE_FILL[effect.tone];
		context.beginPath();
		context.arc(p.x, p.y, effect.radius * s * (0.6 + t * 0.8), 0, Math.PI * 2);
		context.fill();
		context.stroke();
		context.globalAlpha = 1;
	} else if (effect.kind === 'shard') {
		if (effect.age <= effect.delay) return;
		context.globalAlpha = Math.min(1, (1 - t) * 2);
		context.save();
		context.translate(p.x, p.y);
		context.rotate(effect.angle);
		context.fillStyle = TONE_FILL[effect.tone];
		context.beginPath();
		context.rect((-effect.w / 2) * s, (-effect.h / 2) * s, effect.w * s, effect.h * s);
		context.fill();
		context.lineWidth = Math.max(1, s * 0.04);
		context.stroke();
		context.restore();
		context.globalAlpha = 1;
	} else if (effect.kind === 'dome') {
		// First a big ridiculous wobble, then it bursts into a golden ring
		const wobbleEnd = 0.55;
		if (t < wobbleEnd) {
			const k = t / wobbleEnd;
			const amount = options.reducedMotion ? 0.3 : 1;
			const squash = Math.sin(k * Math.PI * 5) * 0.25 * (1 - k * 0.5) * amount;
			context.save();
			context.translate(p.x, p.y);
			context.rotate(-effect.angle + Math.sin(k * Math.PI * 4) * 0.2 * amount);
			context.scale(1 + squash, 1 - squash * 0.8);
			drawDomeShape(context, camera, effect.size * s);
			context.restore();
		} else {
			const k = (t - wobbleEnd) / (1 - wobbleEnd);
			context.globalAlpha = 1 - k;
			context.strokeStyle = GOLD;
			context.lineWidth = Math.max(2, s * 0.18 * (1 - k));
			context.beginPath();
			context.arc(
				p.x,
				p.y - effect.size * 0.5 * s,
				effect.size * s * (0.4 + k * 0.9),
				0,
				Math.PI * 2
			);
			context.stroke();
			context.globalAlpha = 1;
		}
	} else if (effect.kind === 'points') {
		const big = effect.value >= 1000;
		context.globalAlpha = 1 - t * t;
		context.font = `700 ${Math.max(11, s * (big ? 0.75 : 0.5))}px ${DISPLAY_FONT}`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.lineWidth = Math.max(2, s * 0.1);
		context.strokeStyle = INK;
		context.strokeText(`+${effect.value}`, p.x, p.y);
		context.fillStyle = big ? GOLD : PAPER;
		context.fillText(`+${effect.value}`, p.x, p.y);
		context.globalAlpha = 1;
	}
}

function drawPreview(context: CanvasRenderingContext2D, camera: Camera, points: readonly Vec[]) {
	const s = camera.scale;
	points.forEach((point, index) => {
		const p = worldToScreen(camera, point);
		const radius = Math.max(2, s * (0.13 - index * 0.004));
		context.fillStyle = PAPER;
		context.beginPath();
		context.arc(p.x, p.y, radius, 0, Math.PI * 2);
		context.fill();
		context.lineWidth = Math.max(1, s * 0.04);
		context.strokeStyle = INK;
		context.stroke();
	});
}

/** Draws the whole scene for one frame */
export function drawScene(
	context: CanvasRenderingContext2D,
	camera: Camera,
	options: SceneOptions
) {
	const { world } = options;
	// Sky behind everything, so a shaking frame never shows an empty edge
	context.fillStyle = SKY;
	context.fillRect(0, 0, camera.width, camera.height);
	context.save();
	if (options.shake) context.translate(options.shake.x, options.shake.y);
	drawBackground(context, camera, world.level.width);
	drawSlingshotBack(context, camera);

	const pouch = options.aim
		? (() => {
				const pull = pullFromAim(options.aim);
				return { x: POUCH.x + pull.x, y: POUCH.y + pull.y };
			})()
		: POUCH;
	if (options.birdOnSling) drawBand(context, camera, 0.32, pouch);

	for (const piece of world.pieces) {
		if (piece.kind === 'block') drawBlock(context, camera, piece);
	}
	for (const piece of world.pieces) {
		if (piece.kind === 'landmark') drawLandmark(context, camera, piece, options.sprites);
	}
	for (const piece of world.pieces) {
		if (piece.kind === 'dome') drawDome(context, camera, piece, options);
	}
	for (const piece of world.pieces) {
		if (piece.kind !== 'bird') continue;
		const center = worldToScreen(camera, piece.body.getPosition());
		drawBird(context, camera, piece.bird, center, piece.radius, birdAngle(piece), options.sprites);
	}

	if (options.preview.length > 0) drawPreview(context, camera, options.preview);

	if (options.birdOnSling) {
		const idleBob = options.aim || options.reducedMotion ? 0 : Math.sin(options.time * 3) * 0.04;
		const angle = options.aim ? options.aim.angle : 0;
		const center = worldToScreen(camera, { x: pouch.x, y: pouch.y + idleBob });
		drawBird(
			context,
			camera,
			options.birdOnSling,
			center,
			BIRDS[options.birdOnSling].radius,
			angle,
			options.sprites
		);
	}

	// Front prong and band go over the bird
	prong(context, camera, -0.32);
	if (options.birdOnSling) drawBand(context, camera, -0.32, pouch);

	for (const effect of world.effects) drawEffect(context, camera, effect, options);
	context.restore();
}

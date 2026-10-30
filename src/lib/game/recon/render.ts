/*
 * Draws the scope: the terrain and every contact as the active sensor sees them, the lock-on
 * ring, missiles, blasts and smoke, and the camera overlay (brackets, ticks, reticle, minimap).
 * Everything is procedural; nothing here changes game state. The context is expected to be scaled
 * so that one unit is one world unit of the VIEW_W by VIEW_H scope.
 */
import { AA_RADIUS, MAP_H, MAP_W, MISSILE_FLIGHT_S, VIEW_H, VIEW_W } from './config.js';
import type { Contact, Sensor } from './contacts.js';
import type { Run, Track } from './run.js';
import type { Terrain } from './terrain.js';

export interface RenderState {
	run: Run;
	/** Milliseconds since the page started drawing; drives animation only */
	timeMs: number;
	/** Milliseconds of sensor-switch static left */
	switchMs: number;
	/** A red or white flash over the whole scope that fades out, in milliseconds left */
	flashMs: number;
	flashBad: boolean;
}

const INK = '#111111';

const ACCENT: Record<Sensor, string> = { eo: '#ffd84a', ir: '#ffffff', sar: '#7dffb0' };
const LABEL: Record<Sensor, string> = {
	eo: 'EO · DAY OPTICAL',
	ir: 'IR · WHITE HOT',
	sar: 'SAR · X-BAND'
};

interface GroundPalette {
	base: string;
	fields: string[];
	furrow: string;
	field: string;
	wood: string;
	woodLine: string;
	road: string;
	roadEdge: string;
	house: string;
	roofs: string[];
	line: number;
}

const GROUND: Record<Sensor, GroundPalette> = {
	eo: {
		base: '#c7c08a',
		fields: ['#d6cf98', '#bfc882', '#dfd59f', '#b3c27c'],
		furrow: 'rgba(17,17,17,0.13)',
		field: INK,
		wood: '#5f8a4a',
		woodLine: '#3f6a34',
		road: '#ece5c4',
		roadEdge: INK,
		house: '#f3ecd0',
		roofs: ['#e5484d', '#d9823b', '#4fa8d8'],
		line: 2
	},
	ir: {
		base: '#202020',
		fields: ['#2b2b2b', '#303030', '#262626', '#343434'],
		furrow: 'rgba(255,255,255,0.03)',
		field: 'rgba(0,0,0,0.5)',
		wood: '#454545',
		woodLine: '#3a3a3a',
		road: '#181818',
		roadEdge: '#101010',
		house: '#555555',
		roofs: ['#6a6a6a', '#606060', '#707070'],
		line: 1
	},
	sar: {
		base: '#12201a',
		fields: ['#17271f', '#1a2d23', '#14231b', '#1d3226'],
		furrow: 'rgba(125,255,176,0.06)',
		field: 'rgba(0,0,0,0.35)',
		wood: '#4d7a5e',
		woodLine: '#3a6249',
		road: '#050b08',
		roadEdge: '#030605',
		house: '#b9ecce',
		roofs: ['#d6fbe3', '#a9dcbc', '#e8fff1'],
		line: 1
	}
};

let noiseTile: HTMLCanvasElement | null = null;

function noise(): HTMLCanvasElement {
	if (noiseTile) return noiseTile;
	const tile = document.createElement('canvas');
	tile.width = tile.height = 96;
	const c = tile.getContext('2d')!;
	const data = c.createImageData(96, 96);
	for (let i = 0; i < data.data.length; i += 4) {
		const v = Math.random() * 255;
		data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
		data.data[i + 3] = 255;
	}
	c.putImageData(data, 0, 0);
	noiseTile = tile;
	return tile;
}

/** A stable pseudo-random number in [0, 1) for a seed and a slot */
function hash(seed: number, slot: number): number {
	const s = Math.sin(seed * 127.1 + slot * 311.7) * 43758.5453;
	return s - Math.floor(s);
}

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	c.beginPath();
	if (typeof c.roundRect === 'function') c.roundRect(x, y, w, h, r);
	else c.rect(x, y, w, h);
}

function fillStroke(c: CanvasRenderingContext2D, fill: string) {
	c.fillStyle = fill;
	c.fill();
	if (c.lineWidth > 0) c.stroke();
}

function box(
	c: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: string
) {
	c.beginPath();
	c.rect(x, y, w, h);
	fillStroke(c, fill);
}

function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
	c.beginPath();
	c.arc(x, y, r, 0, Math.PI * 2);
	fillStroke(c, fill);
}

// ---------- terrain ----------

function drawTerrain(c: CanvasRenderingContext2D, terrain: Terrain, sensor: Sensor, run: Run) {
	const p = GROUND[sensor];
	const x0 = run.cam.x - VIEW_W / 2 - 30;
	const x1 = run.cam.x + VIEW_W / 2 + 30;
	const y0 = run.cam.y - VIEW_H / 2 - 30;
	const y1 = run.cam.y + VIEW_H / 2 + 30;
	const seen = (x: number, y: number, w: number, h: number) =>
		x < x1 && x + w > x0 && y < y1 && y + h > y0;

	c.fillStyle = p.base;
	c.fillRect(0, 0, MAP_W, MAP_H);
	c.lineJoin = 'round';
	c.lineCap = 'round';

	for (const f of terrain.fields) {
		if (!seen(f.x, f.y, f.w, f.h)) continue;
		c.fillStyle = p.fields[f.tone % p.fields.length];
		c.fillRect(f.x, f.y, f.w, f.h);
		c.strokeStyle = p.furrow;
		c.lineWidth = 1;
		c.beginPath();
		if (f.vertical)
			for (let x = f.x + 9; x < f.x + f.w; x += 9) (c.moveTo(x, f.y), c.lineTo(x, f.y + f.h));
		else for (let y = f.y + 9; y < f.y + f.h; y += 9) (c.moveTo(f.x, y), c.lineTo(f.x + f.w, y));
		c.stroke();
		c.strokeStyle = p.field;
		c.lineWidth = p.line;
		c.strokeRect(f.x, f.y, f.w, f.h);
	}

	for (const road of terrain.roads) {
		const trace = () => {
			c.beginPath();
			road.points.forEach((pt, i) => (i === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y)));
		};
		trace();
		c.strokeStyle = p.roadEdge;
		c.lineWidth = road.width + p.line * 2;
		c.stroke();
		trace();
		c.strokeStyle = p.road;
		c.lineWidth = road.width;
		c.stroke();
		if (sensor === 'eo') {
			trace();
			c.strokeStyle = 'rgba(17,17,17,0.35)';
			c.lineWidth = 1.5;
			c.setLineDash([8, 9]);
			c.stroke();
			c.setLineDash([]);
		}
	}

	for (const w of terrain.woods) {
		if (!seen(w.x - 50, w.y - 50, 100, 100)) continue;
		c.strokeStyle = p.woodLine;
		c.lineWidth = p.line;
		for (const tree of w.trees) disc(c, tree.x, tree.y, tree.r, p.wood);
	}

	for (const h of terrain.houses) {
		if (!seen(h.x - 10, h.y - 10, 30, 30)) continue;
		c.strokeStyle = sensor === 'eo' ? INK : p.house;
		c.lineWidth = p.line;
		box(c, h.x - h.w / 2, h.y - h.h / 2, h.w, h.h, p.house);
		c.fillStyle = p.roofs[h.roof % p.roofs.length];
		c.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h * 0.5);
		if (sensor === 'eo') c.strokeRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
	}
}

// ---------- contacts ----------

interface Look {
	body: string;
	dark: string;
	light: string;
	glass: string;
	line: string;
	lineWidth: number;
}

const CIVILIAN_PAINT = ['#e5484d', '#4fa8d8', '#f2efe2', '#ddb93c', '#d9823b'];

/** How a contact looks to a sensor, or null when the sensor does not see it at all */
function lookFor(contact: Contact, sensor: Sensor): Look | null {
	if (sensor === 'eo') {
		if (contact.olive) {
			return {
				body: '#6f7f3c',
				dark: '#3f4b23',
				light: '#8a9a50',
				glass: '#2c3a28',
				line: INK,
				lineWidth: 2
			};
		}
		const paint = CIVILIAN_PAINT[Math.floor(hash(contact.id, 1) * CIVILIAN_PAINT.length)];
		return {
			body: contact.kind === 'herd' ? '#f4f1e6' : paint,
			dark: '#2b2b2b',
			light: '#ffffff',
			glass: '#27425a',
			line: INK,
			lineWidth: 2
		};
	}
	if (sensor === 'ir') {
		return contact.hot
			? {
					body: '#ffffff',
					dark: '#dcdcdc',
					light: '#ffffff',
					glass: '#9a9a9a',
					line: 'rgba(0,0,0,0)',
					lineWidth: 0
				}
			: {
					body: '#41464b',
					dark: '#2f3338',
					light: '#4b5157',
					glass: '#25282b',
					line: '#5a616b',
					lineWidth: 1
				};
	}
	if (!contact.metal) return null;
	return {
		body: '#e9fff1',
		dark: '#a9ecc4',
		light: '#ffffff',
		glass: '#7fcfa0',
		line: '#0d2417',
		lineWidth: 1
	};
}

/** Kinds that do not turn with a heading */
const UPRIGHT = new Set(['aa', 'command', 'troops', 'herd']);

function drawSprite(c: CanvasRenderingContext2D, contact: Contact, look: Look, timeMs: number) {
	c.save();
	c.translate(contact.x, contact.y);
	if (!UPRIGHT.has(contact.kind)) c.rotate(contact.heading);
	c.lineWidth = look.lineWidth;
	c.strokeStyle = look.line;
	c.lineJoin = 'round';

	switch (contact.kind) {
		case 'tank':
			box(c, -17, -11, 34, 5, look.dark);
			box(c, -17, 6, 34, 5, look.dark);
			rrect(c, -15, -7, 30, 14, 3);
			fillStroke(c, look.body);
			disc(c, -1, 0, 6.5, look.light);
			box(c, 4, -1.6, 17, 3.2, look.dark);
			break;
		case 'truck':
			box(c, -17, -8, 22, 16, look.body);
			box(c, 5, -7, 12, 14, look.dark);
			box(c, 12, -5, 3.5, 10, look.glass);
			break;
		case 'artillery':
			box(c, -12, -11, 8, 4, look.dark);
			box(c, -12, 7, 8, 4, look.dark);
			rrect(c, -15, -7, 22, 14, 3);
			fillStroke(c, look.body);
			box(c, 2, -2.2, 28, 4.4, look.dark);
			box(c, 26, -3.2, 5, 6.4, look.dark);
			break;
		case 'aa': {
			rrect(c, -11, -11, 22, 22, 3);
			fillStroke(c, look.body);
			for (const tilt of [-0.4, 0.4]) {
				c.save();
				c.rotate(tilt);
				box(c, -3, -19, 6, 17, look.dark);
				c.restore();
			}
			c.beginPath();
			c.ellipse(0, 3, 8 * Math.abs(Math.cos(timeMs / 450)) + 1.5, 8, 0, 0, Math.PI * 2);
			fillStroke(c, look.light);
			break;
		}
		case 'troops':
			for (const [x, y] of [
				[-9, -5],
				[6, -8],
				[-3, 6],
				[10, 4]
			]) {
				disc(c, x, y, 3.8, look.body);
				box(c, x + 3, y - 0.8, 6, 1.6, look.dark);
			}
			break;
		case 'command':
			c.beginPath();
			c.moveTo(-16, 11);
			c.lineTo(0, -13);
			c.lineTo(16, 11);
			c.closePath();
			fillStroke(c, look.body);
			c.beginPath();
			c.moveTo(-4, 11);
			c.lineTo(0, 0);
			c.lineTo(4, 11);
			c.closePath();
			fillStroke(c, look.dark);
			c.beginPath();
			c.moveTo(0, -13);
			c.lineTo(0, -25);
			c.stroke();
			disc(c, 0, -25, 2, look.light);
			break;
		case 'car':
			rrect(c, -10, -6, 20, 12, 3);
			fillStroke(c, look.body);
			box(c, 2.5, -4.5, 4.5, 9, look.glass);
			box(c, -7, -4.5, 3, 9, look.glass);
			break;
		case 'tractor':
			disc(c, -7, -8, 5, look.dark);
			disc(c, -7, 8, 5, look.dark);
			disc(c, 9, -6, 3, look.dark);
			disc(c, 9, 6, 3, look.dark);
			rrect(c, -9, -5, 18, 10, 2);
			fillStroke(c, look.body);
			box(c, -5, -4, 6, 8, look.glass);
			break;
		case 'bus':
			rrect(c, -19, -7, 38, 14, 3);
			fillStroke(c, look.body);
			for (let i = 0; i < 5; i++) box(c, -15 + i * 6.5, -5, 4.5, 3.5, look.glass);
			box(c, 14, -5, 3, 10, look.glass);
			break;
		case 'herd':
			for (const [x, y] of [
				[-10, -6],
				[2, -9],
				[11, -2],
				[-5, 5],
				[6, 8],
				[-13, 4]
			]) {
				c.beginPath();
				c.ellipse(x, y, 4.6, 3.4, 0, 0, Math.PI * 2);
				fillStroke(c, look.body);
				disc(c, x + 4.5, y, 1.8, look.dark);
			}
			break;
		case 'farm':
			box(c, -14, -10, 28, 20, look.body);
			box(c, -14, -10, 28, 5, look.dark);
			c.beginPath();
			c.moveTo(0, -10);
			c.lineTo(0, 10);
			c.stroke();
			break;
	}
	c.restore();
}

function drawNet(c: CanvasRenderingContext2D, contact: Contact) {
	c.save();
	c.translate(contact.x, contact.y);
	c.lineJoin = 'round';
	c.beginPath();
	const points = 11;
	for (let i = 0; i < points; i++) {
		const angle = (i / points) * Math.PI * 2;
		const r = 20 + hash(contact.id, 10 + i) * 11;
		const x = Math.cos(angle) * r * 1.2;
		const y = Math.sin(angle) * r * 0.9;
		if (i === 0) c.moveTo(x, y);
		else c.lineTo(x, y);
	}
	c.closePath();
	c.fillStyle = '#566632';
	c.fill();
	c.lineWidth = 2;
	c.strokeStyle = INK;
	c.stroke();
	const patches = ['#3f4b23', '#7d8c48', '#4a5a2a'];
	for (let i = 0; i < 6; i++) {
		c.beginPath();
		c.arc(
			(hash(contact.id, 30 + i) - 0.5) * 30,
			(hash(contact.id, 40 + i) - 0.5) * 20,
			4 + hash(contact.id, 50 + i) * 5,
			0,
			Math.PI * 2
		);
		c.fillStyle = patches[i % patches.length];
		c.fill();
	}
	c.restore();
}

function drawBrackets(
	c: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	len: number
) {
	c.beginPath();
	for (const [sx, sy] of [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	]) {
		c.moveTo(x + sx * size, y + sy * (size - len));
		c.lineTo(x + sx * size, y + sy * size);
		c.lineTo(x + sx * (size - len), y + sy * size);
	}
	c.stroke();
}

function outlinedText(
	c: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	fill: string
) {
	c.lineWidth = 3;
	c.strokeStyle = 'rgba(0,0,0,0.75)';
	c.strokeText(text, x, y);
	c.fillStyle = fill;
	c.fillText(text, x, y);
}

const PIP_COLOUR: Record<Sensor, string> = { eo: '#ffd84a', ir: '#ff6a4d', sar: '#7dffb0' };

function drawContact(c: CanvasRenderingContext2D, t: Track, rs: RenderState) {
	const { run } = rs;
	const sensor = run.sensor;
	const contact = t.contact;
	const gone = t.status === 'struck' && run.clock >= t.struckAt;

	if (gone) {
		drawWreck(c, t, rs);
		return;
	}

	const look = lookFor(contact, sensor);
	c.save();
	c.globalAlpha = t.status === 'cleared' ? 0.5 : 1;

	if (sensor === 'ir' && contact.hot) {
		const glow = c.createRadialGradient(contact.x, contact.y, 2, contact.x, contact.y, 30);
		glow.addColorStop(0, 'rgba(255,255,255,0.65)');
		glow.addColorStop(1, 'rgba(255,255,255,0)');
		c.fillStyle = glow;
		c.fillRect(contact.x - 32, contact.y - 32, 64, 64);
	}

	if (sensor === 'eo' && contact.covered) {
		drawNet(c, contact);
	} else if (look) {
		drawSprite(c, contact, look, rs.timeMs);
		if (contact.covered) {
			// IR and radar look straight through the net, but you can still see it is there
			c.strokeStyle = sensor === 'ir' ? 'rgba(255,255,255,0.5)' : 'rgba(125,255,176,0.6)';
			c.lineWidth = 1;
			c.setLineDash([3, 3]);
			c.beginPath();
			c.ellipse(contact.x, contact.y, 28, 21, 0, 0, Math.PI * 2);
			c.stroke();
			c.setLineDash([]);
		}
		if (sensor === 'sar') {
			c.strokeStyle = '#ffffff';
			c.lineWidth = 1;
			c.beginPath();
			for (let i = 0; i < 3; i++) {
				const a = hash(contact.id, 60 + i) * Math.PI;
				const r = 14 + 4 * Math.sin(rs.timeMs / 200 + i * 2);
				c.moveTo(contact.x - Math.cos(a) * r, contact.y - Math.sin(a) * r);
				c.lineTo(contact.x + Math.cos(a) * r, contact.y + Math.sin(a) * r);
			}
			c.stroke();
		}
	}

	if (t.status === 'cleared') {
		c.globalAlpha = 1;
		c.strokeStyle = '#7dff9a';
		c.lineWidth = 3;
		c.beginPath();
		c.moveTo(contact.x - 7, contact.y - 20);
		c.lineTo(contact.x - 2, contact.y - 14);
		c.lineTo(contact.x + 8, contact.y - 27);
		c.stroke();
		c.restore();
		return;
	}

	// A missile is on its way: no cue any more
	if (t.status === 'struck') {
		c.restore();
		return;
	}

	// The tracking cue: every open contact is boxed in, whatever the sensor sees
	const selected = run.selected === contact.id;
	const accent = ACCENT[sensor];
	c.globalAlpha = 1;
	c.strokeStyle = selected ? accent : 'rgba(255,255,255,0.8)';
	c.lineWidth = selected ? 2.5 : 1.6;
	const size = selected ? 27 + Math.sin(rs.timeMs / 140) * 1.5 : 24;
	// A dark halo under the brackets keeps them readable on every ground
	c.save();
	c.strokeStyle = 'rgba(0,0,0,0.55)';
	c.lineWidth += 2.5;
	drawBrackets(c, contact.x, contact.y, size, 8);
	c.restore();
	drawBrackets(c, contact.x, contact.y, size, 8);

	c.font = 'bold 11px ui-monospace, Consolas, monospace';
	c.textAlign = 'left';
	c.textBaseline = 'alphabetic';
	outlinedText(
		c,
		String(contact.id),
		contact.x + size + 3,
		contact.y - size + 9,
		selected ? accent : '#ffffff'
	);

	// Which sensors have already read this contact
	const sensors: Sensor[] = ['eo', 'ir', 'sar'];
	sensors.forEach((s, i) => {
		const px = contact.x - 8 + i * 8;
		const py = contact.y + size + 6;
		c.beginPath();
		c.arc(px, py, 2.6, 0, Math.PI * 2);
		c.fillStyle = t.dossier[s] ? PIP_COLOUR[s] : 'rgba(0,0,0,0.6)';
		c.fill();
		c.lineWidth = 1;
		c.strokeStyle = 'rgba(255,255,255,0.85)';
		c.stroke();
	});

	c.restore();
}

function drawAaRing(c: CanvasRenderingContext2D, contact: Contact, rs: RenderState) {
	const pulse = 0.5 + 0.5 * Math.sin(rs.timeMs / 260);
	c.save();
	c.beginPath();
	c.arc(contact.x, contact.y, AA_RADIUS, 0, Math.PI * 2);
	if (rs.run.threatened) {
		c.fillStyle = `rgba(229,72,77,${0.12 + pulse * 0.1})`;
		c.fill();
	}
	c.setLineDash([10, 8]);
	c.lineDashOffset = -rs.timeMs / 60;
	c.lineWidth = 3;
	c.strokeStyle = `rgba(0,0,0,0.5)`;
	c.stroke();
	c.lineWidth = 1.8;
	c.strokeStyle = `rgba(255,106,100,${0.75 + pulse * 0.25})`;
	c.stroke();
	c.restore();
}

function drawWreck(c: CanvasRenderingContext2D, t: Track, rs: RenderState) {
	const { x, y } = t.contact;
	const sensor = rs.run.sensor;
	const age = rs.run.clock - t.struckAt;
	c.save();
	c.fillStyle = sensor === 'ir' ? 'rgba(255,255,255,0.35)' : 'rgba(10,10,10,0.7)';
	c.beginPath();
	c.ellipse(x, y, 17, 13, 0, 0, Math.PI * 2);
	c.fill();
	if (sensor === 'sar') {
		c.fillStyle = '#d6fbe3';
		for (let i = 0; i < 5; i++) {
			c.fillRect(
				x + (hash(t.contact.id, 70 + i) - 0.5) * 24,
				y + (hash(t.contact.id, 80 + i) - 0.5) * 18,
				2,
				2
			);
		}
	}
	if (sensor !== 'sar') {
		for (let i = 0; i < 4; i++) {
			const phase = (((rs.timeMs / 2600 + i / 4 + hash(t.contact.id, 5)) % 1) + 1) % 1;
			const alpha = (1 - phase) * 0.55 * Math.min(1, age / 0.6);
			c.fillStyle =
				sensor === 'ir' ? `rgba(255,255,255,${alpha * 0.6})` : `rgba(40,40,40,${alpha})`;
			c.beginPath();
			c.arc(x + Math.sin(phase * 5 + i) * 5, y - phase * 55, 6 + phase * 12, 0, Math.PI * 2);
			c.fill();
		}
	}
	if (age < 0.8) {
		const k = age / 0.8;
		c.globalAlpha = 1 - k;
		c.fillStyle = '#ffd84a';
		c.beginPath();
		c.arc(x, y, 8 + k * 46, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = '#e5484d';
		c.beginPath();
		c.arc(x, y, 5 + k * 28, 0, Math.PI * 2);
		c.fill();
		c.strokeStyle = '#ffffff';
		c.lineWidth = 3;
		c.beginPath();
		c.arc(x, y, 12 + k * 70, 0, Math.PI * 2);
		c.stroke();
		c.strokeStyle = '#ffd84a';
		c.lineWidth = 2;
		c.beginPath();
		for (let i = 0; i < 10; i++) {
			const a = hash(t.contact.id, 90 + i) * Math.PI * 2;
			c.moveTo(x + Math.cos(a) * (10 + k * 20), y + Math.sin(a) * (10 + k * 20));
			c.lineTo(x + Math.cos(a) * (18 + k * 52), y + Math.sin(a) * (18 + k * 52));
		}
		c.stroke();
	}
	c.restore();
}

function drawMissile(c: CanvasRenderingContext2D, t: Track, rs: RenderState) {
	const remaining = t.struckAt - rs.run.clock;
	if (remaining <= 0 || remaining > MISSILE_FLIGHT_S) return;
	const k = remaining / MISSILE_FLIGHT_S;
	const { x, y } = t.contact;
	const hx = x + k * 90;
	const hy = y - k * 330;
	c.save();
	c.lineCap = 'round';
	c.strokeStyle = 'rgba(255,255,255,0.7)';
	c.lineWidth = 3;
	c.beginPath();
	c.moveTo(hx, hy);
	c.lineTo(hx + 22, hy - 70);
	c.stroke();
	c.strokeStyle = '#ffd84a';
	c.lineWidth = 4;
	c.beginPath();
	c.moveTo(hx, hy);
	c.lineTo(hx + 5, hy - 14);
	c.stroke();
	c.restore();
}

function drawLock(c: CanvasRenderingContext2D, run: Run, timeMs: number) {
	if (!run.lock) return;
	const t = run.tracks.find((tr) => tr.contact.id === run.lock!.id);
	if (!t) return;
	const { x, y } = t.contact;
	const accent = ACCENT[run.lock.sensor];
	const progress = Math.min(1, run.lock.progress);
	c.save();
	c.lineCap = 'round';
	c.strokeStyle = 'rgba(0,0,0,0.6)';
	c.lineWidth = 7;
	c.beginPath();
	c.arc(x, y, 34, -Math.PI / 2, Math.PI * 1.5);
	c.stroke();
	c.strokeStyle = accent;
	c.lineWidth = 4;
	c.beginPath();
	c.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
	c.stroke();
	// Spinning ticks sell the search
	c.lineWidth = 2;
	c.beginPath();
	for (let i = 0; i < 4; i++) {
		const a = timeMs / 400 + (i * Math.PI) / 2;
		c.moveTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
		c.lineTo(x + Math.cos(a) * 47, y + Math.sin(a) * 47);
	}
	c.stroke();
	c.restore();
}

// ---------- overlay ----------

export const MINIMAP = { x: VIEW_W - 64, y: VIEW_H - 86, w: 54, h: 72 } as const;

/** Maps a point of the scope (in world units) on the minimap to a map position, or null */
export function minimapToMap(vx: number, vy: number): { x: number; y: number } | null {
	const pad = 4;
	if (
		vx < MINIMAP.x - pad ||
		vx > MINIMAP.x + MINIMAP.w + pad ||
		vy < MINIMAP.y - pad ||
		vy > MINIMAP.y + MINIMAP.h + pad
	) {
		return null;
	}
	return {
		x: ((vx - MINIMAP.x) / MINIMAP.w) * MAP_W,
		y: ((vy - MINIMAP.y) / MINIMAP.h) * MAP_H
	};
}

function drawMinimap(c: CanvasRenderingContext2D, run: Run, accent: string) {
	const { x, y, w, h } = MINIMAP;
	const sx = w / MAP_W;
	const sy = h / MAP_H;
	c.save();
	c.fillStyle = 'rgba(0,0,0,0.6)';
	c.fillRect(x - 2, y - 2, w + 4, h + 4);
	c.strokeStyle = accent;
	c.lineWidth = 1;
	c.strokeRect(x - 2, y - 2, w + 4, h + 4);
	for (const t of run.tracks) {
		const px = x + t.contact.x * sx;
		const py = y + t.contact.y * sy;
		if (t.status === 'struck') c.fillStyle = '#ff6a64';
		else if (t.status === 'cleared') c.fillStyle = '#7dff9a';
		else c.fillStyle = '#ffffff';
		if (t.contact.kind === 'aa' && t.status === 'open') {
			c.fillStyle = '#ff6a64';
			c.fillRect(px - 2.5, py - 2.5, 5, 5);
		} else {
			c.beginPath();
			c.arc(px, py, t.status === 'open' ? 2.2 : 1.5, 0, Math.PI * 2);
			c.fill();
		}
	}
	c.strokeStyle = accent;
	c.lineWidth = 1.5;
	c.strokeRect(
		x + (run.cam.x - VIEW_W / 2) * sx,
		y + (run.cam.y - VIEW_H / 2) * sy,
		VIEW_W * sx,
		VIEW_H * sy
	);
	c.restore();
}

function drawOverlay(c: CanvasRenderingContext2D, rs: RenderState) {
	const { run } = rs;
	const sensor = run.sensor;
	const accent = ACCENT[sensor];
	c.save();

	if (sensor !== 'eo') {
		c.fillStyle = 'rgba(0,0,0,0.13)';
		for (let y = 0; y < VIEW_H; y += 3) c.fillRect(0, y, VIEW_W, 1);
		c.save();
		c.globalAlpha = sensor === 'sar' ? 0.22 : 0.09;
		c.globalCompositeOperation = 'overlay';
		const offX = Math.floor(Math.random() * 96);
		const offY = Math.floor(Math.random() * 96);
		c.fillStyle = c.createPattern(noise(), 'repeat') ?? '#000';
		c.translate(-offX, -offY);
		c.fillRect(0, 0, VIEW_W + 96, VIEW_H + 96);
		c.restore();
	}

	const vignette = c.createRadialGradient(
		VIEW_W / 2,
		VIEW_H / 2,
		VIEW_H * 0.35,
		VIEW_W / 2,
		VIEW_H / 2,
		VIEW_H * 0.75
	);
	vignette.addColorStop(0, 'rgba(0,0,0,0)');
	vignette.addColorStop(1, sensor === 'eo' ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.5)');
	c.fillStyle = vignette;
	c.fillRect(0, 0, VIEW_W, VIEW_H);

	if (run.threatened) {
		const pulse = 0.5 + 0.5 * Math.sin(rs.timeMs / 120);
		c.strokeStyle = `rgba(229,72,77,${0.45 + pulse * 0.4})`;
		c.lineWidth = 10;
		c.strokeRect(0, 0, VIEW_W, VIEW_H);
	}

	// Edge ticks that scroll with the map
	c.strokeStyle = accent;
	c.globalAlpha = 0.7;
	c.lineWidth = 1;
	c.beginPath();
	for (let i = 0; i < VIEW_W; i += 20) {
		const mapX = Math.round(run.cam.x - VIEW_W / 2 + i);
		const len = Math.round(mapX / 20) % 5 === 0 ? 7 : 3.5;
		const px = i - ((run.cam.x - VIEW_W / 2) % 20);
		c.moveTo(px + 20, 0);
		c.lineTo(px + 20, len);
	}
	for (let j = 0; j < VIEW_H; j += 20) {
		const py = j - ((run.cam.y - VIEW_H / 2) % 20) + 20;
		c.moveTo(0, py);
		c.lineTo(Math.round((run.cam.y - VIEW_H / 2 + j) / 20) % 5 === 0 ? 7 : 3.5, py);
	}
	c.stroke();
	c.globalAlpha = 1;

	// Corner brackets
	c.strokeStyle = accent;
	c.lineWidth = 2.5;
	c.beginPath();
	for (const [sx, sy] of [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	]) {
		const px = sx ? VIEW_W - 8 : 8;
		const py = sy ? VIEW_H - 8 : 8;
		const dx = sx ? -18 : 18;
		const dy = sy ? -18 : 18;
		c.moveTo(px, py + dy);
		c.lineTo(px, py);
		c.lineTo(px + dx, py);
	}
	c.stroke();

	// Reticle: this is where the drone hovers
	const reticle = run.threatened ? '#ff6a64' : accent;
	c.strokeStyle = 'rgba(0,0,0,0.5)';
	c.lineWidth = 4;
	reticlePath(c);
	c.stroke();
	c.strokeStyle = reticle;
	c.lineWidth = 1.5;
	reticlePath(c);
	c.stroke();

	c.font = 'bold 10px ui-monospace, Consolas, monospace';
	c.textBaseline = 'alphabetic';
	c.textAlign = 'left';
	outlinedText(c, LABEL[sensor], 16, 28, accent);
	c.textAlign = 'right';
	if (Math.floor(rs.timeMs / 600) % 2 === 0) {
		c.beginPath();
		c.arc(VIEW_W - 50, 25, 3.5, 0, Math.PI * 2);
		c.fillStyle = '#ff4d4d';
		c.fill();
	}
	outlinedText(c, 'REC', VIEW_W - 16, 28, accent);
	c.textAlign = 'left';
	outlinedText(
		c,
		`${String(Math.round(run.cam.x)).padStart(3, '0')}E ${String(Math.round(run.cam.y)).padStart(3, '0')}N`,
		16,
		VIEW_H - 16,
		accent
	);
	if (run.threatened) {
		c.textAlign = 'center';
		c.font = 'bold 12px ui-monospace, Consolas, monospace';
		outlinedText(c, 'AIR DEFENCE LOCK', VIEW_W / 2, 52, '#ff6a64');
	}

	drawMinimap(c, run, accent);

	if (rs.switchMs > 0) {
		const k = rs.switchMs / 180;
		c.fillStyle = `rgba(255,255,255,${0.35 * k})`;
		for (let i = 0; i < 10; i++) {
			c.fillRect(0, Math.random() * VIEW_H, VIEW_W, 1 + Math.random() * 5);
		}
	}
	if (rs.flashMs > 0) {
		c.fillStyle = rs.flashBad ? 'rgba(229,72,77,0.4)' : 'rgba(255,255,255,0.35)';
		c.globalAlpha = Math.min(1, rs.flashMs / 300);
		c.fillRect(0, 0, VIEW_W, VIEW_H);
	}
	c.restore();
}

function reticlePath(c: CanvasRenderingContext2D) {
	const cx = VIEW_W / 2;
	const cy = VIEW_H / 2;
	c.beginPath();
	for (const [dx, dy] of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	]) {
		c.moveTo(cx + dx * 7, cy + dy * 7);
		c.lineTo(cx + dx * 15, cy + dy * 15);
	}
}

export function drawScene(
	c: CanvasRenderingContext2D,
	rs: RenderState,
	shake: { x: number; y: number }
) {
	const { run } = rs;
	c.save();
	c.beginPath();
	c.rect(0, 0, VIEW_W, VIEW_H);
	c.clip();
	c.translate(shake.x, shake.y);
	c.save();
	c.translate(VIEW_W / 2 - run.cam.x, VIEW_H / 2 - run.cam.y);
	drawTerrain(c, run.terrain, run.sensor, run);

	// Air defence rings sit under everything else
	for (const t of run.tracks) {
		if (t.contact.kind === 'aa' && t.status === 'open') drawAaRing(c, t.contact, rs);
	}
	const ordered = [...run.tracks].sort((a, b) => a.contact.y - b.contact.y);
	for (const t of ordered) {
		const { x, y } = t.contact;
		if (Math.abs(x - run.cam.x) > VIEW_W / 2 + 70 || Math.abs(y - run.cam.y) > VIEW_H / 2 + 80)
			continue;
		drawContact(c, t, rs);
	}
	for (const t of run.tracks) {
		if (t.status === 'struck') drawMissile(c, t, rs);
	}
	drawLock(c, run, rs.timeMs);
	c.restore();

	drawOverlay(c, rs);
	c.restore();
}

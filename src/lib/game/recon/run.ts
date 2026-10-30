/*
 * The Recon rules as plain data and functions: a run of up to eight sorties, each one a map with
 * contacts, a clock, a limited number of missiles and a drone that air defence can hurt. The
 * store drives stepRun from the game loop and turns the events it leaves behind into sounds
 * and visual effects.
 */
import {
	AA_DPS,
	AA_RADIUS,
	ESCALATION,
	ESCALATION_DECAY_CLEAN,
	ESCALATION_LIMIT,
	HIT_RADIUS,
	LOCK_S,
	MAP_H,
	MAP_W,
	MAX_INTEGRITY,
	MAX_SORTIES,
	MISSILE_FLIGHT_S,
	POINTS,
	REPAIR_BETWEEN_SORTIES,
	START,
	VIEW_H,
	VIEW_W
} from './config.js';
import {
	emptyDossier,
	readSensor,
	type Contact,
	type Dossier,
	type Role,
	type Sensor
} from './contacts.js';
import { generateSortie, type Sortie } from './sortie.js';
import type { Terrain } from './terrain.js';
import type { Random } from '../random.js';

export type TrackStatus = 'open' | 'struck' | 'cleared';

export interface Track {
	contact: Contact;
	status: TrackStatus;
	dossier: Dossier;
	/** Run clock second at which the missile lands; the contact is gone from then on */
	struckAt: number;
}

export interface Lock {
	id: number;
	sensor: Sensor;
	/** 0 to 1 */
	progress: number;
}

export type Phase = 'active' | 'debrief' | 'over';
export type OverReason = 'integrity' | 'escalation' | 'won';

export interface SortieResult {
	sortie: number;
	hostilesStruck: number;
	harmlessCleared: number;
	civiliansStruck: number;
	decoysStruck: number;
	escaped: number;
	timeBonus: number;
	cleanBonus: number;
	/** Points gained or lost during the sortie, bonuses included */
	total: number;
	/** The drone was lost or the clock ran out before everything was settled */
	ended: 'done' | 'timeout' | 'integrity' | 'escalation';
}

export type ReconEvent =
	| { kind: 'lock-start'; id: number }
	| { kind: 'lock-done'; id: number; sensor: Sensor }
	| { kind: 'launch'; id: number }
	| { kind: 'impact'; id: number; role: Role; x: number; y: number }
	| { kind: 'cleared'; id: number; role: Role }
	| { kind: 'threat' }
	| { kind: 'sortie-end'; result: SortieResult }
	| { kind: 'over'; reason: OverReason };

export interface Run {
	sortie: number;
	phase: Phase;
	overReason: OverReason | null;
	terrain: Terrain;
	tracks: Track[];
	/** Centre of the scope, which is also where the drone hovers */
	cam: { x: number; y: number };
	sensor: Sensor;
	lock: Lock | null;
	selected: number | null;
	timeLeft: number;
	ordnance: number;
	integrity: number;
	escalation: number;
	score: number;
	/** Points of the current sortie so far */
	sortieDelta: number;
	collateral: number;
	/** Whether an air defence site has the drone in range right now */
	threatened: boolean;
	result: SortieResult | null;
	/** Seconds since the run started, also running during the debrief so effects play out */
	clock: number;
	events: ReconEvent[];
	random: Random;
	counts: {
		hostilesStruck: number;
		harmlessCleared: number;
		civiliansStruck: number;
		decoysStruck: number;
	};
}

export function createRun(random: Random): Run {
	const run: Run = {
		sortie: 0,
		phase: 'active',
		overReason: null,
		cam: { x: START.x, y: START.y },
		sensor: 'eo',
		lock: null,
		selected: null,
		timeLeft: 0,
		ordnance: 0,
		integrity: MAX_INTEGRITY,
		escalation: 0,
		score: 0,
		sortieDelta: 0,
		collateral: 0,
		threatened: false,
		result: null,
		clock: 0,
		events: [],
		random,
		tracks: [],
		terrain: { fields: [], woods: [], roads: [], villages: [], houses: [] },
		counts: { hostilesStruck: 0, harmlessCleared: 0, civiliansStruck: 0, decoysStruck: 0 }
	};
	beginSortie(run, 1);
	return run;
}

function loadSortie(run: Run, sortie: Sortie) {
	run.terrain = sortie.terrain;
	run.tracks = sortie.contacts.map((contact) => ({
		contact,
		status: 'open',
		dossier: emptyDossier(),
		struckAt: 0
	}));
	run.ordnance = sortie.ordnance;
	run.timeLeft = sortie.params.timeS;
}

export function beginSortie(run: Run, sortie: number) {
	run.sortie = sortie;
	loadSortie(run, generateSortie(run.random, sortie));
	run.phase = 'active';
	run.cam = { x: START.x, y: START.y };
	run.lock = null;
	run.selected = null;
	run.sortieDelta = 0;
	run.collateral = 0;
	run.threatened = false;
	run.result = null;
	run.counts = { hostilesStruck: 0, harmlessCleared: 0, civiliansStruck: 0, decoysStruck: 0 };
}

/** Moves on after a debrief: repairs a little and sends the next sortie */
export function nextSortie(run: Run) {
	if (run.phase !== 'debrief') return;
	run.integrity = Math.min(MAX_INTEGRITY, run.integrity + REPAIR_BETWEEN_SORTIES);
	beginSortie(run, run.sortie + 1);
}

export function track(run: Run, id: number): Track | undefined {
	return run.tracks.find((t) => t.contact.id === id);
}

function clampCam(x: number, y: number) {
	return {
		x: Math.min(MAP_W - VIEW_W / 2, Math.max(VIEW_W / 2, x)),
		y: Math.min(MAP_H - VIEW_H / 2, Math.max(VIEW_H / 2, y))
	};
}

export function panTo(run: Run, x: number, y: number) {
	if (run.phase !== 'active') return;
	run.cam = clampCam(x, y);
}

export function panBy(run: Run, dx: number, dy: number) {
	panTo(run, run.cam.x + dx, run.cam.y + dy);
}

export function inView(run: Run, x: number, y: number, margin = 0): boolean {
	return (
		Math.abs(x - run.cam.x) <= VIEW_W / 2 - margin && Math.abs(y - run.cam.y) <= VIEW_H / 2 - margin
	);
}

export function setSensor(run: Run, sensor: Sensor) {
	if (run.phase !== 'active' || run.sensor === sensor) return;
	run.sensor = sensor;
	run.lock = null;
}

/** The nearest open contact within tapping distance of a world position */
export function contactAt(run: Run, x: number, y: number): number | null {
	let best: number | null = null;
	let bestDist = HIT_RADIUS;
	for (const t of run.tracks) {
		if (t.status !== 'open') continue;
		const d = Math.hypot(t.contact.x - x, t.contact.y - y);
		if (d < bestDist) {
			bestDist = d;
			best = t.contact.id;
		}
	}
	return best;
}

/** Selects a contact and, if the active sensor has not looked at it yet, starts a lock */
export function tapContact(run: Run, id: number) {
	if (run.phase !== 'active') return;
	const t = track(run, id);
	if (!t || t.status !== 'open') return;
	run.selected = id;
	if (t.dossier[run.sensor] === null) {
		run.lock = { id, sensor: run.sensor, progress: 0 };
		run.events.push({ kind: 'lock-start', id });
	} else {
		run.lock = null;
	}
}

export function deselect(run: Run) {
	run.selected = null;
	run.lock = null;
}

function award(run: Run, points: number) {
	run.score = Math.max(0, run.score + points);
	run.sortieDelta += points;
}

function openTracks(run: Run) {
	return run.tracks.filter((t) => t.status === 'open');
}

/** Fires a missile at a contact; returns whether it was launched */
export function strike(run: Run, id: number): boolean {
	if (run.phase !== 'active' || run.ordnance <= 0) return false;
	const t = track(run, id);
	if (!t || t.status !== 'open') return false;
	const { contact } = t;
	run.ordnance -= 1;
	t.status = 'struck';
	t.struckAt = run.clock + MISSILE_FLIGHT_S;
	if (run.selected === id) run.selected = null;
	if (run.lock?.id === id) run.lock = null;
	run.events.push({ kind: 'launch', id });
	run.events.push({ kind: 'impact', id, role: contact.role, x: contact.x, y: contact.y });

	if (contact.role === 'hostile') {
		run.counts.hostilesStruck += 1;
		award(run, contact.kind === 'aa' ? POINTS.aaStruck : POINTS.hostileStruck);
	} else if (contact.role === 'civilian') {
		run.counts.civiliansStruck += 1;
		run.collateral += 1;
		run.escalation = Math.min(ESCALATION_LIMIT, run.escalation + ESCALATION.civilianStruck);
		award(run, POINTS.civilianStruck);
	} else {
		run.counts.decoysStruck += 1;
		run.collateral += 1;
		run.escalation = Math.min(ESCALATION_LIMIT, run.escalation + ESCALATION.decoyStruck);
		award(run, POINTS.decoyStruck);
	}
	settle(run);
	return true;
}

/** Marks a contact as harmless; a hostile cleared this way escapes at the end of the sortie */
export function clear(run: Run, id: number): boolean {
	if (run.phase !== 'active') return false;
	const t = track(run, id);
	if (!t || t.status !== 'open') return false;
	t.status = 'cleared';
	if (run.selected === id) run.selected = null;
	if (run.lock?.id === id) run.lock = null;
	if (t.contact.role !== 'hostile') {
		run.counts.harmlessCleared += 1;
		award(run, POINTS.harmlessCleared);
	}
	run.events.push({ kind: 'cleared', id, role: t.contact.role });
	settle(run);
	return true;
}

/** Ends the sortie as soon as nothing is left to decide, or the escalation meter is full */
function settle(run: Run) {
	if (run.escalation >= ESCALATION_LIMIT) {
		endSortie(run, 'escalation');
	} else if (openTracks(run).length === 0) {
		endSortie(run, 'done');
	}
}

function endSortie(run: Run, ended: SortieResult['ended']) {
	if (run.phase !== 'active') return;
	run.lock = null;
	run.selected = null;
	run.threatened = false;

	// A hostile that was cleared or never dealt with gets away
	const escaped = run.tracks.filter(
		(t) => t.contact.role === 'hostile' && t.status !== 'struck'
	).length;
	if (escaped > 0) award(run, POINTS.hostileEscaped * escaped);

	const failed = ended === 'integrity' || ended === 'escalation';
	const timeBonus =
		ended === 'done' ? Math.ceil(Math.max(0, run.timeLeft)) * POINTS.timeBonusPerSecond : 0;
	if (timeBonus > 0) award(run, timeBonus);
	const cleanBonus =
		!failed && run.collateral === 0 && escaped === 0 ? POINTS.cleanBonusPerSortie * run.sortie : 0;
	if (cleanBonus > 0) award(run, cleanBonus);
	if (!failed && run.collateral === 0) {
		run.escalation = Math.max(0, run.escalation - ESCALATION_DECAY_CLEAN);
	}

	const won = !failed && run.sortie >= MAX_SORTIES;
	if (won) award(run, POINTS.campaignWon);

	const result: SortieResult = {
		sortie: run.sortie,
		...run.counts,
		escaped,
		timeBonus,
		cleanBonus,
		total: run.sortieDelta,
		ended
	};
	run.result = result;
	run.events.push({ kind: 'sortie-end', result });
	if (failed || won) {
		run.phase = 'over';
		run.overReason = failed ? (ended as 'integrity' | 'escalation') : 'won';
		run.events.push({ kind: 'over', reason: run.overReason });
	} else {
		run.phase = 'debrief';
	}
}

/** Advances the clock, the lock-on and the air defence by dt seconds */
export function stepRun(run: Run, dt: number) {
	run.clock += dt;
	if (run.phase !== 'active') return;

	run.timeLeft -= dt;
	if (run.lock) {
		const t = track(run, run.lock.id);
		if (!t || t.status !== 'open' || !inView(run, t.contact.x, t.contact.y)) {
			run.lock = null;
		} else {
			run.lock.progress += dt / LOCK_S;
			if (run.lock.progress >= 1) {
				const { sensor } = run.lock;
				t.dossier[sensor] = readSensor(t.contact, sensor);
				run.events.push({ kind: 'lock-done', id: t.contact.id, sensor });
				run.lock = null;
			}
		}
	}

	const threatened = run.tracks.some(
		(t) =>
			t.status === 'open' &&
			t.contact.kind === 'aa' &&
			Math.hypot(t.contact.x - run.cam.x, t.contact.y - run.cam.y) < AA_RADIUS
	);
	if (threatened) {
		if (!run.threatened) run.events.push({ kind: 'threat' });
		run.integrity = Math.max(0, run.integrity - AA_DPS * dt);
	}
	run.threatened = threatened;

	if (run.integrity <= 0) endSortie(run, 'integrity');
	else if (run.timeLeft <= 0) {
		run.timeLeft = 0;
		endSortie(run, 'timeout');
	}
}

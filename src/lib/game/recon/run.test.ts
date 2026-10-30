import { describe, expect, it } from 'vitest';
import {
	AA_DPS,
	AA_RADIUS,
	ESCALATION,
	ESCALATION_LIMIT,
	LOCK_S,
	MAX_INTEGRITY,
	MAX_SORTIES,
	POINTS,
	REPAIR_BETWEEN_SORTIES,
	START,
	VIEW_H,
	VIEW_W
} from './config.js';
import {
	beginSortie,
	clear,
	contactAt,
	createRun,
	nextSortie,
	panTo,
	setSensor,
	stepRun,
	strike,
	tapContact,
	track,
	type Run
} from './run.js';
import { createRandom } from '../random.js';

function newRun(seed = 11): Run {
	return createRun(createRandom(seed));
}

const idsWhere = (run: Run, role: 'hostile' | 'civilian' | 'decoy') =>
	run.tracks.filter((t) => t.contact.role === role).map((t) => t.contact.id);

/** Brings a contact into view so a lock can finish */
function lookAt(run: Run, id: number) {
	const { x, y } = track(run, id)!.contact;
	panTo(run, x, y);
}

describe('a new run', () => {
	it('starts sortie 1 at the south edge with one missile more than hostiles', () => {
		const run = newRun();
		expect(run.sortie).toBe(1);
		expect(run.phase).toBe('active');
		expect(run.cam).toEqual({ x: START.x, y: START.y });
		expect(run.ordnance).toBe(idsWhere(run, 'hostile').length + 1);
		expect(run.integrity).toBe(MAX_INTEGRITY);
		expect(run.score).toBe(0);
	});
});

describe('camera', () => {
	it('keeps the scope on the map', () => {
		const run = newRun();
		panTo(run, -500, -500);
		expect(run.cam).toEqual({ x: VIEW_W / 2, y: VIEW_H / 2 });
		panTo(run, 5000, 5000);
		expect(run.cam.x).toBeLessThan(5000);
	});
});

describe('lock-on', () => {
	it('logs the active sensor reading after LOCK_S seconds', () => {
		const run = newRun();
		const id = idsWhere(run, 'hostile')[0];
		lookAt(run, id);
		tapContact(run, id);
		expect(run.selected).toBe(id);
		expect(run.lock).toMatchObject({ id, sensor: 'eo' });

		stepRun(run, LOCK_S / 2);
		expect(track(run, id)!.dossier.eo).toBeNull();
		stepRun(run, LOCK_S / 2 + 0.01);
		expect(track(run, id)!.dossier.eo).toBe('military');
		expect(run.lock).toBeNull();
	});

	it('does not lock again for a reading it already has, and drops the lock on a sensor switch', () => {
		const run = newRun();
		const id = idsWhere(run, 'hostile')[0];
		lookAt(run, id);
		tapContact(run, id);
		setSensor(run, 'ir');
		expect(run.lock).toBeNull();
		tapContact(run, id);
		expect(run.lock?.sensor).toBe('ir');
		stepRun(run, LOCK_S + 0.01);
		tapContact(run, id);
		expect(run.lock).toBeNull();
	});

	it('is lost when the contact leaves the scope', () => {
		const run = newRun();
		const id = idsWhere(run, 'hostile')[0];
		lookAt(run, id);
		tapContact(run, id);
		panTo(run, START.x, 0);
		stepRun(run, 0.1);
		expect(run.lock).toBeNull();
	});

	it('finds the nearest open contact for a tap', () => {
		const run = newRun();
		const t = run.tracks[0].contact;
		expect(contactAt(run, t.x + 5, t.y - 5)).toBe(t.id);
		expect(contactAt(run, -100, -100)).toBeNull();
	});
});

describe('verdicts', () => {
	it('rewards a strike on a hostile and removes it from the map', () => {
		const run = newRun();
		const id = idsWhere(run, 'hostile')[0];
		const before = run.ordnance;
		expect(strike(run, id)).toBe(true);
		expect(run.ordnance).toBe(before - 1);
		expect(track(run, id)!.status).toBe('struck');
		expect(run.score).toBe(POINTS.hostileStruck);
		expect(strike(run, id)).toBe(false);
	});

	it('punishes striking a civilian with a penalty and escalation, never below zero score', () => {
		const run = newRun();
		const id = idsWhere(run, 'civilian')[0];
		strike(run, id);
		expect(run.escalation).toBe(ESCALATION.civilianStruck);
		expect(run.collateral).toBe(1);
		expect(run.score).toBe(0);
		expect(run.sortieDelta).toBe(POINTS.civilianStruck);
	});

	it('rewards clearing a harmless contact and lets a cleared hostile escape', () => {
		const run = newRun();
		clear(run, idsWhere(run, 'civilian')[0]);
		expect(run.score).toBe(POINTS.harmlessCleared);
		const hostile = idsWhere(run, 'hostile')[0];
		clear(run, hostile);
		expect(track(run, hostile)!.status).toBe('cleared');
		expect(run.score).toBe(POINTS.harmlessCleared);
		expect(strike(run, hostile)).toBe(false);
	});

	it('refuses to fire without missiles', () => {
		const run = newRun();
		run.ordnance = 0;
		expect(strike(run, idsWhere(run, 'hostile')[0])).toBe(false);
	});
});

describe('ending a sortie', () => {
	function perfect(run: Run) {
		for (const t of [...run.tracks]) {
			if (t.contact.role === 'hostile') strike(run, t.contact.id);
			else clear(run, t.contact.id);
		}
	}

	it('ends early on a perfect sortie with time and clean bonuses', () => {
		const run = newRun();
		stepRun(run, 10);
		const timeLeft = run.timeLeft;
		perfect(run);
		expect(run.phase).toBe('debrief');
		expect(run.result).toMatchObject({ ended: 'done', escaped: 0, civiliansStruck: 0 });
		expect(run.result!.timeBonus).toBe(Math.ceil(timeLeft) * POINTS.timeBonusPerSecond);
		expect(run.result!.cleanBonus).toBe(POINTS.cleanBonusPerSortie);
		expect(run.score).toBe(run.result!.total);
	});

	it('charges for every hostile still at large when the clock runs out', () => {
		const run = newRun();
		const hostiles = idsWhere(run, 'hostile').length;
		stepRun(run, run.timeLeft + 1);
		expect(run.phase).toBe('debrief');
		expect(run.result).toMatchObject({ ended: 'timeout', escaped: hostiles, timeBonus: 0 });
		expect(run.result!.total).toBe(POINTS.hostileEscaped * hostiles);
		expect(run.score).toBe(0);
	});

	it('withholds the clean bonus after collateral damage and bleeds off escalation only when clean', () => {
		const run = newRun();
		strike(run, idsWhere(run, 'civilian')[0]);
		for (const id of idsWhere(run, 'hostile')) strike(run, id);
		for (const t of run.tracks) if (t.status === 'open') clear(run, t.contact.id);
		expect(run.phase).toBe('debrief');
		expect(run.result!.cleanBonus).toBe(0);
		expect(run.escalation).toBe(ESCALATION.civilianStruck);

		nextSortie(run);
		for (const t of [...run.tracks]) {
			if (t.contact.role === 'hostile') strike(run, t.contact.id);
			else clear(run, t.contact.id);
		}
		expect(run.escalation).toBe(ESCALATION.civilianStruck - 20);
	});

	it('is over when the escalation meter fills up', () => {
		const run = newRun();
		run.escalation = ESCALATION_LIMIT - ESCALATION.civilianStruck;
		strike(run, idsWhere(run, 'civilian')[0]);
		expect(run.phase).toBe('over');
		expect(run.overReason).toBe('escalation');
		expect(run.result!.ended).toBe('escalation');
	});
});

describe('air defence', () => {
	function withAa(): { run: Run; aaId: number } {
		const run = newRun();
		beginSortie(run, 3);
		const aa = run.tracks.find((t) => t.contact.kind === 'aa')!;
		return { run, aaId: aa.contact.id };
	}

	it('damages the drone while the scope sits inside its range, and only then', () => {
		const { run, aaId } = withAa();
		stepRun(run, 1);
		expect(run.integrity).toBe(MAX_INTEGRITY);
		expect(run.threatened).toBe(false);

		const aa = track(run, aaId)!.contact;
		panTo(run, aa.x, aa.y);
		stepRun(run, 1);
		expect(run.threatened).toBe(true);
		expect(run.integrity).toBeCloseTo(MAX_INTEGRITY - AA_DPS, 5);
	});

	it('stops once the site is destroyed', () => {
		const { run, aaId } = withAa();
		const aa = track(run, aaId)!.contact;
		panTo(run, aa.x, aa.y);
		strike(run, aaId);
		const before = run.integrity;
		stepRun(run, 1);
		expect(run.integrity).toBe(before);
		expect(run.score).toBe(POINTS.aaStruck);
	});

	it('ends the run when the drone is lost', () => {
		const { run, aaId } = withAa();
		const aa = track(run, aaId)!.contact;
		panTo(run, aa.x, aa.y);
		expect(Math.hypot(run.cam.x - aa.x, run.cam.y - aa.y)).toBeLessThan(AA_RADIUS);
		stepRun(run, MAX_INTEGRITY / AA_DPS + 1);
		expect(run.phase).toBe('over');
		expect(run.overReason).toBe('integrity');
	});
});

describe('progression', () => {
	it('repairs a little and sends the next, harder sortie', () => {
		const run = newRun();
		run.integrity = 40;
		stepRun(run, run.timeLeft + 1);
		expect(run.phase).toBe('debrief');
		nextSortie(run);
		expect(run.sortie).toBe(2);
		expect(run.phase).toBe('active');
		expect(run.integrity).toBe(40 + REPAIR_BETWEEN_SORTIES);
		expect(run.result).toBeNull();
		expect(run.tracks.length).toBeGreaterThanOrEqual(5);
	});

	it('is won, with a campaign bonus, after the last sortie', () => {
		const run = newRun();
		beginSortie(run, MAX_SORTIES);
		for (const t of [...run.tracks]) {
			if (t.contact.role === 'hostile') strike(run, t.contact.id);
			else clear(run, t.contact.id);
		}
		expect(run.phase).toBe('over');
		expect(run.overReason).toBe('won');
		expect(run.score).toBeGreaterThanOrEqual(POINTS.campaignWon);
	});

	it('does nothing after the run is over', () => {
		const run = newRun();
		run.escalation = ESCALATION_LIMIT - 1;
		strike(run, idsWhere(run, 'civilian')[0]);
		const score = run.score;
		expect(strike(run, idsWhere(run, 'hostile')[0])).toBe(false);
		stepRun(run, 100);
		expect(run.score).toBe(score);
	});
});

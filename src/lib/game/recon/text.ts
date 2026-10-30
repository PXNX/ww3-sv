/*
 * Every user-facing string of Recon in one place, plain English for now, so that moving the mode
 * to paraglide later is a mechanical change.
 */
import type { Reading, Sensor } from './contacts.js';
import type { OverReason, SortieResult } from './run.js';

const SENSOR_TEXT = {
	eo: { name: 'EO', caption: 'Optical' },
	ir: { name: 'IR', caption: 'Thermal' },
	sar: { name: 'SAR', caption: 'Radar' }
} satisfies Record<Sensor, { name: string; caption: string }>;

export const RECON_TEXT = {
	title: 'Recon',
	start: 'Launch sortie',
	resume: 'Resume',
	retry: 'Fly again',
	help: 'How to play',
	helpClose: 'Got it',
	playfield: 'Drone camera over hostile ground. Drag to pan, tap a contact to lock a sensor on it.',
	hud: {
		sortie: 'Sortie',
		time: 'Time',
		ordnance: 'Missiles',
		hull: 'Hull',
		escalation: 'Escalation'
	},
	sensors: SENSOR_TEXT,
	readings: {
		military: 'Military',
		civilian: 'Civilian',
		netted: 'Netted',
		hot: 'Hot',
		cold: 'Cold',
		metal: 'Metal',
		clear: 'No return'
	} satisfies Record<Reading, string>,
	unknown: 'Unread',
	dossier: {
		track: (n: number) => `Contact ${n}`,
		idle: 'Tap a contact to lock a sensor on it.',
		locking: 'Locking…',
		needs: (sensor: Sensor) => `Check next: ${SENSOR_TEXT[sensor].name}`,
		settled: 'Picture complete. Your call.',
		strike: 'Strike',
		clear: 'Clear'
	},
	banners: {
		threat: 'Air defence lock! Strike it or leave its range',
		noOrdnance: 'Out of missiles'
	},
	overlay: {
		paused: 'Paused'
	},
	debrief: {
		title: (sortie: number) => `Sortie ${sortie} debrief`,
		struck: 'Hostiles destroyed',
		cleared: 'Harmless cleared',
		civilians: 'Civilians hit',
		decoys: 'Decoys hit',
		escaped: 'Hostiles escaped',
		timeBonus: 'Speed bonus',
		cleanBonus: 'Clean sortie',
		total: 'Sortie total',
		next: (sortie: number) => `Launch sortie ${sortie}`
	},
	over: {
		title: (reason: OverReason) =>
			reason === 'won' ? 'War won' : reason === 'integrity' ? 'Drone shot down' : 'Escalation',
		body: (reason: OverReason) =>
			reason === 'won'
				? 'Eight sorties flown. The brass gives you a medal for the wall.'
				: reason === 'integrity'
					? 'Air defence got the drone. Strike those sites first next time.'
					: 'Too many civilians hit. The ceasefire is off.',
		sorties: 'Sorties',
		best: 'Best sortie'
	},
	endings: {
		done: 'All contacts settled',
		timeout: 'Out of time',
		integrity: 'Drone lost',
		escalation: 'Escalation'
	} satisfies Record<SortieResult['ended'], string>,
	briefs: [
		'Olive means military. Anything in bright colours is civilian. Tap a contact, then STRIKE the hostile ones and CLEAR the rest.',
		'Decoys and camouflage nets appear. Olive with radar returns or heat is real; olive with neither is a decoy. Switch sensors to check.',
		'Air defence is up. Its red ring hurts the drone while you hover inside it, so approach carefully and strike it first.',
		'More cover, more cold engines. Use all three sensors before you fire.'
	],
	tutorial: {
		title: 'How to fly a sortie',
		goal: 'You task a drone over hostile ground. Destroy the hostile units, spare everyone else, and do it before the clock runs out.',
		controls:
			'Drag the map to pan the scope, or tap the small map in the corner. Tap a contact to select it and lock the active sensor on it; the reading stays in its dossier.',
		sensors:
			'EO sees colour: olive is military, bright colours are civilian, a net hides what is under it. IR sees heat. SAR sees metal. IR and SAR work through nets.',
		rules:
			'Olive with metal or heat is hostile. Olive with neither is a decoy. Under a net: metal is hostile, heat alone is civilians, nothing is a decoy.',
		verdict:
			'STRIKE destroys a contact, CLEAR marks it harmless. You carry one missile more than there are hostiles. Hitting civilians raises escalation; at 100 the run is over. Red-ringed air defence damages the drone while you hover inside its range.'
	}
} as const;

export function brief(sortie: number): string {
	const briefs = RECON_TEXT.briefs;
	return briefs[Math.min(briefs.length - 1, Math.max(0, sortie - 1))];
}

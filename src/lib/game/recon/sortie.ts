/*
 * One sortie: how hard it is, and a freshly generated map with its contacts. The first sortie
 * can be solved with the optical sensor alone; decoys, nets and cold hostiles come in from the
 * second, air defence from the third, so each sensor gets introduced when it starts to matter.
 */
import { AA_RADIUS, MAP_H, MAP_W, MAX_SORTIES, START, VIEW_H, VIEW_W } from './config.js';
import {
	CIVILIAN_KINDS,
	DECOY_KINDS,
	HOSTILE_KINDS,
	type Contact,
	type ContactKind,
	type Role
} from './contacts.js';
import { generateTerrain, type Terrain } from './terrain.js';
import { pickOne, type Random } from '../random.js';

export interface SortieParams {
	contacts: number;
	timeS: number;
	hostiles: number;
	aaCount: number;
	/** Chance that a hostile or decoy sits under a net */
	coverChance: number;
	/** Chance that a non-hostile contact is a decoy rather than a civilian */
	decoyChance: number;
	/** Chance that a hostile vehicle has its engine off */
	coldChance: number;
	/** Chance that a hostile (not air defence) is infantry: warm, but no radar return */
	troopsChance: number;
}

export function sortieParams(sortie: number): SortieParams {
	const n = Math.min(MAX_SORTIES, Math.max(1, sortie));
	const contacts = Math.min(9, 5 + Math.floor(n / 2));
	const late = n - 2;
	return {
		contacts,
		timeS: Math.max(55, 78 - 3 * (n - 1)),
		hostiles: Math.ceil(contacts / 2),
		aaCount: n < 3 ? 0 : n < 6 ? 1 : 2,
		coverChance: n < 2 ? 0 : Math.min(0.5, 0.15 + 0.07 * late),
		decoyChance: n < 2 ? 0 : Math.min(0.6, 0.35 + 0.05 * late),
		coldChance: n < 2 ? 0 : Math.min(0.4, 0.1 + 0.05 * late),
		troopsChance: n < 2 ? 0 : 0.25
	};
}

export interface Sortie {
	params: SortieParams;
	terrain: Terrain;
	contacts: Contact[];
	/** Missiles on board: one more than there are hostiles */
	ordnance: number;
}

type Spot = { x: number; y: number };

const MARGIN_X = 50;
const MARGIN_Y = 60;
const MIN_GAP = 86;

function randomPosition(random: Random, marginX = MARGIN_X, marginY = MARGIN_Y): Spot {
	return {
		x: marginX + random() * (MAP_W - marginX * 2),
		y: marginY + random() * (MAP_H - marginY * 2)
	};
}

/**
 * Air defence sits where the scope centre can reach it (the scope never leaves the map), so it
 * can always threaten the drone and is never a free target
 */
function margins(reachable = false): [number, number] {
	return reachable ? [VIEW_W / 2, VIEW_H / 2] : [MARGIN_X, MARGIN_Y];
}

/** A position away from the others, the start point and (for hostile units) villages */
function findSpot(
	random: Random,
	taken: Spot[],
	terrain: Terrain,
	opts: { avoidVillages: boolean; clearOfStart: number; reachable?: boolean }
): Spot {
	let gap = MIN_GAP;
	for (let attempt = 0; attempt < 400; attempt++) {
		if (attempt > 0 && attempt % 100 === 0) gap -= 14;
		const spot = randomPosition(random, ...margins(opts.reachable));
		if (Math.hypot(spot.x - START.x, spot.y - START.y) < opts.clearOfStart) continue;
		if (taken.some((t) => Math.hypot(t.x - spot.x, t.y - spot.y) < gap)) continue;
		if (
			opts.avoidVillages &&
			terrain.villages.some((v) => Math.hypot(v.x - spot.x, v.y - spot.y) < v.r + 14)
		) {
			continue;
		}
		return spot;
	}
	// Practically unreachable; keeps generation total
	return randomPosition(random, ...margins(opts.reachable));
}

function placeNearVillage(random: Random, terrain: Terrain, taken: Spot[]): Spot | undefined {
	for (let attempt = 0; attempt < 60; attempt++) {
		const village = pickOne(random, terrain.villages);
		const angle = random() * Math.PI * 2;
		const dist = village.r * (0.4 + random() * 0.8);
		const spot = { x: village.x + Math.cos(angle) * dist, y: village.y + Math.sin(angle) * dist };
		if (spot.x < MARGIN_X || spot.x > MAP_W - MARGIN_X) continue;
		if (spot.y < MARGIN_Y || spot.y > MAP_H - MARGIN_Y) continue;
		if (Math.hypot(spot.x - START.x, spot.y - START.y) < 150) continue;
		if (taken.some((t) => Math.hypot(t.x - spot.x, t.y - spot.y) < 56)) continue;
		return spot;
	}
	return undefined;
}

export function generateSortie(random: Random, sortie: number): Sortie {
	const params = sortieParams(sortie);
	const terrain = generateTerrain(random);
	const contacts: Contact[] = [];
	const taken: Spot[] = [];
	let nextId = 1;

	const add = (kind: ContactKind, role: Role, traits: Partial<Contact>, spot?: Spot) => {
		const where =
			spot ??
			findSpot(random, taken, terrain, {
				avoidVillages: role !== 'civilian',
				clearOfStart: kind === 'aa' ? AA_RADIUS + 60 : 120,
				reachable: kind === 'aa'
			});
		taken.push(where);
		contacts.push({
			id: nextId++,
			kind,
			role,
			x: where.x,
			y: where.y,
			heading: random() * Math.PI * 2,
			olive: role !== 'civilian',
			covered: false,
			hot: false,
			metal: false,
			...traits
		});
	};

	// Air defence first: it needs the most room
	for (let i = 0; i < params.aaCount; i++) {
		add('aa', 'hostile', { hot: true, metal: true });
	}
	const others = params.hostiles - params.aaCount;
	for (let i = 0; i < others; i++) {
		// The first one is always a vehicle, so every sortie has a radar-visible hostile
		if (i > 0 && random() < params.troopsChance) {
			add('troops', 'hostile', { hot: true, metal: false });
			continue;
		}
		add(pickOne(random, HOSTILE_KINDS), 'hostile', {
			hot: random() >= params.coldChance,
			metal: true,
			covered: random() < params.coverChance
		});
	}

	for (let i = 0; i < params.contacts - params.hostiles; i++) {
		if (random() < params.decoyChance) {
			add(pickOne(random, DECOY_KINDS), 'decoy', {
				hot: false,
				metal: false,
				covered: random() < params.coverChance
			});
			continue;
		}
		// A covered civilian is a farm shelter with people or animals in it: warm, no metal
		if (random() < params.coverChance * 0.6) {
			add(
				'farm',
				'civilian',
				{ hot: true, metal: false, covered: true },
				placeNearVillage(random, terrain, taken)
			);
			continue;
		}
		const kind = pickOne(random, CIVILIAN_KINDS);
		add(
			kind,
			'civilian',
			{ hot: kind === 'herd' ? true : random() < 0.6, metal: kind !== 'herd' },
			random() < 0.7 ? placeNearVillage(random, terrain, taken) : undefined
		);
	}

	const hostiles = contacts.filter((c) => c.role === 'hostile').length;
	return { params, terrain, contacts, ordnance: hostiles + 1 };
}

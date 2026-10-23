/*
 * Small staged raids for the weapon details: the player stands in the open with a few enemies in
 * front, and the base attack or one skill is shown on a loop. Enemies never hurt the player and
 * only walk where the demo needs it (towards a landmine). The demo turns the step's events into
 * the same rings, cones and numbers the real raid shows.
 */
import { createRandom, type Random } from '#lib/game/random.js';
import { BLAST_ANGLE, BLAST_RADIUS, WEAPONS, type SkillId, type WeaponKind } from './config';
import { makeWeapon } from './items';
import { newProfile } from './profile';
import type { Effect } from './render';
import {
	createRaid,
	setFiring,
	setMove,
	spawnEnemy,
	stepRaid,
	useSkill,
	type RaidEvent,
	type RaidState
} from './state';

/** The base attack, or one of the weapon's two skills */
export type DemoAction = 'attack' | 0 | 1;

/** One loop of a demo */
export const DEMO_MS = 4200;

/** Where the enemies stand, relative to the player */
const LINEUP = [
	{ x: 125, y: -45 },
	{ x: 140, y: 50 },
	{ x: 185, y: 0 },
	{ x: 225, y: -80 },
	{ x: 225, y: 75 }
];

/** The demo camera looks between the player and the enemies */
export const DEMO_CENTER_OFFSET = 110;

export interface Demo {
	state: RaidState;
	random: Random;
	kind: WeaponKind;
	action: DemoAction;
	skill: SkillId | null;
	effects: Effect[];
}

/** Skills that only show something once the weapon has been used for a moment */
const NEEDS_ATTACK: readonly SkillId[] = ['flashpoint', 'swarm', 'overclock'];

export function createDemo(kind: WeaponKind, action: DemoAction): Demo {
	const loadout = newProfile().loadout;
	loadout.primary = makeWeapon(kind, 'rare', 5);
	const state = createRaid('sunflower', loadout, 5);
	state.spawnMs = Infinity;
	state.nextBossMs = Infinity;
	const random = createRandom(7);
	const skill = action === 'attack' ? null : WEAPONS[kind].skills[action];
	for (const spot of LINEUP) {
		const enemy = spawnEnemy(state, random, 'grunt', 'normal', {
			x: state.player.x + spot.x,
			y: state.player.y + spot.y
		});
		if (!enemy) continue;
		enemy.hp = enemy.maxHp = 90;
		// Only the landmine needs enemies that walk into it
		enemy.speed = skill === 'mine' ? 45 : 0;
	}
	if (skill === 'heal') state.player.hp = Math.round(state.player.maxHp * 0.35);
	return { state, random, kind, action, skill, effects: [] };
}

/** Advances the demo by one fixed step; elapsedMs is the time since the loop started */
export function stepDemo(demo: Demo, dtMs: number, elapsedMs: number) {
	const { state, skill } = demo;
	const before = elapsedMs - dtMs;
	const at = (ms: number) => before < ms && elapsedMs >= ms;

	if (demo.action === 'attack') {
		setFiring(state, elapsedMs > 300);
	} else if (skill) {
		const warmUp = NEEDS_ATTACK.includes(skill);
		setFiring(state, warmUp && elapsedMs > 150 && elapsedMs < 1500);
		if (skill === 'focus') setFiring(state, elapsedMs > 700 && elapsedMs < 3200);
		// After the dash, a few shots from the new spot
		if (skill === 'dash') setFiring(state, elapsedMs > 1000);
		// Overdrive is only seen in the shooting it speeds up
		if (skill === 'overdrive') setFiring(state, elapsedMs > 650);
		// The dash goes where the stick points: sideways, out of the line of enemies
		if (skill === 'dash') setMove(state, 0, elapsedMs > 560 && elapsedMs < 640 ? -1 : 0);
		const skillAt = warmUp ? 1700 : 600;
		if (at(skillAt)) handle(demo, useSkill(state, demo.action === 0 ? 0 : 1));
	}

	handle(demo, stepRaid(state, demo.random, dtMs));
	// The demo player is never in danger, and the enemies never strike
	if (skill !== 'heal') state.player.hp = state.player.maxHp;
	for (const enemy of state.enemies) enemy.attackMs = 1e9;
	state.enemyBullets = [];

	for (const effect of demo.effects) effect.ageMs += dtMs;
	demo.effects = demo.effects.filter((effect) => effect.ageMs < effect.durationMs);
}

function handle(demo: Demo, events: readonly RaidEvent[]) {
	const { effects, state } = demo;
	const ring = (x: number, y: number, radius: number, color: string, durationMs = 450) =>
		effects.push({ kind: 'ring', x, y, radius, color, ageMs: 0, durationMs });
	const text = (x: number, y: number, value: string, color: string, size = 16) =>
		effects.push({ kind: 'text', x, y, text: value, color, size, ageMs: 0, durationMs: 700 });
	for (const event of events) {
		switch (event.type) {
			case 'hit':
				text(
					event.x,
					event.y,
					`${Math.round(event.damage)}${event.crit ? '!' : ''}`,
					event.burn ? '#ff9a3c' : event.crit ? '#ff4d4d' : '#ffffff',
					event.crit ? 22 : event.burn ? 13 : 16
				);
				break;
			case 'splash':
				ring(event.x, event.y, event.radius, '#f5c83a', 360);
				break;
			case 'grenade-burst':
			case 'mine-burst':
			case 'napalm':
			case 'flare':
				ring(event.x, event.y, event.type === 'flare' ? 46 : 110, '#ff8a2b');
				break;
			case 'heal':
				text(state.player.x, state.player.y - 34, `+${event.amount}`, '#5bd16b', 22);
				ring(state.player.x, state.player.y, 70, '#5bd16b', 500);
				break;
			case 'nest':
				ring(event.x, event.y, 30, '#5bd16b', 300);
				break;
			case 'blast':
				effects.push({
					kind: 'cone',
					x: event.x,
					y: event.y,
					angle: event.angle,
					spread: BLAST_ANGLE,
					radius: BLAST_RADIUS,
					color: '#ff8a2b',
					ageMs: 0,
					durationMs: 320
				});
				break;
		}
	}
}

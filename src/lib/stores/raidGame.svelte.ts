/*
 * Raid game store: the persistent profile and lobby actions, and around a running raid the
 * player's commands, floating numbers and rings, sounds and the reactive HUD values; the lobby
 * also sockets and combines crystals and claims season and quest rewards, and the clock switches
 * the live events on and off during a raid. The
 * simulation state is a plain object read by the canvas every frame; only what the page chrome
 * shows is reactive, synced after each step.
 */
import {
	ARMOR_NAMES,
	BOSS_NAMES,
	crystalName,
	EVENT_NAMES,
	itemName,
	SKILL_NAMES,
	WEAPON_NAMES
} from '#lib/components/raidText.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import {
	BLAST_ANGLE,
	BLAST_RADIUS,
	DRONE_BLAST_RADIUS,
	GRENADE_RADIUS,
	MEDIC_HEAL_RADIUS,
	NAPALM_RADIUS,
	MINE_RADIUS,
	RARITY_COLOR,
	REVIVE_BLAST_RADIUS,
	BOSS_SLAM_RADIUS,
	CRYSTAL_COLOR,
	SKILL_COOLDOWN_MS,
	SPRINT_COOLDOWN_MS,
	type Archetype,
	type ArmorSlot,
	type MapId,
	type SkillId,
	type Variant,
	type WeaponKind
} from '#lib/game/raid/config.js';
import { gearScore, weaponStats, type Crystal, type GearItem } from '#lib/game/raid/items.js';
import {
	bankHaul,
	claimQuest,
	claimSeasonRewards,
	combineCrystals,
	equipFromStash,
	newProfile,
	parseProfile,
	salvage,
	socketCrystal,
	swapWeapons,
	unequipArmor,
	unsocketCrystal,
	upgradeSlot,
	withCurrentSeason,
	withToday,
	xpToNext,
	type LoadoutSlot,
	type Profile,
	type WeaponSlot
} from '#lib/game/raid/profile.js';
import { liveEventAt, type ActiveEvent } from '#lib/game/raid/events.js';
import { dateAt, type SeasonReward } from '#lib/game/raid/season.js';
import { drawRaidPreview, type Effect, type SceneExtras } from '#lib/game/raid/render.js';
import {
	createRaid,
	currentBoss,
	equipFromHaul,
	giveUp,
	heldSkills,
	revive,
	scoreOf,
	setFiring,
	setLiveEvent,
	setMove,
	sprint,
	stepRaid,
	swapWeapon,
	useSkill,
	type RaidEvent,
	type RaidState
} from '#lib/game/raid/state.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type RaidStatus = 'lobby' | 'playing' | 'paused' | 'down' | 'over';

/** Where the profile is saved; the weapon pages read it too */
export const PROFILE_KEY = 'raid:profile';
/** The weapon the lobby opened its page for, handed over for that one visit */
const DETAILS_ITEM_KEY = 'ww3:raid:details-item';

/** Remembers which of the player's weapons the next weapon page should show */
export function rememberDetailsItem(id: string) {
	try {
		sessionStorage.setItem(DETAILS_ITEM_KEY, id);
	} catch {
		// No session storage: the page shows the weapon's base stats
	}
}

/** The weapon the lobby asked the weapon page to show, if any */
export function detailsItem(): string | null {
	try {
		return sessionStorage.getItem(DETAILS_ITEM_KEY);
	} catch {
		return null;
	}
}
/** How long the "found new gear" card stays up */
const FOUND_MS = 6000;
/** The same sound never plays more often than this, so a fast weapon does not drown the rest */
const SOUND_GAP_MS = 70;

export interface RaidResult {
	map: MapId;
	timeMs: number;
	kills: number;
	/** Defeated enemies by archetype */
	killsBy: Record<Archetype, number>;
	bossKills: number;
	eliteKills: number;
	damageDealt: number;
	biggestHit: number;
	xp: number;
	gold: number;
	scrap: number;
	gear: GearItem[];
	crystals: Crystal[];
	levelsGained: number;
	/** Level and XP before and after banking, for the animated level bar */
	levelBefore: number;
	xpBefore: number;
	level: number;
	xpAfter: number;
	salvaged: number;
	salvageGold: number;
	salvageScrap: number;
	/** Season XP before and after the raid */
	seasonXpBefore: number;
	seasonXpAfter: number;
}

export interface RaidOptions {
	reducedMotion?: boolean;
	/** Injected for tests; default to the browser's local storage */
	store?: () => Store;
	scores?: () => Highscores;
	seed?: () => number;
	/** The wall clock for the live events, in epoch milliseconds; injected for tests */
	now?: () => number;
}

const scoreKey = (map: MapId) => ['raid', map, 'score'] as const;

export class RaidGame {
	status = $state<RaidStatus>('lobby');
	/** Not deeply reactive: profile updates always replace the whole object */
	profile = $state.raw<Profile>(newProfile());
	map = $state<MapId>('sunflower');

	// HUD
	score = $state(0);
	hp = $state(0);
	maxHp = $state(1);
	timeMs = $state(0);
	threat = $state(1);
	xp = $state(0);
	gold = $state(0);
	kills = $state(0);
	crystalsFound = $state(0);
	revivesLeft = $state(1);
	heldKind = $state<WeaponKind>('rifle');
	otherKind = $state<WeaponKind>('marksman');
	heldLevel = $state(1);
	/** The held weapon's two skills, on the buttons around the attack button */
	skills = $state<readonly [SkillId, SkillId]>(['heal', 'grenade']);
	/** Share of each skill's cooldown still to go, 0 when ready */
	skillCooldowns = $state<readonly [number, number]>([0, 0]);
	fireCooldown = $state(0);
	/** Share of the sprint's recharge still to go, 0 when ready */
	sprintCooldown = $state(0);
	/** The live event running during the raid, with its end on the wall clock */
	liveEvent = $state.raw<ActiveEvent | null>(null);
	/** Whole seconds the live event still runs */
	liveEventSeconds = $state(0);
	boss = $state<{ share: number; variant: Variant } | null>(null);
	/** The last piece of gear picked up, offered for equipping for a few seconds */
	found = $state.raw<{ item: GearItem; better: boolean } | null>(null);
	hurtCount = $state(0);
	result = $state.raw<RaidResult | null>(null);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	/** Season rewards just claimed in the lobby, shown until dismissed */
	claimed = $state.raw<SeasonReward[] | null>(null);

	/** Simulation state, deliberately not reactive */
	state: RaidState;
	effects: Effect[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#store: () => Store;
	#scores: () => Highscores;
	#seed: () => number;
	#now: () => number;
	#foundMs = 0;
	/** When each sound last played, on the raid clock */
	#soundAt: Partial<Record<SoundId, number>> = {};
	#clockMs = 0;

	constructor({
		reducedMotion = false,
		store = localStore,
		scores = highscores,
		seed = randomSeed,
		now = Date.now
	}: RaidOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#store = store;
		this.#scores = scores;
		this.#seed = seed;
		this.#now = now;
		this.state = createRaid(this.map, this.profile.loadout, this.profile.level);
		this.#syncChrome();
	}

	/** Reads the saved profile and best score; call in the browser only */
	load() {
		const today = dateAt(this.#now());
		const saved = parseProfile(this.#store().read<unknown>(PROFILE_KEY, null), today);
		this.#setProfile(saved ?? newProfile(today));
		this.best = this.#scores().get(scoreKey(this.map));
		this.state = createRaid(this.map, this.profile.loadout, this.profile.level);
		this.#syncChrome();
	}

	get xpNeeded(): number {
		return xpToNext(this.profile.level);
	}

	// -------------------------------------------------------------------------------------------
	// Lobby

	selectMap(map: MapId) {
		if (this.status !== 'lobby' && this.status !== 'over') return;
		this.map = map;
		this.best = this.#scores().get(scoreKey(map));
	}

	equip(itemId: string, slot: LoadoutSlot) {
		this.#setProfile(equipFromStash(this.profile, itemId, slot));
		this.#play('click');
	}

	unequip(slot: ArmorSlot) {
		this.#setProfile(unequipArmor(this.profile, slot));
		this.#play('click');
	}

	upgrade(slot: LoadoutSlot) {
		const before = this.profile;
		this.#setProfile(upgradeSlot(this.profile, slot));
		this.#play(before === this.profile ? 'ui-error' : 'chime');
	}

	salvageItem(itemId: string) {
		this.#setProfile(salvage(this.profile, itemId));
		this.#play('pickup');
	}

	swapLoadoutWeapons() {
		this.#setProfile(swapWeapons(this.profile));
		this.#play('click');
	}

	socket(slot: WeaponSlot, crystal: Crystal) {
		const before = this.profile;
		this.#setProfile(socketCrystal(this.profile, slot, crystal));
		this.#play(before === this.profile ? 'ui-error' : 'chime');
	}

	unsocket(slot: WeaponSlot, index: number) {
		this.#setProfile(unsocketCrystal(this.profile, slot, index));
		this.#play('click');
	}

	combine(crystal: Crystal) {
		const before = this.profile;
		this.#setProfile(combineCrystals(this.profile, crystal));
		this.#play(before === this.profile ? 'ui-error' : 'chime-big');
	}

	/** Claims a finished daily quest's reward */
	claimQuest(index: number) {
		const before = this.profile;
		this.#setProfile(claimQuest(withToday(this.profile, dateAt(this.#now())), index));
		this.#play(before === this.profile ? 'ui-error' : 'chime-big');
	}

	/** Claims every season tier reached so far */
	claimSeason() {
		const current = withCurrentSeason(this.profile, dateAt(this.#now()));
		const { profile, rewards } = claimSeasonRewards(current);
		this.#setProfile(profile);
		if (rewards.length === 0) return;
		this.claimed = rewards;
		this.#play('chime-big');
	}

	dismissClaimed() {
		this.claimed = null;
	}

	backToLobby() {
		// A new day (or season) may have started during the raid
		this.#setProfile(withToday(this.profile, dateAt(this.#now())));
		this.status = 'lobby';
		this.result = null;
		this.found = null;
	}

	#setProfile(profile: Profile) {
		if (profile === this.profile) return;
		this.profile = profile;
		this.#store().write(PROFILE_KEY, profile);
	}

	// -------------------------------------------------------------------------------------------
	// Raid

	start(map: MapId = this.map) {
		this.map = map;
		const seed = this.#seed();
		this.#random = createRandom(seed);
		this.state = createRaid(map, this.profile.loadout, this.profile.level);
		this.effects = [];
		this.found = null;
		this.result = null;
		this.isNewBest = false;
		this.best = this.#scores().get(scoreKey(map));
		this.#clockMs = 0;
		this.#soundAt = {};
		this.liveEvent = null;
		this.#followClock();
		this.#syncChrome();
		this.status = 'playing';
	}

	pause() {
		if (this.status === 'playing') {
			setFiring(this.state, false);
			setMove(this.state, 0, 0);
			this.status = 'paused';
		}
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	move(x: number, y: number) {
		if (this.status === 'playing') setMove(this.state, x, y);
	}

	attack(on: boolean) {
		if (this.status === 'playing' || !on) setFiring(this.state, on);
	}

	swap() {
		if (this.status === 'playing') this.#apply(swapWeapon(this.state));
	}

	/** A burst forwards, on its own button */
	sprint() {
		if (this.status === 'playing') this.#apply(sprint(this.state));
	}

	/** One of the held weapon's two skills */
	skill(slot: 0 | 1) {
		if (this.status === 'playing') this.#apply(useSkill(this.state, slot));
	}

	revive() {
		if (this.status !== 'down') return;
		const events = revive(this.state);
		if (events.length === 0) return;
		this.status = 'playing';
		this.#apply(events);
	}

	giveUp() {
		if (this.status === 'down') this.#apply(giveUp(this.state));
	}

	/** Puts the gear from the "found" card on */
	equipFound() {
		if (!this.found || (this.status !== 'playing' && this.status !== 'paused')) return;
		this.#apply(equipFromHaul(this.state, this.found.item.id));
		this.found = null;
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		this.#clockMs += dtMs;
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		if (this.found) {
			this.#foundMs -= dtMs;
			if (this.#foundMs <= 0) this.found = null;
		}
		this.#followClock();
		this.#apply(stepRaid(this.state, this.#random, dtMs));
	}

	/** Switches the live event on and off with the wall clock, with a popup each time */
	#followClock() {
		const now = this.#now();
		const event = liveEventAt(now);
		const before = this.liveEvent;
		if (event?.kind !== before?.kind) {
			this.liveEvent = event;
			setLiveEvent(this.state, event?.kind ?? null);
			const { player } = this.state;
			if (event) {
				const name = EVENT_NAMES[event.kind]();
				this.#text(
					player.x,
					player.y - 96,
					m.raid_popup_event({ event: name }),
					'#ffd23a',
					26,
					2400
				);
				this.#play('chime-big');
			} else if (before) {
				const name = EVENT_NAMES[before.kind]();
				this.#text(
					player.x,
					player.y - 96,
					m.raid_popup_event_over({ event: name }),
					'#ffffff',
					20,
					1600
				);
			}
		}
		this.liveEventSeconds = event ? Math.max(0, Math.ceil((event.endsAt - now) / 1000)) : 0;
	}

	sceneExtras(): SceneExtras {
		return { effects: this.effects, reducedMotion: this.reducedMotion };
	}

	/** Draws where the raid ended onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawRaidPreview(context, this.state, x, y, size);
	};

	#apply(events: readonly RaidEvent[]) {
		for (const event of events) this.#handle(event);
		this.#syncChrome();
	}

	#text(x: number, y: number, text: string, color: string, size = 18, duration = 800) {
		if (this.effects.length > 80) this.effects.shift();
		const short = this.reducedMotion ? 0.6 : 1;
		this.effects.push({
			kind: 'text',
			x,
			y,
			text,
			color,
			size,
			ageMs: 0,
			durationMs: duration * short
		});
	}

	#ring(x: number, y: number, radius: number, color: string, duration = 420) {
		this.effects.push({ kind: 'ring', x, y, radius, color, ageMs: 0, durationMs: duration });
	}

	#handle(event: RaidEvent) {
		const { player } = this.state;
		switch (event.type) {
			case 'shot':
				if (event.kind === 'flamethrower') this.#play('whoosh', 0.25);
				else
					this.#play(
						event.kind === 'launcher' ? 'whoosh' : event.kind === 'marksman' ? 'zap' : 'fire',
						0.5
					);
				break;
			case 'hit':
				if (event.burn) {
					this.#text(
						event.x + (Math.random() - 0.5) * 20,
						event.y,
						`${Math.round(event.damage)}`,
						'#ff9a3c',
						13,
						500
					);
					break;
				}
				this.#text(
					event.x + (Math.random() - 0.5) * 16,
					event.y,
					event.crit ? `${Math.round(event.damage)}!` : `${Math.round(event.damage)}`,
					event.crit ? '#ff4d4d' : '#ffffff',
					event.crit ? 24 : 16,
					event.crit ? 900 : 600
				);
				break;
			case 'splash':
				this.#ring(event.x, event.y, event.radius, '#f5c83a', 360);
				this.#play('explosion-tiny');
				break;
			case 'kill':
				if (event.variant !== 'normal' || event.archetype === 'boss') {
					this.#text(event.x, event.y - 30, `+${Math.round(event.xp)} XP`, '#7fd3ff', 22, 1300);
				}
				if (event.archetype === 'boss') this.#play('explosion-big');
				else if (event.variant === 'mega') this.#play('chime-big');
				else if (event.variant === 'super') this.#play('chime');
				else this.#play('pop', 0.6);
				break;
			case 'player-hit':
				this.hurtCount += 1;
				this.#text(player.x, player.y - 30, `-${event.damage}`, '#e5484d', 20);
				this.#play('hit');
				break;
			case 'enemy-shot':
				this.#play('click', 0.3);
				break;
			case 'heal':
				this.#text(player.x, player.y - 34, `+${event.amount}`, '#5bd16b', 22, 1000);
				if (event.source === 'ability') this.#ring(player.x, player.y, 70, '#5bd16b', 500);
				this.#play('sparkle');
				break;
			case 'skill':
				this.#skillCue(event.skill);
				break;
			case 'blast':
				this.effects.push({
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
				this.#play('explosion-small');
				break;
			case 'mine-burst':
				this.#ring(event.x, event.y, MINE_RADIUS, '#ff8a2b', 520);
				this.#play('mine-explosion');
				break;
			case 'grenade-burst':
				this.#ring(event.x, event.y, GRENADE_RADIUS, '#ff8a2b', 520);
				this.#play('explosion-small');
				break;
			case 'boss-spawn':
				this.#text(
					player.x,
					player.y - 80,
					m.raid_popup_boss({ boss: BOSS_NAMES[this.map]() }),
					'#ff4d4d',
					28,
					2400
				);
				this.#play('alarm');
				break;
			case 'boss-windup':
				this.#play('thud', 0.5);
				break;
			case 'boss-slam':
				this.#ring(event.x, event.y, BOSS_SLAM_RADIUS, '#e5484d', 520);
				this.#play('explosion-big', 0.7);
				break;
			case 'gold':
				this.#text(event.x, event.y - 14, `+${event.amount}`, '#f5c83a', 16, 700);
				this.#play('pickup', 0.4);
				break;
			case 'scrap':
				this.#text(
					event.x,
					event.y - 14,
					m.raid_popup_scrap({ amount: event.amount }),
					'#c9ced4',
					16,
					700
				);
				this.#play('pickup', 0.4);
				break;
			case 'crystal': {
				const { crystal } = event;
				this.#text(
					player.x,
					player.y - 44,
					crystalName(crystal),
					RARITY_COLOR[crystal.rarity],
					22,
					1400
				);
				this.#ring(event.x, event.y, 40, CRYSTAL_COLOR[crystal.kind], 500);
				this.#play(
					crystal.rarity === 'legendary' || crystal.rarity === 'epic' ? 'chime-big' : 'sparkle'
				);
				break;
			}
			case 'drone-crash':
				this.#ring(event.x, event.y, DRONE_BLAST_RADIUS, '#ff8a2b', 420);
				this.#play('explosion-small', 0.7);
				break;
			case 'shell-launch':
				this.#play('thud', event.big ? 0.6 : 0.35);
				break;
			case 'shell-burst':
				this.#ring(event.x, event.y, event.radius, '#ff6a2b', 520);
				this.#play(event.radius > 80 ? 'explosion-big' : 'explosion-small', 0.6);
				break;
			case 'medic-heal':
				this.#ring(event.x, event.y, MEDIC_HEAL_RADIUS, '#5bd16b', 650);
				this.#play('sparkle', 0.3);
				break;
			case 'nest':
				this.#ring(event.x, event.y, 30, '#5bd16b', 300);
				this.#play('blocks-place', 0.6);
				break;
			case 'nest-launch':
				this.#play('drone-buzz', 0.35);
				break;
			case 'flare':
				this.#ring(event.x, event.y, 46, '#ff4d1a', 420);
				this.#play('explosion-tiny', 0.7);
				break;
			case 'napalm':
				this.#ring(event.x, event.y, NAPALM_RADIUS, '#ff8a2b', 450);
				this.#play('fire');
				break;
			case 'jammed':
				this.#ring(event.x, event.y, 34, '#3dc9f5', 360);
				this.#text(event.x, event.y - 26, m.raid_popup_jammed(), '#3dc9f5', 16, 800);
				this.#play('zap', 0.5);
				break;
			case 'spikes':
				this.#play('impact-stone', 0.5);
				break;
			case 'sprint':
				this.#play('ability-dash');
				break;
			case 'gear': {
				const { item } = event;
				const current =
					item.type === 'weapon'
						? this.state.loadout[player.held]
						: (this.state.loadout[item.slot] ?? null);
				const better =
					!current || (current.type === item.type && gearScore(item) > gearScore(current));
				this.found = { item, better };
				this.#foundMs = FOUND_MS;
				this.#text(player.x, player.y - 40, itemName(item), RARITY_COLOR[item.rarity], 22, 1300);
				this.#play(item.rarity === 'legendary' || item.rarity === 'epic' ? 'chime-big' : 'chime');
				break;
			}
			case 'weapon-kit':
				this.#text(
					player.x,
					player.y - 40,
					event.maxed
						? '+25'
						: m.raid_popup_weapon_kit({
								weapon: WEAPON_NAMES[event.kind](),
								level: m.raid_item_level({ level: event.level })
							}),
					'#f08a24',
					20,
					1200
				);
				this.#play('chime');
				break;
			case 'armor-kit':
				this.#text(
					player.x,
					player.y - 40,
					m.raid_popup_armor_kit({
						armor: ARMOR_NAMES[event.slot](),
						level: m.raid_item_level({ level: event.level })
					}),
					'#4fa8d8',
					20,
					1200
				);
				this.#play('chime');
				break;
			case 'swap':
				this.#play('click');
				break;
			case 'equip':
				this.#play('ui-toggle');
				break;
			case 'threat':
				this.#text(
					player.x,
					player.y - 70,
					m.raid_popup_threat({ level: event.level }),
					'#ffb347',
					24,
					1600
				);
				this.#play('alarm', 0.35);
				break;
			case 'down':
				setFiring(this.state, false);
				this.status = 'down';
				this.#play('thud');
				break;
			case 'revive':
				this.#ring(event.x, event.y, REVIVE_BLAST_RADIUS, '#4fa8d8', 700);
				this.#text(event.x, event.y - 50, m.raid_popup_revive(), '#7fd3ff', 26, 1300);
				this.#play('explosion-big');
				break;
			case 'over':
				this.#finish();
				break;
		}
	}

	/** The skill's name pops up over the player, with a sound that fits it */
	#skillCue(skill: SkillId) {
		const { player } = this.state;
		const sounds: Record<SkillId, SoundId> = {
			heal: 'sparkle',
			grenade: 'whoosh',
			focus: 'ability-dive',
			railshot: 'zap',
			dash: 'ability-dash',
			blast: 'fire',
			overdrive: 'ability-split',
			nova: 'ability-blast',
			barrage: 'patriot-launch',
			mine: 'click',
			flashpoint: 'explosion-small',
			napalm: 'whoosh',
			swarm: 'drone-brzzz',
			overclock: 'ability-split'
		};
		if (skill !== 'heal')
			this.#text(player.x, player.y - 46, SKILL_NAMES[skill](), '#ffffff', 18, 900);
		this.#play(sounds[skill]);
	}

	#play(id: SoundId, intensity = 1) {
		const last = this.#soundAt[id];
		if (last !== undefined && this.#clockMs - last < SOUND_GAP_MS && this.status === 'playing')
			return;
		this.#soundAt[id] = this.#clockMs;
		soundManager().play(id, intensity);
	}

	#syncChrome() {
		const state = this.state;
		const { player, loadout } = state;
		this.score = scoreOf(state);
		this.hp = Math.ceil(player.hp);
		this.maxHp = player.maxHp;
		this.timeMs = Math.floor(state.timeMs / 1000) * 1000;
		this.threat = state.threat;
		this.xp = Math.floor(state.xp);
		this.gold = state.gold;
		this.kills = state.kills;
		this.crystalsFound = state.crystals.length;
		this.revivesLeft = state.revivesLeft;
		const held = loadout[player.held];
		this.heldKind = held.kind;
		this.heldLevel = held.level;
		this.otherKind = loadout[player.held === 'primary' ? 'secondary' : 'primary'].kind;
		// Rounded to twentieths, so the HUD only updates when it visibly changes
		const share = (left: number, total: number) => Math.ceil((left / total) * 20) / 20;
		const skills = heldSkills(state);
		if (skills[0] !== this.skills[0] || skills[1] !== this.skills[1]) this.skills = skills;
		const cooldowns = skills.map((skill) =>
			share(player.skillMs[skill], SKILL_COOLDOWN_MS[skill])
		) as unknown as readonly [number, number];
		if (cooldowns[0] !== this.skillCooldowns[0] || cooldowns[1] !== this.skillCooldowns[1]) {
			this.skillCooldowns = cooldowns;
		}
		this.fireCooldown = share(player.fireMs, weaponStats(held, state.playerLevel).fireMs);
		this.sprintCooldown = share(player.sprintMs, SPRINT_COOLDOWN_MS);
		const boss = currentBoss(state);
		this.boss = boss
			? { share: Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100) / 100), variant: boss.variant }
			: null;
	}

	#finish() {
		this.#syncChrome();
		const state = this.state;
		const today = dateAt(this.#now());
		const before = withToday(this.profile, today);
		const banked = bankHaul(
			before,
			{
				map: state.mapId,
				timeMs: state.timeMs,
				xp: state.xp,
				gold: state.gold,
				scrap: state.scrap,
				gear: state.haul,
				crystals: state.crystals,
				loadout: state.loadout,
				stats: {
					map: state.mapId,
					timeMs: state.timeMs,
					kills: state.kills,
					killsBy: state.killsBy,
					bossKills: state.bossKills,
					crystals: state.crystals.length,
					damage: state.damageDealt,
					skillsUsed: state.skillsUsed
				}
			},
			today
		);
		this.#setProfile(banked.profile);
		const best = this.#scores().submit(scoreKey(state.mapId), this.score);
		this.best = best.best;
		this.isNewBest = best.isNewBest;
		this.result = {
			map: state.mapId,
			timeMs: state.timeMs,
			kills: state.kills,
			killsBy: { ...state.killsBy },
			bossKills: state.bossKills,
			eliteKills: state.superKills + state.megaKills,
			damageDealt: Math.round(state.damageDealt),
			biggestHit: Math.round(state.biggestHit),
			xp: Math.floor(state.xp),
			gold: state.gold,
			scrap: state.scrap,
			gear: [...state.haul],
			crystals: [...state.crystals],
			levelsGained: banked.levelsGained,
			levelBefore: before.level,
			xpBefore: before.xp,
			level: banked.profile.level,
			xpAfter: banked.profile.xp,
			salvaged: banked.salvaged,
			salvageGold: banked.salvageGold,
			salvageScrap: banked.salvageScrap,
			seasonXpBefore: before.season.xp,
			seasonXpAfter: banked.profile.season.xp
		};
		this.found = null;
		this.status = 'over';
	}
}

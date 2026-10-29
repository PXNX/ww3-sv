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
import { career } from '#lib/game/career/store.svelte.js';
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
	BOSS_EVERY_MS,
	CRYSTAL_COLOR,
	FIRST_BOSS_MS,
	bossStars,
	HAMMER_ARC,
	HAMMER_FALL_RADIUS,
	QUAKE_RADIUS,
	SKILL_COOLDOWN_MS,
	WEAPONS,
	SPRINT_COOLDOWN_MS,
	type Archetype,
	type ArmorSlot,
	type MapId,
	type RaidMode,
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
	type LoadoutSlot,
	type Profile,
	type WeaponSlot
} from '#lib/game/raid/profile.js';
import { liveEventAt, type ActiveEvent } from '#lib/game/raid/events.js';
import {
	addRaidToQuests,
	questKillTargets,
	type Quest,
	type QuestStats
} from '#lib/game/raid/quests.js';
import { dateAt, type SeasonReward } from '#lib/game/raid/season.js';
import { drawRaidPreview, type Effect, type SceneExtras } from '#lib/game/raid/render.js';
import {
	castVote,
	createRaid,
	currentBoss,
	SELF,
	equipFromHaul,
	giveUp,
	heldSkills,
	leaveRaid,
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
	type RaidState,
	type VoteChoice
} from '#lib/game/raid/state.js';
import { m } from '#lib/paraglide/messages.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
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
/** How long the crystal toast stays up */
const CRYSTAL_TOAST_MS = 2600;

/**
 * How a raid ended: a hunt that simply ended, a boss fight won or lost on time, or a defense
 * cashed out, lost with its command post, or given up (down or left) without cashing out
 */
export type RaidOutcome =
	'raid' | 'victory' | 'time-up' | 'cashed-out' | 'post-lost' | 'defense-lost';

/** The defense as the HUD shows it */
export interface DefenseHud {
	/** The command post's health, as a share */
	post: number;
	wave: number;
	/** Enemies of the wave still to beat */
	left: number;
	/** Seconds until the next wave, 0 while one is on */
	breakSeconds: number;
	pot: { xp: number; gold: number; scrap: number; crystals: number; gear: number };
	/** The open vote: seconds left, the player's own choice, and the count on each side */
	vote: {
		seconds: number;
		mine: VoteChoice | null;
		leave: number;
		stay: number;
		voters: number;
	} | null;
}
/** The same sound never plays more often than this, so a fast weapon does not drown the rest */
const SOUND_GAP_MS = 70;

export interface RaidResult {
	map: MapId;
	mode: RaidMode;
	outcome: RaidOutcome;
	/** A defense that was not cashed out loses everything */
	forfeited: boolean;
	/** Defense: waves held */
	wavesHeld: number;
	/** Boss fight: the stars earned, the map's best before, how many were new and their XP */
	stars: number;
	starsBefore: number;
	newStars: number;
	starXp: number;
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
	/** The career level the raid was played at, shown with its rank on the result screen */
	level: number;
	salvaged: number;
	salvageGold: number;
	salvageScrap: number;
	/** Season XP before and after the raid */
	seasonXpBefore: number;
	seasonXpAfter: number;
	/** Today's quests before and after the raid counted towards them */
	questsBefore: Quest[];
	quests: Quest[];
}

export interface RaidOptions {
	reducedMotion?: boolean;
	/** Injected for tests; default to the browser's local storage */
	store?: () => Store;
	seed?: () => number;
	/** The wall clock for the live events, in epoch milliseconds; injected for tests */
	now?: () => number;
	/** The raider's level, which is the career level; injected for tests */
	level?: () => number;
}

export class RaidGame {
	status = $state<RaidStatus>('lobby');
	/** Not deeply reactive: profile updates always replace the whole object */
	profile = $state.raw<Profile>(newProfile());
	map = $state<MapId>('sunflower');
	/** The endless hunt or a boss fight against the clock */
	mode = $state<RaidMode>('hunt');

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
	/** Whole seconds until each skill is ready again, shown on its button */
	skillSeconds = $state<readonly [number, number]>([0, 0]);
	/** Share of the sprint's recharge still to go, 0 when ready */
	sprintCooldown = $state(0);
	sprintSeconds = $state(0);
	/** The live event running during the raid, with its end on the wall clock */
	liveEvent = $state.raw<ActiveEvent | null>(null);
	/** Whole seconds the live event still runs */
	liveEventSeconds = $state(0);
	boss = $state<{ share: number; variant: Variant } | null>(null);
	/** While no boss is out: how far the wait for the next one is, and its seconds left */
	nextBoss = $state<{ share: number; seconds: number } | null>(null);
	/** Boss fight: seconds left on the clock; null in the other modes */
	timeLeft = $state<number | null>(null);
	/** Defense: the command post, the wave, the pot and the vote; null in the other modes */
	defense = $state.raw<DefenseHud | null>(null);
	/** The newest crystal picked up, for the toast */
	crystalToast = $state.raw<{ crystal: Crystal; id: number } | null>(null);
	/** The last piece of gear picked up, offered for equipping for a few seconds */
	found = $state.raw<{ item: GearItem; better: boolean } | null>(null);
	hurtCount = $state(0);
	result = $state.raw<RaidResult | null>(null);
	threatAnnouncement = $state<{ level: number } | null>(null);
	isNewBest = $state(false);
	/** Season rewards just claimed in the lobby, shown until dismissed */
	claimed = $state.raw<SeasonReward[] | null>(null);

	/** Simulation state, deliberately not reactive */
	state: RaidState;
	effects: Effect[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#store: () => Store;
	#seed: () => number;
	#now: () => number;
	#level: () => number;
	#foundMs = 0;
	#crystalMs = 0;
	#defenseKey = '';
	/** When each sound last played, on the raid clock */
	#soundAt: Partial<Record<SoundId, number>> = {};
	#clockMs = 0;

	constructor({
		reducedMotion = false,
		store = localStore,
		seed = randomSeed,
		now = Date.now,
		level = () => career().level
	}: RaidOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#store = store;
		this.#seed = seed;
		this.#now = now;
		this.#level = level;
		this.state = createRaid(this.map, this.profile.loadout, this.level);
		this.#syncChrome();
	}

	/** Reads the saved profile; call in the browser only */
	load() {
		const today = dateAt(this.#now());
		const saved = parseProfile(this.#store().read<unknown>(PROFILE_KEY, null), today);
		this.#setProfile(saved ?? newProfile(today));
		this.state = createRaid(this.map, this.profile.loadout, this.level);
		this.#syncChrome();
	}

	/** The raider's level: the career level, shared with every other game */
	get level(): number {
		return Math.max(1, Math.round(this.#level()));
	}

	// -------------------------------------------------------------------------------------------
	// Lobby

	selectMap(map: MapId) {
		if (this.status !== 'lobby' && this.status !== 'over') return;
		this.map = map;
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

	start(map: MapId = this.map, mode: RaidMode = this.mode) {
		this.map = map;
		this.mode = mode;
		const seed = this.#seed();
		this.#random = createRandom(seed);
		this.state = createRaid(map, this.profile.loadout, this.level, { mode });
		this.effects = [];
		this.found = null;
		this.crystalToast = null;
		this.defense = null;
		this.#defenseKey = '';
		this.result = null;
		this.isNewBest = false;
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

	/** Leaves the battle from the leave screen, banking everything found so far */
	leave() {
		if (this.status === 'playing' || this.status === 'paused') this.#apply(leaveRaid(this.state));
	}

	/** Today's quests as they would stand if the raid ended now, for the leave screen */
	liveQuests(): { before: Quest[]; after: Quest[] } {
		const today = withToday(this.profile, dateAt(this.#now())).quests;
		return { before: today.quests, after: addRaidToQuests(today, this.#questStats()).quests };
	}

	/** The enemy types an open daily quest still asks to be killed, for the minimap */
	questTargets(): Archetype[] {
		return questKillTargets(this.liveQuests().after);
	}

	#questStats(): QuestStats {
		const state = this.state;
		return {
			map: state.mapId,
			timeMs: state.timeMs,
			kills: state.kills,
			killsBy: state.killsBy,
			bossKills: state.bossKills,
			crystals: state.crystals.length,
			damage: state.damageDealt,
			skillsUsed: state.skillsUsed
		};
	}

	/** The player's vote at a defense checkpoint: leave with the pot, or keep holding */
	vote(choice: VoteChoice) {
		if (this.status === 'playing') this.#apply(castVote(this.state, SELF, choice));
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
		if (this.crystalToast) {
			this.#crystalMs -= dtMs;
			if (this.#crystalMs <= 0) this.crystalToast = null;
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
				// Haptic feedback for hits, stronger for higher damage
				haptic().play(Math.min(1, Math.round(event.damage) * 0.001));
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
				this.#ring(event.x, event.y, 90, RARITY_COLOR[crystal.rarity], 750);
				this.effects.push({
					kind: 'shards',
					x: event.x,
					y: event.y,
					color: CRYSTAL_COLOR[crystal.kind],
					glow: RARITY_COLOR[crystal.rarity],
					seed: this.#clockMs,
					ageMs: 0,
					durationMs: this.reducedMotion ? 300 : 900
				});
				this.crystalToast = { crystal, id: this.#clockMs };
				this.#crystalMs = CRYSTAL_TOAST_MS;
				haptic().play(0.6);
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
				if (event.level > 1) {
					this.threatAnnouncement = { level: event.level };
					setTimeout(() => {
						if (this.threatAnnouncement?.level === event.level) this.threatAnnouncement = null;
					}, 2000);
				}
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
			case 'swing':
				this.effects.push({
					kind: 'cone',
					x: event.x,
					y: event.y,
					angle: event.angle,
					spread: HAMMER_ARC,
					radius: WEAPONS.hammer.range,
					color: event.hits > 0 ? '#ffe3a3' : '#ffffff',
					ageMs: 0,
					durationMs: 220
				});
				this.#play(event.hits > 0 ? 'impact-stone' : 'whoosh', event.hits > 0 ? 0.6 : 0.3);
				break;
			case 'hammer-fall':
				this.#ring(event.x, event.y, HAMMER_FALL_RADIUS, '#ffd23a', 700);
				this.#ring(event.x, event.y, HAMMER_FALL_RADIUS * 0.6, '#5bd16b', 900);
				this.#text(event.x, event.y - 70, m.raid_popup_hammer_fall(), '#ffd23a', 28, 1300);
				this.#play('explosion-big');
				haptic().play(1);
				break;
			case 'overheat':
				this.hurtCount += 1;
				this.#text(
					player.x,
					player.y - 60,
					m.raid_popup_overheat({ damage: event.damage }),
					'#ff6a2b',
					22,
					1400
				);
				this.#ring(player.x, player.y, 60, '#ff6a2b', 500);
				this.#play('alarm', 0.6);
				break;
			case 'quake':
				this.#ring(event.x, event.y, QUAKE_RADIUS, '#c9a35d', 600);
				this.#play('break-stone', 0.8);
				break;
			case 'warcry':
				this.#ring(player.x, player.y, 110, '#e5484d', 600);
				break;
			case 'victory':
				this.#text(event.x, event.y - 80, m.raid_popup_victory(), '#ffd23a', 34, 2200);
				this.#ring(event.x, event.y, 220, '#ffd23a', 900);
				this.#play('new-best');
				break;
			case 'wave':
				this.#text(
					player.x,
					player.y - 80,
					event.boss
						? m.raid_popup_wave_boss({ wave: event.wave })
						: m.raid_popup_wave({ wave: event.wave }),
					event.boss ? '#ff4d4d' : '#ffffff',
					event.boss ? 28 : 26,
					1800
				);
				this.#play('alarm', event.boss ? 1 : 0.5);
				break;
			case 'wave-cleared':
				this.#text(
					player.x,
					player.y - 80,
					m.raid_popup_wave_cleared({ wave: event.wave }),
					'#5bd16b',
					26,
					1800
				);
				this.#play(event.vote ? 'chime-big' : 'chime');
				break;
			case 'objective-lost':
				this.#play('explosion-big');
				break;
			case 'vote-cast':
				this.#play('ui-toggle');
				break;
			case 'vote-result':
				this.#text(
					player.x,
					player.y - 80,
					event.choice === 'stay' ? m.raid_vote_stay() : m.raid_vote_leave(),
					'#ffd23a',
					26,
					1600
				);
				break;
			case 'cash-out':
				this.#play('chime-big');
				break;
			case 'tornado-catch':
				if (event.player) {
					this.#text(player.x, player.y - 60, m.raid_popup_tornado(), '#e8c27a', 24, 1200);
					haptic().play(0.5);
				}
				this.#play('draft', event.player ? 1 : 0.4);
				break;
			case 'tornado-spit':
				this.#ring(event.x, event.y, 50, '#d9b56a', 380);
				this.#play('whoosh', event.player ? 0.9 : 0.4);
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
			overclock: 'ability-split',
			quake: 'impact-stone',
			warcry: 'alarm'
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
		const seconds = skills.map((skill) =>
			Math.ceil(player.skillMs[skill] / 1000)
		) as unknown as readonly [number, number];
		if (seconds[0] !== this.skillSeconds[0] || seconds[1] !== this.skillSeconds[1]) {
			this.skillSeconds = seconds;
		}
		this.sprintCooldown = share(player.sprintMs, SPRINT_COOLDOWN_MS);
		this.sprintSeconds = Math.ceil(Math.max(0, player.sprintMs) / 1000);
		this.timeLeft =
			state.timeLimitMs > 0
				? Math.ceil(Math.max(0, state.timeLimitMs - state.timeMs) / 1000)
				: null;
		this.#syncDefense();
		const boss = currentBoss(state);
		this.boss = boss
			? { share: Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100) / 100), variant: boss.variant }
			: null;
		if (boss) this.nextBoss = null;
		else {
			const wait = state.nextBossMs <= FIRST_BOSS_MS ? FIRST_BOSS_MS : BOSS_EVERY_MS;
			const left = Math.max(0, state.nextBossMs - state.timeMs);
			const next = {
				share: Math.floor((1 - left / wait) * 100) / 100,
				seconds: Math.ceil(left / 1000)
			};
			if (next.share !== this.nextBoss?.share || next.seconds !== this.nextBoss.seconds) {
				this.nextBoss = next;
			}
		}
	}

	/** The defense for the HUD; only handed on when something it shows changed */
	#syncDefense() {
		const defense = this.state.defense;
		if (!defense) {
			if (this.defense) this.defense = null;
			return;
		}
		const { objective, pot, vote } = defense;
		const votes = vote ? Object.values(vote.votes) : [];
		const hud: DefenseHud = {
			post: Math.ceil((objective.hp / objective.maxHp) * 100) / 100,
			wave: defense.wave,
			left: defense.toSpawn + this.state.enemies.length,
			breakSeconds: defense.breakMs > 0 ? Math.ceil(defense.breakMs / 1000) : 0,
			pot: {
				xp: Math.floor(pot.xp),
				gold: pot.gold,
				scrap: pot.scrap,
				crystals: pot.crystals.length,
				gear: pot.gear.length
			},
			vote: vote
				? {
						seconds: Math.ceil(Math.max(0, vote.ms) / 1000),
						mine: vote.votes[SELF] ?? null,
						leave: votes.filter((choice) => choice === 'leave').length,
						stay: votes.filter((choice) => choice === 'stay').length,
						voters: defense.voters.length
					}
				: null
		};
		const key = JSON.stringify(hud);
		if (key === this.#defenseKey) return;
		this.#defenseKey = key;
		this.defense = hud;
	}

	#outcome(): RaidOutcome {
		const state = this.state;
		if (state.won) return 'victory';
		if (state.timeLimitMs > 0 && state.timeMs >= state.timeLimitMs) return 'time-up';
		const defense = state.defense;
		if (!defense) return 'raid';
		if (defense.cashedOut) return 'cashed-out';
		return defense.objective.hp <= 0 ? 'post-lost' : 'defense-lost';
	}

	#finish() {
		this.#syncChrome();
		const state = this.state;
		const defense = state.defense;
		const outcome = this.#outcome();
		// A defense pays only when cashed out: losing it (or giving up) loses everything
		const forfeited = defense !== null && !defense.cashedOut;
		const wavesHeld = defense
			? defense.cashedOut || defense.vote || defense.breakMs > 0
				? defense.wave
				: Math.max(0, defense.wave - 1)
			: 0;
		// A boss fight earns a star for every 20 seconds left on the clock
		const stars = bossStars(state.won, state.timeLimitMs - state.timeMs);
		const today = dateAt(this.#now());
		const before = withToday(this.profile, today);
		const banked = bankHaul(
			before,
			{
				map: state.mapId,
				timeMs: state.timeMs,
				xp: forfeited ? 0 : state.xp,
				gold: forfeited ? 0 : state.gold,
				scrap: forfeited ? 0 : state.scrap,
				gear: forfeited ? [] : state.haul,
				crystals: forfeited ? [] : state.crystals,
				loadout: state.loadout,
				stats: this.#questStats(),
				mode: state.mode,
				bossClearMs: state.won ? state.timeMs : undefined,
				defenseWave: defense ? wavesHeld : undefined,
				bossStars: stars,
				starWeapon: state.loadout[state.player.held].kind
			},
			today
		);
		this.#setProfile(banked.profile);
		// No high scores in raids: only stars newly reached in a boss fight count as a best
		this.isNewBest = banked.newStars > 0;
		this.result = {
			map: state.mapId,
			mode: state.mode,
			outcome,
			forfeited,
			wavesHeld,
			stars,
			starsBefore: before.bossStars[state.mapId] ?? 0,
			newStars: banked.newStars,
			starXp: banked.starXp,
			timeMs: state.timeMs,
			kills: state.kills,
			killsBy: { ...state.killsBy },
			bossKills: state.bossKills,
			eliteKills: state.superKills + state.megaKills,
			damageDealt: Math.round(state.damageDealt),
			biggestHit: Math.round(state.biggestHit),
			xp: forfeited ? 0 : Math.floor(state.xp),
			gold: forfeited ? 0 : state.gold,
			scrap: forfeited ? 0 : state.scrap,
			gear: forfeited ? [] : [...state.haul],
			crystals: forfeited ? [] : [...state.crystals],
			level: this.level,
			salvaged: banked.salvaged,
			salvageGold: banked.salvageGold,
			salvageScrap: banked.salvageScrap,
			seasonXpBefore: before.season.xp,
			seasonXpAfter: banked.profile.season.xp,
			questsBefore: before.quests.quests,
			quests: banked.profile.quests.quests
		};
		this.found = null;
		this.status = 'over';
	}
}

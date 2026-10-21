/*
 * Raid game store: the persistent profile and lobby actions, and around a running raid the
 * player's commands, floating numbers and rings, sounds and the reactive HUD values. The
 * simulation state is a plain object read by the canvas every frame; only what the page chrome
 * shows is reactive, synced after each step.
 */
import { BOSS_NAMES, itemName, WEAPON_NAMES } from '#lib/components/raidText.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import {
	GRENADE_COOLDOWN_MS,
	GRENADE_RADIUS,
	HEAL_COOLDOWN_MS,
	RARITY_COLOR,
	REVIVE_BLAST_RADIUS,
	BOSS_SLAM_RADIUS,
	WEAPONS,
	type MapId,
	type Variant,
	type WeaponKind
} from '#lib/game/raid/config.js';
import { gearScore, type GearItem } from '#lib/game/raid/items.js';
import {
	bankHaul,
	equipFromStash,
	isProfile,
	newProfile,
	salvage,
	swapWeapons,
	unequipArmor,
	upgradeSlot,
	xpToNext,
	type LoadoutSlot,
	type Profile
} from '#lib/game/raid/profile.js';
import { drawRaidPreview, type Effect, type SceneExtras } from '#lib/game/raid/render.js';
import {
	createRaid,
	currentBoss,
	equipFromHaul,
	giveUp,
	hasAbilities,
	revive,
	scoreOf,
	setFiring,
	setMove,
	stepRaid,
	swapWeapon,
	useGrenade,
	useHeal,
	type RaidEvent,
	type RaidState
} from '#lib/game/raid/state.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type RaidStatus = 'lobby' | 'playing' | 'paused' | 'down' | 'over';

const PROFILE_KEY = 'raid:profile';
/** How long the "found new gear" card stays up */
const FOUND_MS = 6000;
/** The same sound never plays more often than this, so a fast weapon does not drown the rest */
const SOUND_GAP_MS = 70;

export interface RaidResult {
	map: MapId;
	timeMs: number;
	kills: number;
	bossKills: number;
	eliteKills: number;
	xp: number;
	gold: number;
	gear: GearItem[];
	levelsGained: number;
	level: number;
	salvaged: number;
	salvageGold: number;
}

export interface RaidOptions {
	reducedMotion?: boolean;
	/** Injected for tests; default to the browser's local storage */
	store?: () => Store;
	scores?: () => Highscores;
	seed?: () => number;
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
	revivesLeft = $state(1);
	heldKind = $state<WeaponKind>('rifle');
	otherKind = $state<WeaponKind>('marksman');
	heldLevel = $state(1);
	abilities = $state(true);
	/** Share of the cooldown still to go, 0 when ready */
	healCooldown = $state(0);
	grenadeCooldown = $state(0);
	fireCooldown = $state(0);
	boss = $state<{ share: number; variant: Variant } | null>(null);
	/** The last piece of gear picked up, offered for equipping for a few seconds */
	found = $state.raw<{ item: GearItem; better: boolean } | null>(null);
	hurtCount = $state(0);
	result = $state.raw<RaidResult | null>(null);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: RaidState;
	effects: Effect[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#store: () => Store;
	#scores: () => Highscores;
	#seed: () => number;
	#foundMs = 0;
	#soundAt = new Map<SoundId, number>();
	#clockMs = 0;

	constructor({
		reducedMotion = false,
		store = localStore,
		scores = highscores,
		seed = randomSeed
	}: RaidOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#store = store;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createRaid(this.map, this.profile.loadout, this.profile.level);
		this.#syncChrome();
	}

	/** Reads the saved profile and best score; call in the browser only */
	load() {
		this.profile = this.#store().read(PROFILE_KEY, newProfile(), isProfile);
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

	unequip(slot: 'helmet' | 'vest') {
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

	backToLobby() {
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
		this.#soundAt.clear();
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

	heal() {
		if (this.status === 'playing') this.#apply(useHeal(this.state));
	}

	grenade() {
		if (this.status === 'playing') this.#apply(useGrenade(this.state));
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
		this.#apply(stepRaid(this.state, this.#random, dtMs));
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
				this.#play(
					event.kind === 'launcher' ? 'whoosh' : event.kind === 'marksman' ? 'zap' : 'fire',
					0.5
				);
				break;
			case 'hit':
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
			case 'grenade-throw':
				this.#play('whoosh');
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
			case 'gear': {
				const { item } = event;
				const current =
					item.type === 'weapon' ? this.state.loadout[player.held] : this.state.loadout[item.slot];
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
						armor: event.slot === 'helmet' ? m.raid_armor_helmet() : m.raid_armor_vest(),
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

	#play(id: SoundId, intensity = 1) {
		const last = this.#soundAt.get(id);
		if (last !== undefined && this.#clockMs - last < SOUND_GAP_MS && this.status === 'playing')
			return;
		this.#soundAt.set(id, this.#clockMs);
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
		this.revivesLeft = state.revivesLeft;
		const held = loadout[player.held];
		this.heldKind = held.kind;
		this.heldLevel = held.level;
		this.otherKind = loadout[player.held === 'primary' ? 'secondary' : 'primary'].kind;
		this.abilities = hasAbilities(state);
		// Rounded to twentieths, so the HUD only updates when it visibly changes
		const share = (left: number, total: number) => Math.ceil((left / total) * 20) / 20;
		this.healCooldown = share(player.healMs, HEAL_COOLDOWN_MS);
		this.grenadeCooldown = share(player.grenadeMs, GRENADE_COOLDOWN_MS);
		this.fireCooldown = share(player.fireMs, WEAPONS[held.kind].fireMs);
		const boss = currentBoss(state);
		this.boss = boss
			? { share: Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100) / 100), variant: boss.variant }
			: null;
	}

	#finish() {
		this.#syncChrome();
		const state = this.state;
		const banked = bankHaul(this.profile, {
			map: state.mapId,
			timeMs: state.timeMs,
			xp: state.xp,
			gold: state.gold,
			gear: state.haul,
			loadout: state.loadout
		});
		this.#setProfile(banked.profile);
		const best = this.#scores().submit(scoreKey(state.mapId), this.score);
		this.best = best.best;
		this.isNewBest = best.isNewBest;
		this.result = {
			map: state.mapId,
			timeMs: state.timeMs,
			kills: state.kills,
			bossKills: state.bossKills,
			eliteKills: state.superKills + state.megaKills,
			xp: Math.floor(state.xp),
			gold: state.gold,
			gear: [...state.haul],
			levelsGained: banked.levelsGained,
			level: banked.profile.level,
			salvaged: banked.salvaged,
			salvageGold: banked.salvageGold
		};
		this.found = null;
		this.status = 'over';
	}
}

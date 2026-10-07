/*
 * Reactive state for Magyar's Birds: the level select, the running match, aiming, pause, results
 * and the locally stored progress. The match itself (physics) is not reactive; after every fixed
 * step the few values the interface shows are copied into $state fields.
 */
import { createRandom, randomSeed } from '$lib/game/random';
import type { BirdKind } from '$lib/game/fury/birds';
import { FuryMatch, type FuryPhase } from '$lib/game/fury/furyMatch';
import type { ImpactSurface, WorldEvent } from '$lib/game/fury/furyWorld';
import { DEFAULT_AIM, MIN_POWER, adjustAim, type Aim } from '$lib/game/fury/launch';
import { LEVELS, PREPARED_LEVEL_COUNT, levelAt, levelIdAt } from '$lib/game/fury/levels';
import { backgroundFor, type Backdrop } from '$lib/game/fury/backgrounds';
import {
	DEFAULT_SETTINGS,
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	SETTINGS_KEY,
	isFuryProgress,
	isFurySettings,
	isUnlocked,
	recordWin,
	visibleLevelCount,
	type FuryProgress,
	type FurySettings
} from '$lib/game/fury/progress';
import { highscores } from '$lib/services/highscore';
import { localStore } from '$lib/services/storage';
import { soundManager } from '$lib/sound/soundManager.svelte';
import type { SoundId } from '$lib/sound/sounds';

export type FuryScreen = 'select' | 'play';

export type FuryAnnouncement =
	{ kind: 'ready'; bird: BirdKind } | { kind: 'dome'; remaining: number };

/** Steps between the end of a level and its result panel, so the last domes can pop (1.2 s) */
const RESULT_DELAY_STEPS = 72;

/** The sound of a bird hitting each kind of surface */
const IMPACT_SOUNDS: Record<ImpactSurface, SoundId> = {
	wood: 'impact-wood',
	stone: 'impact-stone',
	ice: 'impact-ice',
	dome: 'impact-dome',
	ground: 'thud',
	bird: 'thud'
};

/** Steps (60 per second) between two impact sounds, so a collapsing tower is not a wall of noise */
const IMPACT_SOUND_GAP = 5;
/** Each step of pull strength (fraction of full power) makes the slingshot creak once */
const PULL_CREAK_STEP = 0.15;

/** Ids of the prepared levels; the generated levels after them are numbered on from here */
export const LEVEL_IDS: readonly string[] = LEVELS.map((level) => level.id);

export function highscoreParts(levelId: string): string[] {
	return ['fury', levelId, 'score'];
}

export class FuryGame {
	screen = $state<FuryScreen>('select');
	levelIndex = $state(0);
	phase = $state<FuryPhase>('aiming');
	score = $state(0);
	/** Birds not yet launched; the first one sits in the slingshot while aiming */
	squad = $state<BirdKind[]>([]);
	domesRemaining = $state(0);
	domesTotal = $state(0);
	blocksDestroyed = $state(0);
	blocksTotal = $state(0);
	bonus = $state(0);
	aim = $state<Aim | null>(null);
	canUseAbility = $state(false);
	paused = $state(false);
	/** Shown once the result delay has passed */
	showWin = $state(false);
	showFail = $state(false);
	stars = $state(0);
	isNewBest = $state(false);
	best = $state<number | null>(null);
	progress = $state<FuryProgress>(EMPTY_PROGRESS);
	settings = $state<FurySettings>(DEFAULT_SETTINGS);
	/** Latest event worth announcing to screen readers */
	announcement = $state<FuryAnnouncement | null>(null);
	/** Increases with every step while playing; drives idle animation */
	steps = $state(0);

	/** The physics match; deliberately not reactive */
	match: FuryMatch | null = null;
	/** Events of the latest step, for effects such as screen shake */
	lastEvents: WorldEvent[] = [];
	#resultSteps = 0;
	#lastImpactSound = -IMPACT_SOUND_GAP;
	#pullStep = 0;

	get level() {
		return levelAt(this.levelIndex);
	}

	/** The scenery of the current level; it changes every few levels */
	get backdrop(): Backdrop {
		return backgroundFor(this.levelIndex);
	}

	/** Level cards to show: the prepared levels, then the generated ones reached so far */
	get visibleLevels(): number {
		return visibleLevelCount(this.progress, PREPARED_LEVEL_COUNT, levelIdAt);
	}

	/** True right after the last prepared level is won: from here on the levels are generated */
	get preparedCleared(): boolean {
		return this.levelIndex === PREPARED_LEVEL_COUNT - 1;
	}

	get currentBird(): BirdKind | null {
		return this.phase === 'aiming' ? (this.squad[0] ?? null) : null;
	}

	/** Reads progress and settings from local storage (call in the browser) */
	load() {
		const store = localStore();
		this.progress = store.read(PROGRESS_KEY, EMPTY_PROGRESS, isFuryProgress);
		this.settings = store.read(SETTINGS_KEY, DEFAULT_SETTINGS, isFurySettings);
	}

	isUnlocked(index: number): boolean {
		return isUnlocked(this.progress, levelIdAt, index);
	}

	starsFor(levelId: string): number {
		return this.progress.stars[levelId] ?? 0;
	}

	bestFor(levelId: string): number | null {
		return highscores().get(highscoreParts(levelId));
	}

	setLongPreview(longPreview: boolean) {
		this.settings = { ...this.settings, longPreview };
		localStore().write(SETTINGS_KEY, this.settings);
	}

	openLevel(index: number) {
		if (!this.isUnlocked(index)) return;
		const level = levelAt(index);
		this.levelIndex = index;
		this.match = new FuryMatch(level, createRandom(randomSeed()));
		this.screen = 'play';
		this.paused = false;
		this.showWin = false;
		this.showFail = false;
		this.isNewBest = false;
		this.stars = 0;
		this.aim = null;
		this.announcement = null;
		this.#resultSteps = 0;
		this.#lastImpactSound = -IMPACT_SOUND_GAP;
		this.#pullStep = 0;
		this.best = this.bestFor(level.id);
		this.#sync();
	}

	retry() {
		this.openLevel(this.levelIndex);
	}

	nextLevel() {
		this.openLevel(this.levelIndex + 1);
	}

	backToSelect() {
		this.match = null;
		this.screen = 'select';
		this.paused = false;
		this.showWin = false;
		this.showFail = false;
		this.aim = null;
	}

	setPaused(paused: boolean) {
		if (this.screen !== 'play' || this.showWin || this.showFail) return;
		this.paused = paused;
	}

	/** Pointer or keyboard aiming; null cancels */
	setAim(aim: Aim | null) {
		if (this.phase !== 'aiming' || this.paused) return;
		this.aim = aim;
		this.#creak(aim);
	}

	/** Keyboard aiming: starts from the default aim when there is none yet */
	nudgeAim(angleDelta: number, powerDelta: number) {
		if (this.phase !== 'aiming' || this.paused) return;
		this.aim = adjustAim(this.aim ?? DEFAULT_AIM, angleDelta, powerDelta);
		this.#creak(this.aim);
	}

	/** Releases the slingshot; a weak pull puts the bird back */
	release(): boolean {
		const aim = this.aim;
		this.aim = null;
		this.#pullStep = 0;
		if (!this.match || this.paused || !aim) return false;
		if (aim.power < MIN_POWER) {
			// Too weak a pull puts the bird back
			if (aim.power > 0) soundManager().play('click');
			return false;
		}
		const launched = this.match.launch(aim);
		if (launched) soundManager().play('sling-release', aim.power);
		this.#sync();
		return launched;
	}

	useAbility(): boolean {
		if (!this.match || this.paused) return false;
		const used = this.match.useAbility();
		if (used) this.#sync();
		return used;
	}

	/** Space or Enter: launches while aiming, triggers the trick while flying */
	primaryAction(): void {
		if (this.phase === 'aiming') {
			if (!this.aim) this.aim = { ...DEFAULT_AIM };
			else this.release();
		} else if (this.phase === 'flying') {
			this.useAbility();
		}
	}

	/** One fixed step of the running level */
	update() {
		const match = this.match;
		if (!match || this.paused) return;
		const previousPhase = match.phase;
		match.step();
		this.lastEvents = match.world.drainEvents();
		this.steps++;

		const brokenMaterials: string[] = [];
		for (const event of this.lastEvents) {
			this.#playEvent(event, brokenMaterials);
			if (event.type === 'dome-destroyed' && event.remaining > 0) {
				this.announcement = { kind: 'dome', remaining: event.remaining };
			}
		}
		if (match.phase === 'aiming' && previousPhase !== 'aiming') {
			const bird = match.currentBird;
			if (bird) this.announcement = { kind: 'ready', bird };
		}

		if (match.isOver && !this.showWin && !this.showFail) {
			this.#resultSteps++;
			if (this.#resultSteps >= RESULT_DELAY_STEPS) this.#finish(match);
		}
		this.#sync();
	}

	/** Creaks once per notch of pull strength, in either direction, so pulling back sounds taut */
	#creak(aim: Aim | null) {
		const step = aim ? Math.floor(aim.power / PULL_CREAK_STEP) : 0;
		if (aim && step !== this.#pullStep) soundManager().play('sling-draw', aim.power);
		this.#pullStep = step;
	}

	/** Plays the sound of one world event; blocks of one material breaking together sound once */
	#playEvent(event: WorldEvent, brokenMaterials: string[]) {
		switch (event.type) {
			case 'impact':
				if (this.steps - this.#lastImpactSound < IMPACT_SOUND_GAP) return;
				this.#lastImpactSound = this.steps;
				soundManager().play(IMPACT_SOUNDS[event.surface], Math.min(1, (event.strength - 4) / 16));
				return;
			case 'block-destroyed':
				if (brokenMaterials.includes(event.material)) return;
				brokenMaterials.push(event.material);
				soundManager().play(`break-${event.material}`);
				return;
			case 'landmark-destroyed':
				soundManager().play('explosion-small');
				return;
			case 'dome-destroyed':
				soundManager().play('dome-pop');
				return;
			case 'ability':
				if (event.bird === 'phoenix') {
					soundManager().play('explosion-small');
					return;
				}
				soundManager().play('flap');
				soundManager().play('whoosh');
				return;
		}
	}

	#finish(match: FuryMatch) {
		const level = this.level;
		if (match.phase === 'won') {
			const result = highscores().submit(highscoreParts(level.id), match.score);
			this.isNewBest = result.isNewBest;
			this.best = result.best;
			this.stars = match.stars;
			this.progress = recordWin(this.progress, level.id, match.stars);
			localStore().write(PROGRESS_KEY, this.progress);
			this.showWin = true;
		} else {
			this.isNewBest = false;
			this.showFail = true;
		}
	}

	#sync() {
		const match = this.match;
		if (!match) return;
		const world = match.world;
		this.phase = match.phase;
		this.score = match.score;
		this.bonus = match.bonus;
		if (this.squad.length !== match.squad.length) this.squad = [...match.squad];
		this.domesRemaining = world.domesRemaining;
		this.domesTotal = world.domesTotal;
		this.blocksDestroyed = world.blocksDestroyed;
		this.blocksTotal = world.blocksTotal;
		this.canUseAbility = match.canUseAbility();
	}
}

/*
 * Reactive state for Feathered Fury: the level select, the running match, aiming, pause, results
 * and the locally stored progress. The match itself (physics) is not reactive; after every fixed
 * step the few values the interface shows are copied into $state fields.
 */
import { createRandom, randomSeed } from '$lib/game/random';
import type { BirdKind } from '$lib/game/fury/birds';
import { FuryMatch, type FuryPhase } from '$lib/game/fury/furyMatch';
import type { WorldEvent } from '$lib/game/fury/furyWorld';
import { DEFAULT_AIM, MIN_POWER, adjustAim, type Aim } from '$lib/game/fury/launch';
import { LEVELS } from '$lib/game/fury/levels';
import {
	DEFAULT_SETTINGS,
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	SETTINGS_KEY,
	isFuryProgress,
	isFurySettings,
	isUnlocked,
	recordWin,
	type FuryProgress,
	type FurySettings
} from '$lib/game/fury/progress';
import { highscores } from '$lib/services/highscore';
import { localStore } from '$lib/services/storage';

export type FuryScreen = 'select' | 'play';

export type FuryAnnouncement =
	{ kind: 'ready'; bird: BirdKind } | { kind: 'dome'; remaining: number };

/** Steps between the end of a level and its result panel, so the last domes can pop (1.2 s) */
const RESULT_DELAY_STEPS = 72;

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

	get level() {
		return LEVELS[this.levelIndex];
	}

	get levelCount() {
		return LEVELS.length;
	}

	get hasNextLevel() {
		return this.levelIndex + 1 < LEVELS.length;
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
		return isUnlocked(this.progress, LEVEL_IDS, index);
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
		if (!this.isUnlocked(index) || !LEVELS[index]) return;
		this.levelIndex = index;
		this.match = new FuryMatch(LEVELS[index], createRandom(randomSeed()));
		this.screen = 'play';
		this.paused = false;
		this.showWin = false;
		this.showFail = false;
		this.isNewBest = false;
		this.stars = 0;
		this.aim = null;
		this.announcement = null;
		this.#resultSteps = 0;
		this.best = this.bestFor(LEVELS[index].id);
		this.#sync();
	}

	retry() {
		this.openLevel(this.levelIndex);
	}

	nextLevel() {
		if (this.hasNextLevel) this.openLevel(this.levelIndex + 1);
		else this.backToSelect();
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
	}

	/** Keyboard aiming: starts from the default aim when there is none yet */
	nudgeAim(angleDelta: number, powerDelta: number) {
		if (this.phase !== 'aiming' || this.paused) return;
		this.aim = adjustAim(this.aim ?? DEFAULT_AIM, angleDelta, powerDelta);
	}

	/** Releases the slingshot; a weak pull puts the bird back */
	release(): boolean {
		const aim = this.aim;
		this.aim = null;
		if (!this.match || this.paused || !aim || aim.power < MIN_POWER) return false;
		const launched = this.match.launch(aim);
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

		for (const event of this.lastEvents) {
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

	#finish(match: FuryMatch) {
		const level = LEVELS[this.levelIndex];
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

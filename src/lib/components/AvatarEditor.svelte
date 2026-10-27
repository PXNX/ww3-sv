<!--
	The agent editor: the agent big on the left (it wobbles on every change), a tab per part and
	the choices for that part. Shape choices are drawn as small agents wearing that option, so the
	editor needs no word for "mohawk" in six languages; colours are plain swatches. Every tap saves.

	A few options are extra looks that unlock from playing a particular game, keeping the daily
	reward streak or climbing the career levels. They are shown in place, dimmed with a lock, so the
	player can see what is still missing; tapping one says what unlocks it.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { career } from '#lib/game/career/store.svelte.js';
	import { LOOK_PARTS, withPart, type LookPart } from '#lib/game/avatar/look.js';
	import { avatar } from '#lib/game/avatar/store.svelte.js';
	import {
		isUnlocked,
		LOOK_UNLOCKS,
		unlockFor,
		unlockProgress,
		unlockedCount
	} from '#lib/game/avatar/unlocks.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import { requirementText } from './unlockText.js';
	import Avatar from './Avatar.svelte';
	import IconDices from '~icons/lucide/dices';
	import IconLock from '~icons/lucide/lock';
	import IconRotateCcw from '~icons/lucide/rotate-ccw';
	import IconSparkles from '~icons/lucide/sparkles';

	interface Props {
		/** Bigger preview for the profile page */
		large?: boolean;
	}

	let { large = false }: Props = $props();

	const avatarState = avatar();
	const careerState = career();

	const PART_LABELS: Record<LookPart, () => string> = {
		shirt: m.avatar_part_shirt,
		shirtColor: m.avatar_part_shirt_color,
		face: m.avatar_part_face,
		skin: m.avatar_part_skin,
		eyes: m.avatar_part_eyes,
		nose: m.avatar_part_nose,
		hair: m.avatar_part_hair,
		hairColor: m.avatar_part_hair_color,
		hat: m.avatar_part_hat
	};
	const COLOR_PARTS: readonly LookPart[] = ['shirtColor', 'skin', 'hairColor'];
	const PARTS = Object.keys(LOOK_PARTS) as LookPart[];
	const TOTAL_UNLOCKS = LOOK_UNLOCKS.length;

	let part = $state<LookPart>('hair');
	/** Bumped on every change to replay the wobble */
	let wobble = $state(0);
	/** What tapping a locked option said, cleared after a moment */
	let lockNote = $state('');
	let lockTimer: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => clearTimeout(lockTimer));

	const progress = $derived(unlockProgress(careerState.profile, careerState.level));
	const collected = $derived(unlockedCount(progress));

	const options = $derived(LOOK_PARTS[part] as readonly string[]);
	const isColor = $derived(COLOR_PARTS.includes(part));

	/** True while the option is locked and not already the look being worn */
	function isLocked(part: LookPart, value: string): boolean {
		return avatarState.look[part] !== value && !isUnlocked(part, value, progress);
	}

	function changed(sound: 'pop' | 'sparkle' | 'ui-tap' = 'pop') {
		wobble += 1;
		soundManager().play(sound);
	}

	function showLocked(value: string) {
		const unlock = unlockFor(part, value);
		if (!unlock) return;
		lockNote = m.avatar_locked_hint({ requirement: requirementText(unlock.requirement) });
		clearTimeout(lockTimer);
		lockTimer = setTimeout(() => (lockNote = ''), 2800);
		soundManager().play('ui-error');
	}

	function pick(value: string) {
		if (isLocked(part, value)) {
			showLocked(value);
			return;
		}
		if (avatarState.look[part] === value) return;
		avatarState.set(part, value);
		lockNote = '';
		changed();
	}

	function surprise() {
		avatarState.randomize((entry, value) => isUnlocked(entry, value, progress));
		lockNote = '';
		changed('sparkle');
	}

	function reset() {
		avatarState.reset();
		lockNote = '';
		changed('ui-tap');
	}
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-start">
	<div class="flex shrink-0 flex-col items-center gap-2">
		{#key wobble}
			<div
				class="avatar-wobble rounded-[18px_10px_16px_8px] border-3 border-ink bg-flag-blue/25 p-2"
			>
				<Avatar size={large ? 180 : 120} label={m.avatar_title()} />
			</div>
		{/key}
		<div class="flex gap-2">
			<button
				type="button"
				class="btn-chunky bg-explosion-yellow px-3 py-1 text-sm"
				onclick={surprise}
			>
				<IconDices class="size-4" aria-hidden="true" />
				{m.avatar_randomize()}
			</button>
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm"
				onclick={reset}
				aria-label={m.avatar_reset()}
				title={m.avatar_reset()}
			>
				<IconRotateCcw class="size-4" aria-hidden="true" />
			</button>
		</div>
	</div>

	<div class="flex min-w-0 flex-1 flex-col gap-2">
		<div class="flex flex-wrap gap-1.5" role="tablist" aria-label={m.avatar_title()}>
			{#each PARTS as entry (entry)}
				<button
					type="button"
					role="tab"
					aria-selected={part === entry}
					class="rounded-[8px_4px_7px_5px] border-2 border-ink px-2 py-0.5 text-xs font-bold transition-transform active:scale-95 {part ===
					entry
						? '-rotate-2 bg-explosion-yellow'
						: 'bg-paper'}"
					onclick={() => (part = entry)}
				>
					{PART_LABELS[entry]()}
				</button>
			{/each}
		</div>

		<div
			class="flex items-center gap-2 rounded-[8px_4px_7px_5px] border-2 border-ink bg-paper px-2 py-1"
		>
			<IconSparkles class="size-4 shrink-0 text-mustard" aria-hidden="true" />
			<p class="min-w-0 flex-1 text-xs leading-tight font-bold" aria-live="polite">
				{collected === TOTAL_UNLOCKS
					? m.avatar_unlocked_all()
					: m.avatar_unlocked_progress({ done: collected, total: TOTAL_UNLOCKS })}
			</p>
			<div class="h-1.5 w-14 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-sand">
				<div class="h-full bg-mustard" style:width="{(collected / TOTAL_UNLOCKS) * 100}%"></div>
			</div>
		</div>

		<div
			class="grid gap-2 {isColor
				? 'grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))]'
				: 'grid-cols-[repeat(auto-fill,minmax(4rem,1fr))]'}"
			role="radiogroup"
			aria-label={PART_LABELS[part]()}
		>
			{#each options as value, index (value)}
				{@const selected = avatarState.look[part] === value}
				{@const locked = isLocked(part, value)}
				{@const unlock = locked ? unlockFor(part, value) : undefined}
				{@const requirement = unlock ? requirementText(unlock.requirement) : ''}
				{@const label = m.avatar_option({
					part: PART_LABELS[part](),
					number: index + 1,
					total: options.length
				})}
				{@const name = locked ? m.avatar_locked_option({ name: label, requirement }) : label}
				{#if isColor}
					<button
						type="button"
						role="radio"
						aria-checked={selected}
						aria-disabled={locked}
						aria-label={name}
						title={name}
						class="relative aspect-square rounded-full border-3 border-ink transition-transform hover:-rotate-6 active:scale-90 {selected
							? 'scale-110 shadow-[2px_2px_0_var(--color-ink)] outline-3 outline-offset-2 outline-tie-red'
							: ''} {locked ? 'opacity-45 grayscale' : ''}"
						style:background={value}
						onclick={() => pick(value)}
					>
						{#if locked}
							<span class="absolute inset-0 grid place-items-center">
								<IconLock class="size-4 text-paper drop-shadow" aria-hidden="true" />
							</span>
						{/if}
					</button>
				{:else}
					<button
						type="button"
						role="radio"
						aria-checked={selected}
						aria-disabled={locked}
						aria-label={name}
						title={name}
						class="relative flex items-center justify-center overflow-hidden rounded-[10px_5px_9px_6px] border-2 border-ink p-0.5 transition-transform hover:-rotate-3 active:scale-90 {selected
							? 'bg-explosion-yellow shadow-[2px_2px_0_var(--color-ink)]'
							: 'bg-paper'}"
						onclick={() => pick(value)}
					>
						<span class="flex" class:opacity-40={locked}>
							<Avatar look={withPart(avatarState.look, part, value)} size={56} />
						</span>
						{#if locked}
							<span class="absolute inset-0 grid place-items-center bg-paper/45">
								<IconLock class="size-5 text-ink" aria-hidden="true" />
							</span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>

		{#if lockNote}
			<p class="lock-note flex items-center gap-1.5 text-xs font-bold text-tie-red" role="status">
				<IconLock class="size-3.5 shrink-0" aria-hidden="true" />
				{lockNote}
			</p>
		{/if}
	</div>
</div>

<style>
	/* A rubbery wiggle when the agent changes; skipped for reduced motion */
	@keyframes avatar-wobble {
		0% {
			rotate: 0deg;
			scale: 1;
		}
		25% {
			rotate: -5deg;
			scale: 1.08 0.94;
		}
		50% {
			rotate: 4deg;
			scale: 0.96 1.05;
		}
		75% {
			rotate: -2deg;
		}
		100% {
			rotate: 0deg;
			scale: 1;
		}
	}

	.avatar-wobble {
		animation: avatar-wobble 420ms var(--ease-spring);
	}

	.lock-note {
		animation: lock-note 2800ms ease-out forwards;
	}

	@keyframes lock-note {
		0% {
			opacity: 0;
			transform: translateY(-0.2rem);
		}
		10% {
			opacity: 1;
			transform: translateY(0);
		}
		85% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.avatar-wobble,
		.lock-note {
			animation: none;
		}
	}
</style>

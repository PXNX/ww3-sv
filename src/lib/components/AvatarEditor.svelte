<!--
	The agent editor: the agent big on the left (it wobbles on every change), a tab per part and
	the choices for that part. Shape choices are drawn as small agents wearing that option, so the
	editor needs no word for "mohawk" in six languages; colours are plain swatches. Every tap saves.
-->
<script lang="ts">
	import { LOOK_PARTS, withPart, type LookPart } from '#lib/game/avatar/look.js';
	import { avatar } from '#lib/game/avatar/store.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import Avatar from './Avatar.svelte';
	import IconDices from '~icons/lucide/dices';
	import IconRotateCcw from '~icons/lucide/rotate-ccw';

	interface Props {
		/** Bigger preview for the profile page */
		large?: boolean;
	}

	let { large = false }: Props = $props();

	const avatarState = avatar();

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

	let part = $state<LookPart>('hair');
	/** Bumped on every change to replay the wobble */
	let wobble = $state(0);

	const options = $derived(LOOK_PARTS[part] as readonly string[]);
	const isColor = $derived(COLOR_PARTS.includes(part));

	function changed(sound: 'pop' | 'sparkle' | 'ui-tap' = 'pop') {
		wobble += 1;
		soundManager().play(sound);
	}

	function pick(value: string) {
		if (avatarState.look[part] === value) return;
		avatarState.set(part, value);
		changed();
	}

	function surprise() {
		avatarState.randomize();
		changed('sparkle');
	}

	function reset() {
		avatarState.reset();
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
			class="grid gap-2 {isColor
				? 'grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))]'
				: 'grid-cols-[repeat(auto-fill,minmax(4rem,1fr))]'}"
			role="radiogroup"
			aria-label={PART_LABELS[part]()}
		>
			{#each options as value, index (value)}
				{@const selected = avatarState.look[part] === value}
				{@const name = m.avatar_option({
					part: PART_LABELS[part](),
					number: index + 1,
					total: options.length
				})}
				{#if isColor}
					<button
						type="button"
						role="radio"
						aria-checked={selected}
						aria-label={name}
						title={name}
						class="aspect-square rounded-full border-3 border-ink transition-transform hover:-rotate-6 active:scale-90 {selected
							? 'scale-110 shadow-[2px_2px_0_var(--color-ink)] outline-3 outline-offset-2 outline-tie-red'
							: ''}"
						style:background={value}
						onclick={() => pick(value)}
					></button>
				{:else}
					<button
						type="button"
						role="radio"
						aria-checked={selected}
						aria-label={name}
						title={name}
						class="flex items-center justify-center overflow-hidden rounded-[10px_5px_9px_6px] border-2 border-ink p-0.5 transition-transform hover:-rotate-3 active:scale-90 {selected
							? 'bg-explosion-yellow shadow-[2px_2px_0_var(--color-ink)]'
							: 'bg-paper'}"
						onclick={() => pick(value)}
					>
						<Avatar look={withPart(avatarState.look, part, value)} size={56} />
					</button>
				{/if}
			{/each}
		</div>
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

	@media (prefers-reduced-motion: reduce) {
		.avatar-wobble {
			animation: none;
		}
	}
</style>

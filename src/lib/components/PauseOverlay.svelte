<!--
	Pause card shared by every mode. Place it inside the playfield wrapper (a `relative` element):
	it covers that wrapper with a dimmed layer and shows "Paused" with a Resume button, which gets
	focus so keyboard players can resume with Enter. Modes render it while paused, for example
	`{#if game.paused}<PauseOverlay onResume={() => game.resume()} />{/if}`, and can add their own
	buttons (restart, back to levels) through the children snippet.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import IconPlay from '~icons/lucide/play';

	let {
		onResume,
		title,
		hint,
		resumeLabel,
		children
	}: {
		onResume: () => void;
		/** Defaults to "Paused" */
		title?: string;
		/** Short line under the title; defaults to a generic hint, pass '' to hide it */
		hint?: string;
		/** Defaults to "Resume" */
		resumeLabel?: string;
		/** Extra buttons or controls shown under the Resume button */
		children?: Snippet;
	} = $props();

	let resumeButton: HTMLButtonElement | undefined = $state();

	$effect(() => resumeButton?.focus());

	const shownHint = $derived(hint ?? m.game_paused_hint());
</script>

<div
	class="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-ink/40 p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="pause-overlay-title"
>
	<div
		class="sticker pop-in flex max-w-xs flex-col items-center gap-3 p-5 text-center"
		style:--tilt="-1.5deg"
	>
		<h2 id="pause-overlay-title" dir="auto" class="font-display text-3xl font-bold">
			{title ?? m.game_paused()}
		</h2>
		{#if shownHint}
			<p dir="auto" class="text-sm leading-snug">{shownHint}</p>
		{/if}
		<button
			bind:this={resumeButton}
			type="button"
			class="btn-chunky min-w-44 bg-explosion-yellow text-lg"
			onclick={onResume}
		>
			<IconPlay class="size-5" aria-hidden="true" />
			{resumeLabel ?? m.game_resume()}
		</button>
		{@render children?.()}
	</div>
</div>

<!--
	A "how to play" screen shown over a game. It opens itself when `open` is true (a mode passes
	true on the first visit and again when the player taps its help button), traps focus like any
	modal dialog, and closes with its button or Escape.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';

	let {
		open,
		title,
		closeLabel,
		onclose,
		children
	}: {
		open: boolean;
		title: string;
		closeLabel: string;
		onclose: () => void;
		/** The steps, usually a list of short paragraphs */
		children: Snippet;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="tutorial-title"
	{onclose}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 shadow-(--shadow-hard)"
		style:--tilt="1deg"
	>
		<h2 id="tutorial-title" class="text-3xl font-bold">{title}</h2>

		<div class="flex flex-col gap-3 leading-snug">{@render children()}</div>

		<div class="flex justify-end">
			<button
				type="button"
				class="btn-chunky bg-explosion-yellow text-lg"
				onclick={() => {
					soundManager().play('ui-tap');
					dialog?.close();
				}}
			>
				{closeLabel}
			</button>
		</div>
	</div>
</dialog>

<!--
	Bottom sheet that nudges the player to reload when a new version has been deployed. An installed
	app can stay open (or be resumed) for days and would otherwise keep showing the old game list.
	SvelteKit flags a new deployment when the app regains focus and on a poll interval (see
	vite.config.ts). Shown only on the start screen, because reloading mid-game would lose the run.

	A native modal `<dialog>` like the result sheet: it lands in the top layer, so no ancestor
	transform or stacking context can trap it, and it brings its own focus handling and backdrop.
-->
<script lang="ts">
	import { updated } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import IconRefresh from '~icons/lucide/refresh-cw';
	import IconX from '~icons/lucide/x';

	let dismissed = $state(false);
	const open = $derived(Boolean(updated.current) && !dismissed);

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
	aria-labelledby="update-hint-title"
	oncancel={(event) => {
		// Escape dismisses the nudge instead of leaving the dialog to close behind the app's back
		event.preventDefault();
		dismissed = true;
	}}
	onclose={() => (dismissed = true)}
>
	<div
		class="modal-box relative border-3 border-ink bg-mustard px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center shadow-(--shadow-hard) sm:pb-5"
	>
		<p id="update-hint-title" class="px-8 text-lg leading-snug font-bold">
			{m.update_app_hint()}
		</p>

		<button
			type="button"
			class="btn-chunky mt-3 flex w-full items-center justify-center gap-2 py-2 text-base"
			onclick={() => location.reload()}
		>
			<IconRefresh class="size-5" aria-hidden="true" />
			{m.update_app_button()}
		</button>

		<button
			type="button"
			class="btn-chunky absolute top-2 right-2 flex size-9 items-center justify-center rounded-full p-0"
			aria-label={m.update_app_dismiss()}
			onclick={() => (dismissed = true)}
		>
			<IconX class="size-4" aria-hidden="true" />
		</button>
	</div>

	<!-- Tapping the dimmed page dismisses it; the backdrop swallows stray taps as well -->
	<form method="dialog" class="modal-backdrop">
		<button aria-label={m.update_app_dismiss()}>{m.update_app_dismiss()}</button>
	</form>
</dialog>

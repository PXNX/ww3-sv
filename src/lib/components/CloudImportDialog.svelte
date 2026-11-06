<!--
	Asks before a browser's progress, carried over with a transfer link, replaces what this Telegram
	account has. Shown once at launch; either answer closes it.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { cloudSave } from '#lib/stores/cloudSave.svelte.js';
	import IconCloudUpload from '~icons/lucide/cloud-upload';

	const cloud = cloudSave();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		const open = cloud.pendingImport !== null;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="cloud-import-title"
	onclose={() => cloud.declineImport()}
>
	<div
		class="sticker modal-box flex flex-col gap-4 rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 shadow-(--shadow-hard)"
		style:--tilt="-0.8deg"
	>
		<h2 id="cloud-import-title" class="flex items-center gap-2 text-2xl font-bold">
			<IconCloudUpload class="size-7 shrink-0" aria-hidden="true" />
			{m.cloud_import_title()}
		</h2>
		<p class="leading-snug">{m.cloud_import_body()}</p>
		<div class="flex flex-wrap justify-end gap-2">
			<button type="button" class="btn-chunky" onclick={() => cloud.declineImport()}>
				{m.cloud_import_keep()}
			</button>
			<button
				type="button"
				class="btn-chunky bg-explosion-yellow"
				onclick={() => void cloud.acceptImport()}
			>
				{m.cloud_import_take()}
			</button>
		</div>
	</div>
</dialog>

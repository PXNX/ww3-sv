<!--
	A small dismissible nudge to install the app, shown only when the browser actually offers to
	(Chromium-based browsers fire `beforeinstallprompt`; Safari and Firefox never do, so the hint
	stays hidden there rather than showing a prompt that would do nothing).
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { localStore } from '#lib/services/storage.js';
	import IconDownload from '~icons/lucide/download';
	import IconX from '~icons/lucide/x';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
	}

	const DISMISSED_KEY = 'install-hint-dismissed';

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let dismissed = $state(localStore().read(DISMISSED_KEY, false));

	$effect(() => {
		function onBeforeInstallPrompt(event: Event) {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
		}
		function onInstalled() {
			deferredPrompt = null;
		}
		window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});

	async function install() {
		const prompt = deferredPrompt;
		if (!prompt) return;
		deferredPrompt = null;
		await prompt.prompt();
	}

	function dismiss() {
		dismissed = true;
		localStore().write(DISMISSED_KEY, true);
	}
</script>

{#if deferredPrompt && !dismissed}
	<div
		class="sticky z-50 mb-4 inline-block w-full rounded-[14px_8px_12px_9px] border-3 border-ink bg-mustard px-3 py-2 text-sm font-semibold shadow-[4px_4px_0_var(--color-ink)]"
		style:--tilt="-1deg"
	>
		<p class="font-semibold">{m.install_app_hint()}</p>
		<div class="flex shrink-0 items-center gap-2">
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={install}>
				<IconDownload class="size-4" aria-hidden="true" />
				{m.install_app_button()}
			</button>
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm"
				aria-label={m.install_app_dismiss()}
				onclick={dismiss}
			>
				<IconX class="size-4" aria-hidden="true" />
			</button>
		</div>
	</div>
{/if}

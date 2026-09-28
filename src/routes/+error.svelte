<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '$lib/config';
	import { m } from '$lib/paraglide/messages';
	import ErrorScene from '$lib/components/scenery/ErrorScene.svelte';
	import IconHome from '~icons/lucide/house';
	import IconRotate from '~icons/lucide/rotate-ccw';

	const lost = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{m.error_status({ status: page.status })} · {APP_NAME}</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-5 px-4 py-8">
	<div class="sticker w-full overflow-hidden p-0" style:--tilt="-1.5deg">
		<ErrorScene kind={lost ? 'lost' : 'broken'} />
	</div>

	<div class="flex flex-col items-center gap-2 text-center">
		<span
			class="pop-in rotate-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-banner-slate px-3 pt-1 font-display text-lg font-bold text-paper shadow-[3px_3px_0_var(--color-ink)]"
		>
			{m.error_status({ status: page.status })}
		</span>
		<h1 class="text-4xl font-bold">{lost ? m.error_lost_title() : m.error_broken_title()}</h1>
		<p class="text-lg">{lost ? m.error_lost_body() : m.error_broken_body()}</p>
	</div>

	<div class="flex flex-wrap justify-center gap-3">
		<a href={resolve('/')} class="btn-chunky bg-flag-blue text-lg">
			<IconHome class="size-5" aria-hidden="true" />
			{m.error_home()}
		</a>
		{#if !lost}
			<button type="button" class="btn-chunky text-lg" onclick={() => location.reload()}>
				<IconRotate class="size-5" aria-hidden="true" />
				{m.error_retry()}
			</button>
		{/if}
	</div>
</main>

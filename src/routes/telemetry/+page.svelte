<!--
	Local-only diagnostics. The event log lives in this browser; the dashboard reads the very same
	service the app writes to, and offers export and delete. Nothing here talks to a server.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { telemetry, type TelemetryEvent } from '#lib/services/telemetry.js';
	import GameShell from '#lib/components/GameShell.svelte';
	import IconClipboard from '~icons/lucide/clipboard-copy';
	import IconEraser from '~icons/lucide/eraser';
	import IconRadar from '~icons/lucide/radar';

	let events = $state<TelemetryEvent[]>([]);
	let counts = $state<{ name: string; count: number }[]>([]);
	let session = $state('');
	let startedAt = $state(0);
	let notice = $state('');

	function refresh() {
		events = telemetry.events();
		counts = telemetry.counts();
		session = telemetry.session();
		const first = events.at(-1);
		startedAt = first?.at ?? Date.now();
	}

	function stamp(at: number) {
		return new Intl.DateTimeFormat(getLocale(), {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(at);
	}

	function propsOf(event: TelemetryEvent) {
		return Object.entries(event.props)
			.map(([key, value]) => `${key}: ${value}`)
			.join(' · ');
	}

	onMount(() => {
		telemetry.track('telemetry_view');
		refresh();
		// A second tab or a game left in the background keeps adding entries; keep the view honest
		const timer = setInterval(refresh, 2000);
		const onFocus = () => refresh();
		window.addEventListener('focus', onFocus);
		return () => {
			clearInterval(timer);
			window.removeEventListener('focus', onFocus);
		};
	});

	async function copy() {
		telemetry.track('telemetry_export');
		refresh();
		try {
			await navigator.clipboard.writeText(telemetry.exportJson());
			notice = m.telemetry_copied();
		} catch {
			notice = m.telemetry_copy_failed();
		}
	}

	function clear() {
		if (!window.confirm(m.telemetry_clear_confirm())) return;
		telemetry.track('telemetry_clear');
		telemetry.clear();
		refresh();
	}
</script>

<GameShell title={m.telemetry_title()}>
	<div class="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-x-hidden pb-6">
		<section class="sticker bg-paper p-4" style:--tilt="-0.4deg">
			<div class="flex items-start gap-3">
				<span class="rounded-xl border-3 border-ink bg-flag-blue/25 p-2">
					<IconRadar class="size-7" aria-hidden="true" />
				</span>
				<div class="min-w-0">
					<h2 class="text-2xl leading-tight font-bold">{m.telemetry_title()}</h2>
					<p class="text-sm leading-snug opacity-80">{m.telemetry_subtitle()}</p>
				</div>
			</div>
			<dl class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
				<div class="rounded-lg border-2 border-ink bg-sand/60 p-2">
					<dt class="text-xs font-bold uppercase opacity-70">{m.telemetry_events()}</dt>
					<dd class="font-display text-2xl leading-none font-bold tabular-nums">{events.length}</dd>
				</div>
				<div class="rounded-lg border-2 border-ink bg-sand/60 p-2">
					<dt class="text-xs font-bold uppercase opacity-70">{m.telemetry_session()}</dt>
					<dd class="truncate font-mono text-xs leading-6" title={session}>{session}</dd>
				</div>
				<p class="col-span-2 rounded-lg border-2 border-ink bg-sand/60 p-2 text-xs font-bold sm:col-span-1">
					{m.telemetry_since({ time: stamp(startedAt) })}
				</p>
			</dl>
			<p class="mt-3 text-xs leading-snug opacity-60">{m.telemetry_note()}</p>
		</section>

		{#if counts.length > 0}
			<section class="flex flex-col gap-2" aria-label={m.telemetry_summary()}>
				<h3 class="font-display text-xl font-bold">{m.telemetry_summary()}</h3>
				<div class="flex flex-wrap gap-2">
					{#each counts as { name, count } (name)}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-explosion-yellow/30 px-2.5 py-1 text-sm font-bold"
						>
							<code class="font-mono text-xs">{name}</code>
							<span
								class="rounded-full border-2 border-ink bg-mustard px-1.5 text-xs tabular-nums"
								>{count}</span
							>
						</span>
					{/each}
				</div>
			</section>
		{/if}

		<section class="flex flex-col gap-2">
			<h3 class="font-display text-xl font-bold">{m.telemetry_recent()}</h3>
			{#if events.length === 0}
				<p class="rounded-xl border-3 border-dashed border-ink/40 bg-paper/60 p-6 text-center text-sm">
					{m.telemetry_empty()}
				</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each events as event (event.id)}
						<li
							class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border-2 border-ink bg-paper px-3 py-2 text-sm"
						>
							<span class="font-mono text-xs opacity-60 tabular-nums">{stamp(event.at)}</span>
							<code class="font-mono text-sm font-bold">{event.name}</code>
							{#if propsOf(event)}
								<span class="min-w-0 break-all font-mono text-xs opacity-75">{propsOf(event)}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<div class="flex flex-wrap items-center gap-2">
			<button type="button" class="btn-chunky bg-flag-blue px-3 py-2 text-sm" onclick={copy}>
				<IconClipboard class="size-4" aria-hidden="true" />
				{m.telemetry_export()}
			</button>
			<button type="button" class="btn-chunky bg-tie-red px-3 py-2 text-sm" onclick={clear}>
				<IconEraser class="size-4" aria-hidden="true" />
				{m.telemetry_clear()}
			</button>
			{#if notice}
				<span class="text-sm font-bold" role="status">{notice}</span>
			{/if}
		</div>
	</div>
</GameShell>

<!--
	Statistics for the game's admins: players, Stars, revivals and group games from the bot, and the
	house adverts from litfass. Counts only; the bot refuses the call for everyone else.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { call } from '#lib/services/telegram.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import GameShell from '#lib/components/GameShell.svelte';

	type Events = { view: number; click: number; reward: number };
	type Day = Events & { day: string };
	type AdStats = {
		totals: Record<'7' | '30', Events>;
		days: Day[];
		ads: (Events & { id: string; title: string | null; live?: boolean })[];
		placements?: (Events & { id: number; name: string; kind: string; blocked: boolean })[];
	};
	type Report = {
		ww3: {
			totals: Record<string, number>;
			signups: Record<string, number>;
			group_games: { game: string; chats: number; players: number }[];
			gifts: { code: string; redeemed: number; revives: number }[];
		};
		ads: { placement: AdStats | null; network: AdStats | null };
		generated_at: number;
	};

	const account = telegram();
	let report = $state<Report | null>(null);
	let failed = $state(false);

	const number = (value: number) => new Intl.NumberFormat(getLocale()).format(value);
	const rate = (e: Events) => (e.view ? `${((e.click / e.view) * 100).toFixed(1)}%` : '–');

	/** The last 30 UTC days, oldest first, so missing days show as empty bars */
	function lastDays(count = 30): string[] {
		const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
		return Array.from({ length: count }, (_, i) =>
			new Date(today - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10)
		);
	}

	const signupDays = $derived(
		report ? lastDays().map((day) => ({ day, value: report!.ww3.signups[day] ?? 0 })) : []
	);
	const adDays = $derived(
		(report?.ads.network ?? report?.ads.placement)?.days.map((d) => ({ day: d.day, value: d.view })) ?? []
	);

	async function load() {
		failed = false;
		try {
			report = await call<Report>('admin_stats');
		} catch {
			failed = true;
		}
	}

	onMount(async () => {
		await account.start();
		if (account.admin) await load();
	});

	const tiles = $derived(
		report
			? [
					[m.admin_accounts(), report.ww3.totals.accounts, m.admin_new({ week: number(report.ww3.totals.accounts_7d), month: number(report.ww3.totals.accounts_30d) })],
					[m.admin_pro(), report.ww3.totals.pro, null],
					[m.admin_stars(), report.ww3.totals.stars, m.admin_last_30({ value: number(report.ww3.totals.stars_30d) })],
					[m.admin_purchases(), report.ww3.totals.purchases, null],
					[m.admin_revives_spent(), report.ww3.totals.revives_spent_30d, m.admin_last_7({ value: number(report.ww3.totals.revives_spent_7d) })],
					[m.admin_referrals(), report.ww3.totals.referrals, m.admin_last_30({ value: number(report.ww3.totals.referrals_30d) })],
					[m.admin_streaks(), report.ww3.totals.active_streaks, null],
					[m.admin_group_players(), report.ww3.totals.group_players_7d, m.admin_group_chats({ chats: number(report.ww3.totals.group_chats_7d), total: number(report.ww3.totals.group_chats) })]
				] as [string, number, string | null][]
			: []
	);
</script>

{#snippet bars(label: string, days: { day: string; value: number }[])}
	{@const top = Math.max(1, ...days.map((d) => d.value))}
	<figure class="flex flex-col gap-1">
		<figcaption class="text-xs font-bold uppercase opacity-70">{label}</figcaption>
		<div class="flex h-28 items-end gap-0.5 border-b-2 border-ink/40" role="img" aria-label={label}>
			{#each days as d (d.day)}
				<div class="group relative flex h-full flex-1 items-end" title={`${d.day}: ${number(d.value)}`}>
					<div
						class="w-full rounded-t-[4px] bg-flag-blue group-hover:bg-ink"
						style:height={`${(d.value / top) * 100}%`}
						style:min-height={d.value ? '2px' : '0'}
					></div>
				</div>
			{/each}
		</div>
		<div class="flex justify-between text-[10px] tabular-nums opacity-60">
			<span>{days[0]?.day.slice(5)}</span><span>{m.admin_peak({ value: number(top) })}</span><span>{days.at(-1)?.day.slice(5)}</span>
		</div>
	</figure>
{/snippet}

{#snippet adTable(stats: AdStats, network: boolean)}
	<div class="grid grid-cols-2 gap-2 text-sm">
		{#each ['7', '30'] as const as span (span)}
			<div class="rounded-lg border-2 border-ink bg-sand/60 p-2">
				<div class="text-xs font-bold uppercase opacity-70">{span === '7' ? m.admin_days_7() : m.admin_days_30()}</div>
				<div class="font-display text-xl font-bold tabular-nums">{number(stats.totals[span].view)} 👁</div>
				<div class="text-xs tabular-nums">{number(stats.totals[span].click)} 👆 ({rate(stats.totals[span])}) · {number(stats.totals[span].reward)} 🎁</div>
			</div>
		{/each}
	</div>
	<div class="overflow-x-auto">
		<table class="w-full text-sm tabular-nums">
			<thead class="text-xs uppercase opacity-70">
				<tr><th class="text-start">{m.admin_advert()}</th><th class="text-end">👁</th><th class="text-end">👆</th><th class="text-end">🎁</th></tr>
			</thead>
			<tbody>
				{#each stats.ads as ad (ad.id)}
					<tr class="border-t border-ink/20">
						<td class="max-w-48 truncate py-1">{ad.live === false ? '⏸ ' : ''}{ad.title ?? `#${ad.id}`}</td>
						<td class="text-end">{number(ad.view)}</td><td class="text-end">{number(ad.click)}</td><td class="text-end">{number(ad.reward)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if network && stats.placements}
		<div class="overflow-x-auto">
			<table class="w-full text-sm tabular-nums">
				<thead class="text-xs uppercase opacity-70">
					<tr><th class="text-start">{m.admin_placement()}</th><th class="text-end">👁</th><th class="text-end">👆</th><th class="text-end">🎁</th></tr>
				</thead>
				<tbody>
					{#each stats.placements as p (p.id)}
						<tr class="border-t border-ink/20">
							<td class="max-w-48 truncate py-1">{p.blocked ? '⛔ ' : ''}{p.name} <span class="opacity-60">({p.kind})</span></td>
							<td class="text-end">{number(p.view)}</td><td class="text-end">{number(p.click)}</td><td class="text-end">{number(p.reward)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/snippet}

<GameShell title={m.admin_title()}>
	<div class="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-x-hidden pb-6">
		{#if account.status === 'verified' && !account.admin}
			<p class="sticker bg-paper p-4">{m.admin_forbidden()}</p>
		{:else if failed}
			<p class="sticker bg-paper p-4">
				{m.admin_failed()}
				<button type="button" class="btn-chunky ms-2 bg-flag-blue px-3 py-1 text-sm" onclick={load}>{m.admin_retry()}</button>
			</p>
		{:else if !report}
			<p class="sticker bg-paper p-4" role="status">{m.admin_loading()}</p>
		{:else}
			<section class="sticker flex flex-col gap-3 bg-paper p-4" style:--tilt="-0.3deg">
				<h2 class="text-2xl font-bold">World War 3</h2>
				<dl class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each tiles as [label, value, note] (label)}
						<div class="rounded-lg border-2 border-ink bg-sand/60 p-2">
							<dt class="text-xs font-bold uppercase opacity-70">{label}</dt>
							<dd class="font-display text-2xl leading-none font-bold tabular-nums">{number(value)}</dd>
							{#if note}<dd class="mt-1 text-xs opacity-70">{note}</dd>{/if}
						</div>
					{/each}
				</dl>
				{@render bars(m.admin_signups_chart(), signupDays)}
				{#if report.ww3.group_games.length}
					<table class="w-full text-sm tabular-nums">
						<thead class="text-xs uppercase opacity-70">
							<tr><th class="text-start">{m.admin_group_game()}</th><th class="text-end">{m.admin_chats()}</th><th class="text-end">{m.admin_players()}</th></tr>
						</thead>
						<tbody>
							{#each report.ww3.group_games as g (g.game)}
								<tr class="border-t border-ink/20"><td class="py-1">{g.game}</td><td class="text-end">{number(g.chats)}</td><td class="text-end">{number(g.players)}</td></tr>
							{/each}
						</tbody>
					</table>
				{/if}
				{#if report.ww3.gifts.length}
					<p class="text-sm">
						🎁 {#each report.ww3.gifts as gift, i (gift.code)}{i ? ' · ' : ''}<code>{gift.code}</code>: {m.admin_gift({ redeemed: number(gift.redeemed), revives: number(gift.revives) })}{/each}
					</p>
				{/if}
			</section>

			<section class="sticker flex flex-col gap-3 bg-paper p-4" style:--tilt="0.3deg">
				<h2 class="text-2xl font-bold">litfass</h2>
				{#if report.ads.network}
					{@render bars(m.admin_ad_views_chart(), adDays)}
					<h3 class="font-display text-lg font-bold">{m.admin_network()}</h3>
					{@render adTable(report.ads.network, true)}
				{/if}
				{#if report.ads.placement}
					{#if !report.ads.network}{@render bars(m.admin_ad_views_chart(), adDays)}{/if}
					<h3 class="font-display text-lg font-bold">{m.admin_this_game()}</h3>
					{@render adTable(report.ads.placement, false)}
				{/if}
				{#if !report.ads.network && !report.ads.placement}
					<p class="text-sm opacity-70">{m.admin_ads_unavailable()}</p>
				{/if}
			</section>
			<p class="text-xs opacity-60">
				{m.admin_generated({ time: new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(report.generated_at * 1000) })}
			</p>
		{/if}
	</div>
</GameShell>

<!--
	The career strip on the start screen and the supply depot: rank, level and progress to the next
	level, plus the shared wallets that every game pays into. Reads the reactive career store, so
	every finished run, daily claim or purchase updates it immediately.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { CAREER_MODES } from '#lib/game/career/config.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import { rankLabel } from '#lib/game/career/rankText.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import IconAward from '~icons/lucide/award';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconLayoutGrid from '~icons/lucide/layout-grid';
	import IconNewspaper from '~icons/lucide/newspaper';
	import IconStore from '~icons/lucide/store';

	const state = career();
	const account = telegram();
	// Earned on this device plus bought with Stars, which live on the Telegram account
	const revives = $derived(
		state.profile.revives + (account.status === 'verified' ? account.wallet.revives : 0)
	);

	const info = $derived(state.levelInfo);
	const percent = $derived(
		info.needed > 0 ? Math.min(100, Math.max(0, (info.xpInto / info.needed) * 100)) : 100
	);
	const title = $derived(m.career_title({ rank: rankLabel(state.rank), level: state.level }));
</script>

<section class="sticker flex flex-col gap-3 bg-paper p-4" style:--tilt="0.7deg" aria-label={title}>
	<div class="flex items-start gap-3">
		<span
			class="mt-0.5 flex size-12 shrink-0 -rotate-3 items-center justify-center rounded-[14px_6px_12px_8px] border-3 border-ink bg-explosion-yellow"
			aria-hidden="true"
		>
			<IconAward class="size-7" stroke-width="2.5" />
		</span>
		<div class="min-w-0 flex-1">
			<p class="font-display text-lg leading-tight font-bold">{title}</p>
			<div class="mt-1.5 flex items-center gap-2">
				<div
					class="h-3 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(percent)}
					aria-label={info.needed > 0
						? m.career_xp({ xp: info.xpInto, needed: info.needed })
						: m.career_max()}
				>
					<div class="h-full bg-khaki" style:width="{percent}%"></div>
				</div>
				<span class="shrink-0 text-xs font-bold tabular-nums">
					{#if info.needed > 0}
						{m.career_xp({ xp: info.xpInto, needed: info.needed })}
					{:else}
						{m.career_max()}
					{/if}
				</span>
			</div>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<span
			class="inline-flex items-center gap-1.5 rounded-[10px_5px_9px_6px] border-2 border-ink bg-explosion-yellow px-2 py-0.5 text-sm font-bold"
		>
			<IconNewspaper class="size-4" aria-hidden="true" />
			{m.career_coins({ count: state.profile.coins })}
		</span>
		<span
			class="inline-flex items-center gap-1.5 rounded-[10px_5px_9px_6px] border-2 border-ink bg-sand px-2 py-0.5 text-sm font-bold"
		>
			<IconHeartPulse class="size-4 text-tie-red" aria-hidden="true" />
			{m.career_revives({ count: revives })}
		</span>
		<span
			class="inline-flex items-center gap-1.5 rounded-[10px_5px_9px_6px] border-2 border-ink bg-sand px-2 py-0.5 text-sm font-bold"
		>
			<IconLayoutGrid class="size-4" aria-hidden="true" />
			{m.career_collection({ played: state.played, total: CAREER_MODES.length })}
		</span>
		<a href={resolve('/shop')} class="btn-chunky ms-auto bg-flag-blue px-3 py-1 text-sm">
			<IconStore class="size-4" aria-hidden="true" />
			{m.career_shop()}
		</a>
	</div>
</section>

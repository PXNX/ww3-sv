<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { APP_NAME } from '#lib/config.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import { rankLabel } from '#lib/game/career/rankText.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import type { LeaderId } from '#lib/theme/leaders.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import CameoLineup from '#lib/components/CameoLineup.svelte';
	import ClipPreloadLine from '#lib/components/ClipPreloadLine.svelte';
	import DailyPanel from '#lib/components/DailyPanel.svelte';
	import InstallPwaHint from '#lib/components/InstallPwaHint.svelte';
	import ModeSelect from '#lib/components/ModeSelect.svelte';
	import UpdatePwaHint from '#lib/components/UpdatePwaHint.svelte';
	import IconChevronRight from '~icons/lucide/chevron-right';
	import IconSettings from '~icons/lucide/settings';

	let leader: LeaderId | null = $state(null);

	const careerState = career();
	const account = telegram();

	// The badge under the title: who is playing, how far they got, and the way into the profile
	const playerName = $derived(account.user?.firstName || m.avatar_title());
	const playerRank = $derived(
		m.career_title({ rank: rankLabel(careerState.rank), level: careerState.level })
	);
</script>

<main
	class="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-[calc(1rem+var(--top-inset))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<ClipPreloadLine class="mx-auto w-full max-w-xs" />

	<header class="flex flex-col items-center gap-3 text-center">
		<h1
			class="pop-in inline-block rotate-1 rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 pt-2 pb-1 text-4xl leading-none font-bold text-paper shadow-[4px_4px_0_var(--color-ink)] sm:text-5xl"
		>
			{APP_NAME}
		</h1>

		<!-- Straight under the title: who is playing and how far they got, one tap into the profile -->
		<a
			href={resolve('/profile')}
			class="sticker sticker-interactive flex max-w-full items-center gap-3 bg-paper p-2 ps-2 pe-3"
			style:--tilt="-0.8deg"
		>
			<span
				class="shrink-0 -rotate-3 rounded-[10px_5px_9px_6px] border-3 border-ink bg-flag-blue/25 p-0.5"
			>
				<Avatar size={40} />
			</span>
			<span class="min-w-0 text-start">
				<span class="block max-w-52 truncate font-display text-lg leading-tight font-bold">
					{playerName}
				</span>
				<span class="block max-w-52 truncate text-xs font-semibold opacity-75">
					{playerRank}
				</span>
			</span>
			<IconChevronRight class="size-5 shrink-0 opacity-70 rtl:rotate-180" aria-hidden="true" />
		</a>

		<div class="sticker mt-2 w-full max-w-2xl bg-sand p-0" style:--tilt="-1deg">
			<CameoLineup bind:selected={leader} />
		</div>
	</header>

	<DailyPanel />

	<section class="flex flex-col gap-4" aria-labelledby="choose-mode">
		<h2 id="choose-mode" class="text-2xl font-bold">{m.home_choose_mode()}</h2>
		<ModeSelect bind:leader />
	</section>

	<footer class="flex flex-wrap items-center justify-center gap-3 text-center text-sm">
		<a href={resolve('/shop')} class="btn-chunky rounded-full px-3 py-1 text-sm font-bold"
			>{m.career_shop()}</a
		>

		<a href={resolve('about')} class="btn-chunky rounded-full px-3 py-1 text-sm font-bold"
			>{m.about_link()}</a
		>
		<a
			href={resolve('/settings')}
			class="btn-chunky rounded-full px-3 py-1 text-sm font-bold"
			aria-label={m.settings_title()}
		>
			<IconSettings class="size-4" aria-hidden="true" />
			{m.settings_title()}
		</a>
	</footer>

	<div
		class="relative z-50 mx-auto w-full max-w-5xl px-4 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))]"
	>
		<InstallPwaHint />
		<UpdatePwaHint />
	</div>
</main>

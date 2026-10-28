<!--
	Black Sea Fleet Hunt: ships of the Russian Black Sea Fleet (from Tarantul corvettes to the
	cruiser Moskva) hide on a 10 by 10 grid, horizontally or vertically. The player strikes cells with
	Neptune missiles and sea drones, which are handed out again every local day; the fleet and the
	shots stay in local storage until every ship is sunk, so a hunt can last several days. Once a
	day a button adds two extra Neptune missiles. Every sunk ship earns points by its class.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import FleetHuntGrid from '#lib/components/FleetHuntGrid.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { SHIP_NAMES, WEAPON_NAMES } from '#lib/components/fleethuntText.js';
	import type { Weapon } from '#lib/game/fleethunt/fleet.js';
	import { BONUS_SHOTS, DAILY_AMMO, totalAmmo } from '#lib/game/fleethunt/save.js';
	import { formatCountdown } from '#lib/game/wordle/daily.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { FleetHuntGame } from '#lib/stores/fleethuntGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconRocket from '~icons/lucide/rocket';
	import IconSailboat from '~icons/lucide/sailboat';
	import IconTv from '~icons/lucide/tv';

	const game = new FleetHuntGame();
	const modeName = m.mode_fleethunt_name();
	const NOTICE_MS = 2200;
	const WEAPON_ICONS = { neptune: IconRocket, usv: IconSailboat };
	const WEAPONS: readonly Weapon[] = ['neptune', 'usv'];

	let showTutorial = $state(false);

	onMount(() => {
		showTutorial = firstPlay('fleethunt');
		const timer = setInterval(() => game.tick(), 1000);
		const onVisible = () => {
			if (document.visibilityState === 'visible') game.tick();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	// Notices fade away by themselves
	$effect(() => {
		const notice = game.notice;
		if (!notice) return;
		const timer = setTimeout(() => {
			if (game.notice?.id === notice.id) game.notice = null;
		}, NOTICE_MS);
		return () => clearTimeout(timer);
	});

	const noticeText = $derived.by(() => {
		const notice = game.notice;
		switch (notice?.kind) {
			case 'miss':
				return notice.contacts === null
					? m.fleethunt_notice_miss()
					: m.fleethunt_notice_contacts({ count: notice.contacts });
			case 'hit':
				return m.fleethunt_notice_hit();
			case 'sunk':
				return m.fleethunt_notice_sunk({ ship: SHIP_NAMES[notice.ship]() });
			case 'bonus':
				return m.fleethunt_notice_bonus();
			case 'newDay':
				return m.fleethunt_notice_new_day();
			default:
				return '';
		}
	});

	// TODO: show a rewarded advertisement here and only claim the bonus once it was watched
	function claimBonus() {
		game.claimBonus();
	}
</script>

<GameShell title={modeName} score={game.points}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.fleethunt_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.fleethunt_help_button()}</span>
		</button>
	{/snippet}

	<section class="mx-auto flex w-full flex-col gap-2 pb-2">
		<!-- Sunk fleets and the strikes left for today, above the water they apply to -->
		<div
			class="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 font-display text-sm font-bold shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p dir="auto" class="tabular-nums">{m.fleethunt_hud_fleets({ count: game.fleetsSunk })}</p>
			<p dir="auto" class="tabular-nums">
				{m.fleethunt_hud_strikes({ count: totalAmmo(game.ammo) })}
			</p>
		</div>

		<!-- The board is the game, so it takes the whole width and sits between the status line and
		     the result of the last strike -->
		<div data-playfield dir="ltr" style:touch-action="manipulation">
			<FleetHuntGrid
				ships={game.ships}
				shots={game.shots}
				interactive={game.status === 'playing'}
				onstrike={(cell) => game.fire(cell)}
			/>
		</div>

		<p
			class="min-h-7 text-center font-display text-lg font-bold"
			role="status"
			aria-live="polite"
			dir="auto"
		>
			{#if game.notice}
				{#key game.notice.id}
					<span class="pop-in inline-block rounded-md border-2 border-ink bg-explosion-yellow px-2">
						{noticeText}
					</span>
				{/key}
			{/if}
		</p>

		{#if game.status === 'won'}
			<div
				class="pop-in flex flex-col items-center gap-2 rounded-[14px_8px_16px_10px] border-3 border-ink bg-paper p-3 text-center shadow-[4px_4px_0_var(--color-ink)]"
			>
				<h2 class="text-2xl font-bold">{m.fleethunt_won_title()}</h2>
				<p dir="auto">{m.fleethunt_won_body({ points: game.points })}</p>
				<button
					type="button"
					class="btn-chunky bg-explosion-yellow"
					onclick={() => game.nextFleet()}
				>
					{m.fleethunt_next_fleet()}
				</button>
			</div>
		{:else}
			{#if game.status === 'resupply'}
				<p class="text-center text-sm font-bold" dir="auto">
					{m.fleethunt_resupply()}
					<span class="font-display text-lg tabular-nums" dir="ltr">
						{formatCountdown(game.msLeft)}
					</span>
				</p>
			{/if}

			<!-- The armory under the board, within reach of the thumb that just fired -->
			<div class="grid grid-cols-2 gap-2" role="group" aria-label={m.fleethunt_weapons_label()}>
				{#each WEAPONS as weapon (weapon)}
					{@const Icon = WEAPON_ICONS[weapon]}
					<button
						type="button"
						class="btn-chunky justify-center px-2 py-1.5 text-sm {game.weapon === weapon
							? 'bg-explosion-yellow'
							: 'bg-paper'}"
						aria-pressed={game.weapon === weapon}
						aria-label="{WEAPON_NAMES[weapon]()}, {m.fleethunt_ammo_left({
							count: game.ammo[weapon]
						})}"
						disabled={game.ammo[weapon] === 0}
						onclick={() => game.selectWeapon(weapon)}
					>
						<Icon class="size-4 shrink-0" aria-hidden="true" />
						<span dir="auto" class="truncate">{WEAPON_NAMES[weapon]()}</span>
						<span
							class="min-w-6 shrink-0 rounded-full bg-ink px-1.5 text-center font-display text-paper tabular-nums"
							aria-hidden="true">{game.ammo[weapon]}</span
						>
					</button>
				{/each}
			</div>

			<button
				type="button"
				class="btn-chunky justify-center bg-khaki px-2 py-1 text-sm"
				disabled={game.bonusClaimed}
				onclick={claimBonus}
			>
				<IconTv class="size-4" aria-hidden="true" />
				{game.bonusClaimed
					? m.fleethunt_bonus_claimed()
					: m.fleethunt_bonus_button({ count: BONUS_SHOTS })}
			</button>
		{/if}
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.fleethunt_tutorial_title()}
		closeLabel={m.fleethunt_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.fleethunt_tutorial_goal()}</p>
		<p>{m.fleethunt_tutorial_weapons()}</p>
		<p>{m.fleethunt_tutorial_daily({ neptune: DAILY_AMMO.neptune, usv: DAILY_AMMO.usv })}</p>
		<p>{m.fleethunt_tutorial_bonus({ count: BONUS_SHOTS })}</p>
		<p>{m.fleethunt_tutorial_points()}</p>
	</TutorialModal>
</GameShell>

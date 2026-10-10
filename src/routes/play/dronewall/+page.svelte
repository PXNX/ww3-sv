<script lang="ts">
	import { onMount } from 'svelte';
	import DroneWallCanvas from '#lib/components/DroneWallCanvas.svelte';
	import DroneWallDefense from '#lib/components/DroneWallDefense.svelte';
	import DroneWallMapPicker from '#lib/components/DroneWallMapPicker.svelte';
	import {
		DEFENSE_NAMES,
		DEFENSE_ROLES,
		POWER_NAMES,
		POWER_ROLES,
		WEATHER_EFFECTS,
		WEATHER_NAMES
	} from '#lib/components/droneWallText.js';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import {
		DEFENSE_KINDS,
		POWERS,
		POWER_KINDS,
		STARTING_LIVES,
		type WeatherKind
	} from '#lib/game/dronewall/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { DroneWallGame } from '#lib/stores/dronewallGame.svelte.js';
	import IconFastForward from '~icons/lucide/fast-forward';
	import IconHelp from '~icons/lucide/circle-help';
	import IconLock from '~icons/lucide/lock';
	import IconSun from '~icons/lucide/sun';
	import IconCloudFog from '~icons/lucide/cloud-fog';
	import IconCloudRain from '~icons/lucide/cloud-rain';
	import IconSnowflake from '~icons/lucide/snowflake';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new DroneWallGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_dronewall_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('dronewall');
	});

	const WEATHER_ICONS = {
		clear: IconSun,
		fog: IconCloudFog,
		rain: IconCloudRain,
		snow: IconSnowflake
	} as const;

	/** While building the chip shows the forecast, during the wave the weather that is there */
	const shownWeather = $derived<WeatherKind>(game.phase === 'prep' ? game.forecast : game.weather);
	const WeatherIcon = $derived(WEATHER_ICONS[shownWeather]);

	/** What a power button says to screen readers: locked, recharging or ready */
	function powerStatus(power: (typeof POWER_KINDS)[number]): string {
		if (!game.powerUnlocked[power]) {
			return m.dronewall_power_locked({ rank: POWERS[power].unlockRank });
		}
		return game.powerSeconds[power] > 0
			? m.dronewall_power_cooldown({ seconds: game.powerSeconds[power] })
			: m.dronewall_power_ready();
	}

	const waveStatus = $derived(
		game.phase === 'prep'
			? game.wave === 0
				? m.dronewall_first_wave_in({ seconds: game.prepSeconds })
				: m.dronewall_next_wave_in({ wave: game.wave + 1, seconds: game.prepSeconds })
			: m.dronewall_wave({ wave: game.wave })
	);
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.dronewall_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.dronewall_help_button()}</span>
		</button>
		{#if game.status === 'playing' || game.status === 'paused'}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.togglePause()}>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					{m.game_resume()}
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					{m.game_pause()}
				{/if}
			</button>
		{/if}
	{/snippet}

	<!-- The HUD, the playfield and the build panel share one width, as wide as the height allows -->
	<section
		class="mx-auto flex w-full flex-col items-center gap-2"
		style:max-width="max(17rem, min(100%, calc((100dvh - 16.8rem) * 0.5625)))"
	>
		<div
			class="flex w-full items-center gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<!-- One button, three speeds: x1, x2, x4 -->
			<button
				type="button"
				class="btn-chunky shrink-0 gap-1 px-2 py-0.5 text-base tabular-nums {game.speed > 1
					? 'bg-explosion-yellow'
					: ''}"
				aria-label={m.dronewall_speed_label({ speed: game.speed })}
				onclick={() => game.cycleSpeed()}
			>
				<IconFastForward class="size-4" aria-hidden="true" />
				<span aria-hidden="true">×{game.speed}</span>
			</button>

			<p
				dir="auto"
				class="min-h-8 flex-1 text-center font-display text-sm leading-tight font-bold sm:text-lg"
				aria-live="off"
			>
				{waveStatus}
			</p>

			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
		</div>

		<!-- The weather (the forecast while building) and the powers the elite defenses unlock -->
		<div class="flex w-full items-stretch gap-2">
			<p
				class="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper px-2 py-0.5 shadow-[2px_2px_0_var(--color-ink)]"
				aria-label={m.dronewall_weather_now({
					weather: WEATHER_NAMES[game.weather](),
					effect: WEATHER_EFFECTS[game.weather]()
				})}
			>
				<WeatherIcon class="size-5 shrink-0" aria-hidden="true" />
				<span class="min-w-0 leading-tight">
					<span class="block truncate font-display text-sm font-bold">
						{game.phase === 'prep' && game.wave > 0
							? m.dronewall_weather_next({ weather: WEATHER_NAMES[shownWeather]() })
							: WEATHER_NAMES[shownWeather]()}
					</span>
					<span dir="auto" class="block truncate text-[0.65rem]">
						{WEATHER_EFFECTS[shownWeather]()}
					</span>
				</span>
			</p>

			<ul class="flex shrink-0 gap-1.5" aria-label={m.dronewall_powers_label()}>
				{#each POWER_KINDS as power (power)}
					{@const unlocked = game.powerUnlocked[power]}
					{@const seconds = game.powerSeconds[power]}
					{@const ready = unlocked && seconds === 0}
					<li class="contents">
						<button
							type="button"
							class="btn-chunky min-w-[3.6rem] flex-col gap-0 px-1.5 py-0.5 text-xs leading-tight {game.armed ===
							power
								? 'bg-tie-red'
								: ready && game.helmets >= POWERS[power].cost
									? 'bg-explosion-yellow'
									: 'bg-sand opacity-80'}"
							aria-pressed={game.armed === power}
							aria-disabled={!ready}
							title={unlocked ? POWER_ROLES[power]() : powerStatus(power)}
							aria-label={m.dronewall_power_button({
								power: POWER_NAMES[power](),
								cost: POWERS[power].cost,
								status: powerStatus(power)
							})}
							disabled={game.status !== 'playing'}
							onclick={() => game.arm(power)}
						>
							<DroneWallDefense kind={power} class="size-6" />
							<span class="flex items-center gap-0.5 font-bold tabular-nums" aria-hidden="true">
								{#if !unlocked}
									<IconLock class="size-3" />
								{:else if seconds > 0}
									{m.dronewall_power_cooldown({ seconds })}
								{:else}
									<DroneWallDefense kind="helmet" class="size-3.5" />
									{POWERS[power].cost}
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>

		<DroneWallCanvas {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.dronewall_tutorial_title()}
		closeLabel={m.dronewall_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.dronewall_tutorial_goal()}</p>
		<p>{m.dronewall_tutorial_build()}</p>
		<p>{m.dronewall_tutorial_helmets()}</p>
		<p>{m.dronewall_tutorial_air()}</p>
		<p>{m.dronewall_tutorial_armor()}</p>
		<p>{m.dronewall_tutorial_attackers()}</p>
		<p>{m.dronewall_tutorial_weather()}</p>
		<p>{m.dronewall_tutorial_elite()}</p>
		<p>{m.dronewall_tutorial_powers()}</p>
		<p>{m.dronewall_tutorial_tall()}</p>
		<ul class="flex flex-col gap-2">
			{#each DEFENSE_KINDS as kind (kind)}
				<li class="flex items-center gap-2">
					<DroneWallDefense {kind} class="size-9 shrink-0" />
					<span>
						<strong>{DEFENSE_NAMES[kind]()}</strong>: {DEFENSE_ROLES[kind]()}
					</span>
				</li>
			{/each}
			{#each POWER_KINDS as power (power)}
				<li class="flex items-center gap-2">
					<DroneWallDefense kind={power} class="size-9 shrink-0" />
					<span>
						<strong>{POWER_NAMES[power]()}</strong>: {POWER_ROLES[power]()}
					</span>
				</li>
			{/each}
		</ul>
		<p>{m.dronewall_tutorial_speed()}</p>
		<p class="hidden text-sm sm:block">{m.dronewall_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.dronewall_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dronewall_wave_reached()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.wave}</dd>
			</div>
			{#if game.bestWave}
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.dronewall_best_wave()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.bestWave}</dd>
				</div>
			{/if}
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dronewall_stat_kills()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.kills}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dronewall_stat_helmets()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.collected}</dd>
			</div>
		</dl>
		<DroneWallMapPicker {game} />
	</GameOverModal>
</GameShell>

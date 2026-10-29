<!--
	The settings page: one card with four rows, volume, vibration, theme and language. The mute
	button sits beside the volume slider, so the sound needs one row instead of a section of its own.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { clipPreload } from '#lib/sound/preload.svelte.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import { appearance, THEME_CHOICES, type ThemeChoice } from '#lib/stores/appearance.svelte.js';
	import { haptic } from '#lib/haptic/haptic.svelte.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconMoon from '~icons/lucide/moon';
	import IconSun from '~icons/lucide/sun';
	import IconVolume1 from '~icons/lucide/volume-1';
	import IconVolume2 from '~icons/lucide/volume-2';
	import IconVolumeX from '~icons/lucide/volume-x';
	import LanguageSelect from '#lib/components/LanguageSelect.svelte';

	const look = appearance();
	const sound = soundManager();
	const hapticFeedback = haptic();

	const THEME_LABELS: Record<ThemeChoice, () => string> = {
		light: m.settings_theme_light,
		dark: m.settings_theme_dark
	};

	const THEME_ICONS = {
		light: IconSun,
		dark: IconMoon
	} as const;

	const percent = $derived(sound.muted ? 0 : Math.round(sound.volume * 100));
	const VolumeIcon = $derived(
		sound.muted || sound.volume === 0 ? IconVolumeX : sound.volume < 0.5 ? IconVolume1 : IconVolume2
	);

	function toggleSound() {
		sound.toggleMuted();
		// Unmuting is the first moment prefetching makes sense for someone who started muted
		if (!sound.muted) clipPreload().start();
	}

	function onVolume(event: Event & { currentTarget: HTMLInputElement }) {
		const value = Number(event.currentTarget.value) / 100;
		// Moving the slider is asking for sound, so it also switches a muted game back on
		if (sound.muted && value > 0) toggleSound();
		sound.setVolume(value);
	}

	// Lets go of the slider: a short sound shows how loud it is now
	function onVolumeDone() {
		sound.play('chime');
	}
</script>

<svelte:head>
	<title>{m.settings_title()} | {APP_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-[calc(1rem+var(--top-inset))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center gap-2 pr-(--top-right-inset) pl-(--top-left-inset)">
		<a href={resolve('/')} class="btn-chunky px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.game_back()}
		</a>
	</div>

	<h1
		class="inline-block self-start rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 py-2 text-3xl font-bold text-paper shadow-[4px_4px_0_var(--color-ink)]"
	>
		{m.settings_title()}
	</h1>

	<section class="sticker flex flex-col divide-y-2 divide-ink/15 p-0">
		<!-- Volume: the speaker is the mute button -->
		<div class="flex items-center gap-3 p-4">
			<button
				type="button"
				class="btn-chunky size-11 shrink-0 rounded-full p-0"
				aria-pressed={!sound.muted}
				aria-label={sound.muted ? m.settings_sound_off() : m.settings_sound_on()}
				onclick={toggleSound}
			>
				<VolumeIcon class="size-5" aria-hidden="true" />
			</button>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<div class="flex items-baseline justify-between gap-2">
					<label for="settings-volume" class="font-display text-lg leading-tight font-bold">
						{m.settings_sound()}
					</label>
					<span class="text-sm font-bold tabular-nums" dir="ltr">{percent}%</span>
				</div>
				<input
					id="settings-volume"
					type="range"
					class="range w-full range-sm"
					min="0"
					max="100"
					step="1"
					value={percent}
					oninput={onVolume}
					onchange={onVolumeDone}
					dir="ltr"
				/>
			</div>
		</div>

		<!-- Vibration -->
		<label class="flex cursor-pointer items-center gap-3 p-4">
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="font-display text-lg leading-tight font-bold">{m.settings_haptic()}</span>
				<span class="text-xs leading-snug opacity-70">{m.settings_haptic_hint()}</span>
			</span>
			<input
				type="checkbox"
				class="toggle shrink-0"
				role="switch"
				checked={hapticFeedback.enabled}
				onchange={() => hapticFeedback.toggle()}
			/>
		</label>

		<!-- Theme -->
		<div class="flex flex-wrap items-center justify-between gap-3 p-4">
			<span id="settings-appearance" class="font-display text-lg leading-tight font-bold">
				{m.settings_appearance()}
			</span>
			<div class="flex gap-2" role="group" aria-labelledby="settings-appearance">
				{#each THEME_CHOICES as choice (choice)}
					{@const Icon = THEME_ICONS[choice]}
					<button
						type="button"
						class="btn-chunky px-3 py-1.5 text-sm"
						class:bg-explosion-yellow={look.choice === choice}
						aria-pressed={look.choice === choice}
						onclick={() => look.set(choice)}
					>
						<Icon class="size-4" aria-hidden="true" />
						{THEME_LABELS[choice]()}
					</button>
				{/each}
			</div>
		</div>

		<!-- Language -->
		<div class="relative z-20 flex flex-col gap-2 p-4">
			<span class="font-display text-lg leading-tight font-bold">{m.language_label()}</span>
			<LanguageSelect />
		</div>
	</section>
</main>

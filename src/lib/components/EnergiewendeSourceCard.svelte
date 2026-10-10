<!--
	One power source of Energiewende Panic: name, how much it delivers right now, how much it could
	deliver (weather, outages), its state, and the slider that sets the target. Batteries have a
	slider from charging (left) to discharging (right).
-->
<script lang="ts">
	import { isThermal, SOURCES } from '#lib/game/energiewende/sources.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { SourceView } from '#lib/stores/energiewendeGame.svelte.js';
	import EnergiewendeSourceIcon from './EnergiewendeSourceIcon.svelte';
	import { SOURCE_COLORS, SOURCE_NAMES } from './energiewendeNames.js';

	let {
		view,
		charge,
		disabled = false,
		onchange
	}: {
		view: SourceView;
		/** Battery charge as a share of full, for the batteries only */
		charge: number;
		disabled?: boolean;
		onchange: (value: number) => void;
	} = $props();

	const spec = $derived(SOURCES[view.id]);
	const name = $derived(SOURCE_NAMES[view.id]());
	const isBattery = $derived(view.id === 'batteries');
	const percent = $derived(Math.round(view.target * 100));
	const power = $derived(Math.abs(view.output).toFixed(1));
	const share = $derived(Math.min(1, Math.max(0, Math.abs(view.output) / spec.capacity)));
	const availableShare = $derived(
		isBattery ? 1 : Math.min(1, Math.max(0, view.available / spec.capacity))
	);

	const status = $derived.by(() => {
		if (isBattery) {
			if (view.output > 0.05)
				return m.energiewende_state_discharging({ percent: Math.abs(percent) });
			if (view.output < -0.05) return m.energiewende_state_charging({ percent: Math.abs(percent) });
			return m.energiewende_state_idle();
		}
		if (isThermal(view.id)) {
			if (view.available <= 0) return m.energiewende_state_tripped();
			if (!view.online && view.target > 0) {
				const hours = Math.ceil(view.warmup ?? spec.startupHours);
				return m.energiewende_state_warming({ hours });
			}
			if (!view.online && view.output <= 0) return m.energiewende_state_off();
		}
		return m.energiewende_state_percent({ percent });
	});

	const sliderText = $derived(
		isBattery
			? `${status} (${power} GW)`
			: `${m.energiewende_state_percent({ percent })}, ${m.energiewende_unit_gw({ power })}`
	);
</script>

<div
	class="flex min-w-0 flex-col gap-1 rounded-[10px_6px_12px_7px] border-3 border-ink bg-paper p-1.5 shadow-[2px_2px_0_var(--color-ink)]"
>
	<div class="flex items-center justify-between gap-1">
		<span class="flex min-w-0 items-center gap-1 font-display text-sm leading-none font-bold">
			<span
				class="flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-ink"
				style:background={SOURCE_COLORS[view.id]}
			>
				<EnergiewendeSourceIcon
					id={view.id}
					class="size-4 {view.id === 'coal' || view.id === 'nuclear' ? 'text-paper' : 'text-ink'}"
				/>
			</span>
			<span dir="auto" class="truncate">{name}</span>
		</span>
		<span class="shrink-0 font-display text-xs font-bold tabular-nums">
			{m.energiewende_unit_gw({ power: `${view.output < -0.05 ? '-' : ''}${power}` })}
		</span>
	</div>

	<!-- Delivered power (dark) inside what the source could deliver right now (light) -->
	<div
		class="relative h-2.5 w-full overflow-hidden rounded-full border-2 border-ink bg-sand"
		aria-hidden="true"
	>
		<div class="absolute inset-y-0 left-0 bg-ink/20" style:width="{availableShare * 100}%"></div>
		<div
			class="absolute inset-y-0 left-0"
			style:width="{(isBattery ? charge : share) * 100}%"
			style:background={SOURCE_COLORS[view.id]}
		></div>
	</div>

	<input
		type="range"
		class="range w-full range-xs"
		min={isBattery ? -100 : 0}
		max="100"
		step="5"
		value={percent}
		{disabled}
		aria-label={name}
		aria-valuetext={sliderText}
		oninput={(event) => onchange(event.currentTarget.valueAsNumber / 100)}
	/>

	<p dir="auto" class="truncate text-xs leading-none font-semibold">
		{isBattery
			? `${status} · ${m.energiewende_battery_level({ percent: Math.round(charge * 100) })}`
			: status}
	</p>
</div>

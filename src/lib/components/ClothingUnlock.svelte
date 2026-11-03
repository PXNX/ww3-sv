<script lang="ts">
	export let part: string; // 'hat','shirt','facial','eyes' etc
	export let value: string;
	export let unlocked: boolean = true;
	export let label: string = '';
</script>

<div
	class="relative flex w-32 flex-col items-center gap-2 rounded-2xl border-3 border-ink bg-paper p-4 shadow-[3px_3px_0_var(--color-ink)]"
>
	{#if unlocked}
		<div
			class="bg-chartreuse absolute -top-3 -right-3 rounded-full border-2 border-ink px-2 py-0.5 font-display text-xs font-bold shadow-sm"
		>
			New
		</div>
	{/if}
	<div class="text-4xl leading-none" aria-label={label || part}>
		{#if part === 'hat'}
			🎩
		{:else if part === 'facial'}
			👨‍🦱
		{:else if part === 'shirt'}
			👕
		{:else if part === 'eyes'}
			👓
		{:else}
			👔
		{/if}
	</div>
	<p class="w-full truncate text-center font-display text-xs font-bold">{label || value}</p>
	{#if unlocked}
		<p class="font-display text-[10px] font-bold tracking-wide text-ink/60 uppercase">Unlocked</p>
	{:else}
		<p class="font-display text-[10px] font-bold tracking-wide text-ink/30 uppercase">Locked</p>
	{/if}
</div>

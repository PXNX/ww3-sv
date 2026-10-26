<script lang="ts">
	export let text: string;
	export let delayMs: number = 300;
</script>

<div class="relative inline-block">
	<span class="size-4" aria-label={text} title={text}> ? </span>
	<div
		class="pointer-events-none absolute bottom-full left-1/2 mb-2 min-w-[180px] -translate-x-1/2 rounded-md bg-ink p-2 text-paper opacity-0 shadow-lg transition-opacity duration-200"
	>
		{text}
	</div>
</div>

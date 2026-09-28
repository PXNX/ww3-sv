<!-- Buoy flag used to mark suspected mines: a generic red and white float with a pennant -->
<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 64 64" class={className} aria-hidden="true">
	<g stroke="#111111" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
		<path d="M32 36 V6" fill="none" />
		<path d="M34 7 L54 14 L34 21 Z" fill="#E5484D" />
		<path d="M14 40 H50 L44 58 H20 Z" fill="#FFFFFF" />
		<path d="M17 49 H47" fill="none" />
		<path d="M14 40 H50 L47 49 H17 Z" fill="#E5484D" />
	</g>
</svg>

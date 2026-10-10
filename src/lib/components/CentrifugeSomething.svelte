<!--
	The looming "Something": a big shapeless shadow with two pale eyes that creeps up behind the
	dial. Original cartoon menace, bloodless and silly; it never touches the needle.
-->
<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 200 200" aria-hidden="true" class={className}>
	<path
		d="M10 200 Q4 120 40 80 Q50 30 100 24 Q150 30 160 80 Q196 120 190 200 Z"
		fill="#1a1a24"
		stroke="#111"
		stroke-width="4"
		stroke-linejoin="round"
	/>
	<path
		d="M30 190 Q20 160 14 168 M170 190 Q182 160 188 168"
		fill="none"
		stroke="#1a1a24"
		stroke-width="10"
		stroke-linecap="round"
	/>
	<ellipse cx="72" cy="84" rx="14" ry="19" fill="#f4f1d0" />
	<ellipse cx="128" cy="84" rx="14" ry="19" fill="#f4f1d0" />
	<circle cx="74" cy="90" r="5" fill="#111" />
	<circle cx="126" cy="90" r="5" fill="#111" />
	<path
		d="M78 138 Q100 150 122 138"
		fill="none"
		stroke="#f4f1d0"
		stroke-width="5"
		stroke-linecap="round"
	/>
</svg>

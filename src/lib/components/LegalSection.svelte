<!--
	One heading with its text on a legal page. Keeping the spacing here means the four documents
	stay a flat list of readable blocks instead of repeating the same classes in every section.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		heading: string;
		children: Snippet;
	}

	let { heading, children }: Props = $props();
</script>

<section class="flex flex-col gap-2">
	<h2 class="text-xl font-bold">{heading}</h2>
	{@render children()}
</section>

<!--
	The little play cube: an isometric cube in the game's thick ink outline with a play triangle on
	its shaded face. It marks the button that rolls a random agent look, so the player sees at a
	glance that the tap is about playing rather than editing.
-->
<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	class={className}
	aria-hidden="true"
	stroke-linejoin="round"
	stroke-linecap="round"
>
	<!-- Three flat faces so it reads as a cube from the front -->
	<path
		d="M12 2.4 20.6 6.7 12 11 3.4 6.7Z"
		fill="var(--color-paper, #ffffff)"
		stroke="currentColor"
		stroke-width="1.8"
	/>
	<path
		d="M3.4 6.7 12 11v10.6L3.4 17.3Z"
		fill="var(--color-paper, #ffffff)"
		stroke="currentColor"
		stroke-width="1.8"
	/>
	<path
		d="M20.6 6.7 12 11v10.6l8.6-4.3Z"
		fill="var(--color-sand, #e8e1bc)"
		stroke="currentColor"
		stroke-width="1.8"
	/>
	<!-- The play triangle sits on the shaded right face, skewed with it -->
	<path
		d="M14.8 12.2 19 14.8 14.8 17.2Z"
		fill="currentColor"
		stroke="currentColor"
		stroke-width="1.2"
	/>
</svg>

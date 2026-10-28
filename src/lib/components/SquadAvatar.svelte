<!--
	A friend's or squad mate's round avatar: their Telegram photo, or the first letter of their
	name on a colour of their own; the player's own slot shows their agent. An optional dot in the
	corner says whether they are online.
-->
<script lang="ts">
	import Avatar from './Avatar.svelte';
	import { avatarColor, initialOf } from './squadText';

	let {
		id,
		name,
		photoUrl,
		self = false,
		online,
		size = 40
	}: {
		id: string;
		name: string;
		photoUrl?: string;
		/** The player themself: draws their agent */
		self?: boolean;
		/** Shows the presence dot when set */
		online?: boolean;
		size?: number;
	} = $props();

	let broken = $state(false);
</script>

<span class="relative inline-block shrink-0" style:width="{size}px" style:height="{size}px">
	<span
		class="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-white/80 font-display font-black text-white shadow-[0_2px_0_rgb(0_0_0/0.3)]"
		style:background={self ? '#d9f3ff' : avatarColor(id)}
		style:font-size="{Math.round(size * 0.45)}px"
	>
		{#if self}
			<Avatar size={Math.round(size * 1.05)} class="mt-[18%]" />
		{:else if photoUrl && !broken}
			<img
				src={photoUrl}
				alt=""
				class="size-full object-cover"
				referrerpolicy="no-referrer"
				onerror={() => (broken = true)}
			/>
		{:else}
			<span aria-hidden="true">{initialOf(name)}</span>
		{/if}
	</span>
	{#if online !== undefined}
		<span
			class="absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-[#2a1a52] {online
				? 'bg-[#3ddc84]'
				: 'bg-[#8a86a0]'}"
			aria-hidden="true"
		></span>
	{/if}
</span>

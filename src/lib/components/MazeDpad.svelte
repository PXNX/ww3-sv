<!--
	On-screen direction buttons for touch players who prefer a d-pad to swiping. It is a physical
	cross, so it stays left-to-right in Persian and Arabic like the maze itself.
-->
<script lang="ts">
	import type { Direction } from '#lib/game/maze/maze.js';
	import { m } from '#lib/paraglide/messages.js';
	import IconDown from '~icons/lucide/arrow-down';
	import IconLeft from '~icons/lucide/arrow-left';
	import IconRight from '~icons/lucide/arrow-right';
	import IconUp from '~icons/lucide/arrow-up';

	let { onmove, disabled = false }: { onmove: (direction: Direction) => void; disabled?: boolean } =
		$props();

	const buttons = [
		{ direction: 'up', label: m.maze_move_up, icon: IconUp, place: 'col-start-2 row-start-1' },
		{
			direction: 'left',
			label: m.maze_move_left,
			icon: IconLeft,
			place: 'col-start-1 row-start-2'
		},
		{
			direction: 'right',
			label: m.maze_move_right,
			icon: IconRight,
			place: 'col-start-3 row-start-2'
		},
		{ direction: 'down', label: m.maze_move_down, icon: IconDown, place: 'col-start-2 row-start-3' }
	] as const;
</script>

<div
	data-playfield
	role="group"
	aria-label={m.maze_dpad_label()}
	class="grid touch-none grid-cols-3 grid-rows-3 gap-1"
	style:touch-action="manipulation"
>
	{#each buttons as { direction, label, icon: Icon, place } (direction)}
		<button
			type="button"
			class="btn-chunky size-11 justify-center p-0 sm:size-12 {place}"
			aria-label={label()}
			{disabled}
			onclick={() => onmove(direction)}
		>
			<Icon class="size-5" aria-hidden="true" />
		</button>
	{/each}
</div>

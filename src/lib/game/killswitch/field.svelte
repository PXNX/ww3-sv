<!--
	Starlink Kill Switch playfield: a rocket rises, satellites float overhead, drones drift
	from the right with links to cut. The visual only: the game logic runs in state.ts.
-->
<script lang="ts">
	import type { KillState } from '#lib/game/killswitch/state.js';
	let { game }: { game: KillState } = $props();
</script>

<div class="relative h-full w-full overflow-hidden bg-slate-900 rounded-xl">
	<div class="absolute top-6 left-6 text-2xl font-display font-bold text-paper">★ Starlink Cut</div>
	<div class="absolute bottom-4 left-4 text-sm text-paper/80 font-display">{game.score} pts · {game.time}s</div>
</div>

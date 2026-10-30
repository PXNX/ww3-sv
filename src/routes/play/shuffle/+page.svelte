<!-- Shadow Fleet Shuffle — engaging -->
<script lang="ts">
	export let level = 1;
</script>
<div class="relative h-full bg-gradient-to-b from-slate-800 via-indigo-950 to-slate-950 rounded-xl overflow-hidden p-4">
  <h2 class="font-display text-2xl font-bold text-paper mb-4">Shadow Fleet Shuffle</h2>
  <div class="grid grid-cols-3 gap-3 mb-6">
    {#each [1,2,3] as i}
      <button type="button" onclick={() => alert('Tapped card ' + i)} class="bg-paper/90 text-ink rounded-lg shadow-[3px_3px_0_var(--color-ink)] p-4 h-24 flex items-center justify-center text-xl font-display font-bold hover:scale-105 active:scale-95 transition-transform">{i}</button>
    {/each}
  </div>
  <p class="text-paper/70 text-sm font-display">Track the sanctioned tanker. Tap the card it's hiding behind.</p>
</div>

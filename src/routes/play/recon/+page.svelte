<!-- Recon: satellite / Global Hawk / Reaper footage analysis -->
<script lang="ts">
	export let level = 1;
</script>
<div class="relative h-full bg-gradient-to-b from-ink to-slate-950 rounded-xl overflow-hidden p-5">
  <h2 class="font-display text-2xl font-bold text-paper mb-1">RECON</h2>
  <p class="text-paper/60 text-xs font-display mb-4">Analyze satellite / Global Hawk / Reaper footage — identify targets before detection.</p>

  <div class="flex gap-2 mb-4">
    {#each ['satellite','globalhawk','reaper'] as cam}
      <button type="button" onclick={() => alert('Switching to ' + cam.toUpperCase())} class="bg-paper/10 text-paper text-xs font-display border border-paper/30 rounded px-3 py-2 hover:bg-paper/20 active:scale-95 transition">{cam.toUpperCase()}</button>
    {/each}
  </div>

  <div class="relative h-56 bg-gradient-to-br from-slate-800 via-ink to-slate-900 rounded-lg border-2 border-paper/20 shadow-[inset_0_0_40px_rgba(255,255,255,0.06)] overflow-hidden">
    <!-- Simulated imagery overlay -->
    <div class="absolute top-8 left-8 text-paper/20 text-6xl font-display font-extrabold select-none">IMAGERY</div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full bg-chartreuse/20 border-2 border-chartreuse/60 backdrop-blur-sm flex items-center justify-center">
      <div class="text-chartreuse font-display font-bold text-xl">ANALYZE</div>
    </div>
    <!-- Crosshair markers -->
    {#each [1,2,3] as _, i}
      <button type="button" onclick={() => alert('Target ' + (i + 1) + ' selected')} aria-label="Target {i+1}" class="absolute w-4 h-4 bg-chartreuse rounded-full shadow-[0_0_6px_rgba(201,255,40,0.9)] hover:scale-125 transition-transform" style="left:{30 + i*20}%; top:{20 + i*15}%;"></button>
    {/each}
  </div>

  <div class="flex gap-3 mt-4">
    <div class="flex-1 bg-paper/10 rounded p-2 text-xs text-paper font-display"><span class="text-chartreuse">●</span> Timer 60s</div>
    <div class="flex-1 bg-paper/10 rounded p-2 text-xs text-paper font-display"><span class="text-amber-400">●</span> Danger 0%</div>
    <div class="flex-1 bg-paper/10 rounded p-2 text-xs text-paper font-display"><span class="text-paper">●</span> Targets 0/3</div>
  </div>
</div>

<!-- Recon: satellite / Global Hawk / Reaper / FPV footage analysis -->
<script lang="ts">
	export let level = 1;
</script>
<div class="relative h-full bg-gradient-to-b from-ink to-slate-950 rounded-xl overflow-hidden p-5">
  <h2 class="font-display text-2xl font-bold text-paper mb-1">RECON / FPV</h2>
  <p class="text-paper/60 text-xs font-display mb-4">Analyze satellite / Global Hawk / Reaper / FPV drone footage. Identify targets. Send strikes.</p>

  <div class="flex gap-2 mb-4 flex-wrap">
    {#each ['satellite','globalhawk','reaper','fpv'] as cam}
      <button type="button" onclick={() => alert('Switching to ' + cam.toUpperCase() + ' — ' + (cam === 'fpv' ? 'maximum detail feed' : 'standard feed'))} class="bg-paper/10 text-paper text-xs font-display border border-paper/30 rounded px-3 py-2 hover:bg-paper/20 active:scale-95 transition">{cam.toUpperCase()}</button>
    {/each}
  </div>

  <div class="relative h-56 bg-gradient-to-br from-slate-800 via-ink to-slate-900 rounded-lg border-2 border-paper/20 shadow-[inset_0_0_40px_rgba(255,255,255,0.06)] overflow-hidden">
    <div class="absolute top-8 left-8 text-paper/20 text-6xl font-display font-extrabold select-none">IMAGERY</div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full bg-chartreuse/20 border-2 border-chartreuse/60 backdrop-blur-sm flex items-center justify-center">
      <div class="text-chartreuse font-display font-bold text-xl">FPV</div>
    </div>
    <!-- Crosshair markers -->
    {#each [1,2,3,4] as _, i}
      <button type="button" onclick={() => alert('Target ' + (i + 1) + ' selected in FPV feed — detailed thermal + visual overlay')
        aria-label="Target {i+1}"
        class="absolute w-4 h-4 bg-chartreuse rounded-full shadow-[0_0_8px_rgba(201,255,40,0.9)] hover:scale-125 transition-transform ring-2 ring-paper/20"
        style="left:{25 + i*15}%;top:{15 + i*18}%;">
      </button>
    {/each}
    <!-- Strike markers -->
    {#each [1] as _, i}
      <div class="absolute" style="left:{40 + i*15}%;top:{30 + i*10}%;">
        <div class="w-6 h-6 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse"></div>
        <span class="absolute top-7 left-0 text-amber-400 text-[0.6rem] font-display font-bold whitespace-nowrap">SHELL</span>
      </div>
    {/each}
  </div>

  <div class="flex gap-2 mt-2">
    <button onclick={() => alert('Attack target — direct units to engage. Reduces danger.')" class="flex-1 bg-tie-red text-paper font-display font-bold rounded px-3 py-2 shadow-[2px_2px_0_var(--color-ink)] hover:scale-[1.03] active:scale-[0.97] transition text-xs">ATTACK</button>
    <button onclick={() => alert('Defend — hold position, block advances. Lowers danger fast.')" class="flex-1 bg-chartreuse text-ink font-display font-bold rounded px-3 py-2 shadow-[2px_2px_0_var(--color-ink)] hover:scale-[1.03] active:scale-[0.97] transition text-xs">DEFEND</button>
    <button onclick={() => alert('Destroy tank / facility — heavy strike, removes target.')" class="flex-1 bg-ink text-paper font-display font-bold rounded px-3 py-2 shadow-[2px_2px_0_var(--color-ink)] hover:scale-[1.03] active:scale-[0.97] transition text-xs">DESTROY</button>
  </div>

  <div class="flex gap-3 mt-2">
    <button onclick={() => alert('Drop shell — high-explosive impact on selected coordinates. FPV confirms visual.')} class="flex-1 bg-amber-500 text-ink font-display font-bold rounded px-3 py-2 shadow-[2px_2px_0_var(--color-ink)] hover:scale-[1.03] active:scale-[0.97] transition text-xs">DROP SHELL</button>
    <button onclick={() => alert('Send artillery strike — multiple rounds, wider area. Confirmed via FPV feed with full detail.')} class="flex-1 bg-tie-red text-paper font-display font-bold rounded px-3 py-2 shadow-[2px_2px_0_var(--color-ink)] hover:scale-[1.03] active:scale-[0.97] transition text-xs">ARTILLERY</button>
  </div>

    <!-- Bunkers / buildings with foliage -->
    <div class="absolute" style="left:10%;top:55%;">
      <div class="w-14 h-14 bg-stone-800 rounded-lg border-2 border-stone-600 shadow-lg flex items-center justify-center relative">
        <span class="text-stone-300 text-[0.6rem] font-display font-bold">BUNKER</span>
        <div class="absolute -top-3 -left-3 w-4 h-8 bg-green-900 rounded-sm opacity-60"></div>
        <div class="absolute -top-2 -right-2 w-3 h-6 bg-green-800 rounded-sm opacity-50"></div>
      </div>
      <button onclick={() => alert('Open bunker — reveal hidden target inside.')" class="absolute top-full left-0 mt-1 text-[0.6rem] bg-paper/90 text-ink px-2 py-0.5 rounded shadow border border-ink font-display font-bold whitespace-nowrap">OPEN</button>
    </div>
    <div class="absolute" style="left:65%;top:25%;">
      <div class="w-12 h-10 bg-stone-700 rounded-md border-2 border-stone-500 shadow-lg flex items-center justify-center relative">
        <span class="text-stone-200 text-[0.55rem] font-display font-bold">BLDG</span>
        <div class="absolute -top-2 left-0 w-6 h-5 bg-green-800 rounded-full opacity-40"></div>
      </div>
    </div>
  </div>

  <div class="flex gap-3 mt-3">
    <div class="flex-1 bg-paper/10 rounded p-2 text-xs text-paper font-display"><span class="text-chartreuse">●</span> Timer 60s</div>
    <div class="flex-1 bg-paper/10 rounded p-2 text-xs text-paper font-display"><span class="text-amber-400">●</span> Danger 0%</div>
    <div class="flex-1 bg-paper/10 rounded p-2 text-xs text-paper font-display"><span class="text-paper">●</span> Targets 0/3</div>
  </div>
</div>

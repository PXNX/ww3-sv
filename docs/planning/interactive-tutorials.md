# Interactive tutorials

Every game used to open a wall of `<p>{m.*_tutorial_*()}</p>` paragraphs in `TutorialModal`.
That is being replaced with a **step wizard that spotlights real UI and asks the player to use it**.
One shared engine, one small description file per game.

## The shared engine

- `src/lib/components/InteractiveTutorial.svelte` — dims the page, cuts a spotlight around a real
  control, shows one short tip at a time with a progress bar, Back / Skip / Next, arrow keys and
  Escape. A `tap` step only advances when the player actually clicks the spotlighted control.
- `src/lib/services/tutorial.ts` — exports `firstPlay(mode)` (unchanged) and the `TutorialStep` type:

```ts
type TutorialStep = {
	title: string; // an existing translated <mode>_tutorial_* message
	text: string; // an existing translated <mode>_tutorial_* message
	target?: string; // selector of a REAL control, e.g. '[data-tutorial="start"]'
	action?: 'tap'; // require using that control to advance
};
```

Shared labels (`tutorial_step_counter`, `tutorial_next`, `tutorial_back`, `tutorial_skip`,
`tutorial_tap_target`) already exist in all six locales. Do not add new message keys.

## Converting a game

1. Add `src/routes/play/<mode>/tutorial.ts`, exporting a **function**
   `tutorialSteps(): TutorialStep[]`. Import `m` from `#lib/paraglide/messages.js` and use the
   game's **existing** translated tutorial strings. Split the old wall into **3–6 steps**, each
   with a short title and one short tip. If a paragraph is too long, do not invent new copy — keep
   it as its own step and put the important sentence first. The page passes `steps={tutorialSteps()}`
   (called, not the function itself).
2. Mark real controls with `data-tutorial="<name>"` attributes in the page or its components.
   Prefer these over class or text selectors. Use names like `start`, `board`, `keyboard`,
   `hud-score`, `tab-upgrades`.
3. At least **two steps** per game must have both `target` and `action: 'tap'` so the tutorial is
   genuinely interactive. Only use `target` without `action` when the element is purely something
   to look at. Steps with no target are plain explanation steps with a Next button.
4. In `src/routes/play/<mode>/+page.svelte`: remove the `TutorialModal` import, import
   `InteractiveTutorial` and `tutorialSteps`, and replace the whole `<TutorialModal>` block with:

```svelte
<InteractiveTutorial
	open={showTutorial}
	title={m.<mode>_tutorial_title()}
	steps={tutorialSteps()}
	closeLabel={m.<mode>_tutorial_close()}
	onclose={() => (showTutorial = false)}
/>
```

The spec above is the finished shape. If a game already has a mechanical conversion (a const
array and `steps={tutorialSteps}`), review and improve it: convert the export to a function,
call it in the page, and prefer specific `data-tutorial` controls (start button, tabs, HUD
counters, D-pad) over a generic full-playfield container wherever those controls exist on both
the initial and the playing screen.

Keep the existing `showTutorial` state, `firstPlay('<mode>')` call and help button untouched.
Delete the now-unused `TutorialModal` import. 5. The targets must exist **while the wizard is open**. If the tutorial opens from a level-select
or lobby screen, either point at controls on that screen or leave those steps targetless;
never point at an element that is not in the DOM.

## Rules for parallel work

- Only touch files under your own `src/routes/play/<mode>/` folder. Never edit shared components,
  shared services, `messages/*.json`, other games, docs or config.
- Do not run git commands, commit, push, or run `bun run check` / tests / build. The coordinator
  reviews and validates everything once at the end.
- No new translated strings. Reuse existing `<mode>_tutorial_*` keys only.
- Keep the existing import order and formatting style (tabs).

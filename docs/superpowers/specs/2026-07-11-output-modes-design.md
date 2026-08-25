# Output Modes — Design

**Status:** Approved (brainstorm 2026-07-11, revised: flat = 2-up only; facing-notes graceful degrade). Next: writing-plans.

## Goal

Let the user choose how generated pages are imposed onto physical sheets, instead of always producing a fold-and-staple booklet. Three selectable **output modes**.

## Scope (locked)

- **Output modes** (`opts.outputMode`):
  - `booklet` (default) — current saddle-stitch fold: 2-up spreads, fold-imposed, nest & staple. **Unchanged behavior.**
  - `flatDouble` — double-sided, 2-up, cut-and-stack (no fold).
  - `flatSingle` — single-sided (fronts only, blank backs), 2-up, cut-and-stack.
- Flat modes are **2-up only** (cut-and-stack). No 1-up option (deferred — see follow-ups).
- Default `booklet` → existing users see **no change**.
- Applies to both wall `generate()` and greeter booklets (mode is read in the shared `imposeAndRender`).
- Irrelevant controls are **hidden** per mode: fold line + save paper hidden for flat modes; duplex flip hidden for single-sided.

## Architecture (Approach A)

Branch in `imposeAndRender` on `opts.outputMode`. The **booklet path is left untouched** (existing `savePaper`/`sides` fold loop). Flat modes go through a new renderer fed by a **pure imposition function in `core.js`** (unit-tested, same pattern as `facingAlignInserts`). The single-page **preview** and **book (reading-spread) views are mode-independent**; only the **print view** (`#print-area`) changes.

### Pure imposition logic (core.js, unit-tested)

`flatImposition(n, sides)` → `{ pad, sheets }`, where `n` is the page count (reading order) and `sides` is `'double'|'single'`. Each sheet is `{ front: [leftIdx, rightIdx], back: [leftIdx, rightIdx] }`; an index is a 0-based reading-order page index, or `null` for a blank/pad slot. `pad` is the padded page count. Flat is always 2-up.

Derivations (verified):

- **Double (cut-and-stack):** pad `n` up to a multiple of 4 → `nn`; `S = nn/4`; `half = nn/2`. Sheet `i` (`0..S-1`): `front=[2i, 2i+half]`, `back=[2i+1, 2i+1+half]` (indices ≥ n → null). After printing, one center cut separates the left column (final pages `0..half-1`) from the right column (`half..nn-1`); stack the right pile under the left pile → reading order. Worked check `n=8`: sheets `front=[0,4]/back=[1,5]`, `front=[2,6]/back=[3,7]` → left pile 0,1,2,3; right pile 4,5,6,7 → 0..7. ✓ The formulas are duplex-flip-independent (flip only mirrors the back-side CSS placement so registration lines up).
- **Single (cut-and-stack, blank backs):** pad `n` up to a multiple of 2 → `nn`; `S = nn/2`; `half = nn/2`. Sheet `i`: `front=[i, i+half]`, `back=[null, null]`. Worked check `n=8`: fronts `[0,4],[1,5],[2,6],[3,7]` → left column 0,1,2,3; right column 4,5,6,7 → 0..7. ✓

Indices ≥ `n` (padding) render as blank pages; `null` back slots are blank.

### Renderer (weekly.js)

- `imposeAndRender` computes `mode = opts.outputMode`. If `booklet`, take the **existing** path unchanged. Otherwise, call `flatImposition(pages.length, mode==='flatSingle'?'single':'double')` and render its `sheets` into `#print-area`:
  - Physical sheet is 2 TN pages wide (reuse the current 2-up sheet DOM + crop-mark scaffolding); place `front[0]`/`front[1]` left/right, and for `flatDouble` place `back[...]` on the back side respecting `opts.flip`. For `flatSingle` the back is blank.
  - A center **cut line** replaces the booklet **fold line** for flat modes.
  - `null`/out-of-range indices → a blank page div (reuse the existing pad-page HTML).
- The `#paper-tip` string and the optional **assembly guide page** (`opts.printGuide`) reflect the mode: fold/nest/staple (booklet) vs cut-once/stack (flat).

### Facing notes interaction (graceful degrade)

`alignFacingRuns` (the day-left/notes-right parity pass) runs **only in booklet mode** — guard its call in `imposeAndRender` with `opts.outputMode==='booklet'`. In flat modes the facing/notes pages **still print** (they are real content the user opted into) and appear sequentially after each day/summary/reflection once cut-and-stacked; only the meaningless spread-alignment blank is skipped. (The Daily-section toggle label is booklet-oriented but the notes-page behavior degrades sensibly.)

### UI (weekly.html + applyOptsToUI/readOptsFromUI + a sync function)

- Add an **Output mode** `<select id="opt-outputmode">` (Booklet / Double-sided flat / Single-sided flat) at the top of the print-options section (near crop marks).
- `syncOutputModeUI()` (called on mode change and in `applyOptsToUI`) toggles visibility: hide **fold line** + **save paper** for flat modes; hide **duplex flip** for `flatSingle`.
- Wire the new control through `applyOptsToUI`/`readOptsFromUI` like the other print options.

## Interactions

- **Save paper (N-up booklet):** booklet-only; hidden and ignored for flat modes.
- **Fold line:** booklet-only; hidden for flat. Flat shows a **cut line** instead.
- **Duplex flip (long/short):** applies to `booklet` + `flatDouble`; hidden for `flatSingle` (no backs).
- **Crop marks:** kept for all; the cut guide for flat modes.
- **Cover sheet:** orthogonal; still extracts cover/back-cover regardless of mode.
- **Facing notes:** see the graceful-degrade section above.
- **Greeter:** no greeter UI needed; greeter booklets honor `opts.outputMode` via the shared `imposeAndRender`.

## Testing / verification

- `node --test`: add cases for `flatImposition` covering double + single, the padding boundaries (n not a multiple of 4/2), and the worked `n=8` orderings above. Suite grows from 18.
- Browser (fresh port): for each flat mode, generate and confirm `#print-area` renders the expected sheet count and page placement; **booklet output is unchanged**; the irrelevant toggles hide/show correctly on mode switch; `flatSingle` backs are blank; `paper-tip`/guide text matches the mode; with facing-notes on, flat modes still emit the notes pages but insert no alignment blanks. No console errors.
- Toggle back to `booklet` → output identical to today.

## Out of scope (follow-ups)

- **1-up flat** layout (one TN page per sheet side, collate) — deferred.
- Facing-notes-aware layout in flat modes beyond graceful degrade.
- A "sheet plan" refactor unifying booklet + flat renderers (Approach B) — revisit if more modes appear.

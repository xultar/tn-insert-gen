# Greeter & Booklet Builder — Design (Plan 2)

**Date:** 2026-07-10
**Status:** Approved for planning
**Base:** `tn-weekly-planner/` on `master` (Plan 1 shipped: Future Log, Master Action List, weekly/monthly reflection, time-block day, Pocket/A5 sizes, Minimal B&W default theme)
**Parent spec:** [2026-07-09-tn-bujo-page-maker-design.md](2026-07-09-tn-bujo-page-maker-design.md)

## 1. Summary

Replace the "wall of controls greets you on load" experience with a calm, page-centric **greeter** that lives in the sidebar. You pick a notebook size, a date range, and a page type; a couple of guided options refine it; the preview shows that single page live; and **Add to booklet** collects it into a hand-assembled booklet you can reorder and print. The full existing control wall is one **Show all tools** toggle away.

This is Plan 2 of the parent spec. Plan 3 adds the single/double/booklet output *modes* and imposition refinements.

## 2. Decisions locked in brainstorming

- **Placement (A):** the greeter **swaps into the sidebar** (`#cfg`). It is the default panel; the toggle flips the same panel to the full existing wall. The preview pane is untouched and always visible.
- **Behavior (both):** selecting a page type **renders that single page** in the preview (reusing `renderSinglePage`) **and** offers **Add to booklet** to collect pages.
- **Smart-expand (by range):** each page type produces N pages for the chosen date range (Daily over Jan → 31 pages; Future Log → its 1–4; Master Action List → 1). Adding expands accordingly; the tray shows each entry's page count and a running total.
- **Default theme:** Minimal B&W (already shipped to `master`).

## 3. Non-Goals (YAGNI / deferred to Plan 3)

- Output *modes* (single / double / booklet imposition choices) — Plan 3.
- Removing or rewriting the existing Tools wall — it stays intact behind the toggle, including its current monthly auto-Generate.
- Per-page color/theme overrides — Page Style stays global.
- Drag-drop file-level reordering polish beyond up/down/remove (see §6).

## 4. Architecture

Three new units, layered in front of the untouched engine:

1. **Greeter panel** (`greeter.js` + markup in `weekly.html`, styles in `weekly.css`): the sidebar UI for the size → dates → page type → guided flow, the Add button, the booklet tray, and the tools toggle. Reads/writes the same global `opts` (size, dates, Page Style) so guided choices and wall choices stay one source of truth.
2. **Booklet collection** (state + small API in `greeter.js`): an ordered array of **entries**; each entry is `{ id, type, label, config }` where `config` is a snapshot of the options that page type needs. A pure helper `expandEntry(entry, ctx)` returns the array of page DOM elements that entry produces for the current date range (delegating to the existing `mk*` builders). `bookletPages()` = `entries.flatMap(expandEntry)`.
3. **Collection renderer** (thin, in `weekly.js`): factor the *imposition half* of `generate()` into `imposeAndRender(pageEls)` so both the greeter's **Generate/Print** and the legacy wall Generate feed the same print pipeline (crop marks, fold, duplex, save-paper). Plan 2 uses the existing single-booklet imposition; Plan 3 adds modes.

**State machine:** `greeter` (default) ⇄ `tools` (toggle). Guided sub-state is just which page type is selected. No full-screen layer.

## 5. The flow

```
Sidebar (greeter mode):
  ① Notebook size   → sets opts.tnsize (drives page geometry)
  ② Date range      → start + end (drives smart-expand counts & content)
  ③ Page type       → one of the types in §7
  ④ Guided options  → the minimal per-type set in §7 (writes opts)
  → live single-page preview (renderSinglePage)
  → [+ Add to booklet]  → pushes an entry (snapshot) into the collection
  → Booklet tray (reorder / remove / counts / total)
  → [Generate / Print]  → imposeAndRender(bookletPages())
  [ Show all tools ]     → swap panel to #cfg wall
```

## 6. Booklet tray

- One row per entry: drag-handle (or ▲▼), label (e.g. "Future Log · stacked"), page count, remove (✕).
- Reorder via up/down buttons in Plan 2 (native HTML5 drag-drop is a nice-to-have, not required).
- Header shows total page count.
- Empty state: a hint ("Pick a page and add it").
- The collection is **session state** (kept in `opts`/localStorage via the existing `saveState`/`loadState`) so it survives reload.

## 7. Page types and their guided options (minimal)

Page Style (fill pattern, grid spacing, theme, font, margins) stays **global** and already applies to every page, so guided options cover only what fundamentally changes a page:

| Page type | Builder(s) | Guided options | Pages for range |
|-----------|-----------|----------------|-----------------|
| Future Log | `mkFutureLog` | layout: stacked / column / year | 1–4 (by size + range) |
| Daily | `mkDay` / `mkTimeBlockDay` | layout: standard / time-block | one per day in range |
| Monthly | `mkCalendar` | spread: single / 2-page | 1–2 per month |
| Habit | `mkHabitMap` | — | 1 per month |
| Master Action List | `mkMonthBrainDump` | — | 1 per month |
| Reflection | `mkReflection` / `mkWeekReflection` | scope: monthly / weekly | 1 monthly, or 1 per week |
| Cover | `mkCover` | design + title (existing cover opts) | 1 |
| Plain | fill-pattern page | ruling: dots / square / ruled / hex / blank (sets the global fill pattern) | 1 (or a count) |
| Notes | `mkMonthNotes` | count | N |

"Plain" is the one type whose identity *is* its ruling, so its guided step sets the global fill pattern (§ non-goal: no per-page override).

## 8. Components / boundaries

- `greeter.js` — panel UI + collection state/API (`addEntry`, `removeEntry`, `moveEntry`, `bookletPages`, `expandEntry`). Understandable/testable without engine internals; depends on the `mk*` builders through a small registry mapping `type → {builder, expand, label, guided}`.
- **Page-type registry** (in `greeter.js`): one entry per row of §7 — the single place that knows how a type previews, expands, and labels. Adding a future page type = one registry entry.
- `imposeAndRender(pageEls)` (in `weekly.js`) — extracted from `generate()`; pure-ish: given page elements, run the existing imposition to `#print-area` / `#page-preview` / `#book-view`.
- Existing engine (`mk*`, themes, Page Style, `generate` for the legacy wall) — unchanged behavior.

## 9. Testing

- `expandEntry` returns the right page count per type for representative ranges (Daily ×31, Future Log by size, Master Action List ×1, Reflection weekly = weeks-in-range).
- Collection API: add / remove / move preserve order; total = sum of counts.
- Registry: every page type has builder + expand + label; preview renders each type without error.
- Toggle swaps `#cfg` ↔ greeter without losing `opts`.
- `imposeAndRender` produces the same output for the legacy monthly page set as today (no regression to crop/fold/duplex/save-paper).
- Smart-expand order: tray order == output order.

## 10. Open questions (resolve in planning)

- Exact date-range control UI (two date pickers vs month picker + range) — lean: start month/year + a range length, reusing existing month/year selects.
- Whether the legacy wall "Generate" and the greeter "Generate" should eventually merge (Plan 3) or stay parallel.

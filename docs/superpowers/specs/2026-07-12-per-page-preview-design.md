# Per-Page Preview — Design Spec

**Date:** 2026-07-12
**Component:** `tn-weekly-planner/` (weekly.html + weekly.js)
**Status:** Approved (design), pending implementation plan

## Goal

Give every config section that produces a page a **"Preview this page"** affordance, so the user can audition a single page type in isolation without generating the whole document. Generalizes the one-off Future Log preview button into a uniform, per-page pattern.

## Background

The old standalone **"Future Log (preview)"** button lived in the global Actions column beside the Pages/Book/Print *view-mode* toggles, conflating a *content action* (render just this page) with *view switches* (re-display the same content). It has since been moved into the Future Log section and relabeled "Preview this page" (commit `75fe67d`). This spec extends that idea to all page-producing sections.

The mechanism already exists: `renderSinglePage(pageEls)` (weekly.js) wipes `#page-preview`, appends the given element(s), sets `pg-count`, and switches to the Pages view. `generateFutureLog()` is a thin wrapper around it. This design generalizes that wrapper.

## Key decisions (settled during brainstorming)

1. **Granularity: per-page, not per-section.** Config sections don't map 1:1 to pages — Future Log / Monthly Trackers / Daily each make one page, **Monthly** makes up to six independently-toggleable pages, **Cover & Extras** makes several, and six sections (Month/Year, Holidays, Typography, Page Style, Habits, Notebook & Print) make none. A preview button therefore attaches to each individual page toggle, not to the section.
2. **Preview is independent of the include-toggle.** A page's Preview button renders it whether or not that page is enabled for the real document — you can audition before enabling. This matches Future Log's current behavior. The include-toggle remains the separate "put this in Generate" control.

## Section → page mapping (reference)

| Section | Pages (each gets a preview button) |
|---|---|
| Cover & Extras | cover, back cover, monthly calendar, month notes |
| Monthly | goals, brain-dump, habit map, mood calendar, expenses, reflection |
| Monthly Trackers | trackers |
| Future Log | future log (migrate existing button) |
| Daily | one representative day (section-level button) |
| Month/Year, Holidays, Typography, Page Style, Habits, Notebook & Print | *(none — settings/data only)* |

Thirteen preview affordances total.

## Architecture

### Core mechanism — generic `previewPage(key)` + a registry

A single helper plus a page-key → builder map, both in `weekly.js`:

```js
const PAGE_PREVIEWS = {
  cover:     (y,m,c)=>mkCover(y,m,c),
  backcover: (y,m,c)=>mkBackCover(y,m,c),
  calendar:  (y,m,c)=>mkCalendar(y,m,c),      // returns a spread (array); renderSinglePage handles arrays
  notes:     (y,m,c)=>mkMonthNotes(y,m,c),
  futurelog: (y,m,c)=>mkFutureLog(y,m,c),     // array
  goals:     (y,m,c)=>mkGoalsPage(y,m,c),
  braindump: (y,m,c)=>mkMonthBrainDump(y,m,c),
  habitmap:  (y,m,c)=>mkHabitMap(y,m,c),
  moodcal:   (y,m,c)=>mkMoodCalendar(y,m,c),
  expenses:  (y,m,c)=>mkExpenseTracker(y,m,c),
  reflection:(y,m,c)=>mkReflection(y,m,c),
  trackers:  (y,m,c)=>mkMonthGraphs(y,m,c),
  daily:     (y,m,c)=>{ const d=Math.min(15, daysInMonth(y,m));
                        return opts.dailyLayout==='timeblock' ? mkTimeBlockDay(y,m,d,c) : mkDay(y,m,d,c); },
};

function previewPage(key){
  const build = PAGE_PREVIEWS[key];
  if(!build) return;
  saveState();
  const m = parseInt($('sel-m').value), y = parseInt($('sel-y').value);
  renderSinglePage(build(y, m, getColors()));
}
```

- **Interface:** `previewPage(key)` — `key` is a `PAGE_PREVIEWS` slug. Unknown key → no-op. Saves state, resolves current month/year/colors, renders just that page via the existing `renderSinglePage`.
- **Depends on:** the existing `mk*` page builders, `renderSinglePage`, `saveState`, `getColors`, `daysInMonth`, `opts`, the `#sel-m`/`#sel-y` inputs.
- `generateFutureLog()` is **removed**; the Future Log button calls `previewPage('futurelog')` instead. Behavior is identical (both delegate to `renderSinglePage(mkFutureLog(...))`).

### The buttons — affordance & placement

- **Affordance:** a compact icon button, glyph `▣` (`&#9635;`, matching the current Future Log preview button), `title="Preview this page"`, class `btn btn-s btn-sm` (the existing small dark-button style).
- **Placement:** at the right end of each page toggle's row. For sections whose whole body is one page (Future Log, Daily), the button sits at the bottom of the section body (as Future Log's does today).
- **Migration:** Future Log's current full-width "▣ Preview this page" button is kept but restyled to the same compact icon form for consistency (optional cosmetic — the wiring change to `previewPage('futurelog')` is the substantive part).
- Settings-only sections get no button.

## Edge cases

- **Trackers with no metrics:** `mkMonthGraphs` renders an (empty) trackers page — harmless, no crash; consistent with "preview independent of toggle." (The real-document guard `opts.trackers && graphMetrics.length>0` in `generate()` is unaffected.)
- **Month notes** is driven by a count-select (`opt-notes`), not a boolean; its preview shows a single notes page.
- **Daily** previews one representative day — the 15th, clamped to `daysInMonth(y,m)` — honoring `opts.dailyLayout` (time-block vs standard). Facing-notes pairing (`opts.dailyFacingNotes`) is **not** applied; the preview shows the day page itself.
- **View side effect:** like today, `previewPage` leaves `#page-preview` showing only the previewed page and `pg-count` reflecting it; the user clicks **Generate** to rebuild the full document. This is the pre-existing, accepted behavior of the Future Log preview.

## Testing

The `mk*` builders and `renderSinglePage`/`previewPage` are DOM-coupled glue in `weekly.js`; the project's 24 `node --test` cases cover pure logic in `core.js` only. Verification is therefore **browser-based**, per the established pattern for this file:

- Serve on a fresh `python -m http.server` port (the preview caches JS/CSS aggressively). Screenshots time out on this page — use `javascript_tool` / `read_page`.
- For each of the 13 keys: click its preview button (or call `previewPage(key)`), confirm `#page-preview` shows the expected page (correct `data-lbl` / heading) and `pg-count` is sensible.
- Confirm preview works with the page's include-toggle **off**.
- Confirm the Daily preview honors `opts.dailyLayout` (standard vs time-block).
- `read_console_messages {onlyErrors:true}` → none.
- `node --test` → **24 pass / 0 fail** (no `core.js` change; count unchanged).

## Out of scope / non-goals

- No change to `generate()` output, imposition, or the view-mode buttons.
- No new `core.js` logic or tests.
- No facing-notes / booklet preview (single representative page only).
- No per-section "preview everything in this section" batch button (explicitly rejected in favor of per-page).

## Definition of Done

- Every page-producing toggle (13 total) has a compact `▣` Preview button that renders just that page, independent of its include-toggle, via a shared `previewPage(key)` helper backed by a `PAGE_PREVIEWS` registry.
- `generateFutureLog()` removed; Future Log preview routed through `previewPage('futurelog')` with identical behavior.
- Settings-only sections have no preview button.
- Browser-verified for all 13 pages (incl. toggle-off and Daily layout variants); console clean; `node --test` 24 green.

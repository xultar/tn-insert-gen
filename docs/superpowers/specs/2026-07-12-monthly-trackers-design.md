# Monthly Trackers — Design

**Status:** Approved-in-brainstorm (2026-07-12). Next: user reviews this spec → writing-plans.

## Goal

Repurpose the confusing "Graphs" page (an unscaled, auto-linked "Steps & Weight" grid) into a clear, opt-in **Monthly Trackers** page: a set of scaled per-metric columns you fill in by hand over the month. Fix the defaults and framing rather than the engine — `buildGraphSVG` and the Min/Max/Step editor already exist and work.

## Why (problem)

- The current page ships with **"Link to daily fields" ON by default**, which overwrites the (scaled) `graphMetrics` with the **unscaled** daily-field labels (`Steps`, `Wt`) on every generate. So the page renders as blank ruled columns with no scale — unreadable as a chart.
- The chart is a **days-vertical grid** (days as rows top→bottom, value left→right), which is fine for a tall narrow TN column but only reads as a chart **when a value scale is present**.
- There is **no include-toggle** — the page appears whenever ≥1 metric exists, so it can't be cleanly turned off.

## Scope (locked in brainstorm)

- **Rename** the section **Graphs → Monthly Trackers** (UI label only; internal names `graphMetrics`/`mkMonthGraphs`/`monthly-graphs` stay to limit blast radius).
- **Include-toggle** `opts.trackers` (default **off**). `generate()` adds the page only when on: `if(opts.trackers && graphMetrics.length>0)`.
- **Remove the "Link to daily fields" feature entirely** — delete `opts.linkFieldsGraphs`, the `#opt-linkfg` toggle, `toggleLink()`, the `graphMetrics=dailyFields.map(...)` override in `generate()`, the `#metric-section` show/hide, and the related apply/read/export/import lines. The trackers editor (`#metric-list`) is always visible. Daily fields (Steps/Wt on daily pages) are untouched and independent.
- **Preset "Add tracker" picker** — replaces the plain name+Add row. A `<select>` "Add tracker…" adds a metric pre-filled with a real scale:
  - Sleep — min 0, max 12, step 2
  - Water — min 0, max 8, step 1
  - Mood — min 1, max 5, step 1
  - Steps — min 0, max 15000, step 5000
  - Weight — min 50, max 100, step 10 (placeholder range; editable)
  - Custom — title "Metric", no scale (user sets a scale or labels)
- **Scaled starter set** — change the default `graphMetrics` from unscaled `[Weight, Steps]` to scaled `[Sleep 0–12, Water 0–8, Mood 1–5]`, so enabling the page looks like real charts immediately. (Page still default off.)
- **Custom labeled axis** — a metric may carry an optional `labels` array. In the metric editor, a **Labels** field (comma-separated) with quick-fills **"Weekdays"** (`S,M,T,W,T,F,S`) and **"1–5"** (`1,2,3,4,5`). In `buildGraphSVG`, if `metric.labels` is non-empty, render those labels as evenly-spaced axis ticks/gridlines **instead of** the numeric Min/Max/Step scale. Numeric scale remains the default when no labels are set.
- **Format unchanged** — keep the days-vertical grid; it now always has a scale or labels, so it reads as a chart. Col density + top/bottom borders options stay.

## Components / touch points

- `weekly.html` `sec-graphs`: rename header; remove the link toggle; replace the add-row with the preset `<select>`; keep density/borders.
- `weekly.js`:
  - `opts`: add `trackers:false`; remove `linkFieldsGraphs`; change default `graphMetrics` to the scaled starter set.
  - `renderMetrics()`: add a **Labels** input (+ quick-fills) to each metric's details, alongside Min/Max/Step.
  - add `addTrackerPreset(kind)` that pushes a preset metric and re-renders.
  - remove `toggleLink()`; strip `linkFieldsGraphs` from `applyOptsToUI`/`readOptsFromUI`/`generate`/export/import; add `trackers` to those.
  - `generate()`: gate the page on `opts.trackers`.
  - `buildGraphSVG()`: when `metric.labels?.length`, draw evenly-spaced text labels + gridlines instead of the numeric header scale.
- Persistence: `trackers` rides in `opts` (already serialized); `labels` rides on each `graphMetrics` entry (already serialized). Export/import: drop `linkFieldsGraphs`.

## Testing / verification

- `node --test` unchanged (no core.js change) — 24 green.
- Browser (fresh port): the Monthly Trackers toggle adds/removes the page; presets add scaled columns that render with a visible scale; a Custom tracker with Labels `S,M,T,W,T,F,S` renders 7 labeled columns; Min/Max/Step still editable; the removed link toggle is gone and the editor is always visible; page persists across reload; daily Steps/Wt fields on daily pages are unaffected. No console errors.
- Default (`trackers` off) → no trackers page in output, matching a clean opt-in.

## Out of scope (follow-ups)

- Auto-plotting real data (it stays a fill-by-hand grid).
- A horizontal (days-along-the-bottom) chart redesign — deliberately not doing this; the vertical grid suits the narrow page.
- Renaming the internal `graphMetrics`/`mkMonthGraphs` identifiers.

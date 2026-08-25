# TN Bullet-Journal Page Maker — Design

**Date:** 2026-07-09
**Status:** Approved for planning
**Base:** `tn-weekly-planner/` (recreation of flolipop/tn-insert-generator, GPL-3.0)

## 1. Summary

Turn the existing "generate a whole print booklet" planner into a **Bullet-Journal page maker for traveler's notebooks**. The user starts from a clean, guided front door — pick a notebook size, a date range, and a page type — and either answers a few questions or flips into the full existing tool wall. Output is a single print-ready page or a collected booklet.

The existing engine (`weekly.js`, ~3,000 lines of print-tested layout math: imposition, crop marks, duplex, per-page builders) is **kept and wrapped**, not rewritten.

## 2. Goals

- Replace the "wall of controls greets you on load" experience with a calm, guided flow.
- Keep the full tool wall available, hidden behind a toggle, for power use.
- Make page creation **page-type-centric**: choose one type and build it.
- Add one net-new page type: **Future Log** (BuJo style, size-adaptive, with compact mini-months).
- Support **single**, **double** (two-up spread), and **booklet** output.
- **WYSIWYG fidelity:** the preview render must faithfully represent the printed page — true notebook proportions, real sizes/spacing, and the actual mini-month/band layout — so what the user sees is what prints.

## 3. Non-Goals (YAGNI)

- No freeform drag-and-drop canvas editor. The "Tools" fork is the existing sidebar, not a new canvas.
- No account system, cloud sync, or sharing.
- No rewrite of the imposition/print engine.
- No new page types beyond Future Log in this iteration (Monthly/Daily/Habit/Cover/Plain already exist).

## 4. Approach: Wrap, don't rewrite (Approach A)

The engine already has a builder function per page type:
- `mkDay()` — Daily
- `mkCalendar()` / `mkMonthNotes()` / `mkCalendarColumnSpread()` — Monthly
- `mkHabitMap()` — Habit
- `mkCover()` / `mkBackCover()` — Cover
- fill patterns (`getFillStyle`, dots/grid/lines/hex) — Plain
- `generate()` currently chains them all into one booklet.

We add:
1. A **greeter shell** (new UI layer) in front of the sidebar.
2. A **single-page render mode** so we can call one builder in isolation.
3. A new builder **`mkFutureLog()`** plus a shared **mini-month** helper.
4. A **"Show all tools" toggle** that reveals the current `#cfg` sidebar (hidden by default).

Guided answers and greeter selections write into the **same `opts` / state** the wall already reads, then trigger a render. This keeps one source of truth.

## 5. UX Flow

```
① Notebook size → ② Date range → ③ Page type → ④ Guided ─┐
                                                └→ Tools ──┴→ ⑤ Output → Preview → Export
```

- **① Notebook size** — Pocket, Passport, B6 Slim, Personal, A5 Slim, Regular, A5, Custom. Drives page geometry (`tnSize()`).
- **② Date range** — placed right after size because dates drive content: which months a Future Log shows, which day a Daily is, which month a Monthly is. Range can be a single date or a span (e.g. 12 months).
- **③ Page type** — Future Log, Monthly, Daily, Habit, Cover, Plain.
  - When **Plain** is chosen, the guided flow adds one sub-step: **ruling** — dot / square / lined / hex-dot / blank (existing fill patterns, so it is a selection not new layout code).
- **④ Fork:**
  - **Guided** — a few type-specific questions; the shell fills `opts` and renders.
  - **Tools** — reveals the full existing sidebar (the "wall"). Toggle is OFF by default.
- **⑤ Output mode** — single / double / booklet (see §6).

The wall is never removed — it is the power-user surface, one toggle away.

## 6. Output model: Single / Double / Booklet

- **Single** — render just the selected page type and export/print only that (new single-page mode).
- **Double** — two independently-configured pages placed side-by-side on one landscape sheet (e.g. Month + Daily, two Dailies, 6 months of Future Log across two panels). This maps directly onto the engine's **existing two-panel-per-landscape-sheet layout** (the fold-in-the-middle booklet already renders two notebook pages per sheet). The only net-new work is a small UI to configure **two slots** instead of one; each slot reuses the single-page renderer.
- **Booklet** — collect many pages and assemble via the existing imposition path (`generate()` + print layout).

## 7. Future Log specification (the one new page type)

### 7.1 Layouts
- **Stacked bands** (default, most TN-friendly): months as horizontal blocks down the page, each with a compact mini-month + event lines.
- **Column spread**: months as vertical columns across a 2-page spread, mini-month on top of each.
- **Year-at-a-glance grid**: all 12 (or range) months as tiny calendars in a grid — a pure overview page with just the mini-months, minimal writing room.

Support all three; stacked is the default.

### 7.2 Mini-month — compact by design
Each month is rendered as a **genuinely small reference calendar** (Hobonichi Weeks philosophy): the calendar is a compact block; the **event/writing area is the priority and takes the majority of the space**. The mini-month is for orientation and circling dates, not for writing inside.

- Mini-calendar occupies a small fraction of each band (target ≈ 30–40% of band width in stacked; a compact top block in columns).
- Weekday header respects the existing `weekstart` option (Mon/Sun).
- Remaining space is ruled event lines.

### 7.3 Size-adaptive band count
Months-per-page auto-fits the chosen notebook's page height (stacked) or width (columns). Defaults:

| Size | W×H (mm) | Months / page |
|------|----------|---------------|
| Pocket (3.5×5.5″) | 89×140 | 2 |
| Passport | 89×124 | 2 |
| Personal | 95×171 | 3 |
| B6 Slim | 91×182 | 3 |
| Regular (standard TN) | 110×210 | 3 |
| A5 Slim | 105×210 | 3–4 |
| A5 (regular) | 148×210 | 3–4 |

A date range longer than one page flows onto additional pages. The count stays **overridable in the tools** (denser or roomier).

## 8. Components / boundaries

- **Greeter shell** (new): owns the ①–④ flow and the tools toggle. Reads/writes `opts`; calls render. Understandable and testable without touching the engine internals.
- **Single-page renderer** (new, thin): given a page type + `opts`, calls the one matching `mk*()` and shows it; no booklet imposition.
- **Double composer** (new, small): configures two slots (each a page type + `opts`) and places their single-page renders into the two panels of one landscape sheet, reusing the existing 2-up sheet layout.
- **`mkFutureLog(range, opts, colors)`** (new): builds stacked / column / year-grid Future Log pages using the mini-month helper and the size→band-count rule.
- **`mkMiniMonth(year, month, opts, colors)`** (new, shared): compact month calendar; reusable by other page types later.
- **Existing engine** (unchanged): all current `mk*()` builders, themes, fill patterns, imposition, print layout.

## 9. Testing

- Mini-month renders correct day grid for representative months (31-day, 28-day, leap Feb, Sun-start vs Mon-start).
- Band count matches the size table for each notebook size (incl. Pocket and A5); range > capacity paginates correctly.
- Future Log renders all three layouts (stacked, column, year-grid).
- Single-page mode renders each of the six page types in isolation without booklet chrome.
- Plain ruling sub-step produces each fill pattern (dot/square/lined/hex/blank).
- Double mode places two independently-configured slots into the two sheet panels; mixed types (Month + Daily) render correctly.
- Tools toggle reveals/hides `#cfg`; guided edits and wall edits produce identical `opts` → identical output.
- Existing booklet generation still passes (no regression to imposition/crop/duplex).
- Preview render is dimensionally faithful: rendered page proportions and element sizes match the selected notebook's real mm dimensions (WYSIWYG).

## 10. Open questions

- Column-spread band/column count rule for very small sizes (Passport spread) — confirm during implementation.
- Guided question set per page type — define the minimal set (start with Future Log + Daily; others can default straight to Tools initially).

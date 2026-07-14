# Greeter date selector + undated pages — design

Date: 2026-07-14
Status: approved by user (conversation 2026-07-14)

## Problem

1. **No date selector on the greeter.** The greeter label reads "Date range (from
   Month/Year above)" but the Month/Year inputs (`sel-m`, `sel-y`) live in the
   hidden "all tools" wall panel (`#cfg`). `grCtx()` reads them anyway, so the
   greeter uses a date the user can't see or change without toggling the wall.
2. **No undated pages.** Every page type prints concrete dates. Users want
   generic, reusable pages where the date area shows a blank write-in label
   (`Date:` / `Month:`) instead.

## Part 1 — Month/Year selector on the greeter

Add a Month `<select id="gr-m">` and Year `<input id="gr-y">` to the greeter,
directly under the "Date range" label (label text drops "(from Month/Year
above)").

Sync model (same pattern as notebook size in `grToggleTools`):

- On change: write through to `sel-m` / `sel-y`, then `grPreview()`.
- When switching wall → greeter (`grToggleTools`), reseed `gr-m`/`gr-y` from
  `sel-m`/`sel-y` (add a `grSeedDate()` called alongside `grInitSize()`).
- `initGreeter()` seeds them once at startup (after `loadState()` has restored
  the wall inputs).
- `grCtx()` keeps reading `sel-m`/`sel-y` (single source of truth; the greeter
  inputs are a mirror).

## Part 2 — Undated pages

### Mechanism

Add `undated` as a **guided option** on every dated page type. Guided options
already: render as chips, snapshot onto the booklet entry (`grAdd`), display in
the tray label (`grEntryLabel`), and apply per-entry via the opts save/restore
in `grGenerate`. No new plumbing.

- Guided spec added to: `cover`, `futureLog`, `monthly`, `monthlog`, `habit`,
  `masterlist`, `reflection`, `notes`, `daily`.
  `{opt:'undated', label:'Dating', choices:[[false,'Dated'],[true,'Undated']]}`
- `plain` is excluded (no date).
- `opts.undated` default: `false`. Because guided chips write the shared global
  `opts` (existing behavior, same as `dailyLayout`), toggling Undated in the
  greeter also affects wall rendering until changed back — consistent with all
  other guided options.

### Guided renderer extension

`grRenderGuided` currently supports only chip rows. Extend the spec format
with two optional fields:

- `input:'number'` — renders a small number input bound to `opts[spec.opt]`
  (min/max from spec) instead of chips.
- `showIf(opts)` — predicate; the row renders only when it returns true.

Used for Daily's page count: `{opt:'dailyCount', label:'Pages', input:'number',
min:1, max:93, showIf:(o)=>o.undated}`. Default `opts.dailyCount = 31`.

### Per-builder behavior when `opts.undated` is true

| Builder | Change |
|---|---|
| `mkCover` | Omit the "Month Year" subtitle (all designs incl. custom image). |
| `mkDay` / `mkTimeBlockDay` | Header shows `Date:` + blank write-in line instead of weekday name + day number. No holidays, no moon phase. |
| Daily expansion (greeter `PAGE_TYPES.daily`) | Generate `opts.dailyCount` pages instead of one per day of month. Facing-notes pairs use a blank label. |
| `mkCalendar` (monthly) | Title becomes `Month:` + blank line. Grid renders 6 empty weeks (no day numbers, no holidays/moon). Weekday header row kept (user picks alignment by hand). |
| `mkMonthList` (monthlog) | Title `Month:` + blank. Rows numbered 1–31; weekday letters dropped. |
| `mkHabitMap` | Month name → `Month:` blank; renders 31 days. |
| `mkMonthBrainDump`, `mkReflection`, `mkMonthNotes` | Month-name header → `Month:` + blank line. |
| `mkFutureLog` (all three layouts) | Month-name labels → blank write-in lines; mini-month day cells keep no numbers but get visible outlines (`.2pt` border, 2mm min-height) so a fillable grid still prints (rev 2026-07-14: user feedback — numberless cells with no outline made the calendars vanish). |
| `facingPair` | Accepts a blank/`Date:` label when undated. |

Convention: undated month-shaped pages assume **31 days / 6 weeks** (user
strikes out extras in short months). For undated entries the greeter "Months"
count acts as a **copies** count (each "month" expands to one more undated
copy); `futureLog` ignores it as it does today. Exception: undated **Daily**
generates exactly `dailyCount` pages total — the Months count is ignored for
that type (no multiplication).

### Pure logic in core.js (testable)

- `blankMonthMatrix(weekstart)` → 6 rows × 7 nulls (or equivalent helper the
  calendar builder consumes when undated).
- `clampDailyCount(raw)` — clamp to [1, 93], defaulting 31 on garbage; used by
  the guided input and the Daily expansion. (Tray page counts need no helper:
  `grAdd` already counts by expanding.)
- Tests in `test/core.test.js` for both, plus existing tests stay green.

### Persistence / migration

`entry.config.undated` and `entry.config.dailyCount` are snapshotted like any
guided option. Old saved booklets lack the keys → `undefined` is falsy →
render dated, exactly as before. No migration needed.

### Tray labels

`grEntryLabel` already skips `false`/unset values, so dated entries show no
extra text; undated entries show `· Undated` (and Daily also `· <n>` pages via
`pageCount`, already displayed).

## Error handling

- `dailyCount` clamped to [1, 93] in the input and at expansion time.
- Stale persisted `undated` on a type that later drops the option: harmless —
  expansion just ignores unknown config keys (existing behavior).

## Testing

- `node --test` for the new core.js helpers (blank matrix, page-count math).
- Manual/visual: generate a mixed booklet (dated July daily + undated daily +
  undated calendar/log/habit) and check the print preview; verify greeter
  Month/Year mirrors the wall in both directions.

## Out of scope

- Moving `sel-m`/`sel-y` out of the wall.
- Per-entry (non-global) guided option state.
- Undated weekly wall view.

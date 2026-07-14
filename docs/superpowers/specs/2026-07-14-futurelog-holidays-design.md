# Future Log Holidays — Design

**Date:** 2026-07-14
**Status:** Approved

## Goal

Dated future log pages show the same holidays the monthly calendar shows: a
visual mark on the date in each mini-month grid, and the holiday names
pre-printed in the month's writing area where the layout has one.

## Requirements

- **Data source:** the existing `holidayMap(y, m)` in weekly.js — library
  holidays (date-holidays, country/state) gated by the wall's Holidays toggle
  (`opts.holidays`), custom holidays always included. No new options or UI.
- **Marks (all three layouts — stacked, columns, year grid):** a holiday
  day's number in the mini-month grid renders bold with a thin (.3pt)
  underline in ink color. Bold+underline is chosen over a color accent so the
  mark survives the Minimal B&W theme and tiny 3.6pt cells.
- **Name lines (stacked + columns only):** each month's writing area starts
  with one compact line per holiday, sorted by day, format `1 · New Year's
  Day`, in dim color at small size. Stacked: appended to the band after the
  floated mini-month (flows beside it at the top of the writing surface).
  Columns: between the mini-month and the ruled `.fl-write` area. Year grid
  has no writing space → marks only.
- **Undated pages:** untouched — no marks, no lines (there are no dates).
- **Empty months:** no lines rendered (zero height), grid unmarked.
- **Greeter booklet entries:** inherit the behavior automatically (same
  builders); a dated FL entry shows holidays, an undated one doesn't,
  regardless of the other's settings (per-entry `config.undated` already
  swaps `opts.undated` around expansion).

## Implementation shape (Approach 1 — builders self-serve)

- `TNCore.holidayListEntries(map)` (core.js, **TDD**): flatten a
  `{day: [names]}` map into `[{day, name}, …]` sorted ascending by day;
  multi-holiday days produce one entry per name. Pure, unit-tested.
- `mkMiniMonth` (weekly.js): when `!opts.undated`, compute
  `holidayMap(y, m)` and style matching day cells (font-weight 700,
  border-bottom .3pt solid ink).
- New `mkFLHolidayLines(y, m, colors)` (weekly.js): returns an element with
  `.fl-hol-line` children (`{day} · {name}`) or `null` when no holidays /
  undated. Called by `mkFutureLogStacked` (append into `.fl-band`) and
  `mkFutureLogColumns` (insert before `.fl-write`).
- CSS: `.fl-hols` / `.fl-hol-line` — ~4.5pt, dim color; must not break the
  band's fill-pattern writing surface.

## Testing

- `node --test`: new cases for `holidayListEntries` (sorting, multi-name
  days, empty map).
- Browser verification: custom holiday + US holidays across all three
  layouts, dated and undated, wall preview and greeter booklet entry;
  Minimal B&W legibility of the mark.

## Out of scope

- A separate "holidays on future log" toggle (user chose to follow the
  existing Holidays setting).
- Any change to undated rendering, holidayMap, or the wall Holidays UI.

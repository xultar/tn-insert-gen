# Future Log Holidays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dated future log pages mark holiday dates in their mini-month grids and pre-print holiday names in each month's writing area (Stacked/Column layouts).

**Architecture:** Builders self-serve from the existing `holidayMap(y,m)` (library holidays gated by `opts.holidays`, custom holidays always). A pure `TNCore.holidayListEntries(map)` flattens/sorts the map (TDD); `mkMiniMonth` styles matching day cells; a new `mkFLHolidayLines` helper renders name lines appended by the Stacked and Column layout builders. Year-grid gets marks only; undated pages are untouched.

**Tech Stack:** Vanilla JS (no build), `node --test` for core.js, static server + browser for DOM verification.

**Spec:** `docs/superpowers/specs/2026-07-14-futurelog-holidays-design.md`

---

### Task 1: `TNCore.holidayListEntries` (pure, TDD)

**Files:**
- Modify: `core.js` (new function + api entry)
- Test: `test/core.test.js` (append)

- [ ] **Step 1: Write the failing tests** — append to `test/core.test.js`:

```js
test('holidayListEntries: flattens a {day:[names]} map sorted by day', () => {
  const entries = core.holidayListEntries({ 15: ['Assumption'], 1: ["New Year's Day", 'Kwanzaa ends'] });
  assert.deepStrictEqual(entries, [
    { day: 1, name: "New Year's Day" },
    { day: 1, name: 'Kwanzaa ends' },
    { day: 15, name: 'Assumption' }
  ]);
});

test('holidayListEntries: empty or garbage input gives []', () => {
  assert.deepStrictEqual(core.holidayListEntries({}), []);
  assert.deepStrictEqual(core.holidayListEntries(null), []);
  assert.deepStrictEqual(core.holidayListEntries(undefined), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tn-weekly-planner && npm test`
Expected: 2 failures, `TypeError: core.holidayListEntries is not a function`

- [ ] **Step 3: Minimal implementation** — in `core.js`, before `var api = {`:

```js
  // Flatten a {day: [names]} holiday map (holidayMap's shape) into
  // render-ready {day, name} entries sorted ascending by day.
  function holidayListEntries(map) {
    if (!map || typeof map !== 'object') return [];
    var out = [];
    Object.keys(map).map(Number).sort(function (a, b) { return a - b; })
      .forEach(function (d) {
        (map[d] || []).forEach(function (name) { out.push({ day: d, name: name }); });
      });
    return out;
  }
```

and add `holidayListEntries: holidayListEntries,` to the `api` object (after `canvasBannerText`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tn-weekly-planner && npm test`
Expected: 37 tests, 0 fail

- [ ] **Step 5: Commit**

```bash
git add tn-weekly-planner/core.js tn-weekly-planner/test/core.test.js
git commit -m "feat(core): holidayListEntries for future-log holiday lines"
```

### Task 2: Marks + name lines in the future log builders

**Files:**
- Modify: `weekly.js` — `mkMiniMonth` (~line 2584) and the three `mkFutureLog*` builders (~lines 2680–2745); add `mkFLHolidayLines` next to them
- Modify: `weekly.css` — after the `.mini-month-day` rule (~line 403)

- [ ] **Step 1: Mark holiday days in `mkMiniMonth`** — inside `mkMiniMonth`, add a holiday map right after `const grid = el('div','mini-month-grid');` line's surrounding setup (before the weeks loop):

```js
  const hmap = opts.undated ? {} : holidayMap(y, m);
```

and in the day-cell loop, after `cell.style.color = colors.ink;`:

```js
      // Holiday mark: bold + thin underline survives 3.6pt cells and B&W themes.
      if(d!=null && hmap[d]){ cell.style.fontWeight='700'; cell.style.borderBottom=`.3pt solid ${colors.ink}`; }
```

- [ ] **Step 2: Add `mkFLHolidayLines`** — directly above `mkFutureLog` in weekly.js:

```js
// Pre-printed holiday lines ("1 · New Year's Day") for a Future Log month's
// writing area. Returns null when undated or the month has no holidays.
function mkFLHolidayLines(y, m, colors){
  if(opts.undated) return null;
  const entries=TNCore.holidayListEntries(holidayMap(y,m));
  if(!entries.length) return null;
  const box=el('div','fl-hols');
  entries.forEach(en=>{
    const line=el('div','fl-hol-line', en.day+' · '+en.name);
    line.style.color=colors.dim;
    box.appendChild(line);
  });
  return box;
}
```

- [ ] **Step 3: Wire into Stacked** — in `mkFutureLogStacked`, after `band.appendChild(mkMiniMonth(mm.year, mm.month, colors));`:

```js
      const hl=mkFLHolidayLines(mm.year, mm.month, colors);
      if(hl) band.appendChild(hl);
```

- [ ] **Step 4: Wire into Columns** — in `mkFutureLogColumns`, after `col.appendChild(mkMiniMonth(mm.year, mm.month, colors));` (and before the `fl-write` append):

```js
      const hl=mkFLHolidayLines(mm.year, mm.month, colors);
      if(hl) col.appendChild(hl);
```

(Year grid: no change — marks come from `mkMiniMonth`.)

- [ ] **Step 5: CSS** — in weekly.css after `.mini-month-day{...}`:

```css
.fl-hols{margin-top:.6mm;}
.fl-hol-line{font-size:4.5pt;line-height:1.5;}
```

- [ ] **Step 6: Run tests (unchanged code paths)**

Run: `cd tn-weekly-planner && npm test`
Expected: 37 tests, 0 fail

- [ ] **Step 7: Commit**

```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.css
git commit -m "feat(futurelog): holiday marks in mini-months + name lines in write areas"
```

### Task 3: Browser verification

**Files:** none (verification only)

- [ ] **Step 1: Serve fresh + load** — `python -m http.server <FRESH PORT> --directory tn-weekly-planner`, open `weekly.html`. Back up localStorage (`STORAGE_KEY`) before mutating state; restore after.

- [ ] **Step 2: Verify marks + lines, all layouts, dated** — with Holidays toggle ON (or a custom holiday added): Stacked band shows bold/underlined day + `N · Name` lines beside the mini-month; Columns shows lines between mini-month and ruling; Year grid shows marks only.

- [ ] **Step 3: Verify gating** — Holidays toggle OFF and no custom holidays in a month → that month renders exactly as before (no `.fl-hols` element). Custom holiday still appears with toggle OFF.

- [ ] **Step 4: Verify undated untouched** — Undated FL (any layout): no marks, no lines.

- [ ] **Step 5: Greeter entry** — dated FL booklet entry shows holidays; undated entry in the same booklet doesn't. No console errors.

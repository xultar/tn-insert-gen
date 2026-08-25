# Greeter 2a — Booklet Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the testable foundation for the greeter's hand-assembled booklet — a pure collection model, a page-type registry that expands entries into pages, and an `imposeAndRender()` extraction so a collection prints through the same pipeline as the legacy generator.

**Architecture:** Add pure collection operations to `core.js` (Node-tested). Extract the CSS-var setup + imposition tail of `generate()` into `imposeAndRender(pageEls)` in `weekly.js` (refactor, no behaviour change). Add `greeter.js` with a page-type registry (`PAGE_TYPES`) mapping each type to an `expand(ctx)` that returns page DOM elements via the existing `mk*` builders, plus `bookletPages(list, ctx)`. A temporary console hook proves a collection renders. The visible sidebar UI is Plan 2b.

**Tech Stack:** Vanilla ES5-compatible browser JS, Node 24 `node:test`, no build step.

**Roadmap:** This is Plan 2a of the greeter ([spec](../specs/2026-07-10-greeter-design.md)). Plan 2b = the sidebar greeter UI (panel, guided options, tray, tools toggle) built on these APIs.

---

## File Structure

- Modify: `tn-weekly-planner/core.js` — pure booklet-collection ops.
- Modify: `tn-weekly-planner/test/core.test.js` — tests for the ops.
- Modify: `tn-weekly-planner/weekly.js` — extract `imposeAndRender`; add `mkPlain`.
- Create: `tn-weekly-planner/greeter.js` — `PAGE_TYPES` registry + `bookletPages` + temp `renderBooklet` hook.
- Modify: `tn-weekly-planner/weekly.html` — load `greeter.js`.

**Entry shape** (used throughout): `{ id: string, type: string, config: object, pageCount: number }`. `config` holds only the type's guided options (e.g. `{layout:'stacked'}`). `pageCount` is filled in by the browser when an entry is added (Plan 2b); the pure ops treat it as given.

---

## Task 1: Pure booklet-collection operations

**Files:**
- Modify: `tn-weekly-planner/core.js`
- Modify: `tn-weekly-planner/test/core.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tn-weekly-planner/test/core.test.js`:

```js
test('bookletAdd appends an entry immutably', () => {
  const a = [];
  const b = core.bookletAdd(a, { id: '1', type: 'cover', config: {}, pageCount: 1 });
  assert.strictEqual(a.length, 0);
  assert.strictEqual(b.length, 1);
  assert.strictEqual(b[0].type, 'cover');
});

test('bookletRemove drops the matching id', () => {
  const list = [{ id: '1', type: 'cover', config: {}, pageCount: 1 },
                { id: '2', type: 'daily', config: {}, pageCount: 31 }];
  const out = core.bookletRemove(list, '1');
  assert.deepStrictEqual(out.map((e) => e.id), ['2']);
});

test('bookletMove shifts an entry up and down within bounds', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepStrictEqual(core.bookletMove(list, 'b', -1).map((e) => e.id), ['b', 'a', 'c']);
  assert.deepStrictEqual(core.bookletMove(list, 'b', 1).map((e) => e.id), ['a', 'c', 'b']);
  // no-op past the ends
  assert.deepStrictEqual(core.bookletMove(list, 'a', -1).map((e) => e.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(core.bookletMove(list, 'c', 1).map((e) => e.id), ['a', 'b', 'c']);
});

test('bookletTotalPages sums pageCount', () => {
  const list = [{ pageCount: 1 }, { pageCount: 31 }, { pageCount: 4 }];
  assert.strictEqual(core.bookletTotalPages(list), 36);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tn-weekly-planner && node --test`
Expected: FAIL — `core.bookletAdd is not a function`.

- [ ] **Step 3: Implement in core.js**

In `tn-weekly-planner/core.js`, add these functions before the `var api = {` line:

```js
  function bookletAdd(list, entry) {
    return list.concat([entry]);
  }

  function bookletRemove(list, id) {
    return list.filter(function (e) { return e.id !== id; });
  }

  function bookletMove(list, id, dir) {
    var i = list.findIndex(function (e) { return e.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list.slice();
    var out = list.slice();
    var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    return out;
  }

  function bookletTotalPages(list) {
    return list.reduce(function (n, e) { return n + (e.pageCount || 0); }, 0);
  }
```

Add them to the `api` object:

```js
  var api = {
    NOTEBOOK_SIZES: NOTEBOOK_SIZES,
    futureLogBandCount: futureLogBandCount,
    monthMatrix: monthMatrix,
    paginateMonths: paginateMonths,
    bookletAdd: bookletAdd,
    bookletRemove: bookletRemove,
    bookletMove: bookletMove,
    bookletTotalPages: bookletTotalPages
  };
```

- [ ] **Step 4: Run to verify pass**

Run: `cd tn-weekly-planner && node --test`
Expected: PASS — all tests green (8 prior + 4 new = 12).

- [ ] **Step 5: Commit**

```bash
git add tn-weekly-planner/core.js tn-weekly-planner/test/core.test.js
git commit -m "feat: pure booklet-collection ops in core.js"
```

---

## Task 2: Extract imposeAndRender() from generate()

This is a **pure refactor** — no behaviour change. `generate()` currently (a) sets root CSS vars + sheet dims, (b) builds an `els` array of pages from `opts`, (c) numbers pages, clones to `#page-preview`, builds `#book-view`, and imposes to `#print-area`. We move everything except (b) into `imposeAndRender(pageEls)`.

**Files:**
- Modify: `tn-weekly-planner/weekly.js` (the `generate()` function, currently starting at `function generate(){`)

- [ ] **Step 1: Add the imposeAndRender wrapper**

In `tn-weekly-planner/weekly.js`, rename the existing `function generate(){` to `function imposeAndRender(pageEls){` and change its internals as follows:

1. Delete the first three lines of the old body:
   ```js
     saveState();
     const m=parseInt($('sel-m').value);
     const y=parseInt($('sel-y').value);
   ```
   (These move to the new `generate()` below.)

2. Keep everything else, but replace the block that **builds** the pages — from the line `const els=[];` through the end of the `buildWeeks(y,m).forEach(...)` loop and the `if(opts.reflectionPage)`, `if(opts.backCover)` pushes (i.e. the entire section that pushes into `els`) — with a single line:
   ```js
     const els = pageEls;
   ```
   Every later reference to `els` (pagenums, cloning, imposition) now operates on the passed-in `pageEls`.

3. `imposeAndRender` still needs `m`/`y` only where the legacy code used them for building pages — those uses are gone with the deleted build block. If any remaining reference to `m` or `y` exists (e.g. none should after the build block is removed), leave them computed at the top of `imposeAndRender` as:
   ```js
     const m=parseInt($('sel-m').value);
     const y=parseInt($('sel-y').value);
   ```
   Otherwise omit them.

- [ ] **Step 2: Add the new generate() that builds els then delegates**

Immediately **before** `function imposeAndRender(pageEls){`, add:

```js
function generate(){
  saveState();
  const m=parseInt($('sel-m').value);
  const y=parseInt($('sel-y').value);
  const colors=getColors();
  const els=[];

  if(opts.cover) els.push(mkCover(y,m,colors));
  if(opts.goalsPage) els.push(mkGoalsPage(y,m,colors));
  if(opts.braindump) els.push(mkMonthBrainDump(y,m,colors));
  if(opts.calendar) els.push(...mkCalendar(y,m,colors));
  if(opts.habitMap) els.push(mkHabitMap(y,m,colors));
  if(opts.moodCal) els.push(mkMoodCalendar(y,m,colors));
  const noteCount=opts.notes;
  if(noteCount>0 && (opts.notespos==='front'||opts.notespos==='both')){
    const frontNotes=opts.notespos==='both'?Math.ceil(noteCount/2):noteCount;
    for(let i=0;i<frontNotes;i++) els.push(mkMonthNotes(y,m,colors));
  }
  if(opts.linkFieldsGraphs){ graphMetrics=dailyFields.map(f=>({id:f.id,title:f.label})); }
  if(graphMetrics.length>0) els.push(mkMonthGraphs(y,m,colors));
  buildWeeks(y,m).forEach((wdays,wi)=>{
    els.push(mkWeekSummary(y,m,wi+1,wdays,colors));
    wdays.forEach(d=>{if(d>0)els.push(opts.dailyLayout==='timeblock'?mkTimeBlockDay(y,m,d,colors):mkDay(y,m,d,colors));});
    if(opts.weeklyReflection) els.push(mkWeekReflection(wi+1,colors));
  });
  if(opts.expenseTracker) els.push(mkExpenseTracker(y,m,colors));
  if(noteCount>0 && (opts.notespos==='back'||opts.notespos==='both')){
    const backNotes=opts.notespos==='both'?Math.floor(noteCount/2):noteCount;
    for(let i=0;i<backNotes;i++) els.push(mkMonthNotes(y,m,colors));
  }
  if(opts.reflectionPage) els.push(mkReflection(y,m,colors));
  if(opts.backCover) els.push(mkBackCover(y,m,colors));

  imposeAndRender(els);
}
```

> Note: this `els`-building block is copied verbatim from the current `generate()` body (the exact push sequence between `const els=[];` and `imposeAndRender`). Reproduce it exactly from the file you are editing; if the live order differs, match the live order.

- [ ] **Step 3: Browser regression check**

Serve on a fresh port and confirm no behaviour change:

```bash
cd tn-weekly-planner && python -m http.server 5701 --bind 127.0.0.1
```
Load `http://localhost:5701/weekly.html`, click **↻ Generate**, and verify: the page count header, the Pages/Book/Print Layout views, and a couple of daily pages all render exactly as before. Check the console — no errors.
Also run `cd tn-weekly-planner && node --test` — still 12 passing (no core change, sanity only).

- [ ] **Step 4: Commit**

```bash
git add tn-weekly-planner/weekly.js
git commit -m "refactor: extract imposeAndRender() from generate()"
```

---

## Task 3: mkPlain — a bare fill-pattern page

The registry needs a "Plain" page: a full page with just the current fill pattern, no header.

**Files:**
- Modify: `tn-weekly-planner/weekly.js` (add near `mkMonthNotes`)

- [ ] **Step 1: Add mkPlain**

In `tn-weekly-planner/weekly.js`, immediately after the `mkMonthNotes` function's closing brace, add:

```js
function mkPlain(y,m,c){
  const colors=c||getColors();
  const p=pg('plain',colors);
  p.style.cssText+=getFillStyle(colors);
  return p;
}
```

- [ ] **Step 2: Browser check**

On the same server, open the console and run:

```js
renderSinglePage(mkPlain(2026,0,getColors()));
```
Expected: a full notebook-sized page filled edge-to-edge with the current fill pattern (dots by default), no header, no console errors.

- [ ] **Step 3: Commit**

```bash
git add tn-weekly-planner/weekly.js
git commit -m "feat: add mkPlain bare fill-pattern page builder"
```

---

## Task 4: Page-type registry + bookletPages (greeter.js)

**Files:**
- Create: `tn-weekly-planner/greeter.js`
- Modify: `tn-weekly-planner/weekly.html` (load greeter.js after weekly.js)

- [ ] **Step 1: Create greeter.js with the registry**

Create `tn-weekly-planner/greeter.js`:

```js
'use strict';

// ctx: { year, month, monthCount, colors } merged with the entry's config.
// Each expand(ctx) returns an array of page DOM elements, reusing the engine builders.
// mkFutureLog / mkCalendar already return arrays; the rest return single elements.
//
// CONFIG SCOPE (Plan 2a): expand reads config keys it can consume DIRECTLY from ctx
// (e.g. daily's `timeblock`, notes' `count`). Config keys that the underlying
// builders read from the GLOBAL `opts` (Future Log's `flLayout`, Plain's fill
// pattern) use whatever `opts` currently holds; wiring per-entry config into
// `opts` around each expand() is a Plan 2b responsibility (guided options set opts).
function monthsOf(ctx){
  const list=[];
  for(let i=0;i<(ctx.monthCount||1);i++){
    const idx=ctx.month+i;
    list.push({ year: ctx.year + Math.floor(idx/12), month: ((idx%12)+12)%12 });
  }
  return list;
}

const PAGE_TYPES = {
  cover:      { label:'Cover',              expand:(c)=>[mkCover(c.year,c.month,c.colors)] },
  futureLog:  { label:'Future Log',         expand:(c)=>mkFutureLog(c.year,c.month,c.colors) },
  monthly:    { label:'Monthly',            expand:(c)=>monthsOf(c).flatMap(mm=>mkCalendar(mm.year,mm.month,c.colors)) },
  habit:      { label:'Habit tracker',      expand:(c)=>monthsOf(c).map(mm=>mkHabitMap(mm.year,mm.month,c.colors)) },
  masterlist: { label:'Master Action List', expand:(c)=>monthsOf(c).map(mm=>mkMonthBrainDump(mm.year,mm.month,c.colors)) },
  reflection: { label:'Reflection',         expand:(c)=>monthsOf(c).map(mm=>mkReflection(mm.year,mm.month,c.colors)) },
  daily:      { label:'Daily',              expand:(c)=>monthsOf(c).flatMap(mm=>{
                 const out=[]; const dim=new Date(mm.year,mm.month+1,0).getDate();
                 for(let d=1;d<=dim;d++) out.push(c.timeblock?mkTimeBlockDay(mm.year,mm.month,d,c.colors):mkDay(mm.year,mm.month,d,c.colors));
                 return out; }) },
  plain:      { label:'Plain',              expand:(c)=>[mkPlain(c.year,c.month,c.colors)] },
  notes:      { label:'Notes',              expand:(c)=>{ const n=c.count||1; const out=[]; for(let i=0;i<n;i++) out.push(mkMonthNotes(c.year,c.month,c.colors)); return out; } }
};

// Expand a whole collection into a flat page array.
function bookletPages(list, ctx){
  return list.flatMap(function(entry){
    const type=PAGE_TYPES[entry.type];
    if(!type) return [];
    return type.expand(Object.assign({}, ctx, entry.config||{}));
  });
}
```

- [ ] **Step 2: Load greeter.js in the browser**

In `tn-weekly-planner/weekly.html`, find:

```html
<script src="weekly.js"></script>
```
and add immediately after it:

```html
<script src="greeter.js"></script>
```

- [ ] **Step 3: Browser check — registry expands correctly**

Load `http://localhost:5701/weekly.html` (reload), open the console and run:

```js
(() => {
  const ctx = { year: 2026, month: 0, monthCount: 1, colors: getColors() };
  return {
    daily: PAGE_TYPES.daily.expand(ctx).length,          // 31
    futureLog: PAGE_TYPES.futureLog.expand(ctx).length,  // >=1
    masterlist: PAGE_TYPES.masterlist.expand(ctx).length,// 1
    cover: PAGE_TYPES.cover.expand(ctx).length            // 1
  };
})();
```
Expected: `{daily:31, futureLog:>=1, masterlist:1, cover:1}`, no errors.

- [ ] **Step 4: Commit**

```bash
git add tn-weekly-planner/greeter.js tn-weekly-planner/weekly.html
git commit -m "feat: add page-type registry and bookletPages in greeter.js"
```

---

## Task 5: Prove a hand-built collection renders (temporary hook)

**Files:**
- Modify: `tn-weekly-planner/greeter.js` (add a temporary `renderBooklet` hook)

- [ ] **Step 1: Add the temporary render hook**

Append to `tn-weekly-planner/greeter.js`:

```js
// TEMPORARY (Plan 2b replaces this with the sidebar UI): render a collection.
function renderBooklet(list){
  const ctx={ year:parseInt($('sel-y').value), month:parseInt($('sel-m').value), monthCount:1, colors:getColors() };
  imposeAndRender(bookletPages(list, ctx));
}
```

- [ ] **Step 2: Browser check — collection → imposition**

Reload `http://localhost:5701/weekly.html`, open the console and run:

```js
renderBooklet([
  { id:'1', type:'cover', config:{}, pageCount:1 },
  { id:'2', type:'futureLog', config:{}, pageCount:4 },       // layout follows current global opts.flLayout (Plan 2b sets it per-entry)
  { id:'3', type:'daily', config:{timeblock:true}, pageCount:31 }, // config read directly from ctx — works in 2a
  { id:'4', type:'masterlist', config:{}, pageCount:1 },
  { id:'5', type:'reflection', config:{}, pageCount:1 }
]);
```
Expected: the preview shows a booklet of exactly those pages in that order (Cover → Future Log pages → 31 time-block daily pages → Master Action List → Reflection); switching to Book / Print Layout views works; page-count header updates; no console errors. This proves the collection feeds the same imposition pipeline as the legacy generator, and that `config` read directly from `ctx` (the `timeblock` daily flag) takes effect.

- [ ] **Step 3: Run the full test suite**

Run: `cd tn-weekly-planner && node --test`
Expected: PASS — 12 tests.

- [ ] **Step 4: Commit**

```bash
git add tn-weekly-planner/greeter.js
git commit -m "feat: temporary renderBooklet hook proving collection imposition"
```

---

## Definition of Done (Plan 2a)

- `node --test` passes (12): booklet ops + prior core.
- `imposeAndRender(pageEls)` renders any page-element array through the existing imposition; the legacy **Generate** is unchanged (verified in browser).
- `PAGE_TYPES` expands every listed type into the right pages; `bookletPages(list, ctx)` flattens a collection in order.
- A console-built collection renders as a booklet (temporary `renderBooklet`).

## Handoff to Plan 2b

Plan 2b adds the visible sidebar greeter: the size/date/page-type/guided panel, live single-page preview, **Add to booklet** (computing `pageCount` via `PAGE_TYPES[type].expand(ctx).length`), the booklet tray (reorder via `bookletMove`, remove via `bookletRemove`, total via `bookletTotalPages`), the **Generate/Print** button (calling `imposeAndRender(bookletPages(...))`), the **Show all tools** toggle, and persistence of the collection through `saveState`/`loadState`. It replaces the temporary `renderBooklet` hook.

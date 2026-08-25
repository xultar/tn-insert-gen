# Future Log Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a testable pure-logic core and a complete, WYSIWYG **Future Log** page type (stacked, column, and year-at-a-glance layouts) to the recreated TN planner, plus the Pocket and regular-A5 notebook sizes.

**Architecture:** Wrap the existing `weekly.js` engine (Approach A) — don't rewrite it. Pure, size/date math moves into a new buildless dual-mode module `core.js` (usable in both the browser as `window.TNCore` and in Node's `node --test`). New DOM builders (`mkMiniMonth`, `mkFutureLog`) live in `weekly.js` and consume the core; they render through the existing `pg()` helper so pages are sized in real millimetres (WYSIWYG). A temporary "Future Log" button drives a new `renderSinglePage()` preview so the feature is verifiable now; the greeter that replaces the button is Plan 2.

**Tech Stack:** Vanilla ES5-compatible browser JS (no framework, no build step), Node 24 built-in `node:test` + `node:assert` for unit tests, Lucide icons via CDN.

**Roadmap:** This is Plan 1 of 3. Plan 2 = greeter shell + tools toggle + Plain ruling step. Plan 3 = single/double/booklet output modes.

---

## File Structure

- Create: `tn-weekly-planner/core.js` — pure logic (notebook sizes incl. Pocket/A5, `futureLogBandCount`, `monthMatrix`, `paginateMonths`). Dual browser/Node export.
- Create: `tn-weekly-planner/package.json` — `npm test` → `node --test`.
- Create: `tn-weekly-planner/test/core.test.js` — unit tests for `core.js`.
- Modify: `tn-weekly-planner/weekly.js` — add Pocket/A5 to `TN_SIZES`; add `mkMiniMonth`, `mkFutureLog` (+ 3 layout helpers), `renderSinglePage`, `generateFutureLog`.
- Modify: `tn-weekly-planner/weekly.css` — styles for `.mini-month*`, `.fl-*`.
- Modify: `tn-weekly-planner/weekly.html` — load `core.js`; add Pocket/A5 `<option>`s; add temporary "Future Log" button.
- Modify: `tn-weekly-planner/index.html` — replace the duplicated copy with a redirect to `weekly.html` so only one page is maintained.

**Note on `index.html`:** It is currently a byte copy of `weekly.html`. Task 1 converts it to a redirect so later tasks only touch `weekly.html`.

---

## Task 1: Convert index.html to a redirect

**Files:**
- Modify: `tn-weekly-planner/index.html` (replace entire contents)

- [ ] **Step 1: Replace index.html with a redirect**

Overwrite the whole file with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=weekly.html">
<title>TN Planner</title>
</head>
<body>
<p>Redirecting to <a href="weekly.html">weekly.html</a>&hellip;</p>
</body>
</html>
```

- [ ] **Step 2: Verify the redirect**

Run: `python -m http.server 5599 --directory tn-weekly-planner` (if not already running via the `tn-weekly-planner` launch config), then load `http://localhost:5599/` — it must land on the planner UI (the purple sidebar).
Expected: the app loads exactly as before; the URL settles on `weekly.html`.

- [ ] **Step 3: Commit**

```bash
git add tn-weekly-planner/index.html
git commit -m "refactor: make index.html redirect to weekly.html"
```

---

## Task 2: Test harness + notebook sizes + band count

**Files:**
- Create: `tn-weekly-planner/package.json`
- Create: `tn-weekly-planner/core.js`
- Create: `tn-weekly-planner/test/core.test.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "tn-planner",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tn-weekly-planner/test/core.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../core.js');

test('NOTEBOOK_SIZES includes Pocket and regular A5 with correct mm', () => {
  assert.deepStrictEqual(core.NOTEBOOK_SIZES.pocket, { label: 'Pocket (3.5×5.5")', w: 89, h: 140 });
  assert.deepStrictEqual(core.NOTEBOOK_SIZES.a5, { label: 'A5', w: 148, h: 210 });
});

test('futureLogBandCount: short pages get 2 bands, tall pages get 3', () => {
  assert.strictEqual(core.futureLogBandCount(124), 2); // passport
  assert.strictEqual(core.futureLogBandCount(140), 2); // pocket
  assert.strictEqual(core.futureLogBandCount(149), 2);
  assert.strictEqual(core.futureLogBandCount(150), 3);
  assert.strictEqual(core.futureLogBandCount(171), 3); // personal
  assert.strictEqual(core.futureLogBandCount(210), 3); // regular / a5
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd tn-weekly-planner && node --test`
Expected: FAIL — `Cannot find module '../core.js'`.

- [ ] **Step 4: Create core.js with the minimal implementation**

Create `tn-weekly-planner/core.js`:

```js
'use strict';
(function (root) {
  var NOTEBOOK_SIZES = {
    pocket:   { label: 'Pocket (3.5×5.5")', w: 89,  h: 140 },
    passport: { label: 'Passport',          w: 89,  h: 124 },
    b6slim:   { label: 'B6 Slim',           w: 91,  h: 182 },
    personal: { label: 'Personal',          w: 95,  h: 171 },
    a5slim:   { label: 'A5 Slim',           w: 105, h: 210 },
    regular:  { label: 'Regular',           w: 110, h: 210 },
    a5:       { label: 'A5',                 w: 148, h: 210 }
  };

  // Bands (months) per Future Log page, derived from page height in mm.
  function futureLogBandCount(heightMm) {
    return heightMm < 150 ? 2 : 3;
  }

  var api = {
    NOTEBOOK_SIZES: NOTEBOOK_SIZES,
    futureLogBandCount: futureLogBandCount
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TNCore = api;
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd tn-weekly-planner && node --test`
Expected: PASS — 2 tests passing.

- [ ] **Step 6: Commit**

```bash
git add tn-weekly-planner/package.json tn-weekly-planner/core.js tn-weekly-planner/test/core.test.js
git commit -m "feat: add core.js with notebook sizes and future-log band count"
```

---

## Task 3: monthMatrix (pure calendar grid)

**Files:**
- Modify: `tn-weekly-planner/core.js`
- Modify: `tn-weekly-planner/test/core.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tn-weekly-planner/test/core.test.js`:

```js
test('monthMatrix: Jan 2026, Monday start, has 3 leading blanks', () => {
  // 2026-01-01 is a Thursday (getDay() === 4)
  const weeks = core.monthMatrix(2026, 0, 'monday');
  assert.deepStrictEqual(weeks[0], [null, null, null, 1, 2, 3, 4]);
  assert.strictEqual(weeks.length, 5);
  assert.strictEqual(weeks[weeks.length - 1].includes(31), true);
});

test('monthMatrix: Jan 2026, Sunday start, has 4 leading blanks', () => {
  const weeks = core.monthMatrix(2026, 0, 'sunday');
  assert.deepStrictEqual(weeks[0], [null, null, null, null, 1, 2, 3]);
});

test('monthMatrix: Feb 2026 (28 days, non-leap) Monday start', () => {
  // 2026-02-01 is a Sunday (getDay() === 0)
  const weeks = core.monthMatrix(2026, 1, 'monday');
  assert.deepStrictEqual(weeks[0], [null, null, null, null, null, null, 1]);
  const flat = weeks.flat().filter((d) => d !== null);
  assert.strictEqual(flat.length, 28);
  assert.strictEqual(weeks.flat().length % 7, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tn-weekly-planner && node --test`
Expected: FAIL — `core.monthMatrix is not a function`.

- [ ] **Step 3: Add monthMatrix to core.js**

In `tn-weekly-planner/core.js`, add this function immediately after `futureLogBandCount`:

```js
  // Weeks-of-a-month matrix. Blanks are null. weekStart: 'monday' | 'sunday'.
  function monthMatrix(year, monthIndex, weekStart) {
    var startOffset = weekStart === 'sunday' ? 0 : 1;
    var firstDay = new Date(year, monthIndex, 1).getDay(); // 0 = Sunday
    var offset = (firstDay - startOffset + 7) % 7;
    var totalDays = new Date(year, monthIndex + 1, 0).getDate();
    var flat = [];
    var i;
    for (i = 0; i < offset; i++) flat.push(null);
    for (var d = 1; d <= totalDays; d++) flat.push(d);
    while (flat.length % 7 !== 0) flat.push(null);
    var weeks = [];
    for (i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
    return weeks;
  }
```

And add `monthMatrix: monthMatrix,` to the `api` object:

```js
  var api = {
    NOTEBOOK_SIZES: NOTEBOOK_SIZES,
    futureLogBandCount: futureLogBandCount,
    monthMatrix: monthMatrix
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tn-weekly-planner && node --test`
Expected: PASS — all 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add tn-weekly-planner/core.js tn-weekly-planner/test/core.test.js
git commit -m "feat: add monthMatrix to core.js"
```

---

## Task 4: paginateMonths (spread a date range across pages)

**Files:**
- Modify: `tn-weekly-planner/core.js`
- Modify: `tn-weekly-planner/test/core.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tn-weekly-planner/test/core.test.js`:

```js
test('paginateMonths: 12 months from Jan 2026, 3 per page', () => {
  const pages = core.paginateMonths(2026, 0, 12, 3);
  assert.strictEqual(pages.length, 4);
  assert.deepStrictEqual(pages[0], [
    { year: 2026, month: 0 }, { year: 2026, month: 1 }, { year: 2026, month: 2 }
  ]);
  assert.deepStrictEqual(pages[3], [
    { year: 2026, month: 9 }, { year: 2026, month: 10 }, { year: 2026, month: 11 }
  ]);
});

test('paginateMonths: rolls over the year boundary', () => {
  const pages = core.paginateMonths(2026, 10, 4, 2); // Nov26, Dec26, Jan27, Feb27
  assert.deepStrictEqual(pages, [
    [{ year: 2026, month: 10 }, { year: 2026, month: 11 }],
    [{ year: 2027, month: 0 }, { year: 2027, month: 1 }]
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tn-weekly-planner && node --test`
Expected: FAIL — `core.paginateMonths is not a function`.

- [ ] **Step 3: Add paginateMonths to core.js**

In `tn-weekly-planner/core.js`, add after `monthMatrix`:

```js
  // Expand a start month + count into pages of {year, month}, perPage each.
  function paginateMonths(startYear, startMonth, count, perPage) {
    var months = [];
    for (var i = 0; i < count; i++) {
      var idx = startMonth + i;
      months.push({ year: startYear + Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 });
    }
    var pages = [];
    for (var p = 0; p < months.length; p += perPage) pages.push(months.slice(p, p + perPage));
    return pages;
  }
```

And add `paginateMonths: paginateMonths` to the `api` object:

```js
  var api = {
    NOTEBOOK_SIZES: NOTEBOOK_SIZES,
    futureLogBandCount: futureLogBandCount,
    monthMatrix: monthMatrix,
    paginateMonths: paginateMonths
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tn-weekly-planner && node --test`
Expected: PASS — all 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add tn-weekly-planner/core.js tn-weekly-planner/test/core.test.js
git commit -m "feat: add paginateMonths to core.js"
```

---

## Task 5: Wire core.js into the browser + add Pocket and A5 sizes

**Files:**
- Modify: `tn-weekly-planner/weekly.js:141-147` (`TN_SIZES`)
- Modify: `tn-weekly-planner/weekly.html:590-599` (paper/notebook select) and the `<head>` script tags

- [ ] **Step 1: Add Pocket and A5 to TN_SIZES**

In `tn-weekly-planner/weekly.js`, replace the `TN_SIZES` block (lines 141-147):

```js
const TN_SIZES = {
  'passport':  { label:'Passport',    w:89,  h:124 },
  'b6slim':    { label:'B6 Slim',     w:91,  h:182 },
  'personal':  { label:'Personal',    w:95,  h:171 },
  'a5slim':    { label:'A5 Slim',     w:105, h:210 },
  'regular':   { label:'Regular',     w:110, h:210 },
};
```

with:

```js
const TN_SIZES = {
  'pocket':    { label:'Pocket',      w:89,  h:140 },
  'passport':  { label:'Passport',    w:89,  h:124 },
  'b6slim':    { label:'B6 Slim',     w:91,  h:182 },
  'personal':  { label:'Personal',    w:95,  h:171 },
  'a5slim':    { label:'A5 Slim',     w:105, h:210 },
  'regular':   { label:'Regular',     w:110, h:210 },
  'a5':        { label:'A5',          w:148, h:210 },
};
```

- [ ] **Step 2: Load core.js before weekly.js**

In `tn-weekly-planner/weekly.html`, find (line 8):

```html
<link rel="stylesheet" href="weekly.css">
```

and immediately after it add:

```html
<script src="core.js"></script>
```

(This loads `core.js` synchronously in `<head>`, so `TNCore` exists before `weekly.js` runs at the bottom of `<body>`.)

- [ ] **Step 3: Add the two notebook `<option>`s**

In `tn-weekly-planner/weekly.html`, in the `#opt-tnsize` select, replace the passport line:

```html
              <option value="passport">Passport (89&#215;124mm)</option>
```

with:

```html
              <option value="pocket">Pocket (89&#215;140mm)</option>
              <option value="passport">Passport (89&#215;124mm)</option>
```

and replace the regular line:

```html
              <option value="regular">Regular (110&#215;210mm)</option>
```

with:

```html
              <option value="regular">Regular (110&#215;210mm)</option>
              <option value="a5">A5 (148&#215;210mm)</option>
```

- [ ] **Step 4: Verify in the browser**

Load `http://localhost:5599/weekly.html`, open DevTools console, and confirm:
- `TNCore.NOTEBOOK_SIZES.pocket` returns `{label:'Pocket (3.5×5.5")', w:89, h:140}`.
- The **Notebook size** dropdown (under "Notebook & Print") now lists **Pocket** and **A5**.
- Selecting **A5** and clicking **↻ Generate** produces visibly wider pages.

Expected: all three hold; no console errors.

- [ ] **Step 5: Commit**

```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.html
git commit -m "feat: load core.js in browser and add Pocket + A5 notebook sizes"
```

---

## Task 6: mkMiniMonth DOM builder

**Files:**
- Modify: `tn-weekly-planner/weekly.js` (add function after `mkCalendarGrid`, near line 2237)
- Modify: `tn-weekly-planner/weekly.css` (append mini-month styles)

- [ ] **Step 1: Add the mkMiniMonth function**

In `tn-weekly-planner/weekly.js`, add immediately after the `mkCalendarGrid` function (after its closing brace at line 2237):

```js
function mkMiniMonth(y, m, c){
  const colors = c || getColors();
  const wrap = el('div','mini-month');
  const cap = el('div','mini-month-cap', MONTHS[m]);
  cap.style.color = getElemColor('sectionHdr', colors.dim);
  wrap.appendChild(cap);
  const grid = el('div','mini-month-grid');
  getWdayLabels().forEach(lbl=>{
    const h = el('div','mini-month-dow', lbl.charAt(0));
    h.style.color = colors.dot;
    grid.appendChild(h);
  });
  TNCore.monthMatrix(y, m, opts.weekstart).forEach(week=>{
    week.forEach(d=>{
      const cell = el('div','mini-month-day', d==null ? '' : String(d));
      cell.style.color = colors.ink;
      grid.appendChild(cell);
    });
  });
  wrap.appendChild(grid);
  return wrap;
}
```

- [ ] **Step 2: Add mini-month styles**

Append to `tn-weekly-planner/weekly.css`:

```css
/* ── FUTURE LOG: mini-month ─────────────── */
.mini-month{display:flex;flex-direction:column;}
.mini-month-cap{font-size:5pt;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:.4mm;}
.mini-month-grid{display:grid;grid-template-columns:repeat(7,1fr);column-gap:.2mm;row-gap:.1mm;}
.mini-month-dow{font-size:3pt;text-align:center;font-weight:600;opacity:.8;}
.mini-month-day{font-size:3.6pt;text-align:center;line-height:1.3;}
```

- [ ] **Step 3: Visual verification (temporary console render)**

Load `http://localhost:5599/weekly.html`, open the console and run:

```js
(() => {
  const p = pg('probe'); p.style.padding='4mm';
  p.appendChild(mkMiniMonth(2026, 0, getColors()));
  const prev = document.getElementById('page-preview');
  prev.innerHTML=''; prev.appendChild(p); setView('pages');
})();
```

Expected: a real notebook-sized page appears showing a **compact** January 2026 calendar — weekday header row, `1` under Thursday (Monday-start default), dates `1`–`31`, no console errors. The calendar should look small relative to the page (Hobonichi-mini), confirming the writing-space-first proportion.

- [ ] **Step 4: Commit**

```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.css
git commit -m "feat: add mkMiniMonth compact calendar builder"
```

---

## Task 7: renderSinglePage + Future Log (stacked) + temporary button

**Files:**
- Modify: `tn-weekly-planner/weekly.js` (add `renderSinglePage`, `mkFutureLog`, `mkFutureLogStacked`, `generateFutureLog` after `mkMiniMonth`)
- Modify: `tn-weekly-planner/weekly.css` (append `.fl-*` styles)
- Modify: `tn-weekly-planner/weekly.html:644-650` (add temporary button)

- [ ] **Step 1: Add renderSinglePage and the stacked Future Log**

In `tn-weekly-planner/weekly.js`, add after `mkMiniMonth`:

```js
function renderSinglePage(pageEls){
  const els = Array.isArray(pageEls) ? pageEls : [pageEls];
  const prev = $('page-preview');
  prev.innerHTML = '';
  els.forEach(e=>{
    e.style.boxShadow = '2px 3px 10px rgba(0,0,0,.18)';
    prev.appendChild(e);
  });
  lucide.createIcons();
  setView('pages');
  $('pg-count').textContent = els.length;
}

function mkFutureLog(y, m, c){
  const colors = c || getColors();
  const layout = opts.flLayout || 'stacked';
  if(layout === 'columns') return mkFutureLogColumns(y, m, colors);
  if(layout === 'year')    return mkFutureLogYear(y, m, colors);
  return mkFutureLogStacked(y, m, colors);
}

function mkFutureLogStacked(y, m, colors){
  const sz = tnSize();
  const perPage = opts.flPerPage || TNCore.futureLogBandCount(sz.h);
  const count = opts.flMonthCount || 12;
  return TNCore.paginateMonths(y, m, count, perPage).map(monthsOnPage=>{
    const p = pg('future-log', colors);
    p.classList.add('fl-stacked');
    monthsOnPage.forEach(mm=>{
      const band = el('div','fl-band');
      band.style.borderColor = colors.line;
      band.appendChild(mkMiniMonth(mm.year, mm.month, colors));
      const events = el('div','fl-events');
      const lbl = el('div','fl-events-lbl', MONTHS[mm.month] + ' ' + mm.year);
      lbl.style.color = colors.dim;
      events.appendChild(lbl);
      for(let i=0;i<5;i++){
        const ln = el('div','fl-line');
        ln.style.borderColor = colors.line;
        events.appendChild(ln);
      }
      band.appendChild(events);
      p.appendChild(band);
    });
    return p;
  });
}

function generateFutureLog(){
  saveState();
  const m = parseInt($('sel-m').value);
  const y = parseInt($('sel-y').value);
  renderSinglePage(mkFutureLog(y, m, getColors()));
}
```

- [ ] **Step 2: Add Future Log stacked styles**

Append to `tn-weekly-planner/weekly.css`:

```css
/* ── FUTURE LOG: stacked ────────────────── */
.pg.fl-stacked{display:flex;flex-direction:column;gap:2mm;}
.fl-band{flex:1;display:flex;gap:2.5mm;border-bottom:.3pt solid;padding-bottom:1.5mm;}
.fl-band:last-child{border-bottom:none;padding-bottom:0;}
.fl-band .mini-month{flex:0 0 34%;}
.fl-events{flex:1;display:flex;flex-direction:column;justify-content:center;}
.fl-events-lbl{font-size:4pt;text-transform:uppercase;letter-spacing:.05em;margin-bottom:1mm;}
.fl-line{border-bottom:.3pt solid;height:0;margin:1.6mm 0;}
```

- [ ] **Step 3: Add the temporary Future Log button**

In `tn-weekly-planner/weekly.html`, find the Actions block (line 645):

```html
      <button class="btn btn-p" onclick="generate()">&#8635; Generate</button>
```

and add immediately after it:

```html
      <button class="btn btn-s" onclick="generateFutureLog()">&#9635; Future Log (preview)</button>
```

- [ ] **Step 4: Visual verification (WYSIWYG)**

Load `http://localhost:5599/weekly.html`:
1. Set **Month/Year** to January 2026.
2. Under **Notebook & Print**, set notebook size to **Regular**, click **▣ Future Log (preview)**.
   Expected: **4 pages**, each with **3 month bands**; each band = compact mini-month on the left (~1/3 width) and 5 ruled event lines on the right; months run Jan→Dec.
3. Change notebook size to **Passport**, click the button again.
   Expected: pages now show **2 bands each** (6 pages), confirming size-adaptive band count.

No console errors in either case.

- [ ] **Step 5: Commit**

```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.css tn-weekly-planner/weekly.html
git commit -m "feat: add renderSinglePage and stacked Future Log with size-adaptive bands"
```

---

## Task 8: Future Log — column-spread layout

**Files:**
- Modify: `tn-weekly-planner/weekly.js` (add `mkFutureLogColumns` after `mkFutureLogStacked`)
- Modify: `tn-weekly-planner/weekly.css` (append `.fl-columns` styles)

- [ ] **Step 1: Add mkFutureLogColumns**

In `tn-weekly-planner/weekly.js`, add after `mkFutureLogStacked`:

```js
function mkFutureLogColumns(y, m, colors){
  const perPage = opts.flColsPerPage || 3;
  const count = opts.flMonthCount || 12;
  return TNCore.paginateMonths(y, m, count, perPage).map(monthsOnPage=>{
    const p = pg('future-log', colors);
    p.classList.add('fl-columns');
    monthsOnPage.forEach(mm=>{
      const col = el('div','fl-col');
      col.style.borderColor = colors.line;
      col.appendChild(mkMiniMonth(mm.year, mm.month, colors));
      const lines = el('div','fl-col-lines');
      for(let i=0;i<8;i++){
        const ln = el('div','fl-line');
        ln.style.borderColor = colors.line;
        lines.appendChild(ln);
      }
      col.appendChild(lines);
      p.appendChild(col);
    });
    return p;
  });
}
```

- [ ] **Step 2: Add column styles**

Append to `tn-weekly-planner/weekly.css`:

```css
/* ── FUTURE LOG: columns ────────────────── */
.pg.fl-columns{display:flex;gap:2mm;}
.fl-col{flex:1;display:flex;flex-direction:column;border-right:.3pt solid;padding-right:1.5mm;}
.fl-col:last-child{border-right:none;padding-right:0;}
.fl-col-lines{flex:1;display:flex;flex-direction:column;margin-top:1.5mm;}
```

- [ ] **Step 3: Visual verification**

Load `http://localhost:5599/weekly.html`, open the console and run:

```js
opts.flLayout = 'columns'; generateFutureLog(); opts.flLayout = 'stacked';
```

Expected: pages with **3 vertical columns**, each a mini-month on top and ~8 ruled lines below, separated by thin vertical rules; 12 months → 4 pages. No console errors.

- [ ] **Step 4: Commit**

```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.css
git commit -m "feat: add Future Log column-spread layout"
```

---

## Task 9: Future Log — year-at-a-glance grid

**Files:**
- Modify: `tn-weekly-planner/weekly.js` (add `mkFutureLogYear` after `mkFutureLogColumns`)
- Modify: `tn-weekly-planner/weekly.css` (append `.fl-year` styles)

- [ ] **Step 1: Add mkFutureLogYear**

In `tn-weekly-planner/weekly.js`, add after `mkFutureLogColumns`:

```js
function mkFutureLogYear(y, m, colors){
  const count = opts.flMonthCount || 12;
  const months = [];
  for(let i=0;i<count;i++){
    const idx = m + i;
    months.push({ year: y + Math.floor(idx/12), month: ((idx%12)+12)%12 });
  }
  const p = pg('future-log', colors);
  p.classList.add('fl-year');
  const hdr = el('div','sh', 'Future Log — ' + y);
  hdr.style.cssText = `color:${getElemColor('sectionHdr',colors.dim)};border-bottom:.3pt solid ${colors.line};background:${colors.page};`;
  p.appendChild(hdr);
  const grid = el('div','fl-year-grid');
  months.forEach(mm=>{
    const cell = el('div','fl-year-cell');
    cell.style.borderColor = colors.line;
    cell.appendChild(mkMiniMonth(mm.year, mm.month, colors));
    grid.appendChild(cell);
  });
  p.appendChild(grid);
  return [p];
}
```

- [ ] **Step 2: Add year-grid styles**

Append to `tn-weekly-planner/weekly.css`:

```css
/* ── FUTURE LOG: year-at-a-glance ───────── */
.pg.fl-year{display:flex;flex-direction:column;}
.fl-year-grid{flex:1;display:grid;grid-template-columns:repeat(2,1fr);gap:2mm;margin-top:1.5mm;}
.fl-year-cell{border:.3pt solid;border-radius:.5mm;padding:1mm;}
```

- [ ] **Step 3: Visual verification**

Load `http://localhost:5599/weekly.html`, open the console and run:

```js
opts.flLayout = 'year'; generateFutureLog(); opts.flLayout = 'stacked';
```

Expected: a **single page** with **12 mini-months in a 2-column grid** under a "Future Log — 2026" header; each cell is a compact calendar. No console errors.

- [ ] **Step 4: Run the full unit-test suite once more**

Run: `cd tn-weekly-planner && node --test`
Expected: PASS — all 7 core tests still green (no regressions).

- [ ] **Step 5: Commit**

```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.css
git commit -m "feat: add Future Log year-at-a-glance layout"
```

---

## Definition of Done (Plan 1)

- `node --test` passes (7 tests) covering sizes, band count, month matrix, pagination.
- The notebook-size dropdown offers Pocket and A5; selecting them changes real page dimensions.
- The temporary **Future Log (preview)** button renders all three layouts WYSIWYG at true notebook size, with band count adapting to the selected size and mini-months kept compact (writing space dominant).
- No regression to existing booklet generation (the original **↻ Generate** still works).

## Handoff to Plan 2

Plan 2 replaces the temporary button with the greeter shell (size → dates → page type → guided/tools), hides the tool wall behind a toggle, and adds the Plain ruling step. The `opts.flLayout` / `opts.flMonthCount` / `opts.flPerPage` keys used above become real controls there.

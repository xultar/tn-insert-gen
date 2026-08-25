# Per-Page Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. This feature is DOM glue in `weekly.js`/`weekly.html`; the 24 `node --test` cases cover `core.js` only and MUST stay 24 green (this feature adds none). Verify browser changes on a FRESH `python -m http.server` port each time (the preview caches JS/CSS aggressively; screenshots time out on this page — use `javascript_tool`/`read_page`). Run `cd tn-weekly-planner && node --test` after each task (must stay 24 green).

**Goal:** Give every page-producing config toggle a compact "Preview this page" button that renders just that page in isolation, independent of its include-toggle, via one shared helper.

**Architecture:** Add a generic `previewPage(key)` helper + a `PAGE_PREVIEWS` registry (key → builder thunk) to `weekly.js`, reusing the existing `renderSinglePage()`. Remove the one-off `generateFutureLog()` and route Future Log through the registry. Add 13 preview buttons across the page-producing sections; settings-only sections get none.

**Tech Stack:** Vanilla ES5-ish browser JS, no build. Spec: [2026-07-12-per-page-preview-design.md](../specs/2026-07-12-per-page-preview-design.md).

**Branch:** create `feature/per-page-preview` off `master`.

---

## File Structure

- Modify `tn-weekly-planner/weekly.js` — replace `generateFutureLog()` with `PAGE_PREVIEWS` + `previewPage(key)`.
- Modify `tn-weekly-planner/weekly.html` — rewire the Future Log button; add 12 more preview buttons (Cover & Extras ×4, Monthly ×6, Monthly Trackers ×1, Daily ×1).

## Button conventions (used throughout)

- **Inline (next to a page toggle):** icon-only, right-aligned.
  `<button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('KEY')" title="Preview this page">&#9635;</button>`
  Insert as the **last child of the toggle's `.toggle-row` div** (immediately before its closing `</div>`). Each row's label text is unique, so match on the full row.
- **Section-level (whole section body is one page — Future Log, Daily):** labeled.
  `<button class="btn btn-s btn-sm" style="margin-top:8px;" onclick="previewPage('KEY')" title="Preview this page">&#9635; Preview this page</button>`

---

## Task 1: Core mechanism + Future Log migration

**Files:** Modify `tn-weekly-planner/weekly.js`, `tn-weekly-planner/weekly.html`

- [ ] **Step 1: Add the registry + helper; remove `generateFutureLog`.** In `weekly.js`, replace the entire existing function:
```js
function generateFutureLog(){
  saveState();
  const m = parseInt($('sel-m').value);
  const y = parseInt($('sel-y').value);
  renderSinglePage(mkFutureLog(y, m, getColors()));
}
```
with:
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

- [ ] **Step 2: Rewire the Future Log button.** In `weekly.html`, replace:
```html
          <button class="btn btn-s btn-sm" style="margin-top:8px;" onclick="generateFutureLog()">&#9635; Preview this page</button>
```
with:
```html
          <button class="btn btn-s btn-sm" style="margin-top:8px;" onclick="previewPage('futurelog')" title="Preview this page">&#9635; Preview this page</button>
```

- [ ] **Step 3: Confirm `generateFutureLog` is fully gone.** Grep both files for `generateFutureLog` — expect ZERO matches. (Nothing else referenced it.)

- [ ] **Step 4: Verify (browser, FRESH port).** Start `python -m http.server 8420`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const out={};
  out.generateFutureLogGone = (typeof generateFutureLog==='undefined');
  out.helperExists = (typeof previewPage==='function');
  out.registryKeys = Object.keys(PAGE_PREVIEWS).length; // 13
  // Future Log preview still works via the new path
  previewPage('futurelog');
  out.futureLogPages = document.querySelectorAll('#page-preview [data-lbl="future-log"]').length; // >=1
  // a couple more keys resolve and render
  previewPage('cover');
  out.coverRendered = document.querySelectorAll('#page-preview [data-lbl="cover"]').length; // 1
  previewPage('goals');
  out.goalsRendered = document.querySelectorAll('#page-preview [data-lbl="goals"]').length; // 1
  previewPage('nope-bad-key'); // no-op, no throw
  return out;
})();
```
Expected: `generateFutureLogGone:true`, `helperExists:true`, `registryKeys:13`, `futureLogPages>=1`, `coverRendered:1`, `goalsRendered:1`, and no thrown error from the bad key. `read_console_messages {onlyErrors:true}` → none. `node --test` → 24. Stop the server.

- [ ] **Step 5: Commit.**
```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.html
git commit -m "feat(preview): add previewPage(key) registry; route Future Log through it"
```
(End every commit body in this plan with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.)

---

## Task 2: Preview buttons — Cover & Extras + Monthly

**Files:** Modify `tn-weekly-planner/weekly.html`

Add an inline preview button to each of these 10 page toggles. For each, replace the shown toggle row (or notes row) with the same markup plus the button before its closing `</div>`.

- [ ] **Step 1: Cover.** Replace:
```html
          <div class="toggle-row">
            <label class="toggle-sw"><input type="checkbox" id="opt-cover" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Cover page</span>
          </div>
```
with:
```html
          <div class="toggle-row">
            <label class="toggle-sw"><input type="checkbox" id="opt-cover" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Cover page</span>
            <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('cover')" title="Preview this page">&#9635;</button>
          </div>
```

- [ ] **Step 2: Back cover.** Replace:
```html
            <div class="toggle-row">
              <label class="toggle-sw"><input type="checkbox" id="opt-backcover" onchange="onOptionChange()"><span class="slider"></span></label>
              <span style="font-size:12px;">Back cover</span>
            </div>
```
with:
```html
            <div class="toggle-row">
              <label class="toggle-sw"><input type="checkbox" id="opt-backcover" onchange="onOptionChange()"><span class="slider"></span></label>
              <span style="font-size:12px;">Back cover</span>
              <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('backcover')" title="Preview this page">&#9635;</button>
            </div>
```

- [ ] **Step 3: Monthly calendar.** Replace:
```html
            <div class="toggle-row">
              <label class="toggle-sw"><input type="checkbox" id="opt-calendar" onchange="onOptionChange()"><span class="slider"></span></label>
              <span style="font-size:12px;">Monthly calendar</span>
            </div>
```
with:
```html
            <div class="toggle-row">
              <label class="toggle-sw"><input type="checkbox" id="opt-calendar" onchange="onOptionChange()"><span class="slider"></span></label>
              <span style="font-size:12px;">Monthly calendar</span>
              <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('calendar')" title="Preview this page">&#9635;</button>
            </div>
```

- [ ] **Step 4: Notes pages.** This is a `cfg-row` with a select, not a toggle-row. Replace:
```html
            <div class="cfg-row">
              <label>Notes pages</label>
              <select id="opt-notes" onchange="onOptionChange()">
                <option value="0">0</option>
                <option value="1" selected>1</option>
                <option value="2">2</option>
                <option value="4">4</option>
              </select>
            </div>
```
with:
```html
            <div class="cfg-row">
              <label>Notes pages</label>
              <select id="opt-notes" onchange="onOptionChange()">
                <option value="0">0</option>
                <option value="1" selected>1</option>
                <option value="2">2</option>
                <option value="4">4</option>
              </select>
              <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('notes')" title="Preview this page">&#9635;</button>
            </div>
```

- [ ] **Step 5: Goals page.** Replace:
```html
          <div class="toggle-row">
            <label class="toggle-sw"><input type="checkbox" id="opt-goalspage" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Goals page</span>
          </div>
```
with:
```html
          <div class="toggle-row">
            <label class="toggle-sw"><input type="checkbox" id="opt-goalspage" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Goals page</span>
            <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('goals')" title="Preview this page">&#9635;</button>
          </div>
```

- [ ] **Step 6: Master action list (brain dump).** Replace:
```html
          <div class="toggle-row" style="margin-top:4px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-braindump" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Master action list</span>
          </div>
```
with:
```html
          <div class="toggle-row" style="margin-top:4px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-braindump" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Master action list</span>
            <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('braindump')" title="Preview this page">&#9635;</button>
          </div>
```

- [ ] **Step 7: Circle habit tracker (habit map).** Replace:
```html
          <div class="toggle-row" style="margin-top:4px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-habitmap" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Circle habit tracker</span>
          </div>
```
with:
```html
          <div class="toggle-row" style="margin-top:4px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-habitmap" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Circle habit tracker</span>
            <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('habitmap')" title="Preview this page">&#9635;</button>
          </div>
```

- [ ] **Step 8: Mood calendar.** Replace:
```html
          <div class="toggle-row" style="margin-top:6px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-moodcal" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Mood calendar</span>
          </div>
```
with:
```html
          <div class="toggle-row" style="margin-top:6px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-moodcal" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Mood calendar</span>
            <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('moodcal')" title="Preview this page">&#9635;</button>
          </div>
```

- [ ] **Step 9: Expense tracker.** Replace:
```html
          <div class="toggle-row" style="margin-top:4px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-expenses" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Expense tracker</span>
          </div>
```
with:
```html
          <div class="toggle-row" style="margin-top:4px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-expenses" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Expense tracker</span>
            <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('expenses')" title="Preview this page">&#9635;</button>
          </div>
```

- [ ] **Step 10: Reflection page.** Replace:
```html
          <div class="toggle-row" style="margin-top:4px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-reflection" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Reflection page</span>
          </div>
```
with:
```html
          <div class="toggle-row" style="margin-top:4px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-reflection" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Reflection page</span>
            <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('reflection')" title="Preview this page">&#9635;</button>
          </div>
```

- [ ] **Step 11: Verify (browser, FRESH port).** Start `python -m http.server 8421`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const map={cover:'cover',backcover:'back-cover',calendar:'calendar',notes:'monthly-notes',
             goals:'goals',braindump:'braindump',habitmap:'habit-map',moodcal:'mood-cal',
             expenses:'expenses',reflection:'reflection'};
  const res={};
  for(const key in map){
    previewPage(key);
    const lbl=map[key];
    // calendar may render as a spread (calendar-spread-1); accept a startsWith match
    const n=[...document.querySelectorAll('#page-preview [data-lbl]')]
      .filter(p=>p.dataset.lbl===lbl || p.dataset.lbl.indexOf(lbl)===0).length;
    res[key]=n;
  }
  return res; // every value >= 1
})();
```
Expected: every key maps to `>=1`. Confirm each button is visible/right-aligned in its row via `read_page` on `#sec-extras` and `#sec-monthly` (10 buttons with title "Preview this page"). `read_console_messages {onlyErrors:true}` → none. `node --test` → 24. Stop the server.

- [ ] **Step 12: Commit.**
```bash
git add tn-weekly-planner/weekly.html
git commit -m "feat(preview): per-page preview buttons on Cover & Extras and Monthly toggles"
```

---

## Task 3: Preview buttons — Monthly Trackers + Daily

**Files:** Modify `tn-weekly-planner/weekly.html`

- [ ] **Step 1: Monthly Trackers (inline on the include toggle).** Replace:
```html
          <div class="toggle-row" style="margin-bottom:6px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-trackers" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Include trackers page</span>
          </div>
```
with:
```html
          <div class="toggle-row" style="margin-bottom:6px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-trackers" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Include trackers page</span>
            <button class="btn btn-s btn-sm" style="margin-left:auto;" onclick="previewPage('trackers')" title="Preview this page">&#9635;</button>
          </div>
```

- [ ] **Step 2: Daily (section-level button).** The Daily section (`#sec-daily`) body ends with the "Facing notes page" toggle-row. Replace:
```html
          <div class="toggle-row" style="margin-top:8px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-dailyfacingnotes" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Facing notes page (day left / notes right)</span>
          </div>
        </div>
```
with:
```html
          <div class="toggle-row" style="margin-top:8px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-dailyfacingnotes" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Facing notes page (day left / notes right)</span>
          </div>
          <button class="btn btn-s btn-sm" style="margin-top:8px;" onclick="previewPage('daily')" title="Preview this page">&#9635; Preview this page</button>
        </div>
```
(The `</div>` shown is the one closing `#sec-daily`'s `.cfg-sec`; the button becomes the last child of that `.cfg-sec`. Confirm by checking the button sits inside `#sec-daily` after editing.)

- [ ] **Step 3: Verify (browser, FRESH port).** Start `python -m http.server 8422`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const out={};
  // trackers: seed a metric so the page has content
  addTrackerPreset('sleep');
  previewPage('trackers');
  out.trackers = document.querySelectorAll('#page-preview [data-lbl="monthly-graphs"]').length; // 1

  // daily standard layout → a date-labelled page, no tb-page class
  opts.dailyLayout='standard'; previewPage('daily');
  const dStd=[...document.querySelectorAll('#page-preview [data-lbl]')];
  out.dailyStd = dStd.length; // >=1
  out.dailyStdNotTimeblock = dStd.every(p=>!p.classList.contains('tb-page')); // true

  // daily timeblock layout → tb-page class present
  opts.dailyLayout='timeblock'; previewPage('daily');
  out.dailyTb = [...document.querySelectorAll('#page-preview [data-lbl]')].some(p=>p.classList.contains('tb-page')); // true
  opts.dailyLayout='standard';
  return out;
})();
```
Expected: `trackers:1`, `dailyStd>=1`, `dailyStdNotTimeblock:true`, `dailyTb:true`. Confirm both buttons render via `read_page` on `#sec-graphs` and `#sec-daily`. `read_console_messages {onlyErrors:true}` → none. `node --test` → 24. Stop the server.

- [ ] **Step 4: Commit.**
```bash
git add tn-weekly-planner/weekly.html
git commit -m "feat(preview): per-page preview buttons on Monthly Trackers and Daily"
```

---

## Task 4: Cross-cutting verification

**Files:** none (verification; commit only if a fix was needed).

- [ ] **Step 1: Full 13-key sweep + toggle-off independence.** Start `python -m http.server 8423`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  // Turn EVERY include-toggle OFF to prove preview is independent of them.
  ['opt-cover','opt-backcover','opt-calendar','opt-goalspage','opt-braindump','opt-habitmap',
   'opt-moodcal','opt-expenses','opt-reflection','opt-trackers','opt-futurelog','opt-dailyfacingnotes']
    .forEach(id=>{ const e=document.getElementById(id); if(e){e.checked=false;} });
  if(document.getElementById('opt-notes')) document.getElementById('opt-notes').value='0';
  onOptionChange();
  if(graphMetrics.length===0) addTrackerPreset('sleep'); // give trackers content

  const labels={cover:'cover',backcover:'back-cover',calendar:'calendar',notes:'monthly-notes',
    futurelog:'future-log',goals:'goals',braindump:'braindump',habitmap:'habit-map',
    moodcal:'mood-cal',expenses:'expenses',reflection:'reflection',trackers:'monthly-graphs'};
  const results={}; let allOk=true;
  for(const key in labels){
    previewPage(key);
    const lbl=labels[key];
    const n=[...document.querySelectorAll('#page-preview [data-lbl]')]
      .filter(p=>p.dataset.lbl===lbl || p.dataset.lbl.indexOf(lbl)===0).length;
    results[key]=n; if(n<1) allOk=false;
  }
  // daily separately (dynamic date label)
  previewPage('daily');
  results.daily=[...document.querySelectorAll('#page-preview [data-lbl]')].length;
  if(results.daily<1) allOk=false;
  return {allOk, results};
})();
```
Expected: `allOk:true`, and every entry in `results` is `>=1` — proving all 13 previews work with their include-toggles OFF.

- [ ] **Step 2: Generate still correct (no leakage).** In `javascript_tool`: `generate();` then confirm the full document still renders and the view is coherent:
```js
(function(){ generate(); return {pages: document.querySelectorAll('#page-preview > *').length, pgCount: document.getElementById('pg-count').textContent}; })();
```
Expect `pages>=1` and `pgCount` matches — preview clicks left no residue that breaks a normal Generate.

- [ ] **Step 3: Regression.** `read_console_messages {onlyErrors:true}` clean across the above; `node --test` → 24. Stop the server.

- [ ] **Step 4:** No commit unless a defect fix was required.

---

## Definition of Done

- Every page-producing toggle (13 total) has a compact `&#9635;` Preview button that renders just that page via the shared `previewPage(key)` helper + `PAGE_PREVIEWS` registry, independent of its include-toggle.
- `generateFutureLog()` is removed; Future Log preview runs through `previewPage('futurelog')` with identical behavior.
- Settings-only sections (Month/Year, Holidays, Typography, Page Style, Habits, Notebook & Print) have no preview button.
- Daily preview honors `opts.dailyLayout` (standard vs time-block); trackers preview shows content when a metric exists.
- Browser-verified for all 13 pages incl. toggle-off; `generate()` unaffected; console clean; `node --test` 24 green.

## Handoff / follow-ups

- If a future page type is added, wiring its preview = one `PAGE_PREVIEWS` line + one button (the pattern this plan establishes).
- Icon-only inline buttons rely on the `title` tooltip for discoverability; a future pass could add a tiny "preview" affordance style if users miss them.

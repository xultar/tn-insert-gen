# Greeter Date Selector + Undated Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Month/Year selector to the greeter panel, and an "Undated" guided option that renders every dated page type with blank `Date:` / `Month:` write-in lines.

**Architecture:** The greeter gets mirror Month/Year inputs that write through to the wall's `sel-m`/`sel-y` (the existing single source of truth). Undated rides the existing guided-options mechanism: a chip per page type snapshotted onto booklet entries, applied via the opts save/restore in `grGenerate()`. Builders branch on `opts.undated`. Pure logic (blank month matrix, count clamping) goes in `core.js` where `node --test` can reach it.

**Tech Stack:** Vanilla JS (no build step), `node:test` for core.js, browser preview for visual verification.

**Spec:** `docs/superpowers/specs/2026-07-14-greeter-date-and-undated-pages-design.md`

Repo root for all paths below: `tn-weekly-planner/`.

---

### Task 1: core.js helpers (blankMonthMatrix, clampDailyCount)

**Files:**
- Modify: `core.js` (add two functions + export in the `api` object at the bottom)
- Test: `test/core.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/core.test.js`:

```js
test('blankMonthMatrix: 6 weeks of 7 nulls', () => {
  const weeks = core.blankMonthMatrix();
  assert.strictEqual(weeks.length, 6);
  weeks.forEach((w) => {
    assert.strictEqual(w.length, 7);
    assert.ok(w.every((d) => d === null));
  });
  // rows must be independent arrays (no shared reference)
  weeks[0][0] = 1;
  assert.strictEqual(weeks[1][0], null);
});

test('clampDailyCount: clamps to [1,93], defaults 31 on garbage', () => {
  assert.strictEqual(core.clampDailyCount(10), 10);
  assert.strictEqual(core.clampDailyCount('10'), 10);
  assert.strictEqual(core.clampDailyCount(0), 1);
  assert.strictEqual(core.clampDailyCount(-5), 1);
  assert.strictEqual(core.clampDailyCount(200), 93);
  assert.strictEqual(core.clampDailyCount(undefined), 31);
  assert.strictEqual(core.clampDailyCount('abc'), 31);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tn-weekly-planner && npm test`
Expected: 2 new FAILs — `core.blankMonthMatrix is not a function` (and same for `clampDailyCount`); all 24 existing tests still PASS.

- [ ] **Step 3: Implement in core.js**

Add above the `var api = {` block (same function style as the rest of the file):

```js
  // Undated pages: a full 6-week grid with no day numbers — the user writes
  // dates in by hand (31-day convention; extras get struck out).
  function blankMonthMatrix() {
    var weeks = [];
    for (var w = 0; w < 6; w++) {
      var row = [];
      for (var d = 0; d < 7; d++) row.push(null);
      weeks.push(row);
    }
    return weeks;
  }

  // Undated Daily generates a user-chosen number of pages. Garbage → 31
  // (a month's worth); otherwise clamp to [1, 93].
  function clampDailyCount(raw) {
    var n = parseInt(raw, 10);
    if (isNaN(n)) return 31;
    return Math.min(93, Math.max(1, n));
  }
```

Add to the `api` object (after `monthMatrix: monthMatrix,`):

```js
    blankMonthMatrix: blankMonthMatrix,
    clampDailyCount: clampDailyCount,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tn-weekly-planner && npm test`
Expected: all tests PASS (26 total).

- [ ] **Step 5: Commit**

```bash
git add core.js test/core.test.js
git commit -m "feat(core): blankMonthMatrix + clampDailyCount for undated pages"
```

---

### Task 2: Month/Year selector on the greeter

**Files:**
- Modify: `weekly.html` (greeter markup, ~line 23–27)
- Modify: `weekly.js:93` area (opts defaults — done here so one commit carries all new keys)
- Modify: `greeter.js` (`grSeedDate`, `grOnDateChange`, wire into `grToggleTools` + `initGreeter`)

- [ ] **Step 1: Add the inputs to weekly.html**

Replace lines 23–27 (`<label class="gr-lbl">Date range (from Month/Year above)</label>` through the closing `</div>` of that `gr-row`) with:

```html
  <label class="gr-lbl">Date range</label>
  <div class="gr-row">
    <select id="gr-m" aria-label="Month" onchange="grOnDateChange()">
      <option value="0">January</option><option value="1">February</option>
      <option value="2">March</option><option value="3">April</option>
      <option value="4">May</option><option value="5">June</option>
      <option value="6">July</option><option value="7">August</option>
      <option value="8">September</option><option value="9">October</option>
      <option value="10">November</option><option value="11">December</option>
    </select>
    <input id="gr-y" type="number" min="2020" max="2099" style="width:66px;" aria-label="Year" onchange="grOnDateChange()">
  </div>
  <div class="gr-row">
    <span style="font-size:11px;opacity:.7;">Months</span>
    <input id="gr-months" type="number" min="1" max="12" value="1" style="width:56px;" onchange="grOnMonthsChange()">
  </div>
```

- [ ] **Step 2: Add opts defaults in weekly.js**

In the `let opts = {` block (after `dailyFacingNotes: false,` at weekly.js:116) add:

```js
  undated: false,
  dailyCount: 31,
```

(`undated`/`dailyCount` are consumed in Tasks 3–6; adding them now keeps all new opts keys in one place.)

- [ ] **Step 3: Add sync handlers in greeter.js**

Below `grOnMonthsChange` (greeter.js:65) add:

```js
// The wall's sel-m/sel-y stay the single source of truth (grCtx reads them);
// the greeter inputs are a mirror synced both ways.
function grSeedDate(){
  $('gr-m').value=$('sel-m').value;
  $('gr-y').value=$('sel-y').value;
}
function grOnDateChange(){
  $('sel-m').value=$('gr-m').value;
  $('sel-y').value=$('gr-y').value;
  saveState(); grPreview();
}
```

In `grToggleTools`, change the else-branch line

```js
    grInitSize(); grRenderGuided(); grPreview();     // greeter ← opts
```

to

```js
    grInitSize(); grSeedDate(); grRenderGuided(); grPreview();  // greeter ← opts/wall
```

In `initGreeter`, change the last line before the closing brace

```js
  grInitSize(); grRenderTypes(); grRenderGuided(); grRenderTray(); grPreview();
```

to

```js
  grInitSize(); grSeedDate(); grRenderTypes(); grRenderGuided(); grRenderTray(); grPreview();
```

- [ ] **Step 4: Verify in the browser**

Open `weekly.html` (via the dev-server preview). Check:
- Greeter shows Month + Year populated with the wall's persisted values.
- Changing greeter month updates the page preview immediately.
- Toggle "Show all tools" → the wall's Month/Year match what was set in the greeter; change month there, come back → greeter mirrors it.

- [ ] **Step 5: Commit**

```bash
git add weekly.html weekly.js greeter.js
git commit -m "feat(greeter): month/year selector mirrored with wall inputs"
```

---

### Task 3: Guided renderer extension + Undated chips on page types

**Files:**
- Modify: `greeter.js` (`PAGE_TYPES`, `grRenderGuided`, `grEntryLabel`)

- [ ] **Step 1: Add the shared guided specs**

Above `const PAGE_TYPES = {` in greeter.js add:

```js
// Shared guided specs: every dated page type offers Undated; Daily also gets
// a page-count input that only shows when Undated is on.
const GR_UNDATED={opt:'undated',label:'Dating',choices:[[false,'Dated'],[true,'Undated']]};
const GR_DAILY_COUNT={opt:'dailyCount',label:'Pages',input:'number',min:1,max:93,showIf:(o)=>!!o.undated};
```

Then per type in `PAGE_TYPES`:
- `cover`: add `guided:[GR_UNDATED]`
- `futureLog`: append `GR_UNDATED` to its existing guided array
- `monthly`: add `guided:[GR_UNDATED]`
- `monthlog`: add `guided:[GR_UNDATED]`
- `habit`: add `guided:[GR_UNDATED]`
- `masterlist`: add `guided:[GR_UNDATED]`
- `reflection`: add `guided:[GR_UNDATED]`
- `notes`: add `guided:[GR_UNDATED]`
- `daily`: append `GR_UNDATED, GR_DAILY_COUNT` to its existing guided array
- `plain`: unchanged (no date).

- [ ] **Step 2: Extend grRenderGuided**

Replace the body of the `g.forEach(spec=>{ ... })` loop in `grRenderGuided` (greeter.js:106-124) with:

```js
  g.forEach(spec=>{
    if(spec.showIf && !spec.showIf(opts)) return;
    const lbl=document.createElement('div'); lbl.className='gr-lbl'; lbl.textContent=spec.label; box.appendChild(lbl);
    const row=document.createElement('div'); row.className='gr-opt';
    if(spec.input==='number'){
      const inp=document.createElement('input');
      inp.type='number'; inp.min=spec.min; inp.max=spec.max;
      inp.style.width='56px';
      inp.value=TNCore.clampDailyCount(opts[spec.opt]);
      inp.setAttribute('aria-label',spec.label);
      inp.onchange=()=>{ opts[spec.opt]=TNCore.clampDailyCount(inp.value); inp.value=opts[spec.opt]; grPreview(); };
      row.appendChild(inp);
    }else{
      spec.choices.forEach(([val,text])=>{
        const chip=document.createElement('div');
        chip.className='gr-chip'+(opts[spec.opt]===val?' on':'');
        chip.textContent=text;
        chip.setAttribute('role','button'); chip.tabIndex=0;
        chip.setAttribute('aria-pressed', opts[spec.opt]===val?'true':'false');
        chip.dataset.opt=spec.opt; chip.dataset.val=String(val);
        chip.onclick=()=>{ opts[spec.opt]=val; grRenderGuided(); grPreview();
          // re-render replaces this node; keep keyboard focus on the chosen chip
          const sel=$('gr-guided').querySelector('.gr-chip[data-opt="'+spec.opt+'"][data-val="'+String(val)+'"]');
          if(sel) sel.focus();
        };
        row.appendChild(chip);
      });
    }
    box.appendChild(row);
  });
```

(Only additions: the `showIf` guard at the top and the `spec.input==='number'` branch; the chip branch is unchanged.)

- [ ] **Step 3: Teach grEntryLabel about the new spec shapes**

In `grEntryLabel`, replace the `parts` mapping (greeter.js:173-178) with:

```js
  const parts=g.map(spec=>{
    if(spec.showIf && !spec.showIf(entry.config)) return null; // hidden option → not in label
    const v=entry.config[spec.opt];
    if(v===false || v==null || v==='') return null;         // skip off/unset (e.g. Facing notes Off)
    if(spec.input==='number') return spec.label+' '+v;      // e.g. "Pages 20"
    const choice=(spec.choices||[]).find(ch=>ch[0]===v);
    return choice?choice[1]:v;                              // display text, fallback to raw value
  }).filter(Boolean);
```

- [ ] **Step 4: Verify in the browser**

- Select Daily → chips show "Dating: Dated/Undated"; clicking Undated reveals the "Pages" number input; clicking Dated hides it.
- Every dated type shows the Dating chips; Plain does not.
- Add an Undated Daily with Pages=5 → tray label reads `Daily · Undated · Pages 5` (page count still wrong — expansion comes in Task 6; that's expected here).

- [ ] **Step 5: Commit**

```bash
git add greeter.js
git commit -m "feat(greeter): undated guided option + number-input guided specs"
```

---

### Task 4: Undated month-labeled builders (calendar, month log, habit, master list, reflection, notes, cover)

**Files:**
- Modify: `weekly.js` — `mkCalendar`, `mkCalendarGrid`, `mkMonthList`, `mkMonthListPage`, `mkHabitMap`, `mkMonthBrainDump`, `mkReflection`, `mkMonthNotes`, `mkCover`, plus one new helper

- [ ] **Step 1: Add the shared header helper**

Above `mkCalendarGrid` (weekly.js:2511) add:

```js
// Section-header content for month-labeled pages: "July 2026 — Suffix" when
// dated, or "Month: ______ — Suffix" (write-in rule) when opts.undated.
function monthTitleFrag(y,m,suffix,colors){
  const frag=document.createDocumentFragment();
  if(opts.undated){
    frag.appendChild(document.createTextNode('Month:'));
    const line=el('span','');
    line.style.cssText=`display:inline-block;width:20mm;margin-left:1.5mm;border-bottom:.3pt solid ${colors.dim};`;
    frag.appendChild(line);
    if(suffix) frag.appendChild(document.createTextNode(' — '+suffix));
  }else{
    frag.appendChild(document.createTextNode(`${MONTHS[m]} ${y}`+(suffix?` — ${suffix}`:'')));
  }
  return frag;
}
```

- [ ] **Step 2: Convert the simple headers**

Each site keeps its own `style.cssText`; only the text argument moves into the frag.

`mkMonthNotes` (weekly.js:2782): replace

```js
  const h=el('div','sh',`${MONTHS[m]} ${y} — Notes`);
```

with

```js
  const h=el('div','sh'); h.appendChild(monthTitleFrag(y,m,'Notes',colors));
```

`mkReflection` (weekly.js:2344): replace

```js
  const hdr=el('div','sh',`${MONTHS[m]} ${y} — Reflection`);
```

with

```js
  const hdr=el('div','sh'); hdr.appendChild(monthTitleFrag(y,m,'Reflection',colors));
```

`mkMonthBrainDump` (weekly.js:2367): replace

```js
  const hdr=el('div','sh',`${MONTHS[m]} ${y} — Master Action List`);
```

with

```js
  const hdr=el('div','sh'); hdr.appendChild(monthTitleFrag(y,m,'Master Action List',colors));
```

`mkHabitMap` (weekly.js:2026): replace

```js
  const hdr=el('div','sh',`${MONTHS[m]} ${y} — Circle Habit Tracker`);
```

with

```js
  const hdr=el('div','sh'); hdr.appendChild(monthTitleFrag(y,m,'Circle Habit Tracker',colors));
```

and change the days line (weekly.js:2020) from

```js
  const days=daysInMonth(y,m);
```

to

```js
  const days=opts.undated?31:daysInMonth(y,m);
```

`mkCover` (weekly.js:1766): change

```js
  const sub=`${MONTHS[m]} ${y}`;
```

to

```js
  const sub=opts.undated?'':`${MONTHS[m]} ${y}`;
```

then guard every subtitle append. In the custom-image branch wrap the two subtitle lines:

```js
  if(sub){
    const cs=el('div','cover-subtitle',sub);
    cs.style.cssText=`color:rgba(255,255,255,.8);position:relative;z-index:1;`;
    p.appendChild(cs);
  }
```

Do the same `if(sub){...}` wrap around the subtitle element in each `switch(opts.coverDesign)` case (`simple` → `ss`, `minimal` → `ms`, `banner` → `bs`, and any subtitle element in the remaining cases — search the function for `sub` usages and guard each).

- [ ] **Step 3: Undated calendar**

`mkCalendar` (weekly.js:2670): after `const colors=...` line add an undated branch before the dated math:

```js
  if(opts.undated){
    const allWeeks=TNCore.blankMonthMatrix();
    const p=pg('calendar',colors); p.classList.add('fcol');
    const hdr=el('div','sh'); hdr.appendChild(monthTitleFrag(y,m,'',colors));
    hdr.style.cssText=`color:${getElemColor('sectionHdr',colors.dim)};border-bottom:.3pt solid ${colors.line};background:${colors.page};`;
    p.appendChild(hdr);
    mkCalendarGrid(p,colors,getWdayLabels(),allWeeks);
    return [p];   // undated ignores calSpread: one fill-in grid page
  }
```

`mkCalendarGrid` (weekly.js:2511): make it undated-aware. Replace the first two lines of the function body with:

```js
  const undated=!!opts.undated;
  const y=parseInt($('sel-y').value),m=parseInt($('sel-m').value);
  const hmap=undated?{}:holidayMap(y,m);
```

and replace the inner cell loop `wk.forEach(d=>{ ... })` head with:

```js
    wk.forEach(d=>{
      if(undated){
        const cell=el('div','cal-cell');
        cell.style.borderColor=colors.line;
        cell.style.color=colors.ink;
        grid.appendChild(cell);
        return;
      }
      if(d===0){ grid.appendChild(el('div','cal-cell empty')); return; }
```

(rest of the dated cell code unchanged — blank matrix cells are `null`, so the undated branch must come first).

- [ ] **Step 4: Undated month log**

`mkMonthList` (weekly.js:2850): change

```js
  const dim=daysInMonth(y,m);
```

to

```js
  const dim=opts.undated?31:daysInMonth(y,m);
```

The title is passed as a string into `mkMonthListPage(headerText)`; switch it to the frag pattern. In `mkMonthList` replace

```js
  const title=`${MONTHS[m]} ${y}`;
```

with

```js
  const title=monthTitleFrag(y,m,'',colors);
```

and in `mkMonthListPage` (weekly.js:2819) replace the header block with:

```js
  if(headerText){
    const hdr=el('div','sh');
    hdr.appendChild(headerText);
    hdr.style.cssText=`text-align:center;color:${getElemColor('sectionHdr',colors.dim)};border-bottom:.3pt solid ${colors.line};`;
    p.appendChild(hdr);
  }
```

Note the second page of a 2-page month-log spread passes `''` as headerText (weekly.js:2868) — a DocumentFragment is truthy and `''` is falsy, so the `if(headerText)` guard still works for both.

In `mkMonthListPage`, the day rows (weekly.js:2827-2837): replace

```js
  days.forEach(d=>{
    const w=dow(y,m,d);
    const row=mkRow(w===0||w===6?'ml-weekend':'');
    const num=el('span','ml-num',String(d));
    num.style.color=colors.ink;
    const wd=el('span','ml-wd',WK[w]);
    wd.style.color=colors.dim;
    row.appendChild(num);
    row.appendChild(wd);
    labels.appendChild(row);
  });
```

with

```js
  days.forEach(d=>{
    // Undated: keep the 1–31 numbers but drop weekday letters + weekend
    // shading — both depend on knowing the actual month.
    const w=opts.undated?-1:dow(y,m,d);
    const row=mkRow(w===0||w===6?'ml-weekend':'');
    const num=el('span','ml-num',String(d));
    num.style.color=colors.ink;
    row.appendChild(num);
    if(w>=0){
      const wd=el('span','ml-wd',WK[w]);
      wd.style.color=colors.dim;
      row.appendChild(wd);
    }
    labels.appendChild(row);
  });
```

- [ ] **Step 5: Run tests + verify in the browser**

Run: `cd tn-weekly-planner && npm test` — all PASS (builders aren't node-tested; this catches core.js regressions).

In the greeter preview each type with Undated on:
- Calendar: `Month: ___` header, empty 6-row grid, weekday header intact, no holidays.
- Monthly Log: numbers 1–31, no weekday letters, no weekend shading, `Month: ___` centered title.
- Habit tracker: 31 day segments, `Month: ___ — Circle Habit Tracker` header.
- Master list / Reflection / Notes: `Month: ___ — <suffix>` headers.
- Cover: no month/year subtitle in every cover design (framed, simple, minimal, banner, custom image).
- Toggle back to Dated: everything renders exactly as before (compare with a dated July preview).

- [ ] **Step 6: Commit**

```bash
git add weekly.js
git commit -m "feat(pages): undated variants for month-labeled builders"
```

---

### Task 5: Undated Future Log

**Files:**
- Modify: `weekly.js` — `mkMiniMonth` (weekly.js:2544), `mkFutureLogYear` header (weekly.js:2630)

- [ ] **Step 1: Undated mini-month**

`mkMiniMonth` is the single building block for all three future-log layouts. Replace its caption + matrix lines:

```js
  const cap = el('div','mini-month-cap', MONTHS[m]);
  cap.style.color = getElemColor('sectionHdr', colors.dim);
```

with

```js
  const cap = el('div','mini-month-cap', opts.undated ? '' : MONTHS[m]);
  cap.style.color = getElemColor('sectionHdr', colors.dim);
  if(opts.undated){
    // blank write-in rule where the month name would print
    const line = el('span','');
    line.style.cssText = `display:inline-block;width:12mm;border-bottom:.3pt solid ${colors.dim};`;
    cap.appendChild(line);
  }
```

and

```js
  TNCore.monthMatrix(y, m, opts.weekstart).forEach(week=>{
```

with

```js
  (opts.undated ? TNCore.blankMonthMatrix() : TNCore.monthMatrix(y, m, opts.weekstart)).forEach(week=>{
```

(the cell renderer already prints `''` for `null` days — no change needed there).

- [ ] **Step 2: Undated year-grid header**

`mkFutureLogYear` (weekly.js:2630): replace

```js
  const hdr = el('div','sh', 'Future Log — ' + y);
```

with

```js
  const hdr = el('div','sh', opts.undated ? 'Future Log' : 'Future Log — ' + y);
```

- [ ] **Step 3: Verify in the browser**

Preview Future Log with Undated on, in all three layouts (Stacked / Column / Year grid): month captions become short write-in rules, grids show weekday initials over empty cells, year dropped from the year-grid header. Toggle Dated → unchanged from before.

- [ ] **Step 4: Commit**

```bash
git add weekly.js
git commit -m "feat(pages): undated future log (blank mini-month grids)"
```

---

### Task 6: Undated Daily (standard + time-block) and greeter expansion

**Files:**
- Modify: `weekly.js` — `mkDay` header (weekly.js:3022-3045), `mkTimeBlockDay` header (weekly.js:3184-3201)
- Modify: `greeter.js` — `PAGE_TYPES.daily.expand`

- [ ] **Step 1: Extract the undated daily header**

Both daily layouts share the same header structure. Above `mkDay` add:

```js
// Undated daily header: "Date:" + a write-in rule, replacing weekday name,
// day number, holidays and moon phase (all meaningless without a real date).
function mkUndatedDayHdr(colors){
  const hdr=el('div','d-hdr');
  hdr.style.cssText=`border-bottom:.3pt solid ${colors.line};`;
  const dowWrap=el('div','d-dow-wrap');
  const dowEl=el('span','d-dow','Date:');
  dowEl.style.color=getElemColor('dayName',colors.dim);
  dowWrap.appendChild(dowEl);
  const line=el('span','');
  line.style.cssText=`display:inline-block;width:24mm;margin-left:1.5mm;border-bottom:.3pt solid ${colors.dim};`;
  dowWrap.appendChild(line);
  hdr.appendChild(dowWrap);
  return hdr;
}
```

- [ ] **Step 2: Branch in mkDay**

In `mkDay`, wrap the header construction (weekly.js:3022 `const hdr=el('div','d-hdr');` through 3045 `p.appendChild(hdr);`) as:

```js
  if(opts.undated){
    p.appendChild(mkUndatedDayHdr(colors));
  }else{
    const hdr=el('div','d-hdr');
    // ... existing lines 3023–3044 unchanged ...
    p.appendChild(hdr);
  }
```

- [ ] **Step 3: Branch in mkTimeBlockDay**

Same wrap for weekly.js:3185-3201 (`const hdr=el('div','d-hdr');` through `p.appendChild(hdr);`):

```js
  if(opts.undated){
    p.appendChild(mkUndatedDayHdr(colors));
  }else{
    const hdr=el('div','d-hdr');
    // ... existing lines 3186–3200 unchanged ...
    p.appendChild(hdr);
  }
```

(`wdayIdx` above the header is still used by the habit-row filter in both layouts; leave it — undated pages just use the selected month's weekday, which is as good as any for "which habits print".)

- [ ] **Step 4: Undated expansion in the greeter**

In `PAGE_TYPES.daily` (greeter.js:29), replace the `expand` with:

```js
  daily:      { label:'Daily',              expand:(c)=>{
                 if(opts.undated){
                   // user-chosen count; Months multiplier does not apply
                   const n=TNCore.clampDailyCount(opts.dailyCount);
                   const out=[];
                   for(let i=0;i<n;i++){
                     const page=opts.dailyLayout==='timeblock'?mkTimeBlockDay(c.year,c.month,1,c.colors):mkDay(c.year,c.month,1,c.colors);
                     if(opts.dailyFacingNotes){ out.push(...facingPair(page,'',c.colors)); }
                     else out.push(page);
                   }
                   return out;
                 }
                 return monthsOf(c).flatMap(mm=>{
                   const out=[]; const dim=new Date(mm.year,mm.month+1,0).getDate();
                   for(let d=1;d<=dim;d++){
                     const page=opts.dailyLayout==='timeblock'?mkTimeBlockDay(mm.year,mm.month,d,c.colors):mkDay(mm.year,mm.month,d,c.colors);
                     if(opts.dailyFacingNotes){ out.push(...facingPair(page, DOW_ABB3[dow(mm.year,mm.month,d)]+' '+d, c.colors)); }
                     else out.push(page);
                   }
                   return out; });
                 },
```

(keep the existing `guided:` array from Task 3). `facingPair(page,'',...)` gives facing-notes pages with no date stamp — `mkFacingNotes` already skips a falsy label.

- [ ] **Step 5: Verify in the browser**

- Undated Daily, Pages=5 → tray shows `Daily · Undated · Pages 5` and `5p`; Generate → 5 identical pages with `Date: ___` headers, no weekday, no holiday, no moon.
- Undated + Time-block layout → same header treatment.
- Undated + Facing notes On, Pages=3 → 6 pages, facing pages have no date stamp.
- Dated Daily unchanged (spot-check July: 31 pages, weekday+number headers, holidays present).
- Mixed booklet: dated July daily + undated calendar + undated daily → each entry honors its own snapshot.

- [ ] **Step 6: Run the full test suite**

Run: `cd tn-weekly-planner && npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add weekly.js greeter.js
git commit -m "feat(daily): undated daily pages with user-chosen count"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full regression pass in the browser**

- Fresh load (clear localStorage via DevTools → Application if needed): greeter shows Month/Year; defaults sane.
- Build the mixed booklet from Task 6 Step 5, Generate booklet, then Print/PDF preview: undated pages print blank rules crisply; dated pages unchanged.
- Wall regression: toggle "Show all tools", render the weekly view — pages dated as normal (opts.undated is false unless a chip set it; if a leftover Undated chip state leaks into the wall, that matches existing guided-option behavior per spec).
- Reload the page: persisted booklet restores, tray labels correct, greeter Month/Year seeded from persisted wall values.

- [ ] **Step 2: Run tests one final time**

Run: `cd tn-weekly-planner && npm test`
Expected: all PASS.

- [ ] **Step 3: Update memory/docs if needed and finish**

Follow superpowers:finishing-a-development-branch (merge/PR decision is the user's).

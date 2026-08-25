# Daily Facing Notes Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Verify browser changes on a FRESH `python -m http.server` port each time (the preview caches JS/CSS aggressively). Run `cd tn-weekly-planner && node --test` after core-touching tasks (must stay green; this plan adds tests).

**Goal:** Add an optional "facing notes page" mode so that in a booklet every daily page becomes a left-hand page with a minimal, dated notes page facing it on the right — driven by one `opts.dailyFacingNotes` toggle honored by both the wall generator and the greeter.

**Architecture:** Every content page in a daily context is emitted as a `[content, facingNotes]` pair (uniform 2-page units). A single central pass at the top of `imposeAndRender` inserts one blank alignment page before any paired run that would otherwise start on a right slot, so each run's content lands on the left. The parity math is a pure, unit-tested function in `core.js`; everything else is DOM assembly in `weekly.js`/`greeter.js`.

**Tech Stack:** Vanilla ES5-ish browser JS, no build step; Node 24 `node:test` for the pure core logic. Spec: [2026-07-11-daily-facing-notes-design.md](../specs/2026-07-11-daily-facing-notes-design.md).

**Design decisions locked (from spec):**
- Facing page = current fill style, mostly blank, small date in a top corner (dateless for summary/reflection/alignment blanks).
- Scope = both wall `generate()` and greeter `daily` page-type; one global `opts.dailyFacingNotes` (default off).
- Uniform 2-page units: weekly summary + each day + weekly reflection all paired.
- One boundary alignment page per paired run when it would start on the right.
- Left/right convention (even index = left) must be **verified in the rendered book view**.

---

## File Structure

- Modify `tn-weekly-planner/core.js` — add pure `facingAlignInserts(roles)` + export.
- Modify `tn-weekly-planner/test/core.test.js` — add tests for `facingAlignInserts`.
- Modify `tn-weekly-planner/weekly.js` — add `mkFacingNotes`, `alignFacingRuns`, `pushDaily`; `dailyFacingNotes` opt default; hook into `imposeAndRender`; wall daily loop; wall toggle read/apply.
- Modify `tn-weekly-planner/weekly.html` — wall Daily-section toggle.
- Modify `tn-weekly-planner/greeter.js` — daily expand pairing; `daily` guided chip; `grEntryLabel` display-text fix.

---

## Task 1: Pure alignment logic in core.js (TDD)

**Files:**
- Modify: `tn-weekly-planner/core.js`
- Test: `tn-weekly-planner/test/core.test.js`

`facingAlignInserts(roles)` takes an array of role strings — `'content'` (a paired content page that must land on the left), `'facing'` (its facing page), `'other'` (any unpaired page) — and returns the ascending list of **original indices** before which a blank alignment page must be inserted. A "run" is a maximal contiguous block of `content`/`facing` pages; only a run's first page needs aligning (every unit is 2 pages, so the rest follow). The running `shift` accounts for blanks inserted by earlier runs.

- [ ] **Step 1: Write the failing tests.** Append to `tn-weekly-planner/test/core.test.js`:

```js
test('facingAlignInserts: no paired pages -> no inserts', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['other', 'other', 'other']), []);
});

test('facingAlignInserts: run starting at even index -> no insert', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['content', 'facing', 'content', 'facing']), []);
});

test('facingAlignInserts: run starting at odd index -> insert before it', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['other', 'content', 'facing']), [1]);
});

test('facingAlignInserts: two runs separated by other, shift accounted', () => {
  assert.deepStrictEqual(
    core.facingAlignInserts(['other', 'content', 'facing', 'other', 'content', 'facing']),
    [1, 4]
  );
});

test('facingAlignInserts: back-to-back pairs are a single run (no extra insert)', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['content', 'facing', 'content', 'facing']), []);
});

test('facingAlignInserts: even leading others keep the run on the left', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['other', 'other', 'content', 'facing']), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `cd tn-weekly-planner && node --test`
Expected: FAIL — `core.facingAlignInserts is not a function`.

- [ ] **Step 3: Implement `facingAlignInserts`.** In `core.js`, add this function just before the `var api = {` line:

```js
  function facingAlignInserts(roles) {
    var inserts = [];
    var shift = 0;
    for (var i = 0; i < roles.length; i++) {
      var isRunStart = roles[i] === 'content' && (i === 0 || roles[i - 1] === 'other');
      if (isRunStart && ((i + shift) % 2 === 1)) {
        inserts.push(i);
        shift++;
      }
    }
    return inserts;
  }
```

- [ ] **Step 4: Export it.** In the `var api = { ... }` object in `core.js`, add the entry (after `bookletTotalPages: bookletTotalPages`):

```js
    bookletTotalPages: bookletTotalPages,
    facingAlignInserts: facingAlignInserts
```

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `cd tn-weekly-planner && node --test`
Expected: PASS — all tests pass (12 prior + 6 new = 18).

- [ ] **Step 6: Commit.**

```bash
git add tn-weekly-planner/core.js tn-weekly-planner/test/core.test.js
git commit -m "feat(core): facingAlignInserts — pure parity logic for facing-page runs"
```

---

## Task 2: `mkFacingNotes` builder + `dailyFacingNotes` opt default

**Files:**
- Modify: `tn-weekly-planner/weekly.js`

- [ ] **Step 1: Add the `dailyFacingNotes` opt default.** In `weekly.js`, in the `opts` defaults object, the line `dailyLayout: 'standard',` is followed by `flLayout: 'stacked',`. Add a new line after `flLayout: 'stacked',`:

```js
  dailyFacingNotes: false,
```

- [ ] **Step 2: Add the `mkFacingNotes` builder.** In `weekly.js`, immediately after the `mkPlain` function (which ends with `return p;` / `}` around line 2538), add:

```js
function mkFacingNotes(dateLabel, c){
  const colors=c||getColors();
  const p=pg('facing-notes',colors);           // dataset.lbl='facing-notes' marks it for alignment
  p.style.cssText+=getFillStyle(colors);        // inherit the user's ruling
  if(dateLabel){
    const d=el('div','facing-date',dateLabel);
    d.style.cssText=`position:absolute;top:2mm;right:3mm;font-size:6pt;letter-spacing:.02em;color:${colors.dim};`;
    p.appendChild(d);
  }
  return p;
}
```

(`.pg` is already `position:relative`, so the corner date anchors correctly.)

- [ ] **Step 3: Verify (browser, fresh port).** Start `python -m http.server 8201` from `tn-weekly-planner`; open `http://localhost:8201/weekly.html`. In `mcp__Claude_Browser__javascript_tool`, run:

```js
(function(){
  const c = getColors();
  const withDate = mkFacingNotes('Wed 1', c);
  const blank = mkFacingNotes(null, c);
  return {
    withDate_lbl: withDate.dataset.lbl,                 // 'facing-notes'
    withDate_hasDate: !!withDate.querySelector('.facing-date'),  // true
    withDate_dateText: (withDate.querySelector('.facing-date')||{}).textContent, // 'Wed 1'
    blank_hasDate: !!blank.querySelector('.facing-date'),        // false
    isPg: withDate.classList.contains('pg')             // true
  };
})();
```

Expected: `{ withDate_lbl:'facing-notes', withDate_hasDate:true, withDate_dateText:'Wed 1', blank_hasDate:false, isPg:true }`. Check `read_console_messages {onlyErrors:true}` → none. Stop the server.

- [ ] **Step 4: Commit.**

```bash
git add tn-weekly-planner/weekly.js
git commit -m "feat(pages): mkFacingNotes builder + dailyFacingNotes opt default"
```

---

## Task 3: `alignFacingRuns` + hook into `imposeAndRender`

**Files:**
- Modify: `tn-weekly-planner/weekly.js`

This adds the central alignment pass. With no paired pages yet (Tasks 4–5 add them) it is a no-op, so the goal here is "wired in, zero regression."

- [ ] **Step 1: Add `alignFacingRuns`.** In `weekly.js`, immediately before the `function imposeAndRender(pageEls){` line, add:

```js
// Insert one blank page before any paired daily "run" that would start on a right
// slot, so every content page lands on the left with its facing page on the right.
function alignFacingRuns(els, colors){
  const roles = els.map(e=>{
    if(e.dataset && e.dataset.facingPair==='1') return 'content';
    if(e.dataset && e.dataset.lbl==='facing-notes') return 'facing';
    return 'other';
  });
  const inserts = TNCore.facingAlignInserts(roles);   // ascending original indices
  if(!inserts.length) return els;
  const out = els.slice();
  for(let k=inserts.length-1; k>=0; k--){              // splice high->low to keep indices valid
    out.splice(inserts[k], 0, mkFacingNotes(null, colors));
  }
  return out;
}
```

- [ ] **Step 2: Call it at the top of `imposeAndRender`.** In `weekly.js`, find the line `const els = pageEls;` inside `imposeAndRender` (around line 3099) and replace it with:

```js
  const els = alignFacingRuns(pageEls, getColors());
```

- [ ] **Step 3: Verify no regression (browser, fresh port).** Start `python -m http.server 8202`; open `weekly.html`. The default output must be unchanged (no paired pages exist yet, so `alignFacingRuns` returns the input array). In `javascript_tool`:

```js
(function(){
  opts.dailyLayout='standard';
  generate();
  return {
    previewPages: document.querySelectorAll('#page-preview > *').length, // unchanged from before
    anyFacing: document.querySelectorAll('#page-preview [data-lbl="facing-notes"]').length // 0
  };
})();
```

Expected: `anyFacing: 0`, and the preview renders normally. `read_console_messages {onlyErrors:true}` → none. Run `cd tn-weekly-planner && node --test` → 18 pass. Stop the server.

- [ ] **Step 4: Commit.**

```bash
git add tn-weekly-planner/weekly.js
git commit -m "feat(impose): alignFacingRuns pass wired into imposeAndRender (no-op until pairing)"
```

---

## Task 4: Wall daily pairing + wall UI toggle

**Files:**
- Modify: `tn-weekly-planner/weekly.js`, `tn-weekly-planner/weekly.html`

- [ ] **Step 1: Add the `pushDaily` helper.** In `weekly.js`, immediately before `function generate(){`, add:

```js
// Push a daily-context content page; when facing notes are on, mark it and add its
// facing page (dateLabel is the small corner date for day pages, null for summary/reflection).
function pushDaily(els, page, dateLabel, colors){
  if(opts.dailyFacingNotes){
    page.dataset.facingPair='1';
    els.push(page, mkFacingNotes(dateLabel, colors));
  }else{
    els.push(page);
  }
}
```

- [ ] **Step 2: Rewrite the daily loop in `generate()`.** In `weekly.js`, replace the existing block:

```js
  buildWeeks(y,m).forEach((wdays,wi)=>{
    els.push(mkWeekSummary(y,m,wi+1,wdays,colors));
    wdays.forEach(d=>{if(d>0)els.push(opts.dailyLayout==='timeblock'?mkTimeBlockDay(y,m,d,colors):mkDay(y,m,d,colors));});
    if(opts.weeklyReflection) els.push(mkWeekReflection(wi+1,colors));
  });
```

with:

```js
  buildWeeks(y,m).forEach((wdays,wi)=>{
    pushDaily(els, mkWeekSummary(y,m,wi+1,wdays,colors), null, colors);
    wdays.forEach(d=>{ if(d>0){
      const page = opts.dailyLayout==='timeblock'?mkTimeBlockDay(y,m,d,colors):mkDay(y,m,d,colors);
      pushDaily(els, page, DOW_ABB3[dow(y,m,d)]+' '+d, colors);
    }});
    if(opts.weeklyReflection) pushDaily(els, mkWeekReflection(wi+1,colors), null, colors);
  });
```

- [ ] **Step 3: Add the wall toggle markup.** In `weekly.html`, the Daily section has a weekly-reflection toggle-row ending at the `</div>` that closes `.coll-body`. Immediately AFTER this block:

```html
          <div class="toggle-row" style="margin-top:8px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-weekly-reflection" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Weekly reflection page</span>
          </div>
```

add:

```html
          <div class="toggle-row" style="margin-top:8px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-dailyfacingnotes" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Facing notes page (day left / notes right)</span>
          </div>
```

- [ ] **Step 4: Wire the toggle into applyOptsToUI/readOptsFromUI.** In `weekly.js` `applyOptsToUI`, after the line `$('opt-weekly-reflection').checked=opts.weeklyReflection;` add:

```js
  $('opt-dailyfacingnotes').checked=opts.dailyFacingNotes;
```

In `readOptsFromUI`, after the line `opts.weeklyReflection=$('opt-weekly-reflection').checked;` add:

```js
  opts.dailyFacingNotes=$('opt-dailyfacingnotes').checked;
```

- [ ] **Step 5: Verify (browser, fresh port).** Start `python -m http.server 8203`; open `weekly.html`. In `javascript_tool`:

```js
(function(){
  opts.dailyLayout='standard'; opts.dailyFacingNotes=true; opts.weeklyReflection=true;
  generate();
  // Book view: every facing-notes page must be the RIGHT child of its spread, its day the LEFT.
  const spreads=[...document.querySelectorAll('#book-view .book-spread')];
  let facingOnRight=0, facingOnLeft=0;
  spreads.forEach(sp=>{
    const kids=[...sp.children];
    kids.forEach((k,idx)=>{
      if(k.dataset && k.dataset.lbl==='facing-notes'){ (idx===1?facingOnRight++:facingOnLeft++); }
    });
  });
  // A day page (has .d-hdr) should sit on the left of a spread whose right is a facing page.
  return {
    facingOnRight, facingOnLeft,          // expect facingOnLeft === 0
    totalFacing: document.querySelectorAll('#book-view [data-lbl="facing-notes"]').length
  };
})();
```

Expected: `facingOnLeft === 0` (every facing page is on the right). If `facingOnLeft > 0`, the even-index=left assumption is wrong for this app — flip the parity target in `facingAlignInserts` (align run starts to ODD instead) and re-verify; note the flip in the commit.

- [ ] **Step 6: Verify the standard/timeblock + toggle-off cases.** Still in the browser:

```js
(function(){
  const out={};
  // timeblock
  opts.dailyLayout='timeblock'; opts.dailyFacingNotes=true; generate();
  out.timeblock_facingOnLeft = [...document.querySelectorAll('#book-view .book-spread')]
    .flatMap(sp=>[...sp.children].map((k,idx)=>({facing:k.dataset&&k.dataset.lbl==='facing-notes',idx})))
    .filter(x=>x.facing && x.idx!==1).length;   // expect 0
  // toggle off -> no facing pages at all
  opts.dailyFacingNotes=false; generate();
  out.off_facingCount = document.querySelectorAll('#page-preview [data-lbl="facing-notes"]').length; // 0
  return out;
})();
```

Expected: `timeblock_facingOnLeft: 0`, `off_facingCount: 0`. `read_console_messages {onlyErrors:true}` → none. `node --test` → 18 pass. Stop the server.

- [ ] **Step 7: Commit.**

```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.html
git commit -m "feat(daily): wall facing-notes pairing + Daily-section toggle"
```

---

## Task 5: Greeter daily pairing + guided chip + tray-label fix

**Files:**
- Modify: `tn-weekly-planner/greeter.js`

- [ ] **Step 1: Pair days in the greeter `daily` expand.** In `greeter.js`, replace the `daily` registry entry:

```js
  daily:      { label:'Daily',              expand:(c)=>monthsOf(c).flatMap(mm=>{
                 const out=[]; const dim=new Date(mm.year,mm.month+1,0).getDate();
                 for(let d=1;d<=dim;d++) out.push(opts.dailyLayout==='timeblock'?mkTimeBlockDay(mm.year,mm.month,d,c.colors):mkDay(mm.year,mm.month,d,c.colors));
                 return out; }), guided:[{opt:'dailyLayout',label:'Layout',choices:[['standard','Standard'],['timeblock','Time-block']]}] },
```

with:

```js
  daily:      { label:'Daily',              expand:(c)=>monthsOf(c).flatMap(mm=>{
                 const out=[]; const dim=new Date(mm.year,mm.month+1,0).getDate();
                 for(let d=1;d<=dim;d++){
                   const page=opts.dailyLayout==='timeblock'?mkTimeBlockDay(mm.year,mm.month,d,c.colors):mkDay(mm.year,mm.month,d,c.colors);
                   if(opts.dailyFacingNotes){ page.dataset.facingPair='1'; out.push(page, mkFacingNotes(DOW_ABB3[dow(mm.year,mm.month,d)]+' '+d, c.colors)); }
                   else out.push(page);
                 }
                 return out; }),
                 guided:[
                   {opt:'dailyLayout',label:'Layout',choices:[['standard','Standard'],['timeblock','Time-block']]},
                   {opt:'dailyFacingNotes',label:'Facing notes',choices:[[false,'Off'],[true,'On']]}
                 ] },
```

- [ ] **Step 2: Fix `grEntryLabel` to show choice display text (and skip off/unset).** In `greeter.js`, replace:

```js
function grEntryLabel(entry){
  let l=PAGE_TYPES[entry.type].label;
  const g=(PAGE_TYPES[entry.type].guided||[]);
  const parts=g.map(spec=>entry.config[spec.opt]).filter(Boolean);
  if(parts.length) l+=' · '+parts.join(' ');
  return l;
}
```

with:

```js
function grEntryLabel(entry){
  let l=PAGE_TYPES[entry.type].label;
  const g=(PAGE_TYPES[entry.type].guided||[]);
  const parts=g.map(spec=>{
    const v=entry.config[spec.opt];
    if(v===false || v==null || v==='') return null;         // skip off/unset (e.g. Facing notes Off)
    const choice=(spec.choices||[]).find(ch=>ch[0]===v);
    return choice?choice[1]:v;                              // display text, fallback to raw value
  }).filter(Boolean);
  if(parts.length) l+=' · '+parts.join(' · ');
  return l;
}
```

- [ ] **Step 3: Verify (browser, fresh port).** Start `python -m http.server 8204`; open `weekly.html`. In `javascript_tool`:

```js
(function(){
  const out={};
  const tiles=[...document.querySelectorAll('#gr-types .gr-type')];
  tiles.find(t=>t.textContent==='Daily').click();
  // The daily type now shows TWO guided rows: Layout + Facing notes
  out.guidedLabels=[...document.querySelectorAll('#gr-guided .gr-lbl')].map(e=>e.textContent);
  // Turn Facing notes On, add the entry, check the tray label
  [...document.querySelectorAll('#gr-guided .gr-chip')].find(c=>c.textContent==='On').click();
  document.querySelector('#gr-months').value='1';
  grAdd();
  out.trayLabel=(document.querySelector('#gr-tray .gr-tlabel')||{}).textContent; // e.g. "Daily · Standard · On"
  // Generate the booklet: each day must be left, its notes right, in the book view
  grGenerate();
  out.facingOnLeft=[...document.querySelectorAll('#book-view .book-spread')]
    .flatMap(sp=>[...sp.children].map((k,idx)=>({facing:k.dataset&&k.dataset.lbl==='facing-notes',idx})))
    .filter(x=>x.facing && x.idx!==1).length;   // expect 0
  out.optRestored=opts.dailyFacingNotes;         // grGenerate restores; live value unchanged by render
  return out;
})();
```

Expected: `guidedLabels` includes `'Layout'` and `'Facing notes'`; `trayLabel` reads `"Daily · Standard · On"` (no raw `true`); `facingOnLeft: 0`. `read_console_messages {onlyErrors:true}` → none.

- [ ] **Step 4: Verify two daily entries both align.** Still in the browser:

```js
(function(){
  booklet=[]; grUid=0;
  const tiles=[...document.querySelectorAll('#gr-types .gr-type')];
  // entry 1: Daily + facing On
  tiles.find(t=>t.textContent==='Daily').click();
  [...document.querySelectorAll('#gr-guided .gr-chip')].find(c=>c.textContent==='On').click();
  grAdd();
  // entry 2: a Cover (odd-size unpaired block between not needed; Cover alone shifts parity)
  tiles.find(t=>t.textContent==='Cover').click(); grAdd();
  // entry 3: another Daily + facing On
  tiles.find(t=>t.textContent==='Daily').click();
  [...document.querySelectorAll('#gr-guided .gr-chip')].find(c=>c.textContent==='On').click();
  grAdd();
  grGenerate();
  return {
    facingOnLeft:[...document.querySelectorAll('#book-view .book-spread')]
      .flatMap(sp=>[...sp.children].map((k,idx)=>({facing:k.dataset&&k.dataset.lbl==='facing-notes',idx})))
      .filter(x=>x.facing && x.idx!==1).length   // expect 0 — BOTH daily runs aligned
  };
})();
```

Expected: `facingOnLeft: 0`. Stop the server.

- [ ] **Step 5: Commit.**

```bash
git add tn-weekly-planner/greeter.js
git commit -m "feat(greeter): daily facing-notes chip + pairing + tray display labels"
```

---

## Task 6: Cross-cutting verification pass

**Files:** none (verification + a possible follow-up note).

- [ ] **Step 1: Boundary parity (odd vs even preceding content).** Start `python -m http.server 8205`; open `weekly.html`. In `javascript_tool`, force an odd and an even amount of pre-daily content and confirm the daily run still starts on the left both ways:

```js
(function(){
  const check=()=>[...document.querySelectorAll('#book-view .book-spread')]
    .flatMap(sp=>[...sp.children].map((k,idx)=>({facing:k.dataset&&k.dataset.lbl==='facing-notes',idx})))
    .filter(x=>x.facing && x.idx!==1).length;
  const out={};
  opts.dailyFacingNotes=true; opts.dailyLayout='standard';
  opts.cover=false; opts.calendar=false; opts.habitMap=false; generate();  // one parity
  out.noCover_facingOnLeft=check();
  opts.cover=true; generate();                                             // flip parity by adding a cover
  out.withCover_facingOnLeft=check();
  return out;   // both expect 0
})();
```

Expected: both `0`. This exercises the alignment blank being inserted only when needed.

- [ ] **Step 2: coverSheet edge (documented caveat).** In `javascript_tool`:

```js
(function(){
  opts.dailyFacingNotes=true; opts.cover=true; opts.coverSheet=true; generate();
  // Book view still aligns (cover included); note the print body may differ — see spec caveat.
  const bookFacingOnLeft=[...document.querySelectorAll('#book-view .book-spread')]
    .flatMap(sp=>[...sp.children].map((k,idx)=>({facing:k.dataset&&k.dataset.lbl==='facing-notes',idx})))
    .filter(x=>x.facing && x.idx!==1).length;
  return { bookFacingOnLeft };  // expect 0 in the book view
})();
```

Expected: `0` in the book view. If the physical print imposition is off by one with `coverSheet` on, that matches the documented spec caveat — record it as a follow-up in the final message, do not fix here.

- [ ] **Step 3: Full regression + tests.** Confirm `read_console_messages {onlyErrors:true}` is clean across the above. Run `cd tn-weekly-planner && node --test` → 18 pass. Toggle `opts.dailyFacingNotes=false; generate();` and confirm `document.querySelectorAll('#page-preview [data-lbl="facing-notes"]').length === 0` (byte-for-byte prior behavior). Stop the server.

- [ ] **Step 4: No commit needed** unless the parity flip (Task 4 Step 5) or a caveat fix was applied. If `facingAlignInserts` was flipped to odd, ensure Task 1's tests were updated to match and are green.

---

## Definition of Done

- `opts.dailyFacingNotes` toggle (default off) in the wall's Daily section AND a greeter `daily` "Facing notes" chip, both driving the same behavior.
- With it on: every day is a left page with a minimal, dated notes page on the right; weekly summary + reflection get dateless facing blanks; at most one alignment blank per paired run.
- Works for standard + time-block layouts, wall + greeter paths, and multiple greeter daily entries.
- Off → output identical to today.
- `node --test` green (18 tests). No console errors.
- Book view verified: no facing page ever lands on the left.

## Handoff / follow-ups

- `coverSheet` on may shift the physical print body by one page (book view remains correct). Print-path-only adjustment deferred.
- Facing pages for non-daily page types (future log, monthly…) — not in scope.
- Configurable facing content (a "Notes" label, prompts) — not in scope.

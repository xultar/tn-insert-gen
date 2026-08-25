# Output Modes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Verify browser changes on a FRESH `python -m http.server` port each time (the preview caches JS/CSS aggressively). Run `cd tn-weekly-planner && node --test` after core-touching tasks.

**Goal:** Add a selectable output mode — Booklet (fold, current), Double-sided flat (2-up cut-and-stack), Single-sided flat (2-up, blank backs) — that changes only the print imposition, leaving the booklet path and all views otherwise unchanged.

**Architecture:** A pure `flatImposition(n, sides)` in `core.js` (unit-tested) computes the cut-and-stack sheet ordering. `imposeAndRender` branches on `opts.outputMode`: booklet keeps its existing fold `sides` loop; flat builds a `sides` array (same `{l,r,lbl}` shape) from `flatImposition` and reuses the existing sheet renderer. Facing-notes alignment and save-paper are gated to booklet mode. Default `booklet` → zero change.

**Tech Stack:** Vanilla ES5-ish browser JS, no build; Node `node:test` for the pure core. Spec: [2026-07-11-output-modes-design.md](../specs/2026-07-11-output-modes-design.md).

---

## File Structure

- Modify `tn-weekly-planner/core.js` — add pure `flatImposition(n, sides)` + export.
- Modify `tn-weekly-planner/test/core.test.js` — tests for `flatImposition`.
- Modify `tn-weekly-planner/weekly.js` — `outputMode` default; `syncOutputModeUI`; wire `onOptionChange`/`applyOptsToUI`/`readOptsFromUI`; gate `layout2up` + `alignFacingRuns` to booklet; the `sides` mode-branch + center-line + `pg-count` in `imposeAndRender`.
- Modify `tn-weekly-planner/weekly.html` — Output-mode `<select>`; row ids for hide-sync.

---

## Task 1: `flatImposition` pure logic + tests (core.js)

**Files:** Modify `tn-weekly-planner/core.js`; Test `tn-weekly-planner/test/core.test.js`

`flatImposition(n, sides)` → `{ pad, sheets }`. `sides` is `'double'|'single'`. Each sheet is `{ front:[leftIdx,rightIdx], back:[leftIdx,rightIdx]|null }`; indices are 0-based reading-order page indices (may be ≥ `n` for padding — the renderer blanks those); `back` is `null` for single-sided. Flat is always 2-up.

- [ ] **Step 1: Write the failing tests.** Append to `test/core.test.js`:

```js
test('flatImposition double n=8: two sheets, cut-and-stack order', () => {
  assert.deepStrictEqual(core.flatImposition(8, 'double'), {
    pad: 8,
    sheets: [
      { front: [0, 4], back: [1, 5] },
      { front: [2, 6], back: [3, 7] }
    ]
  });
});

test('flatImposition double n=6 pads to 8 (indices >=6 are blanks)', () => {
  assert.deepStrictEqual(core.flatImposition(6, 'double'), {
    pad: 8,
    sheets: [
      { front: [0, 4], back: [1, 5] },
      { front: [2, 6], back: [3, 7] }
    ]
  });
});

test('flatImposition double n=4: one sheet', () => {
  assert.deepStrictEqual(core.flatImposition(4, 'double'), {
    pad: 4,
    sheets: [ { front: [0, 2], back: [1, 3] } ]
  });
});

test('flatImposition single n=8: four fronts, blank backs', () => {
  assert.deepStrictEqual(core.flatImposition(8, 'single'), {
    pad: 8,
    sheets: [
      { front: [0, 4], back: null },
      { front: [1, 5], back: null },
      { front: [2, 6], back: null },
      { front: [3, 7], back: null }
    ]
  });
});

test('flatImposition single n=5 pads to 6', () => {
  assert.deepStrictEqual(core.flatImposition(5, 'single'), {
    pad: 6,
    sheets: [
      { front: [0, 3], back: null },
      { front: [1, 4], back: null },
      { front: [2, 5], back: null }
    ]
  });
});

test('flatImposition n=0: no sheets', () => {
  assert.deepStrictEqual(core.flatImposition(0, 'double'), { pad: 0, sheets: [] });
});
```

- [ ] **Step 2: Run tests, verify they FAIL.** `cd tn-weekly-planner && node --test` → FAIL (`core.flatImposition is not a function`).

- [ ] **Step 3: Implement.** In `core.js`, add before the `var api = {` line:

```js
  function flatImposition(n, sides) {
    var doubleSided = sides !== 'single';
    var mult = doubleSided ? 4 : 2;
    var nn = Math.ceil(n / mult) * mult;
    var half = nn / 2;
    var S = doubleSided ? nn / 4 : nn / 2;
    var sheets = [];
    for (var i = 0; i < S; i++) {
      if (doubleSided) {
        sheets.push({ front: [2 * i, 2 * i + half], back: [2 * i + 1, 2 * i + 1 + half] });
      } else {
        sheets.push({ front: [i, i + half], back: null });
      }
    }
    return { pad: nn, sheets: sheets };
  }
```

- [ ] **Step 4: Export it.** In `var api = { ... }`, add after `facingAlignInserts: facingAlignInserts`:

```js
    facingAlignInserts: facingAlignInserts,
    flatImposition: flatImposition
```

- [ ] **Step 5: Run tests, verify PASS.** `cd tn-weekly-planner && node --test` → all pass (18 prior + 6 new = 24).

- [ ] **Step 6: Commit.**

```bash
git add tn-weekly-planner/core.js tn-weekly-planner/test/core.test.js
git commit -m "feat(core): flatImposition — pure 2-up cut-and-stack sheet ordering"
```

(End every commit body in this plan with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.)

---

## Task 2: `outputMode` default + UI select + hide-sync

**Files:** Modify `tn-weekly-planner/weekly.js`, `tn-weekly-planner/weekly.html`

- [ ] **Step 1: Add the opt default.** In `weekly.js` `opts` defaults, after the line `savePaper: false,` add:

```js
  outputMode: 'booklet',
```

- [ ] **Step 2: Add the Output-mode select** in `weekly.html`. Find the print-options wrapper that starts with `<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px;">` followed by the Crop marks `toggle-row`. Immediately INSIDE that wrapper, BEFORE the Crop marks row, add:

```html
            <div class="cfg-row" style="margin-bottom:6px;">
              <label>Output mode</label>
              <select id="opt-outputmode" onchange="onOptionChange()">
                <option value="booklet" selected>Booklet (fold &amp; staple)</option>
                <option value="flatDouble">Double-sided flat (cut &amp; stack)</option>
                <option value="flatSingle">Single-sided flat</option>
              </select>
            </div>
```

- [ ] **Step 3: Add ids to the rows that hide per mode.** In `weekly.html`:
  - The Fold line row `<div class="toggle-row" style="margin-top:4px;">` containing `id="opt-foldline"` → add `id="row-foldline"` to that div: `<div class="toggle-row" id="row-foldline" style="margin-top:4px;">`.
  - The Save paper row containing `id="opt-savepaper"` → add `id="row-savepaper"`: `<div class="toggle-row" id="row-savepaper" style="margin-top:4px;">`.
  - The Duplex-flip block `<div style="margin-top:6px;">` that contains `<h3 ...>Duplex Flip</h3>` → add `id="row-duplexflip"`: `<div id="row-duplexflip" style="margin-top:6px;">`.

- [ ] **Step 4: Add `syncOutputModeUI` and wire it.** In `weekly.js`, add the function (e.g. right after `onOptionChange`):

```js
function syncOutputModeUI(){
  const flat = opts.outputMode!=='booklet';
  $('row-foldline').style.display  = flat ? 'none' : '';
  $('row-savepaper').style.display = flat ? 'none' : '';
  $('row-duplexflip').style.display = (opts.outputMode==='flatSingle') ? 'none' : '';
}
```

Then in `onOptionChange`, add the sync between `readOptsFromUI()` and `generate()`:

```js
function onOptionChange(){
  readOptsFromUI();
  syncOutputModeUI();
  generate();
}
```

- [ ] **Step 5: Wire the select into applyOptsToUI/readOptsFromUI.** In `applyOptsToUI`, after `$('opt-savepaper').checked=opts.savePaper;` add:

```js
  $('opt-outputmode').value=opts.outputMode;
```

At the END of `applyOptsToUI` (after its last line, before the closing `}`), add:

```js
  syncOutputModeUI();
```

In `readOptsFromUI`, after `opts.savePaper=$('opt-savepaper').checked;` add:

```js
  opts.outputMode=$('opt-outputmode').value;
```

- [ ] **Step 6: Verify (browser, FRESH port).** Start `python -m http.server 8301`; open `weekly.html`. In `javascript_tool`:

```js
(function(){
  const out={};
  const disp=id=>getComputedStyle(document.getElementById(id)).display;
  // default booklet: fold/savepaper/duplex all visible
  out.booklet={fold:disp('row-foldline'),save:disp('row-savepaper'),flip:disp('row-duplexflip'),mode:opts.outputMode};
  // switch to double-flat
  document.getElementById('opt-outputmode').value='flatDouble'; onOptionChange();
  out.flatDouble={fold:disp('row-foldline'),save:disp('row-savepaper'),flip:disp('row-duplexflip'),mode:opts.outputMode};
  // switch to single-flat
  document.getElementById('opt-outputmode').value='flatSingle'; onOptionChange();
  out.flatSingle={fold:disp('row-foldline'),save:disp('row-savepaper'),flip:disp('row-duplexflip'),mode:opts.outputMode};
  return out;
})();
```

Expected: booklet → all `''`/visible (not `none`); flatDouble → fold `none`, save `none`, flip visible; flatSingle → fold `none`, save `none`, flip `none`. `mode` reflects the select each time. `read_console_messages {onlyErrors:true}` → none. Stop the server.

- [ ] **Step 7: Commit.**

```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.html
git commit -m "feat(output): output-mode select + per-mode control hiding (no render change yet)"
```

---

## Task 3: Flat imposition in `imposeAndRender`

**Files:** Modify `tn-weekly-planner/weekly.js`

- [ ] **Step 1: Gate save-paper to booklet.** Find:

```js
  const layout2up=opts.savePaper?getSavePaperLayout(sz,paper):null;
```

replace with:

```js
  const layout2up=(opts.outputMode==='booklet' && opts.savePaper)?getSavePaperLayout(sz,paper):null;
```

- [ ] **Step 2: Gate facing-notes alignment to booklet.** Find:

```js
  const els = alignFacingRuns(pageEls, getColors());
```

replace with:

```js
  const els = opts.outputMode==='booklet' ? alignFacingRuns(pageEls, getColors()) : pageEls;
```

- [ ] **Step 3: Branch the pad + `sides` computation.** Find this exact block:

```js
  const padTarget=opts.savePaper?(layout2up?layout2up.spreadsPerSide*4:2):4;
  while(pages.length%padTarget!==0){
    const dotStyle=getFillStyle(colors);
    pages.push(`<div class="pg" style="width:${sz.w}mm;height:${sz.h}mm;background-color:${colors.page};font-family:'${activeFont()}',serif;${getPagePadding()}${dotStyle}"><div class="sh" style="background:${colors.page};color:${colors.dim};border-bottom:.3pt solid ${colors.line}">Notes</div></div>`);
  }
  const n=pages.length;

  const sides=[];
  let L=0,R=n-1,sn=1;
  while(L<R){
    sides.push({l:pages[R],r:pages[L],lbl:`Sheet ${sn} Front (pp ${R+1} & ${L+1})`});
    L++;R--;
    if(L<R){
      sides.push({l:pages[L],r:pages[R],lbl:`Sheet ${sn} Back (pp ${L+1} & ${R+1})`});
      L++;R--;sn++;
    }
  }
```

and replace it with:

```js
  const blankPad=()=>{
    const dotStyle=getFillStyle(colors);
    return `<div class="pg" style="width:${sz.w}mm;height:${sz.h}mm;background-color:${colors.page};font-family:'${activeFont()}',serif;${getPagePadding()}${dotStyle}"><div class="sh" style="background:${colors.page};color:${colors.dim};border-bottom:.3pt solid ${colors.line}">Notes</div></div>`;
  };

  let n; const sides=[];
  if(opts.outputMode==='booklet'){
    const padTarget=opts.savePaper?(layout2up?layout2up.spreadsPerSide*4:2):4;
    while(pages.length%padTarget!==0){ pages.push(blankPad()); }
    n=pages.length;
    let L=0,R=n-1,sn=1;
    while(L<R){
      sides.push({l:pages[R],r:pages[L],lbl:`Sheet ${sn} Front (pp ${R+1} & ${L+1})`});
      L++;R--;
      if(L<R){
        sides.push({l:pages[L],r:pages[R],lbl:`Sheet ${sn} Back (pp ${L+1} & ${R+1})`});
        L++;R--;sn++;
      }
    }
  }else{
    const dbl=opts.outputMode!=='flatSingle';
    const imp=TNCore.flatImposition(pages.length, dbl?'double':'single');
    n=imp.pad;
    const pageAt=idx=>(idx==null || idx>=pages.length)?blankPad():pages[idx];
    imp.sheets.forEach((sheet,i)=>{
      sides.push({l:pageAt(sheet.front[0]), r:pageAt(sheet.front[1]), lbl:`Sheet ${i+1} Front`});
      if(dbl) sides.push({l:pageAt(sheet.back[0]), r:pageAt(sheet.back[1]), lbl:`Sheet ${i+1} Back`});
    });
  }
```

- [ ] **Step 4: Center line for flat modes.** The string `const foldLine=opts.foldline?...` appears twice; target the one in the default render loop by matching it together with the following line (the `${s.lbl}` one makes it unique — the separate-cover copy is followed by a `Cover Sheet` label instead). Find:

```js
      const foldLine=opts.foldline?'<div class="fold-line"></div>':'';
      div.innerHTML=`
        <div class="sheet-label">${s.lbl}</div>
```

and replace with:

```js
      const foldLine=(opts.outputMode!=='booklet' || opts.foldline)?'<div class="fold-line"></div>':'';
      div.innerHTML=`
        <div class="sheet-label">${s.lbl}</div>
```

- [ ] **Step 5: Mode-aware pg-count.** Find:

```js
  $('pg-count').textContent=`${n+separateCovers.length} pages · ${physSides} print sides${upNote}${coverNote} · fold · staple spine · trim`;
```

replace with:

```js
  const assembly = opts.outputMode==='booklet' ? 'fold · staple spine · trim'
                 : opts.outputMode==='flatSingle' ? 'cut · stack (single-sided) · trim'
                 : 'cut · stack · trim';
  $('pg-count').textContent=`${n+separateCovers.length} pages · ${physSides} print sides${upNote}${coverNote} · ${assembly}`;
```

- [ ] **Step 6: Verify (browser, FRESH port).** Start `python -m http.server 8302`; open `weekly.html`. In `javascript_tool`:

```js
(function(){
  const out={};
  const sheetCount=()=>document.querySelectorAll('#print-area .sheet').length;
  const pgText=()=>document.getElementById('pg-count').textContent;

  // Booklet baseline (unchanged)
  opts.outputMode='booklet'; generate();
  out.booklet={sheets:sheetCount(), pg:pgText()};

  // Double-flat: sides == 2 * ceil(pad/4); pg-count says 'cut · stack'
  opts.outputMode='flatDouble'; generate();
  out.flatDouble={sheets:sheetCount(), pg:pgText(), hasCut:/cut · stack/.test(pgText())};

  // Single-flat: only fronts -> sheets == pad/2 (no 'Back' sheets); backs blank
  opts.outputMode='flatSingle'; generate();
  const labels=[...document.querySelectorAll('#print-area .sheet .sheet-label')].map(e=>e.textContent);
  out.flatSingle={sheets:sheetCount(), anyBack:labels.some(l=>/Back/.test(l)), pg:pgText()};

  opts.outputMode='booklet';
  return out;
})();
```

Expected: `flatDouble.hasCut` true and it has both Front+Back sheets; `flatSingle.anyBack` is **false** (fronts only); all three render a non-zero `sheets`. `read_console_messages {onlyErrors:true}` → none. Run `cd tn-weekly-planner && node --test` → 24 pass. Stop the server.

- [ ] **Step 7: Commit.**

```bash
git add tn-weekly-planner/weekly.js
git commit -m "feat(output): flat cut-and-stack imposition path + booklet-only facing/savepaper gates"
```

---

## Task 4: Cross-cutting verification

**Files:** none (verification; commit only if a fix was needed).

- [ ] **Step 1: Booklet output is byte-identical to before.** Start `python -m http.server 8303`; open `weekly.html`. In `javascript_tool`, capture booklet `#print-area` HTML with default options and confirm it matches the pre-feature behavior structurally (same sheet count and same fold-line/pg-count wording):

```js
(function(){
  opts.outputMode='booklet'; opts.dailyFacingNotes=false; opts.savePaper=false; generate();
  return {
    sheets:document.querySelectorAll('#print-area .sheet').length,
    pg:document.getElementById('pg-count').textContent,          // ends with 'fold · staple spine · trim'
    hasFold:!!document.querySelector('#print-area .fold-line')
  };
})();
```

Expected: `pg` ends with `fold · staple spine · trim`, `hasFold` true. (Compare against `git stash`-ing nothing — just confirm booklet wording/behavior unchanged.)

- [ ] **Step 2: Facing-notes graceful degrade in flat.** In `javascript_tool`:

```js
(function(){
  opts.dailyFacingNotes=true; opts.dailyLayout='standard';
  opts.outputMode='booklet'; generate();
  const bookletAlignBlanks=document.querySelectorAll('#book-view [data-lbl="facing-notes"]').length;
  opts.outputMode='flatDouble'; generate();
  // Facing/notes pages still present as content in the reading list (book view builds pre-imposition):
  const flatNotesPresent=document.querySelectorAll('#book-view [data-lbl="facing-notes"]').length>0;
  opts.outputMode='booklet'; opts.dailyFacingNotes=false;
  return { bookletAlignBlanks_gt0: bookletAlignBlanks>0, flatNotesPresent };
})();
```

Expected: notes pages present in both (`flatNotesPresent` true); the point is flat still emits notes pages. No console errors.

- [ ] **Step 3: Persistence + tests.** Reload the page and confirm `opts.outputMode` round-trips (set flatDouble, reload, check `document.getElementById('opt-outputmode').value` and that the hide-sync applied). Run `cd tn-weekly-planner && node --test` → 24 pass. `read_console_messages {onlyErrors:true}` → none. Stop the server.

- [ ] **Step 4:** No commit unless a defect fix was required.

---

## Definition of Done

- `opts.outputMode` select (Booklet / Double-sided flat / Single-sided flat), default Booklet → existing output unchanged.
- Flat modes render 2-up cut-and-stack sheets (`flatImposition`, unit-tested); single-sided prints fronts only (blank backs, no Back sheets).
- Fold line + save paper hidden for flat; duplex flip hidden for single-sided; 2-up flat shows a center cut line; `pg-count` wording matches the mode.
- Facing-notes: alignment pass runs only in booklet mode; notes pages still emitted in flat modes.
- Greeter honors the mode via the shared `imposeAndRender` (no greeter UI).
- `node --test` green (24). No console errors.

## Handoff / follow-ups

- 1-up flat layout (deferred).
- Mode-aware `mkPrintGuide` assembly-guide text (currently booklet-worded; the on-page guide is off by default).
- coverSheet + flat physical registration is untested in print; eyeball if used.

# Greeter 2b — Sidebar UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Verify browser changes on a FRESH `python -m http.server` port each time (the preview browser caches JS/CSS aggressively). Run `cd tn-weekly-planner && node --test` after core-touching tasks (12 tests must stay green).

**Goal:** Add the visible greeter to the sidebar — pick notebook size → date range → page type → a couple of guided options, see a live single-page preview, **Add to booklet**, manage a booklet tray (reorder/remove/total), **Generate** the collection, and flip **Show all tools** to reveal the existing wall.

**Architecture:** Build on the Plan 2a foundation (all already on `master`): `PAGE_TYPES` + `bookletPages(list,ctx)` (greeter.js), `bookletAdd/Remove/Move/TotalPages` (core.js, TNCore), `imposeAndRender(pageEls)` and `renderSinglePage(els)` (weekly.js). Add a `#greeter` panel as a sibling of `#cfg`, shown by default with `#cfg` hidden; a toggle swaps them. Greeter state lives in `greeter.js`: `booklet` (the collection array) and `greeterSel` (current `{type, config}`). Guided choices write the global `opts` (per the approved spec §4), so preview and output stay one source of truth. Replaces the temporary `renderBooklet` hook.

**Tech Stack:** Vanilla ES5-ish browser JS, no build step; Node 24 `node:test` for the (unchanged) core.

**Roadmap:** Plan 2b of the greeter ([spec](../specs/2026-07-10-greeter-design.md)); Plan 2a (foundation) is merged. Output *modes* (single/double/booklet imposition choices) remain Plan 3.

**Design decisions locked (from spec + brainstorm):**
- Placement A: greeter swaps into the sidebar; `#cfg` wall is one toggle away (nothing removed).
- Behavior "both": selecting a type renders that single page live AND offers Add to booklet.
- Smart-expand by range: each entry's page count = `PAGE_TYPES[type].expand(ctx).length`, computed at Add time and stored on the entry (carry-forward review note: derive `pageCount` from expansion, don't invent it).
- Date range = start month/year (reuse `sel-m`/`sel-y`) + a **months** count (1–12) added to the greeter.
- Guided options are MINIMAL and write global `opts`: Future Log layout (`opts.flLayout`), Daily layout (`opts.dailyLayout`), Plain ruling (`opts.fillPattern`). Other types have no guided options in 2b.
- Reflection entry = monthly only in 2b (weekly reflection stays a wall feature).

---

## File Structure

- Modify: `tn-weekly-planner/weekly.html` — add the `#greeter` panel markup (sibling of `#cfg`); no other structural change.
- Modify: `tn-weekly-planner/weekly.css` — greeter panel styles.
- Modify: `tn-weekly-planner/greeter.js` — greeter state, render, event handlers, tray, generate, toggle, persistence; add `guided` metadata to `PAGE_TYPES`; remove the temporary `renderBooklet`.
- Modify: `tn-weekly-planner/weekly.js` — call `initGreeter()` on load; include `booklet` in `saveState`/`loadState`.

**Greeter DOM (ids):** `#greeter` (panel), `#gr-size` (size select), `#gr-months` (range length), `#gr-types` (page-type grid), `#gr-guided` (guided options container), `#gr-add` (Add button), `#gr-tray` (tray list), `#gr-total` (page total), `#gr-generate` (Generate button), `#gr-tools` (Show all tools toggle input), `#cfg-back` (a "‹ Back to greeter" control shown when the wall is visible).

---

## Task 1: Greeter panel markup + styles + default visibility

**Files:** Modify `tn-weekly-planner/weekly.html`, `tn-weekly-planner/weekly.css`

- [ ] **Step 1: Add the `#greeter` panel immediately before `<div id="cfg">`** in `weekly.html`:

```html
<div id="greeter">
  <div class="gr-title">◆ Build a page</div>

  <label class="gr-lbl">Notebook</label>
  <select id="gr-size" onchange="grOnSizeChange()"></select>

  <label class="gr-lbl">Date range (from Month/Year above)</label>
  <div class="gr-row">
    <span style="font-size:11px;opacity:.7;">Months</span>
    <input id="gr-months" type="number" min="1" max="12" value="1" style="width:56px;" onchange="grOnMonthsChange()">
  </div>

  <label class="gr-lbl">Page type</label>
  <div id="gr-types" class="gr-types"></div>

  <div id="gr-guided" class="gr-guided"></div>

  <button id="gr-add" class="btn btn-p" onclick="grAdd()">+ Add to booklet</button>

  <div class="gr-tray-hd"><span>Booklet</span><span id="gr-total">0 pages</span></div>
  <div id="gr-tray" class="gr-tray"></div>

  <button id="gr-generate" class="btn btn-s" onclick="grGenerate()">&#9112; Generate / Print</button>

  <div class="gr-toggle">
    <label class="toggle-sw"><input type="checkbox" id="gr-tools" onchange="grToggleTools()"><span class="slider"></span></label>
    <span style="font-size:12px;">Show all tools</span>
  </div>
</div>
```

- [ ] **Step 2: Add a "back to greeter" control at the very top of `#cfg`.** In `weekly.html`, immediately after `<div id="cfg">`, add:

```html
    <div id="cfg-back" onclick="grToggleTools()" style="cursor:pointer;font-size:12px;padding:6px 0;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,.1);">&#8249; Back to greeter</div>
```

- [ ] **Step 3: Append greeter styles** to `weekly.css`:

```css
/* ── GREETER PANEL ─────────────────────── */
#greeter{background:var(--acc);color:#f0ede6;border-right:3px solid #1f1f1f;width:300px;min-width:280px;height:100vh;overflow-y:auto;padding:14px 16px 18px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;}
#greeter *{color:#f0ede6;}
.gr-title{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:4px;}
.gr-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;margin-top:6px;}
.gr-row{display:flex;align-items:center;gap:8px;}
#greeter select,#greeter input{font-family:inherit;}
.gr-types{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;}
.gr-type{font-size:11px;border:1px solid rgba(255,255,255,.25);border-radius:6px;padding:6px 4px;text-align:center;cursor:pointer;background:rgba(255,255,255,.05);}
.gr-type.on{background:#f0ede6;color:var(--acc);font-weight:700;border-color:#f0ede6;}
.gr-guided{display:flex;flex-direction:column;gap:5px;}
.gr-guided .gr-opt{display:flex;flex-wrap:wrap;gap:4px;}
.gr-guided .gr-chip{font-size:10px;border:1px solid rgba(255,255,255,.25);border-radius:11px;padding:3px 8px;cursor:pointer;}
.gr-guided .gr-chip.on{background:#f0ede6;color:var(--acc);font-weight:700;}
.gr-tray-hd{display:flex;justify-content:space-between;font-size:10px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;margin-top:6px;}
.gr-tray{display:flex;flex-direction:column;gap:3px;}
.gr-trow{display:flex;align-items:center;gap:5px;font-size:11px;background:rgba(255,255,255,.06);border-radius:4px;padding:3px 5px;}
.gr-trow .gr-tlabel{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gr-trow .gr-tct{opacity:.6;font-size:9px;}
.gr-trow button{background:none;border:none;color:#f0ede6;cursor:pointer;opacity:.7;font-size:11px;padding:0 2px;}
.gr-toggle{display:flex;align-items:center;gap:7px;border-top:1px solid rgba(255,255,255,.12);padding-top:9px;margin-top:auto;}
/* default: greeter shown, wall hidden */
#cfg{display:none;}
body.show-tools #greeter{display:none;}
body.show-tools #cfg{display:flex;}
```

- [ ] **Step 4: Verify (browser, fresh port).** Load the app; the sidebar shows the greeter panel (size, months, empty page-type grid, Add, empty tray, Generate, Show all tools). Flipping **Show all tools** does nothing yet (wired in Task 6) — that's expected. No console errors (the greeter grid is empty until Task 2 populates it).

- [ ] **Step 5: Commit.** `git add tn-weekly-planner/weekly.html tn-weekly-planner/weekly.css && git commit -m "feat(greeter): add sidebar greeter panel markup + styles"`

---

## Task 2: Greeter state, page-type grid, size sync, live preview

**Files:** Modify `tn-weekly-planner/greeter.js`, `tn-weekly-planner/weekly.js`

- [ ] **Step 1: Add `guided` metadata to the registry.** In `greeter.js`, add a `guided` array to the three entries that need it (leave others as-is). Insert after each entry's `expand` (same object):
  - `futureLog`: `, guided:[{opt:'flLayout',label:'Layout',choices:[['stacked','Stacked'],['columns','Column'],['year','Year grid']]}]`
  - `daily`: `, guided:[{opt:'dailyLayout',label:'Layout',choices:[['standard','Standard'],['timeblock','Time-block']]}]`
  - `plain`: `, guided:[{opt:'fillPattern',label:'Ruling',choices:[['dots','Dotted'],['grid','Squared'],['lines','Ruled'],['hex','Hex'],['empty','Blank']]}]`

- [ ] **Step 2: Add greeter state + core render functions** to `greeter.js` (append after `bookletPages`, and DELETE the temporary `renderBooklet` function):

```js
let booklet = [];
let greeterSel = { type: 'futureLog' };
let grUid = 0;

function grCtx(){
  return { year: parseInt($('sel-y').value), month: parseInt($('sel-m').value),
           monthCount: Math.max(1, parseInt($('gr-months').value)||1), colors: getColors() };
}

function grInitSize(){
  const sel = $('gr-size');
  sel.innerHTML = '';
  Object.keys(TN_SIZES).forEach(k=>{
    const o=document.createElement('option'); o.value=k;
    o.textContent = TN_SIZES[k].label + ' ('+TN_SIZES[k].w+'×'+TN_SIZES[k].h+')';
    if(k===opts.tnsize) o.selected=true;
    sel.appendChild(o);
  });
}
function grOnSizeChange(){ opts.tnsize=$('gr-size').value; grPreview(); }
function grOnMonthsChange(){ grPreview(); }

function grRenderTypes(){
  const grid=$('gr-types'); grid.innerHTML='';
  Object.keys(PAGE_TYPES).forEach(type=>{
    const b=document.createElement('div');
    b.className='gr-type'+(type===greeterSel.type?' on':'');
    b.textContent=PAGE_TYPES[type].label;
    b.onclick=()=>{ greeterSel={type}; grRenderTypes(); grRenderGuided(); grPreview(); };
    grid.appendChild(b);
  });
}

function grRenderGuided(){
  const box=$('gr-guided'); box.innerHTML='';
  const g=(PAGE_TYPES[greeterSel.type]||{}).guided||[];
  g.forEach(spec=>{
    const lbl=document.createElement('div'); lbl.className='gr-lbl'; lbl.textContent=spec.label; box.appendChild(lbl);
    const row=document.createElement('div'); row.className='gr-opt';
    spec.choices.forEach(([val,text])=>{
      const chip=document.createElement('div');
      chip.className='gr-chip'+(opts[spec.opt]===val?' on':'');
      chip.textContent=text;
      chip.onclick=()=>{ opts[spec.opt]=val; grRenderGuided(); grPreview(); };
      row.appendChild(chip);
    });
    box.appendChild(row);
  });
}

function grPreview(){
  const ctx=grCtx();
  const pages=PAGE_TYPES[greeterSel.type].expand(Object.assign({}, ctx, greeterSel.config||{}));
  renderSinglePage(pages);
}

function initGreeter(){
  grInitSize(); grRenderTypes(); grRenderGuided(); grRenderTray(); grPreview();
}
```

> Note: `grRenderTray` is defined in Task 4; if executing tasks strictly in order, stub it as `function grRenderTray(){}` here and replace in Task 4, OR implement Task 4 before first running `initGreeter`.

- [ ] **Step 3: Call `initGreeter()` on load.** In `weekly.js`, find where the app initializes on load (near the end, after `loadState()`/first `generate()`), and add `initGreeter();` after the existing init so the DOM exists. Confirm `TN_SIZES`, `opts`, `getColors`, `renderSinglePage`, `$` are all in scope (they are — greeter.js loads after weekly.js).

- [ ] **Step 4: Verify (browser, fresh port).** The page-type grid shows all 9 types; Future Log is selected by default and its guided "Layout" chips appear; the preview shows the Future Log. Click **Daily** → guided shows Standard/Time-block, preview switches to a daily page. Click **Plain** → Ruling chips appear; clicking "Ruled" changes the preview's pattern. Changing **Months** to 3 and clicking Daily previews the first page (preview shows page 1). No console errors.

- [ ] **Step 5: Commit.** `git add tn-weekly-planner/greeter.js tn-weekly-planner/weekly.js && git commit -m "feat(greeter): page-type picker, guided options, live preview"`

---

## Task 3: Add to booklet + tray (reorder / remove / total)

**Files:** Modify `tn-weekly-planner/greeter.js`

- [ ] **Step 1: Add the tray + add/remove/move handlers** to `greeter.js`:

```js
function grAdd(){
  const ctx=grCtx();
  const cfg=Object.assign({}, greeterSel.config||{});
  const type=greeterSel.type;
  // snapshot the opts-based guided choices onto the entry so the label + count reflect them
  const g=(PAGE_TYPES[type].guided||[]);
  g.forEach(spec=>{ cfg[spec.opt]=opts[spec.opt]; });
  const pageCount=PAGE_TYPES[type].expand(Object.assign({}, ctx, cfg)).length;
  const entry={ id:'e'+(++grUid), type, config:cfg, pageCount };
  booklet=TNCore.bookletAdd(booklet, entry);
  grRenderTray(); saveState();
}

function grEntryLabel(entry){
  let l=PAGE_TYPES[entry.type].label;
  const g=(PAGE_TYPES[entry.type].guided||[]);
  const parts=g.map(spec=>entry.config[spec.opt]).filter(Boolean);
  if(parts.length) l+=' · '+parts.join(' ');
  return l;
}

function grRenderTray(){
  const tray=$('gr-tray'); tray.innerHTML='';
  booklet.forEach(entry=>{
    const row=document.createElement('div'); row.className='gr-trow';
    const up=document.createElement('button'); up.textContent='▲'; up.title='Move up';
    up.onclick=()=>{ booklet=TNCore.bookletMove(booklet,entry.id,-1); grRenderTray(); saveState(); };
    const dn=document.createElement('button'); dn.textContent='▼'; dn.title='Move down';
    dn.onclick=()=>{ booklet=TNCore.bookletMove(booklet,entry.id,1); grRenderTray(); saveState(); };
    const lab=document.createElement('span'); lab.className='gr-tlabel'; lab.textContent=grEntryLabel(entry);
    const ct=document.createElement('span'); ct.className='gr-tct'; ct.textContent=entry.pageCount+'p';
    const rm=document.createElement('button'); rm.textContent='✕'; rm.title='Remove';
    rm.onclick=()=>{ booklet=TNCore.bookletRemove(booklet,entry.id); grRenderTray(); saveState(); };
    row.appendChild(up); row.appendChild(dn); row.appendChild(lab); row.appendChild(ct); row.appendChild(rm);
    tray.appendChild(row);
  });
  $('gr-total').textContent=TNCore.bookletTotalPages(booklet)+' pages';
}
```

- [ ] **Step 2: Verify (browser, fresh port).** Select Future Log (Year grid) → Add → tray shows "Future Log · year" with its page count; total updates. Add Daily (Time-block) with Months=1 → tray shows "Daily · timeblock 31p"; total sums. Use ▲/▼ to reorder, ✕ to remove — tray + total update correctly. No console errors.

- [ ] **Step 3: Commit.** `git add tn-weekly-planner/greeter.js && git commit -m "feat(greeter): add-to-booklet and tray (reorder/remove/total)"`

---

## Task 4: Generate the booklet through the print pipeline

**Files:** Modify `tn-weekly-planner/greeter.js`

- [ ] **Step 1: Add `grGenerate`** to `greeter.js`:

```js
function grGenerate(){
  if(!booklet.length){ grPreview(); return; }
  const ctx=grCtx();
  // apply each entry's opts-based guided choices around its expansion, so mixed entries render with their own settings
  const pages=booklet.flatMap(entry=>{
    const g=(PAGE_TYPES[entry.type].guided||[]);
    const saved={}; g.forEach(spec=>{ saved[spec.opt]=opts[spec.opt]; opts[spec.opt]=entry.config[spec.opt]; });
    const out=PAGE_TYPES[entry.type].expand(Object.assign({}, ctx, entry.config||{}));
    g.forEach(spec=>{ opts[spec.opt]=saved[spec.opt]; });
    return out;
  });
  imposeAndRender(pages);
}
```

> This resolves the Plan-2a carry-forward: each entry renders with its own opts-based guided choices (Future Log layout, Plain ruling) by temporarily setting `opts` around its expansion and restoring after.

- [ ] **Step 2: Verify (browser, fresh port).** Build a booklet: Cover, Future Log (stacked), Master Action List, Monthly Log, one Reflection. Click **Generate / Print** → the preview shows exactly those pages in order; switch to Book / Print Layout views — imposition works; `#pg-count` reflects the total (padded to a multiple of 4). Add a second Future Log set to "year" and Generate → the two Future Log entries render with their respective layouts (stacked vs year). No console errors.

- [ ] **Step 3: Commit.** `git add tn-weekly-planner/greeter.js && git commit -m "feat(greeter): generate booklet via imposeAndRender + per-entry guided opts"`

---

## Task 5: Show-all-tools toggle

**Files:** Modify `tn-weekly-planner/greeter.js`

- [ ] **Step 1: Add `grToggleTools`** to `greeter.js`:

```js
function grToggleTools(){
  const on=$('gr-tools').checked;
  document.body.classList.toggle('show-tools', on);
}
```

- [ ] **Step 2: Verify (browser, fresh port).** With the greeter visible, flip **Show all tools** → the full `#cfg` wall appears and the greeter hides. Click **‹ Back to greeter** (top of the wall) → greeter returns, wall hides, and the toggle resets. Confirm `opts.tnsize` chosen in the greeter is reflected in the wall's notebook-size dropdown after `applyOptsToUI` runs (it already syncs on load; if not visually synced, that's acceptable for 2b since both read/write the same `opts`). No console errors.

> Note: `grToggleTools` reads `#gr-tools`. Clicking "Back to greeter" calls `grToggleTools()` directly; set `$('gr-tools').checked=false` at the start of that path — implement `grToggleTools` to sync the checkbox to the resulting state: if invoked from the back link (checkbox still checked), toggle it off first. Concretely:

```js
function grToggleTools(){
  const cb=$('gr-tools');
  // if called from the wall's back link, the checkbox is still checked → force off
  if(document.body.classList.contains('show-tools')) cb.checked=false;
  document.body.classList.toggle('show-tools', cb.checked);
}
```

- [ ] **Step 3: Commit.** `git add tn-weekly-planner/greeter.js && git commit -m "feat(greeter): show-all-tools toggle"`

---

## Task 6: Persist the booklet collection

**Files:** Modify `tn-weekly-planner/weekly.js`, `tn-weekly-planner/greeter.js`

- [ ] **Step 1: Include `booklet` in save/load.** In `weekly.js` `saveState()`, add the greeter collection to the saved object (guard for greeter.js not yet loaded): where the state object is assembled, add `booklet: (typeof booklet!=='undefined'?booklet:[])`. In `loadState()`, after restoring, add: `if(typeof booklet!=='undefined' && Array.isArray(s.booklet)) booklet=s.booklet;` (use the parsed state variable name already used in `loadState`).

- [ ] **Step 2: Re-render the tray after load.** In `initGreeter()` (greeter.js), `grRenderTray()` already runs — ensure it runs AFTER `loadState()` has populated `booklet`. Since `initGreeter()` is called on load after `loadState()` (Task 2 Step 3), the restored collection shows. If `grUid` collisions are possible after reload, set `grUid` to the max existing id number: at the top of `initGreeter`, add `booklet.forEach(e=>{const n=parseInt(String(e.id).replace(/\D/g,''))||0; if(n>grUid)grUid=n;});`

- [ ] **Step 3: Verify (browser, fresh port).** Add a few entries, reload the page → the tray + total are restored; reordering/removing still works and persists across another reload. No console errors. Run `cd tn-weekly-planner && node --test` → still 12 passing.

- [ ] **Step 4: Commit.** `git add tn-weekly-planner/weekly.js tn-weekly-planner/greeter.js && git commit -m "feat(greeter): persist booklet collection in save/load state"`

---

## Definition of Done (Plan 2b)

- The sidebar opens on the greeter; size + months + page type + guided options drive a live single-page preview.
- Add to booklet builds a collection with correct per-entry page counts; tray reorders/removes; total sums.
- Generate renders the collection (in order, each entry with its own guided opts) through the existing imposition pipeline; Book/Print views work.
- Show all tools reveals the wall; Back returns to the greeter.
- The collection persists across reloads.
- `node --test` still 12 green; the legacy wall **Generate** still works unchanged.

## Handoff / follow-ups

- **Output modes** (single / double / booklet imposition choices) = Plan 3.
- Nice-to-haves deferred: native drag-drop tray reorder; per-notebook auto month-count; syncing the greeter size dropdown ↔ wall live; Cover title editing in the greeter (currently uses existing cover opts).
- If the wall and greeter size controls feel disjoint, consider making the greeter reuse `applyOptsToUI`/`readOptsFromUI` rather than its own size `<select>`.

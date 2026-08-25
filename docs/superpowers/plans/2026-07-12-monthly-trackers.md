# Monthly Trackers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Verify browser changes on a FRESH `python -m http.server` port each time (the preview caches JS/CSS aggressively; screenshots time out on this page — use `javascript_tool`/`read_page`). Run `cd tn-weekly-planner && node --test` after each task (must stay 24 green; this feature adds no core tests).

**Goal:** Repurpose the confusing "Graphs" page into an opt-in, scaled **Monthly Trackers** page: remove the "Link to daily fields" behavior, add an include-toggle, ship scaled presets (Sleep/Water/Mood/Steps/Weight/Custom), and let custom trackers use a labeled axis (e.g. `S,M,T,W,T,F,S` or `1–5`).

**Architecture:** No engine rewrite. `buildGraphSVG` (the days-vertical grid) and the Min/Max/Step editor already exist; this fixes defaults/framing and adds a labeled-axis branch. Internal identifiers `graphMetrics`/`mkMonthGraphs`/page-label `monthly-graphs` are kept to limit blast radius; only the UI is renamed.

**Tech Stack:** Vanilla ES5-ish browser JS, no build. Spec: [2026-07-12-monthly-trackers-design.md](../specs/2026-07-12-monthly-trackers-design.md).

**Branch:** `feature/monthly-trackers` (already created off `master`).

---

## File Structure

- Modify `tn-weekly-planner/weekly.js` — opts defaults; remove `linkFieldsGraphs`/`toggleLink`; add `opts.trackers`; gate `generate()`; `addTrackerPreset()`; `renderMetrics()` Labels field; `buildGraphSVG()` labels branch.
- Modify `tn-weekly-planner/weekly.html` — `sec-graphs`: rename header, remove link toggle, add Monthly Trackers include-toggle, replace the add-row with the preset picker.

---

## Task 1: Remove the link feature; add the Monthly Trackers toggle; rename; scaled starter set

**Files:** Modify `tn-weekly-planner/weekly.js`, `tn-weekly-planner/weekly.html`

- [ ] **Step 1: Change the default metrics + opts.** In `weekly.js`, replace the `graphMetrics` default line (currently):
```js
let graphMetrics = [{id:1,title:'Weight',min:null,max:null,step:null},{id:2,title:'Steps',min:null,max:null,step:null}];
```
with the scaled starter set:
```js
let graphMetrics = [{id:1,title:'Sleep',min:0,max:12,step:2,labels:null},{id:2,title:'Water',min:0,max:8,step:1,labels:null},{id:3,title:'Mood',min:1,max:5,step:1,labels:null}];
```

- [ ] **Step 2: In the `opts` defaults**, remove the line `  linkFieldsGraphs: true,` and add (anywhere in the object, e.g. next to where `linkFieldsGraphs` was):
```js
  trackers: false,
```

- [ ] **Step 3: Remove `toggleLink`.** In `weekly.js`, delete the entire function:
```js
function toggleLink(){
  opts.linkFieldsGraphs=$('opt-linkfg').checked;
  $('metric-section').style.display=opts.linkFieldsGraphs?'none':'';
  if(opts.linkFieldsGraphs){
    graphMetrics=dailyFields.map(f=>({id:f.id,title:f.label,min:null,max:null,step:null}));
    renderMetrics();
  }
  generate();
}
```

- [ ] **Step 4: `applyOptsToUI` — remove the link lines, add the trackers line.** Replace:
```js
  $('opt-linkfg').checked=opts.linkFieldsGraphs;
  $('metric-section').style.display=opts.linkFieldsGraphs?'none':'';
```
with:
```js
  $('opt-trackers').checked=opts.trackers;
```

- [ ] **Step 5: `readOptsFromUI` — swap the link line for the trackers line.** Replace:
```js
  opts.linkFieldsGraphs=$('opt-linkfg').checked;
```
with:
```js
  opts.trackers=$('opt-trackers').checked;
```

- [ ] **Step 6: `generate()` — remove the auto-derive, gate on the toggle.** Replace these two lines:
```js
  if(opts.linkFieldsGraphs){ graphMetrics=dailyFields.map(f=>({id:f.id,title:f.label})); }
  if(graphMetrics.length>0) els.push(mkMonthGraphs(y,m,colors));
```
with:
```js
  if(opts.trackers && graphMetrics.length>0) els.push(mkMonthGraphs(y,m,colors));
```

- [ ] **Step 7: HTML — rename header, remove the link toggle, add the include-toggle.** In `weekly.html`, the `sec-graphs` section currently starts:
```html
      <div class="coll-hdr" onclick="toggleSection('sec-graphs')">
        <span class="coll-arrow">&#9654;</span> Graphs
      </div>
      <div class="coll-body">
        <div class="cfg-sec">
          <div class="toggle-row" style="margin-bottom:6px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-linkfg" checked onchange="toggleLink()"><span class="slider"></span></label>
            <span style="font-size:12px;">Link to daily fields</span>
          </div>
          <div id="metric-section">
```
Replace that block with:
```html
      <div class="coll-hdr" onclick="toggleSection('sec-graphs')">
        <span class="coll-arrow">&#9654;</span> Monthly Trackers
      </div>
      <div class="coll-body">
        <div class="cfg-sec">
          <div class="toggle-row" style="margin-bottom:6px;">
            <label class="toggle-sw"><input type="checkbox" id="opt-trackers" onchange="onOptionChange()"><span class="slider"></span></label>
            <span style="font-size:12px;">Include trackers page</span>
          </div>
          <div id="metric-section">
```
(The `#metric-section` div stays — it's just never hidden now.)

- [ ] **Step 8: Verify (browser, FRESH port).** Start `python -m http.server 8401`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const out={};
  out.linkToggleGone = !document.getElementById('opt-linkfg');
  out.trackersToggle = !!document.getElementById('opt-trackers');
  out.editorVisible = getComputedStyle(document.getElementById('metric-section')).display!=='none';
  out.starter = graphMetrics.map(m=>m.title+':'+m.min+'-'+m.max);
  // page only when trackers on
  opts.trackers=false; generate();
  out.offCount = [...document.querySelectorAll('#page-preview > *')].filter(p=>p.dataset.lbl==='monthly-graphs').length; // 0
  opts.trackers=true; generate();
  out.onCount = [...document.querySelectorAll('#page-preview > *')].filter(p=>p.dataset.lbl==='monthly-graphs').length; // 1
  opts.trackers=false;
  return out;
})();
```
Expected: `linkToggleGone:true`, `trackersToggle:true`, `editorVisible:true`, `starter:["Sleep:0-12","Water:0-8","Mood:1-5"]`, `offCount:0`, `onCount:1`. `read_console_messages {onlyErrors:true}` → none. `node --test` → 24. Stop the server.

- [ ] **Step 9: Commit.**
```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.html
git commit -m "feat(trackers): remove link-to-daily-fields, add Monthly Trackers toggle + scaled defaults"
```
(End every commit body in this plan with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.)

---

## Task 2: Preset "Add tracker" picker

**Files:** Modify `tn-weekly-planner/weekly.js`, `tn-weekly-planner/weekly.html`

- [ ] **Step 1: Add `addTrackerPreset`.** In `weekly.js`, add near `addMetric` (which you will remove in Step 3):
```js
function addTrackerPreset(kind){
  const P={
    sleep:{title:'Sleep',min:0,max:12,step:2},
    water:{title:'Water',min:0,max:8,step:1},
    mood:{title:'Mood',min:1,max:5,step:1},
    steps:{title:'Steps',min:0,max:15000,step:5000},
    weight:{title:'Weight',min:50,max:100,step:10},
    custom:{title:'Metric',min:null,max:null,step:null}
  };
  const p=P[kind]; if(!p) return;
  graphMetrics.push({id:Date.now(),title:p.title,min:p.min,max:p.max,step:p.step,labels:null});
  renderMetrics(); onOptionChange();
}
```

- [ ] **Step 2: Replace the add-row markup.** In `weekly.html` (inside `#metric-section`), replace:
```html
            <div class="add-row" style="margin-top:4px;">
              <input id="metric-name" type="text" placeholder="Metric name" style="width:120px;">
              <button class="btn btn-s btn-sm" onclick="addMetric()">+ Add</button>
            </div>
```
with:
```html
            <div class="add-row" style="margin-top:4px;">
              <select id="tracker-preset" onchange="addTrackerPreset(this.value); this.value='';">
                <option value="">+ Add tracker…</option>
                <option value="sleep">Sleep (0–12)</option>
                <option value="water">Water (0–8)</option>
                <option value="mood">Mood (1–5)</option>
                <option value="steps">Steps (0–15k)</option>
                <option value="weight">Weight (50–100)</option>
                <option value="custom">Custom…</option>
              </select>
            </div>
```

- [ ] **Step 3: Remove the now-unused `addMetric`.** In `weekly.js`, delete:
```js
function addMetric(){
  const name=$('metric-name').value.trim();
  if(!name)return;
  graphMetrics.push({id:Date.now(),title:name,min:null,max:null,step:null});
  $('metric-name').value='';
  renderMetrics(); onOptionChange();
}
```
(Confirm `addMetric` is referenced nowhere else first — after Step 2 it isn't.)

- [ ] **Step 4: Verify (browser, FRESH port).** Start `python -m http.server 8402`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const before=graphMetrics.length;
  addTrackerPreset('sleep'); addTrackerPreset('mood'); addTrackerPreset('custom');
  const added=graphMetrics.slice(before);
  return {
    addedTitles: added.map(m=>m.title),                 // ["Sleep","Mood","Metric"]
    sleepScale: (added.find(m=>m.title==='Sleep')||{}),  // min 0 max 12 step 2
    customUnscaled: added.find(m=>m.title==='Metric').min===null,
    presetSelectExists: !!document.getElementById('tracker-preset'),
    addMetricGone: (typeof addMetric==='undefined')
  };
})();
```
Expected: `addedTitles:["Sleep","Mood","Metric"]`; `sleepScale` has `min:0,max:12,step:2`; `customUnscaled:true`; `presetSelectExists:true`; `addMetricGone:true`. Console clean; `node --test` 24. Stop the server.

- [ ] **Step 5: Commit.**
```bash
git add tn-weekly-planner/weekly.js tn-weekly-planner/weekly.html
git commit -m "feat(trackers): preset Add-tracker picker (scaled Sleep/Water/Mood/Steps/Weight/Custom)"
```

---

## Task 3: Custom labeled axis

**Files:** Modify `tn-weekly-planner/weekly.js`

- [ ] **Step 1: Add a Labels field to the metric editor.** In `weekly.js` `renderMetrics()`, find the end of the details builder (right after the `mkNum('Step',m.step,v=>{m.step=v;});` line and before `row.appendChild(det);`) and insert:
```js
    det.appendChild(el('span','metric-det-lbl','Labels'));
    const li=document.createElement('input');
    li.type='text'; li.placeholder='S,M,T,W,T,F,S'; li.value=(m.labels||[]).join(',');
    li.style.cssText='width:96px;font-size:10px;padding:2px 4px;';
    li.onchange=function(){ const v=this.value.trim(); m.labels=v?v.split(',').map(s=>s.trim()).filter(Boolean):null; onOptionChange(); };
    det.appendChild(li);
    const qWk=el('button','btn btn-d','Wk'); qWk.title='Weekdays';
    qWk.onclick=()=>{ m.labels=['S','M','T','W','T','F','S']; li.value='S,M,T,W,T,F,S'; onOptionChange(); };
    det.appendChild(qWk);
    const q15=el('button','btn btn-d','1-5'); q15.title='1 to 5';
    q15.onclick=()=>{ m.labels=['1','2','3','4','5']; li.value='1,2,3,4,5'; onOptionChange(); };
    det.appendChild(q15);
```

- [ ] **Step 2: Render labels as the axis in `buildGraphSVG`.** In `weekly.js` `buildGraphSVG`, find:
```js
  const hasRange = typeof metric!=='string' && metric.min!=null && metric.max!=null && metric.step!=null && metric.step>0 && metric.max>metric.min;
```
and add right after it:
```js
  const hasLabels = typeof metric!=='string' && Array.isArray(metric.labels) && metric.labels.length>0;
```
Then find:
```js
  const headerH = hasRange ? 4 : 0;
```
and replace with:
```js
  const headerH = (hasRange||hasLabels) ? 4 : 0;
```
Then find the value-axis header block:
```js
  // Value axis header
  if(hasRange){
```
and change that opening to make labels take precedence:
```js
  // Value axis header
  if(hasLabels){
    const labs=metric.labels;
    s+=`<line x1="${plotX}" y1="${headerH}" x2="${plotX+plotW}" y2="${headerH}" stroke="${c.dim}" stroke-width=".4"/>`;
    labs.forEach((lab,i)=>{
      const xRatio = labs.length===1 ? 0.5 : i/(labs.length-1);
      const lx=+(plotX+xRatio*plotW).toFixed(2);
      s+=`<line x1="${lx}" y1="${headerH-1}" x2="${lx}" y2="${headerH}" stroke="${c.dim}" stroke-width=".3"/>`;
      s+=`<text x="${lx}" y="${+(headerH/2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="2.8" fill="${c.dim}">${lab}</text>`;
    });
  } else if(hasRange){
```
(The existing numeric-scale body and its closing `}` stay as-is — you are only changing the `if(hasRange){` line into `if(hasLabels){ … } else if(hasRange){`.)

- [ ] **Step 3: Verify (browser, FRESH port).** Start `python -m http.server 8403`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  // a labeled custom tracker renders its labels; a numeric one still renders its scale
  graphMetrics=[{id:1,title:'Mood',min:1,max:5,step:1,labels:null},{id:2,title:'Day',min:null,max:null,step:null,labels:['S','M','T','W','T','F','S']}];
  opts.trackers=true; generate();
  const svgs=[...document.querySelectorAll('#page-preview [data-lbl="monthly-graphs"] svg')];
  const txt=svgs.map(s=>[...s.querySelectorAll('text')].map(t=>t.textContent).join(' '));
  return {
    graphCount: svgs.length,                       // 2
    hasWeekdayLabels: txt.some(t=>/S M T W T F S/.test(t) || (/\bS\b/.test(t)&&/\bF\b/.test(t))),
    hasNumericScale: txt.some(t=>/\b1\b/.test(t)&&/\b5\b/.test(t))
  };
})();
```
Expected: `graphCount:2`, `hasWeekdayLabels:true`, `hasNumericScale:true`. Also open the metric editor "…" details for a tracker and confirm the **Labels** input + **Wk**/**1-5** quick-fill buttons appear (via `read_page` or checking `document.querySelectorAll('#metric-list .metric-details input').length`). Console clean; `node --test` 24. Stop the server.

- [ ] **Step 4: Commit.**
```bash
git add tn-weekly-planner/weekly.js
git commit -m "feat(trackers): optional labeled axis for custom trackers (e.g. SMTWTFS / 1-5)"
```

---

## Task 4: Cross-cutting verification

**Files:** none (verification; commit only if a fix was needed).

- [ ] **Step 1: Persistence.** Start `python -m http.server 8404`; open `weekly.html`. Turn the Monthly Trackers toggle on (`document.getElementById('opt-trackers').checked=true; onOptionChange();`), add a preset (`addTrackerPreset('sleep')`), set labels on one metric, then reload. Confirm after reload: `opts.trackers===true`, the added tracker is present, and its `labels` survived. (opts + graphMetrics both ride in saveState.)

- [ ] **Step 2: Daily fields untouched.** Confirm the daily pages still show the Steps/Wt fields independently: with a daily page in the output, `document.querySelectorAll('#page-preview .d-field, #page-preview [class*="field"]')` (or inspect a daily page) still shows the daily fields — removing the graphs link must not have changed daily-field rendering.

- [ ] **Step 3: Old-settings import safety.** In `javascript_tool`, simulate importing a settings file that still has `linkFieldsGraphs:true` in its opts: `importSettings({target:{files:[new File([JSON.stringify({opts:{linkFieldsGraphs:true,trackers:true}})],'s.json',{type:'application/json'})]}})`, then (after the async read) confirm no error and the app still generates (the stale `linkFieldsGraphs` key is simply ignored — nothing reads it).

- [ ] **Step 4: Regression.** `read_console_messages {onlyErrors:true}` clean across the above; `node --test` → 24. Default (`trackers` off) → no `monthly-graphs` page. Stop the server.

- [ ] **Step 5:** No commit unless a defect fix was required.

---

## Definition of Done

- Section reads **Monthly Trackers** with an **Include trackers page** toggle (default off) and an always-visible trackers editor.
- **No "Link to daily fields"** control or behavior remains; daily Steps/Wt fields are unaffected.
- **Preset picker** adds scaled Sleep/Water/Mood/Steps/Weight and a blank Custom; scales editable via Min/Max/Step.
- **Custom labeled axis** works: a `labels` list (with Wk / 1-5 quick-fills) renders as the axis instead of the numeric scale; numeric scale remains the default.
- Trackers + labels persist across reload; `node --test` 24 green; no console errors.

## Handoff / follow-ups

- Label-aligned vertical gridlines (currently labels sit in the header; the plot keeps density gridlines) — nice-to-have.
- Renaming internal `graphMetrics`/`mkMonthGraphs` identifiers to "trackers" — deferred (blast radius).

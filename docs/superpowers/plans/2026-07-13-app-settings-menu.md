# App Settings Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. This feature is DOM/CSS glue; the 24 `node --test` cases cover `core.js` only and MUST stay 24 green (this feature adds none). Verify browser changes on a FRESH `python -m http.server` port each time (the preview caches JS/CSS aggressively; the mcp browser can serve a stale weekly.js/css — always use a new port after edits). Use `javascript_tool`/`read_page`, not screenshots (they time out on this page). Run `cd tn-weekly-planner && node --test` after each task.

**Goal:** Give the app its own theme + font (an "App Settings" gear menu in the top bar), fully decoupled from the page (output) theme + font.

**Architecture:** Add `opts.appTheme`/`opts.appFont`; a new `applyAppSkin()` becomes the sole styler of the app chrome (root color vars from the app theme, `document.body` font from the app font). Remove the two lines in `imposeAndRender` that pushed the *page* palette/font onto the app. Add a gear (⚙) button + dropdown panel in `#preview-hdr` with App-theme/App-font selects. Rename the Page Style labels to "Page theme"/"Page font".

**Tech Stack:** Vanilla ES5-ish browser JS, no build. Spec: [2026-07-13-app-settings-menu-design.md](../specs/2026-07-13-app-settings-menu-design.md).

**Branch:** create `feature/app-settings-menu` off `master`.

---

## File Structure

- Modify `tn-weekly-planner/weekly.js` — `opts` defaults (+appTheme/appFont); new `applyAppSkin()`, `toggleAppSettings()`, `onAppSkinChange()`; remove 2 coupling lines from `imposeAndRender`; `applyOptsToUI` sets the 2 selects; init call + close-handlers.
- Modify `tn-weekly-planner/weekly.html` — gear button + panel in `#preview-hdr`; Page Style label renames.
- Modify `tn-weekly-planner/weekly.css` — panel styles.

Persistence needs **no** code: `saveState`/`loadState`/`exportSettings`/`importSettings` serialize/spread the whole `opts` object, and `sanitizeOpts` only touches `colors`/`customFont`/`element*` — so `appTheme`/`appFont` ride along automatically once they exist in the defaults.

---

## Task 1: Data model + `applyAppSkin()` + decouple `imposeAndRender`

**Files:** Modify `tn-weekly-planner/weekly.js`

- [ ] **Step 1: Add the two opts.** In the `opts` defaults object, the lines are (weekly.js:84, :86):
```js
  theme: 'Minimal B&W',
```
and
```js
  font: 'Georgia',
```
Add `appTheme` right after the `theme` line and `appFont` right after the `font` line, so:
```js
  theme: 'Minimal B&W',
  appTheme: 'Minimal B&W',
```
and
```js
  font: 'Georgia',
  appFont: 'Georgia',
```

- [ ] **Step 2: Add `applyAppSkin()`.** In `weekly.js`, add this function immediately AFTER the `getColors()` function (which ends around weekly.js:423 with its closing `}`):
```js
// Sole styler of the APP chrome (independent of the page theme/font). Sets the
// root color vars from the app theme and the body font from the app font. The
// pages get their colors/font from the `colors` object + inline styles, not
// these root vars, so this never affects the printed output.
function applyAppSkin(){
  const root=document.documentElement;
  const t=THEMES[opts.appTheme]||THEMES['Minimal B&W'];
  COLOR_VARS.forEach(k=>root.style.setProperty('--'+k,t[k]));
  document.body.style.fontFamily=`'${opts.appFont||'Georgia'}',serif`;
}
```

- [ ] **Step 3: Remove the color-coupling line from `imposeAndRender`.** Delete this line (weekly.js:3268 — the one INSIDE `imposeAndRender`, right after `const root=document.documentElement;`):
```js
  COLOR_VARS.forEach(k=>root.style.setProperty('--'+k,colors[k]));
```
Context (delete only the middle line):
```js
  const root=document.documentElement;
  COLOR_VARS.forEach(k=>root.style.setProperty('--'+k,colors[k]));   // <-- DELETE THIS LINE
  const sz=tnSize();
```
(`const root` stays — it's used later in the function for `--tn-w`, `--sheet-w`, `--ef-*`, etc.)

- [ ] **Step 4: Remove the font-coupling line from `imposeAndRender`.** Delete this line (weekly.js:3318):
```js
  document.body.style.fontFamily=`'${activeFont()}',serif`;
```
Context (it sits right after the `$('paper-tip').textContent=...` line and before `const els = ...`):
```js
  $('paper-tip').textContent=paper.label+' '+orientStr+upLabel+' · '+tipAssembly;
  document.body.style.fontFamily=`'${activeFont()}',serif`;   // <-- DELETE THIS LINE

  const els = opts.outputMode==='booklet' ? alignFacingRuns(pageEls, colors) : pageEls;
```

- [ ] **Step 5: Call `applyAppSkin()` at init.** In the init block, the try/catch render section calls `applyOptsToUI();` (weekly.js:3560). Add `applyAppSkin();` on the line immediately after it:
```js
  applyOptsToUI();
  applyAppSkin();
```

- [ ] **Step 6: Verify (browser, FRESH port).** Start `python -m http.server 8450`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const root=document.documentElement;
  const gv=n=>getComputedStyle(root).getPropertyValue(n).trim();
  const out={};
  out.applyAppSkinExists=typeof applyAppSkin==='function';
  out.appDefaults={appTheme:opts.appTheme, appFont:opts.appFont}; // Minimal B&W / Georgia

  // PAGE theme change must NOT move the app chrome (root --acc) anymore
  opts.theme='Midnight Blue'; opts.colors={}; generate();
  out.rootAccAfterPageTheme=gv('--acc'); // still #333333 (app theme), NOT #1e3a5f
  // and the PAGE actually changed (a rendered page dot color follows the page theme)
  out.pageColorsFollowPageTheme = getColors().dot; // #b0b8c8 (midnight), proves pages still themed

  // APP theme change DOES move the app chrome
  opts.appTheme='Midnight Blue'; applyAppSkin();
  out.rootAccAfterAppTheme=gv('--acc'); // #1e3a5f now

  // PAGE font change must NOT move the app font
  opts.font='Courier New'; opts.customFont=''; generate();
  out.appBodyFontAfterPageFont=getComputedStyle(document.body).fontFamily; // still Georgia
  // APP font change DOES move the app font
  opts.appFont='Inter'; applyAppSkin();
  out.appBodyFontAfterAppFont=getComputedStyle(document.body).fontFamily; // Inter

  // restore
  opts.theme='Minimal B&W'; opts.appTheme='Minimal B&W'; opts.font='Georgia'; opts.appFont='Georgia'; opts.colors={}; applyAppSkin(); generate();
  return out;
})();
```
Expected: `applyAppSkinExists:true`; `appDefaults` = Minimal B&W/Georgia; `rootAccAfterPageTheme` = `#333333` (unchanged by page theme); `pageColorsFollowPageTheme` = `#b0b8c8` (page still follows page theme); `rootAccAfterAppTheme` = `#1e3a5f`; `appBodyFontAfterPageFont` contains `Georgia` (not Courier New); `appBodyFontAfterAppFont` contains `Inter`. `read_console_messages {onlyErrors:true}` → none. `node --test` → 24. Stop the server.

- [ ] **Step 7: Commit.**
```bash
cd "C:/Claude/Claude Code"
git add tn-weekly-planner/weekly.js
git commit -m "$(cat <<'EOF'
feat(app-settings): decouple app theme/font from page; add applyAppSkin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
(End every commit body in this plan with a blank line then the Co-Authored-By line.)

---

## Task 2: Gear button + App Settings panel (UI + wiring)

**Files:** Modify `tn-weekly-planner/weekly.html`, `tn-weekly-planner/weekly.css`, `tn-weekly-planner/weekly.js`

- [ ] **Step 1: Add the gear + panel in the top bar.** In `weekly.html`, `#preview-hdr` currently is (weekly.html:774):
```html
  <div id="preview-hdr">
    <strong id="pg-count">0</strong>
    <span class="tip" id="paper-tip">A4 landscape &middot; duplex &middot; fold &middot; staple spine &middot; trim edges</span>
    <div class="zoom-ctrl">
      <button class="zoom-btn" onclick="adjustZoom(-0.1)" title="Zoom out">−</button>
      <span id="zoom-level">100%</span>
      <button class="zoom-btn" onclick="adjustZoom(0.1)" title="Zoom in">+</button>
    </div>
  </div>
```
Replace it with (adds an app-settings wrap after the zoom control):
```html
  <div id="preview-hdr">
    <strong id="pg-count">0</strong>
    <span class="tip" id="paper-tip">A4 landscape &middot; duplex &middot; fold &middot; staple spine &middot; trim edges</span>
    <div class="zoom-ctrl">
      <button class="zoom-btn" onclick="adjustZoom(-0.1)" title="Zoom out">−</button>
      <span id="zoom-level">100%</span>
      <button class="zoom-btn" onclick="adjustZoom(0.1)" title="Zoom in">+</button>
    </div>
    <div class="app-settings-wrap">
      <button id="app-settings-btn" class="zoom-btn" aria-label="App settings" aria-haspopup="true" aria-expanded="false" onclick="toggleAppSettings(event)">&#9881;</button>
      <div id="app-settings-panel">
        <label class="as-lbl" for="opt-apptheme">App theme</label>
        <select id="opt-apptheme" onchange="onAppSkinChange()">
          <option value="Classic Warm">Classic Warm</option>
          <option value="Cool Gray">Cool Gray</option>
          <option value="Midnight Blue">Midnight Blue</option>
          <option value="Forest">Forest</option>
          <option value="Rose">Rose</option>
          <option value="Minimal B&amp;W">Minimal B&amp;W</option>
        </select>
        <label class="as-lbl" for="opt-appfont">App font</label>
        <select id="opt-appfont" onchange="onAppSkinChange()">
          <option value="Georgia">Georgia</option>
          <option value="Garamond">Garamond</option>
          <option value="Palatino">Palatino</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Inter">Inter</option>
          <option value="Courier New">Courier New</option>
        </select>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Panel CSS.** In `weekly.css`, add after the `#zoom-level{...}` rule (search for `#zoom-level`):
```css
/* ── App settings dropdown ── */
.app-settings-wrap{position:relative;}
#app-settings-panel{display:none;position:absolute;right:0;top:calc(100% + 6px);z-index:300;background:var(--acc);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:10px 12px;flex-direction:column;gap:6px;min-width:160px;box-shadow:0 6px 20px rgba(0,0,0,.25);}
#app-settings-panel.open{display:flex;}
#app-settings-panel select{width:100%;}
.as-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.7;color:#f0ede6;}
```

- [ ] **Step 3: Add the panel + skin JS handlers.** In `weekly.js`, add these functions right after `applyAppSkin()` (from Task 1):
```js
function onAppSkinChange(){
  opts.appTheme=$('opt-apptheme').value;
  opts.appFont=$('opt-appfont').value;
  applyAppSkin();
  saveState();
}
function toggleAppSettings(e){
  if(e) e.stopPropagation();               // don't let the document handler immediately re-close
  const p=$('app-settings-panel'), b=$('app-settings-btn');
  const open=p.classList.toggle('open');
  b.setAttribute('aria-expanded', open?'true':'false');
}
function closeAppSettings(){
  const p=$('app-settings-panel'); if(!p || !p.classList.contains('open')) return;
  p.classList.remove('open');
  $('app-settings-btn').setAttribute('aria-expanded','false');
}
```

- [ ] **Step 4: Sync the selects in `applyOptsToUI`.** In `weekly.js` `applyOptsToUI`, the page-font line is (weekly.js:699):
```js
  $('opt-font').value=opts.font;
```
Add right after it:
```js
  $('opt-apptheme').value=opts.appTheme;
  $('opt-appfont').value=opts.appFont;
```

- [ ] **Step 5: Close on outside-click / Escape.** In `weekly.js`, in the init block near the other top-level `document.addEventListener` handlers (there is already a `document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeInspector(); });`), add two handlers just after that Escape line:
```js
document.addEventListener('click',e=>{
  if(e.target.closest('#app-settings-panel') || e.target.closest('#app-settings-btn')) return;
  closeAppSettings();
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAppSettings(); });
```

- [ ] **Step 6: Verify (browser, FRESH port).** Start `python -m http.server 8451`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const out={};
  const panel=document.getElementById('app-settings-panel');
  const btn=document.getElementById('app-settings-btn');
  out.gearExists=!!btn; out.panelExists=!!panel;
  out.hiddenInitially=!panel.classList.contains('open');
  // open via the button
  toggleAppSettings();
  out.openAfterToggle=panel.classList.contains('open');
  out.ariaExpanded=btn.getAttribute('aria-expanded'); // "true"
  // selects reflect current opts
  out.appThemeSel=document.getElementById('opt-apptheme').value; // Minimal B&W
  out.appFontSel=document.getElementById('opt-appfont').value;   // Georgia
  // choose a new app theme via the handler
  document.getElementById('opt-apptheme').value='Forest'; onAppSkinChange();
  out.rootAccAfter=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(); // Forest acc #2d5a2d
  out.optsAppTheme=opts.appTheme;
  // Escape closes
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
  out.closedAfterEsc=!panel.classList.contains('open');
  // restore
  document.getElementById('opt-apptheme').value='Minimal B&W'; onAppSkinChange();
  return out;
})();
```
Expected: `gearExists`/`panelExists`:true; `hiddenInitially`:true; `openAfterToggle`:true; `ariaExpanded`:"true"; `appThemeSel`:"Minimal B&W"; `appFontSel`:"Georgia"; `rootAccAfter`:"#2d5a2d"; `optsAppTheme`:"Forest"; `closedAfterEsc`:true. Console clean; `node --test` 24. Stop the server.

- [ ] **Step 7: Commit.**
```bash
cd "C:/Claude/Claude Code"
git add tn-weekly-planner/weekly.html tn-weekly-planner/weekly.css tn-weekly-planner/weekly.js
git commit -m "$(cat <<'EOF'
feat(app-settings): gear menu in top bar with App theme + App font

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Page-side label renames

**Files:** Modify `tn-weekly-planner/weekly.html`

- [ ] **Step 1: Rename "Theme" → "Page theme".** In `weekly.html` Page Style section (weekly.html:358), replace:
```html
          <h3>Theme</h3>
          <div class="theme-grid" id="theme-grid"></div>
```
with:
```html
          <h3>Page theme</h3>
          <div class="theme-grid" id="theme-grid"></div>
```

- [ ] **Step 2: Rename "Font" → "Page font".** In the same section (weekly.html:365), replace:
```html
          <div style="margin-top:8px;">
            <h3>Font</h3>
            <select id="opt-font" onchange="onOptionChange()" style="width:100%;">
```
with:
```html
          <div style="margin-top:8px;">
            <h3>Page font</h3>
            <select id="opt-font" onchange="onOptionChange()" style="width:100%;">
```

- [ ] **Step 3: Verify (browser, FRESH port).** Start `python -m http.server 8452`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const cb=document.getElementById('gr-tools'); cb.checked=true; grToggleTools(); // show wall
  const h3=[...document.querySelectorAll('#sec-style h3')].map(h=>h.textContent.trim());
  return { styleHeadings:h3, hasPageTheme:h3.includes('Page theme'), hasPageFont:h3.includes('Page font'), noBareTheme:!h3.includes('Theme'), noBareFont:!h3.includes('Font') };
})();
```
Expected: `hasPageTheme`:true, `hasPageFont`:true, `noBareTheme`:true, `noBareFont`:true (`styleHeadings` includes "Page theme","Custom Colors","Page font",…). Console clean; `node --test` 24. Stop the server.

- [ ] **Step 4: Commit.**
```bash
cd "C:/Claude/Claude Code"
git add tn-weekly-planner/weekly.html
git commit -m "$(cat <<'EOF'
polish(app-settings): rename Page Style labels to "Page theme"/"Page font"

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Cross-cutting verification

**Files:** none (verification; commit only if a fix was needed).

- [ ] **Step 1: Bidirectional independence + persistence.** Start `python -m http.server 8453`; open `weekly.html`. In `javascript_tool`:
```js
(function(){
  const gv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const bodyFont=()=>getComputedStyle(document.body).fontFamily;
  const out={};
  // set DISTINCT app vs page appearance
  opts.theme='Rose'; opts.colors={}; opts.appTheme='Midnight Blue';
  opts.font='Courier New'; opts.customFont=''; opts.appFont='Inter';
  applyAppSkin(); generate();
  out.appAcc=gv('--acc');            // Midnight Blue #1e3a5f (app), NOT Rose #6b3a50
  out.pageDot=getColors().dot;       // Rose dot #d4b8c2 (page), NOT Midnight
  out.appFontApplied=bodyFont();     // Inter (app), NOT Courier New
  out.pageEfDaynum=gv('--ef-daynum');// 'Courier New' (page), NOT Inter
  out.independentOk = out.appAcc==='#1e3a5f' && getColors().dot==='#d4b8c2' &&
                      /Inter/.test(out.appFontApplied) && /Courier New/.test(out.pageEfDaynum);
  // persist + reload happens in Step 2 (this snapshot proves independence pre-reload)
  saveState();
  return out;
})();
```
Then reload the page (navigate to the same URL) and run:
```js
(function(){
  const gv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return {
    appThemePersisted: opts.appTheme,            // Midnight Blue
    appFontPersisted: opts.appFont,              // Inter
    appAccAppliedOnLoad: gv('--acc'),            // #1e3a5f  (applyAppSkin ran at init)
    appBodyFontOnLoad: getComputedStyle(document.body).fontFamily, // Inter
    selectsReflect: document.getElementById('opt-apptheme').value+'/'+document.getElementById('opt-appfont').value // Midnight Blue/Inter
  };
})();
```
Expected first: `independentOk:true` (app=Midnight/Inter, page=Rose/Courier, fully independent). Expected after reload: `appThemePersisted:"Midnight Blue"`, `appFontPersisted:"Inter"`, `appAccAppliedOnLoad:"#1e3a5f"`, `appBodyFontOnLoad` contains `Inter`, `selectsReflect:"Midnight Blue/Inter"`.

- [ ] **Step 2: Old-settings import safety.** In `javascript_tool`, simulate importing a settings file with NO appTheme/appFont: `importSettings({target:{files:[new File([JSON.stringify({opts:{theme:'Forest'}})],'s.json',{type:'application/json'})]}})`; after ~500ms confirm no error and `opts.appTheme`/`opts.appFont` fall back to defaults (`Minimal B&W`/`Georgia`) and the app still renders.

- [ ] **Step 3: Regression.** `read_console_messages {onlyErrors:true}` clean across the above; `node --test` → 24. Confirm print unaffected: the panel lives in `#preview-hdr` which is `display:none` in `@media print` (no leak). Reset the app to defaults (`opts.appTheme='Minimal B&W'; opts.appFont='Georgia'; applyAppSkin()`), clear the test localStorage if desired. Stop the server.

- [ ] **Step 4:** No commit unless a defect fix was required.

---

## Definition of Done

- Gear (⚙) in the top bar opens an App Settings panel with **App theme** + **App font** selects (Escape / outside-click closes it; `aria-expanded` tracks).
- App theme/font style **only** the app UI; page theme/font style **only** the output — verified independent in both directions.
- `applyAppSkin()` is the sole styler of app chrome; the two coupling lines are gone from `imposeAndRender`.
- Page Style shows **"Page theme"** / **"Page font"**.
- App settings persist across reload and are applied at init; defaults (Minimal B&W / Georgia) preserve the current look; old imports without the keys fall back safely; console clean; `node --test` 24 green.

## Handoff / follow-ups

- The App Settings menu is the natural home for future app-level preferences (e.g. a compact/comfortable density toggle) — not in scope now.

# App Settings Menu — Design Spec

**Date:** 2026-07-13
**Component:** `tn-weekly-planner/` (weekly.html, weekly.js, weekly.css, greeter.js as needed)
**Status:** Approved (design), pending implementation plan

## Goal

Separate **app appearance** from **page (output) appearance**. Today a single "Theme" and a single "Font" drive both the printed pages *and* the app's own UI; changing either for the pages also restyles the app. Introduce an **App Settings** menu (gear icon in the top bar) that controls the app UI's theme and font **independently** of the page theme/font, and decouple the two.

## Background (current coupling)

- **Theme** is a shared color palette. `getColors()` returns `THEMES[opts.theme]` (+ per-key overrides in `opts.colors`). Page builders consume that `colors` object inline (e.g. `getFillStyle` uses `colors.dot`; page borders use per-page `--pg-line` set from `colors` at weekly.js:1649). Separately, `imposeAndRender` pushes the **same** page palette onto the document root — `COLOR_VARS.forEach(k=>root.style.setProperty('--'+k,colors[k]))` (weekly.js ~3268) — and the app chrome reads those root vars (`body{background:var(--bg);color:var(--ink)}`, `#cfg`/`#greeter{background:var(--acc)}`, `.zoom-btn{color:var(--ink)}`). That root push is what makes the app follow the page theme.
- **Font**: `imposeAndRender` sets `document.body.style.fontFamily = '<activeFont()>',serif` (weekly.js ~3318), where `activeFont()` is the *page* font (`opts.customFont||opts.font`). That single line forces the whole app UI to use the page font.

**Verified safe to split:** pages never read the root `--ink/--dot/--line/--page` vars — they use the `colors` object inline and per-page `--pg-*`. The root color vars are consumed only by app chrome. So repointing the root vars + body font at a separate app source changes only the app UI, not the output.

`THEMES` keys (unchanged): Classic Warm, Cool Gray, Midnight Blue, Forest, Rose, Minimal B&W. `COLOR_VARS = ['ink','dim','bg','page','dot','line','acc']`.

## Key decisions (settled during brainstorming)

1. **Full separation** (not just a straight move): pages and app each get their own theme + font.
2. **App theme picker** in App Settings reusing the existing 6 `THEMES` palettes, applied only to the app chrome. Default `'Minimal B&W'` (matches the current CSS `:root` defaults, so first paint is unchanged).
3. **App font picker** in App Settings reusing the existing 6-font list, applied only to the app UI. Default `'Georgia'` (the app's current look).
4. **Gear (⚙) button in the top preview bar** (`#preview-hdr`) opening a small dropdown panel — chosen over a sidebar section (user asked for a bar) and over a modal (lighter for two controls).
5. **Page-side renames** for clarity: Page Style "Theme" → "Page theme", "Font" → "Page font".

## Architecture

### Data model
Two new `opts` fields with defaults: `appTheme: 'Minimal B&W'`, `appFont: 'Georgia'`. Added to the `opts` defaults object, and to `saveState`/`loadState`/`exportSettings`/`importSettings` (loadState/import already spread `opts`, so they carry automatically; just ensure `sanitizeOpts` doesn't strip them — it only coerces colors/customFont/element* — so no change needed there).

### `applyAppSkin()` — the app-appearance owner
New function; single source of truth for app chrome styling:
```js
function applyAppSkin(){
  const root=document.documentElement;
  const t=THEMES[opts.appTheme]||THEMES['Minimal B&W'];
  COLOR_VARS.forEach(k=>root.style.setProperty('--'+k,t[k]));
  document.body.style.fontFamily=`'${opts.appFont||'Georgia'}',serif`;
}
```
- Called once at **init** (after opts are loaded) and whenever an App Settings control changes.
- Sets **all** `COLOR_VARS` on root from the app theme (so any root-var consumer keeps working), plus the body font from the app font.

### Decoupling `imposeAndRender`
Remove the two lines that made the app follow the page appearance:
- Delete `COLOR_VARS.forEach(k=>root.style.setProperty('--'+k,colors[k]));` (~weekly.js:3268). The page palette continues to reach pages via the `colors` object / `--pg-*`; it no longer touches root.
- Delete `document.body.style.fontFamily='<activeFont()>',serif;` (~weekly.js:3318). Page font still reaches pages via inline `.pg` font-family + `--ef-*`.

After this, `imposeAndRender` no longer styles the app chrome at all; `applyAppSkin()` owns it.

### Settings UI (gear + dropdown)
- **Gear button** in `#preview-hdr` (top bar, near the zoom controls): a real `<button id="app-settings-btn">` with `aria-label="App settings"`, `aria-haspopup="true"`, `aria-expanded` kept in sync. Glyph ⚙ (`&#9881;`).
- **Panel** `<div id="app-settings-panel" hidden>` positioned under the gear (absolute), containing two labeled `<select>`s:
  - **App theme** (`#opt-apptheme`) — options = the 6 `THEMES` names; `onchange` sets `opts.appTheme`, calls `applyAppSkin()` + `saveState()`.
  - **App font** (`#opt-appfont`) — options = the 6 fonts; `onchange` sets `opts.appFont`, calls `applyAppSkin()` + `saveState()`.
- **Open/close:** `toggleAppSettings()` flips `hidden` + `aria-expanded`. Closes on Escape and on outside-click (document click handler that ignores clicks within the panel/gear). Native selects handle their own keyboard.
- **A11y:** gear is a native button (keyboard-native); `enhanceA11y` needs no special handling, but the panel selects should get `<label for>` or `aria-label` (consistent with the app's convention — use visible `<label>`s in the panel).
- **Print:** the panel lives in `#preview-hdr`, which is already `display:none` in `@media print` — no leak.

### Page-side renames (display-only)
In Page Style (`sec-style`): the `<h3>`/label "Theme" → "Page theme", "Font" → "Page font". Internal ids (`theme-grid`, `opt-font`) and opts (`opts.theme`, `opts.font`) unchanged.

### Init order
`applyAppSkin()` runs in the init block **after** `loadState()`/opts are ready and after `applyOptsToUI()` (which should also set `#opt-apptheme`/`#opt-appfont` values), and before/independent of the first `generate()`. Since `imposeAndRender` no longer sets root color vars, the app chrome depends on `applyAppSkin()` having run — ensure it runs at init even if `generate()` throws (put it outside/before the guarded generate, or in its own try/catch).

## Edge cases
- **Old saved/imported settings** without `appTheme`/`appFont`: `opts` defaults supply `'Minimal B&W'`/`'Georgia'`; `loadState` spreads `s.opts` over defaults, so missing keys keep defaults. `applyAppSkin` guards with `|| THEMES['Minimal B&W']` / `|| 'Georgia'`.
- **Default parity:** app theme `Minimal B&W` = the current CSS `:root` values, and app font `Georgia` = the current body font, so the out-of-box look is unchanged.
- **Reset All** already clears storage → reload → defaults. Fine.
- `applyOptsToUI` must set the two new selects so the panel reflects saved state.

## Testing (browser-based; core.js untouched → 24 tests stay green)
- Change **App theme** → sidebar/app chrome recolors; a rendered page's ink/dot/line colors are **unchanged**.
- Change **Page theme** → page ink/dot/line change; app chrome **unchanged**.
- Change **App font** → app UI font changes; page element font (`--ef-daynum` / `.pg`) **unchanged**.
- Change **Page font** → page font changes; app body font **unchanged**.
- Gear toggles the panel; Escape/outside-click closes it; `aria-expanded` tracks.
- Persistence: set app theme/font, reload → both restored and applied.
- `read_console_messages {onlyErrors:true}` clean; `node --test` → 24 pass.

## Out of scope / non-goals
- No new palettes or fonts (reuse the existing 6 each).
- No change to page rendering, imposition, or `core.js`.
- No mobile-specific styling for the panel beyond it being usable (the broader mobile backlog is separate).
- No migration of other settings into the menu (App theme + App font only for now; the menu is a home for future app prefs).

## Definition of Done
- Gear (⚙) in the top bar opens an App Settings panel with **App theme** + **App font** selects.
- App theme/font style **only** the app UI; page theme/font style **only** the output — verified independent in both directions.
- Page Style shows "Page theme"/"Page font".
- `applyAppSkin()` is the sole styler of app chrome; the two coupling lines are gone from `imposeAndRender`.
- App settings persist across reload; defaults preserve the current look; console clean; `node --test` 24 green.

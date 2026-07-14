# Print output too small — investigation context & handoff

**Status: UNRESOLVED.** The two prior "fixes" in git did **not** solve the real
problem. This document exists so a fresh session (Fable) can start clean without
inheriting the earlier mistaken conclusions. Read the "Why the earlier work
misled us" section before doing anything.

Written 2026-07-13.

---

## Symptom

Printing / "Save as PDF" of a booklet from a **real browser** produces output
that is far too small: the page content is shrunk to roughly a third of its
expected size, clustered near the center fold, surrounded by large blank
margins.

Evidence (user photo): an A4-landscape sheet labelled "Sheet 2 Back (pp 2 & 3)",
printed from `file:///C:/Claude/Claude Code/tn-weekly-planner/weekly.html`, with
the browser's own print header/footer (date, title, URL, "2/3"). The two page
columns are tiny and hug the center fold.

**This reproduces in the original upstream app too** (the flolipop /
tn-insert-generator app this project was recreated/forked from). That is the
most important clue: the cause is a **shared design/print pattern**, not
something this fork introduced.

---

## Why the earlier work misled us (READ THIS FIRST)

Two commits claim to address "print too small". Treat both with suspicion — the
symptom persists in a real browser.

1. **`df591ec` — "never inherit preview zoom in printed/exported PDF."**
   The on-screen preview uses CSS `zoom` (`adjustZoom` sets `style.zoom` on
   `#print-area`). This commit resets it for print via a `beforeprint` handler
   plus `@media print{#print-area{zoom:1!important}}`.
   - Verified this session: `@media print{zoom:1!important}` **does** correctly
     override an inline `zoom:0.33` in Chrome's print engine (isolated probe:
     an inline-zoomed box still printed at full size). So the zoom reset works,
     and zoom-leak is **not** the cause.

2. **`5db6203` — "scope mobile layout media queries to screen."**
   The `@media (max-width:768px)` blocks had no media *type*, so they defaulted
   to `all` and could apply during print. One of them contains
   `.spread-container{transform:scale(0.32)}`. Scoping them to
   `@media screen and (max-width:768px)` was verified with headless
   `chrome --print-to-pdf`, which showed a ⅓-scale output before and full size
   after. **This verification was unsound.** See below.

### The headless trap

`chrome --headless --print-to-pdf` evaluates `max-width` media queries against a
**narrow layout width**, not the paper width. So `@media (max-width:768px)`
**matches in headless print even on an A4-landscape (~1122px) page** — a
headless-only artifact. That is why headless "reproduced" the ⅓ scaling and why
scoping the query to `screen` "fixed" it *in headless*.

In a **real** Chrome at A4 landscape, `@media (max-width:768px)` never matches
(1122px > 768px), so `scale(0.32)` never applied there in the first place —
meaning `5db6203` most likely changed nothing for real-browser printing. The
headless reproduction did not correspond to the real bug.

**Takeaway: do not use `chrome --print-to-pdf` to reproduce or verify this bug.**
It does not model the print dialog's paper size, margins, or Scale setting, and
it mis-evaluates width media queries. Reproduce in a **real browser**.

### Measurement trap (also cost time)

Measuring the PDF by text/vector bounding boxes is unreliable here:
- `.sheet{background:white}` and page fills render as full-page vector rects, so
  a naive "content bbox" reads as 100% of the page.
- Sparse text on a sheet (e.g. a dot-grid page with one header) reads as ~⅓.
Both produced misleading numbers this session. **Rasterize the page**
(`page.get_pixmap(dpi=…)`) and look, or measure a *specific element's* geometry.

---

## Confirmed facts about the code

- One `.sheet` == one `@page`. Static CSS sets `@page{size:A4 landscape;margin:0}`
  (`weekly.css` ~L251); `imposeAndRender` injects a `#dynamic-page-style`
  `@page{size:<selected paper>}` (`weekly.js` ~L3355) that wins.
- Booklet imposition (`weekly.css` ~L104–107): `.sheet` is the full paper
  (e.g. 297×210 mm). `.spread-container` is the two-up spread at a **fixed** size
  (passport = 2×89 = 178 mm wide × 124 mm tall) **absolutely positioned, centered**
  on the sheet (`top:43mm; left:59.5mm`).
- So **by design**, a passport booklet occupies only ~178/297 ≈ 60% width and
  ~124/210 ≈ 59% height of an A4 sheet, with ~60 mm side and ~43 mm top/bottom
  margins. Small notebook pages on big paper, meant to be cut/folded. The
  headless render of the current build shows exactly this (~60% spread), i.e.
  headless looks "correct".
- Preview zoom: `adjustZoom` (`weekly.js` ~L25) sets `style.zoom` on
  `#print-area`, `#page-preview`, `#book-view`; reset for print via
  `beforeprint`/`afterprint` (~L26) and `@media print` (~L250).

---

## Leading hypotheses for the REAL cause (ranked)

1. **Print-dialog paper / Scale / "Fit to printable area" mismatch.**
   `@page` requests A4 landscape (297 mm wide). If the user's print dialog paper
   is Letter (US default) or A4 *portrait*, Chrome scales the wide landscape
   content to fit the narrower page → shrink. Stacked on the by-design ~60%
   spread, the result reads as ~⅓ with big margins. Headless never sees this
   because it prints at the `@page` size directly.
   *Test:* print with Paper=A4, Margins=None, Scale=100 and compare to
   Paper=Letter / Margins=Default / Scale=Default(Fit).

2. **By-design small imposition, perceived as the bug.** For small TN sizes,
   booklet mode centers a small spread on big paper with large margins. The
   desired behavior may be "scale the spread to fill the paper" or default to a
   packed multi-up layout (the existing `savePaper`/`layout2up` path).
   *Test:* compare a large size (A5, 148×210) and `savePaper` on vs off.

3. **Physical size not preserved (1:1 mm).** If the print pipeline scales, the
   folded inserts come out undersized for the real notebook. *Test:* measure a
   printed page's actual mm (ruler, or in the PDF) against expected (passport
   page = 89×124 mm).

4. **Some real-browser-only scaling** the headless path doesn't model.

Given "reproduces in the upstream app too", hypotheses 1 and 2 (shared
imposition/paper behavior) are the most likely.

---

## Reproduction protocol (REAL browser — headless is not authoritative)

1. `cd tn-weekly-planner && python -m http.server <PORT>`; open `weekly.html` in
   Chrome (or `file://`). Use a **fresh port after any edit** — the app caches
   JS/CSS aggressively.
2. Generate a booklet (defaults: passport size, booklet mode).
3. `Ctrl+P` → "Save as PDF". **Record the dialog state**: Paper size, Margins,
   Scale, "Fit to printable area". Produce several PDFs varying:
   - Paper A4, Margins None, Scale 100.
   - Paper Letter (default), Margins Default.
   - Scale Default(Fit) vs Custom 100.
4. Measure each with PyMuPDF: rasterize and view, or measure the spread's mm.
   Expected for passport on A4 landscape: each A5 page ≈ 89×124 mm; the spread
   ≈ 178×124 mm centered on 297×210 mm. `PT2MM = 25.4/72`.
5. Identify which dialog setting (or code path) yields the tiny output.
6. Repeat against the original upstream app to confirm the shared cause and,
   ideally, see how (or whether) it is meant to be handled there.

---

## Tooling notes

- Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe`. Edge also
  installed.
- PyMuPDF present (`import fitz`, v1.28). poppler/`pdftoppm` **not** installed.
- Headless one-liner (for reference only — NOT authoritative for this bug):
  `chrome --headless=new --no-pdf-header-footer --print-to-pdf=out.pdf <URL>`.

---

## Key files / pointers

- `weekly.css`: `@media print` (~L241), static `@page` (~L251) + JS
  `#dynamic-page-style` (see below), `.sheet` / `.spread-container` geometry
  (~L104–107), mobile blocks `@media screen and (max-width:768px)` (L199, L387,
  L506).
- `weekly.js`: `imposeAndRender` (~L3300), `#dynamic-page-style` `@page`
  injection (~L3355), `adjustZoom` / `previewZoom` (~L24), `beforeprint` /
  `afterprint` (~L26).
- The fixed-mm spread on a full-paper sheet is the pattern shared with the
  upstream app; that is where the shared cause most likely lives.

---

## Distrust these

- Git commits `df591ec` and `5db6203` and any memory note claiming
  "print too small — fixed". They addressed a headless artifact and a
  now-confirmed non-cause. The real-browser bug is still open.

## Suggested first move (Fable)

Reproduce in a real browser, varying the print dialog's Paper / Scale / Margins,
and measure the output in mm. Decide whether the shrink comes from a dialog
setting (→ needs an `@page`/paper fix or explicit user guidance) or from the
imposition geometry (→ needs a scale-to-fill-paper option). **Do not trust
headless `--print-to-pdf` to reproduce or verify this.**

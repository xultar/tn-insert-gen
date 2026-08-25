# Daily Facing Notes Page — Design

**Status:** Approved (brainstorm 2026-07-11). Next: writing-plans.

## Goal

Add an option so that, in a bound booklet, **every daily page is a left-hand page with a facing notes page on the right**. The facing page is minimal: the current fill style (dots/grid/ruled/blank) with a **small date in a top corner**, otherwise empty.

## Scope (locked)

- Works in **both** generation paths: the wall's full-month `generate()` **and** the greeter's `daily` page-type / booklet entries. Driven by one shared flag `opts.dailyFacingNotes` (default **off**).
- Applies to **both** daily layouts — standard (`mkDay`) and time-block (`mkTimeBlockDay`).
- **Uniform 2-page units:** in the wall's daily section, *every* content page becomes a `[content-left, facing-right]` pair — the **weekly summary** and the **weekly reflection** (when enabled) get **dateless** facing blanks too, not just the day pages. This keeps the section even-length so no scattered per-day fillers are needed.
- **One boundary alignment** page is acceptable: if a daily run would otherwise begin on a right slot, insert a single blank (current fill style, no date) to push it back to the left.

## Locked design decisions (from brainstorm)

1. Facing page = **small date in a corner, mostly blank**, in the current fill style. Dateless for summary/reflection/alignment blanks.
2. Scope = **both wall + greeter**, one global `opts.dailyFacingNotes`.
3. Parity strategy = **uniform 2-page units** (summary + each day + reflection all paired), **plus** at most one boundary alignment page per daily run.

## Components

### 1. `mkFacingNotes(dateLabel, colors)` — new builder (weekly.js, near `mkPlain`)
- Builds a page via the standard `pg(...)` shell, applies `getFillStyle(colors)` (so it inherits the user's ruling), and tags `dataset.lbl='facing-notes'`.
- If `dateLabel` is truthy, appends a small, subtle date element in a top corner (e.g. `Wed 1`), styled with the dim/label color; if `null`/omitted, the page is left blank.
- Because it reuses `pg`, it inherits size, margins, and theme automatically — same as `mkPlain`.

### 2. Pairing at build time (wall + greeter)
When `opts.dailyFacingNotes` is on, each content page in a daily context is emitted immediately followed by its facing page:
- **Wall** `generate()` daily loop (weekly.js:~3031): weekly summary → `[summary, mkFacingNotes(null)]`; each day → `[dayPage, mkFacingNotes(dateLabel(y,m,d))]`; weekly reflection → `[reflection, mkFacingNotes(null)]`.
- **Greeter** `daily` page-type expand (greeter.js:~29): each day → `[dayPage, mkFacingNotes(dateLabel)]`. (The greeter daily stream has no summaries/reflections — just day pairs.)
- **Every paired content page** (summary, day, reflection) is marked (e.g. `dataset.facingPair='1'`) and each facing page tagged `dataset.lbl='facing-notes'`, so the alignment pass can identify contiguous paired **runs** and their first page. (In the wall a run begins with the weekly *summary*; in the greeter it begins with the first *day* — the anchor is whichever paired page comes first in the block.)

### 3. Central alignment pass (imposeAndRender) — the "guaranteed right" guarantee
Alignment runs **once, centrally, at the very top of `imposeAndRender`** (right after `const els = pageEls;`, before page numbers / preview / book / print are built), operating on the DOM element array. This is shared by both the wall and the greeter, so all three views (single-page preview, book spreads, print imposition) build from the **same aligned list** and agree.

- `alignFacingRuns(els, colors)` returns a new array: walk `els` and identify each maximal **contiguous run of paired units** (pages marked `data-facing-pair` or `data-lbl="facing-notes"`). At the **first content page of each run**, if it sits on a **right** slot (odd index), splice one blank alignment page (`mkFacingNotes(null, colors)`) immediately before it. Every unit in a run is 2 pages, so aligning the run's first page keeps every content page on the left and every facing page on the right.
- **`opts.coverSheet` caveat:** the book/preview views include the cover, but `coverSheet` later extracts the cover into a separate sheet for the *print* view only (weekly.js:~3148), shifting the print body's parity by one. With `coverSheet` **off** (the default) all three views agree. With `coverSheet` **on**, the physical print body may be off by one; this is a documented edge for verification and a possible follow-up (a print-path-only adjustment), not part of the initial implementation.
- Handles the greeter case of **multiple daily entries** in one booklet — each run is aligned independently.

### 4. Left/right convention — verify empirically
This app's book view pairs `(0,1)`, `(2,3)`, … as `(left, right)`, so index-even ⇒ left is the working assumption (day on even/left, notes on odd/right). **Confirm in the rendered book AND print/imposition views** that a day actually shows on the left with its notes on the right; if the imposition's physical fold reverses this, flip the parity target. This is the top verification risk.

### 5. Wiring / UI
`dailyFacingNotes` follows the exact dual-control pattern already used by `dailyLayout` — a wall control **and** a greeter guided chip, both writing the same `opts` key:
- Add `dailyFacingNotes: false` to the `opts` defaults (weekly.js:~73, beside `dailyLayout`).
- **Wall:** a toggle in the wall's **Daily** settings section (`#opt-dailyfacingnotes`), wired through `applyOptsToUI` / `readOptsFromUI` like the other daily controls.
- **Greeter:** add a second guided spec to the `daily` page type — `{opt:'dailyFacingNotes', label:'Facing notes', choices:[[false,'Off'],[true,'On']]}` — so a Facing-notes chip pair appears when Daily is selected (alongside the existing Layout chips). The chip mechanism already handles non-string values (`opts[spec.opt]===val` compare, `opts[spec.opt]=val` set), and `grAdd`/`grGenerate` snapshot & restore it per entry exactly like `dailyLayout`.
- **Tray label fix (needed so the boolean renders sensibly):** update `grEntryLabel` to map each guided value to its choice's **display text** and skip off/unset values — e.g. `dailyLayout:'timeblock'` → "Time-block", `dailyFacingNotes:true` → "On", `dailyFacingNotes:false` → omitted. (This also resolves the existing review note that the tray showed raw values like "year".)

## Impact

- Roughly **doubles** the daily section's page count. The booklet's multiple-of-4 padding and the greeter tray total both adjust automatically (the tray count derives from `expand().length`).
- No `core.js` change → `node --test` stays at 12 green.

## Testing / verification

- `node --test` unchanged (12 green).
- Browser-verify in the **book and print/imposition views** (fresh port — cache):
  - Each day is on the **left**, its notes page on the **right**, for standard **and** time-block layouts.
  - Wall full-month **and** greeter Daily-entry paths.
  - With and without weekly reflection enabled.
  - The **odd/even boundary** case: preceding content of both parities → the daily run still starts on the left (alignment page appears only when needed).
  - `opts.coverSheet` on and off (cover extraction must not flip the alignment).
  - Greeter booklet with **two** daily entries separated by another entry → both runs aligned.
  - Greeter **Facing-notes chip** toggles `opts.dailyFacingNotes`, drives the live preview, snapshots per entry, and the **tray label** reads sensibly (e.g. "Daily · Time-block · On", and no raw `true`/`false`).
- Toggle off → output is byte-for-byte the previous behavior (no facing pages, no alignment pages).

## Out of scope (follow-ups)

- Facing pages for non-daily page types (future log, monthly, etc.).
- Configurable facing-page content beyond the small date (e.g. "Notes" label, prompts).

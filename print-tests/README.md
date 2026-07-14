# Print-test protocol (print-too-small bug)

Purpose: determine whether the ~⅓-size booklet output comes from the print
dialog's paper/margins/scale settings, or from something else. Produced PDFs
are measured by `measure_pdfs.py` (dark-ink span; expected ~200 mm at true
100% for the default passport booklet — crop marks + spread).

## App state (same for every PDF)

1. Open `weekly.html` in Chrome (file:// is fine).
2. Leave everything at defaults: Passport size, A4 paper, Booklet mode,
   crop marks + fold line ON. Generate the booklet.

## PDFs to produce (save each into THIS folder with the given name)

For each one: `Ctrl+P`, Destination = **Save as PDF**, then set ONLY what's
listed. Expand "More settings" to reach Margins / Scale / Headers.

| File name         | Paper size | Margins | Scale            | Headers/footers |
|-------------------|-----------|---------|------------------|-----------------|
| `defaults.pdf`    | (change nothing — whatever the dialog opens with) |||
| `correct.pdf`     | A4        | None    | Custom → 100     | OFF             |
| `letter-fit.pdf`  | Letter    | Default | Default          | ON              |

**For `defaults.pdf`, write down what the dialog showed** (Paper size,
Margins, Scale, Headers on/off, Layout portrait/landscape) — that's the
configuration that produced the original bad print.

## Also useful

- The photo of the physical bad sheet, if still around (drop it in here).
- How that physical sheet was printed: directly Chrome → printer, or
  Chrome → Save as PDF → opened in a PDF viewer → printed from there?
  (PDF viewers add their own "Fit to page" shrink — a separate suspect.)

"""Measure booklet print-test PDFs (see README.md in this folder).

For every *.pdf here: report page size in mm, rasterize each page, and measure
the DARK-ink bounding box (crop marks / fold line / headers — ignores the white
sheet, light-gray dots and labels). Writes a PNG per page next to the PDF so a
human (or Claude) can look at the actual raster, per the handoff doc's warning
about bbox-only measurement.

Expected geometry for the DEFAULT passport booklet on A4 landscape @ 100%:
  page               297.0 x 210.0 mm
  dark-ink width     ~200 mm  (178 mm spread + 10 mm crop marks each side)
  dark-ink left edge ~48.5 mm ... right edge ~248.5 mm  (centered)
  fold line x        148.5 mm
Any uniform print-pipeline scale factor s shows up as: measured_width ~ 200*s
(centered), so s = measured_width / 200.
"""
import sys, glob, os
import fitz

PT2MM = 25.4 / 72
DPI = 100
PX2MM = 25.4 / DPI
DARK = 120          # gray level below which a pixel counts as "dark ink"
EDGE_SKIP_MM = 6    # ignore a border strip: browser headers/footers live there

def dark_bbox(pix, skip_px):
    """Bounding box of dark pixels, ignoring an outer strip of skip_px."""
    import struct
    w, h, n = pix.width, pix.height, pix.n
    buf = pix.samples
    minx, miny, maxx, maxy = None, None, None, None
    for y in range(skip_px, h - skip_px):
        row = buf[y * pix.stride:(y + 1) * pix.stride]
        for x in range(skip_px, w - skip_px):
            px = row[x * n:x * n + 3]
            if px and (px[0] + px[1] + px[2]) / 3 < DARK:
                if minx is None or x < minx: minx = x
                if maxx is None or x > maxx: maxx = x
                if miny is None: miny = y
                maxy = y
    if minx is None:
        return None
    return (minx, miny, maxx, maxy)

def main(folder):
    pdfs = sorted(glob.glob(os.path.join(folder, "*.pdf")))
    if not pdfs:
        print("No PDFs found in", folder); return
    for path in pdfs:
        doc = fitz.open(path)
        print(f"\n=== {os.path.basename(path)} — {doc.page_count} page(s) ===")
        for i, page in enumerate(doc):
            wmm, hmm = page.rect.width * PT2MM, page.rect.height * PT2MM
            pix = page.get_pixmap(dpi=DPI)
            png = os.path.splitext(path)[0] + f"_p{i+1}.png"
            pix.save(png)
            bb = dark_bbox(pix, int(EDGE_SKIP_MM / PX2MM))
            print(f"  page {i+1}: {wmm:.1f} x {hmm:.1f} mm  -> {os.path.basename(png)}")
            if bb:
                x0, y0, x1, y1 = [v * PX2MM for v in bb]
                iw = x1 - x0
                print(f"    dark-ink bbox: x {x0:.1f}..{x1:.1f} mm (w={iw:.1f}), "
                      f"y {y0:.1f}..{y1:.1f} mm")
                print(f"    implied scale vs 200 mm expectation: {iw/200:.2f}")
            else:
                print("    no dark ink found (blank page?)")
        doc.close()

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__)))

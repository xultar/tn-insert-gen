'use strict';
(function (root) {
  var NOTEBOOK_SIZES = {
    pocket:   { label: 'Pocket',            w: 89,  h: 140 },
    passport: { label: 'Passport',          w: 89,  h: 124 },
    b6slim:   { label: 'B6 Slim',           w: 91,  h: 182 },
    personal: { label: 'Personal',          w: 95,  h: 171 },
    a5slim:   { label: 'A5 Slim',           w: 105, h: 210 },
    regular:  { label: 'Regular',           w: 110, h: 210 },
    a5:       { label: 'A5',                 w: 148, h: 210 }
  };

  // Bands (months) per Future Log page, derived from page height in mm.
  function futureLogBandCount(heightMm) {
    return heightMm < 150 ? 2 : 3;
  }

  // Weeks-of-a-month matrix. Blanks are null. weekStart: 'monday' | 'sunday'.
  function monthMatrix(year, monthIndex, weekStart) {
    var startOffset = weekStart === 'sunday' ? 0 : 1;
    var firstDay = new Date(year, monthIndex, 1).getDay(); // 0 = Sunday
    var offset = (firstDay - startOffset + 7) % 7;
    var totalDays = new Date(year, monthIndex + 1, 0).getDate();
    var flat = [];
    var i;
    for (i = 0; i < offset; i++) flat.push(null);
    for (var d = 1; d <= totalDays; d++) flat.push(d);
    while (flat.length % 7 !== 0) flat.push(null);
    var weeks = [];
    for (i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
    return weeks;
  }

  // Expand a start month + count into pages of {year, month}, perPage each.
  function paginateMonths(startYear, startMonth, count, perPage) {
    var months = [];
    for (var i = 0; i < count; i++) {
      var idx = startMonth + i;
      months.push({ year: startYear + Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 });
    }
    var pages = [];
    for (var p = 0; p < months.length; p += perPage) pages.push(months.slice(p, p + perPage));
    return pages;
  }

  function bookletAdd(list, entry) {
    return list.concat([entry]);
  }

  function bookletRemove(list, id) {
    return list.filter(function (e) { return e.id !== id; });
  }

  function bookletMove(list, id, dir) {
    var i = list.findIndex(function (e) { return e.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list.slice();
    var out = list.slice();
    var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    return out;
  }

  function bookletTotalPages(list) {
    return list.reduce(function (n, e) { return n + (e.pageCount || 0); }, 0);
  }

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

  // Custom notebook dimensions are user-typed; clamp to a sane mm range so a
  // stray 0 / negative / huge value can't produce a broken or invisible page.
  var NOTEBOOK_MIN_MM = 40;
  var NOTEBOOK_MAX_MM = 300;
  function clampNotebookDim(v, def) {
    var n = parseInt(v, 10);
    if (!isFinite(n)) return def;
    if (n < NOTEBOOK_MIN_MM) return NOTEBOOK_MIN_MM;
    if (n > NOTEBOOK_MAX_MM) return NOTEBOOK_MAX_MM;
    return n;
  }

  // Persisted/imported collections may be corrupt (null items, wrong types).
  // Drop anything that isn't a plain object so later render loops can't throw.
  function sanitizeCollection(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (x) { return x && typeof x === 'object'; });
  }

  // Habits are indexed by weekday via h.days.includes(...); guarantee days is
  // an array so a malformed habit can't crash daily-page generation.
  function sanitizeHabits(list) {
    return sanitizeCollection(list).map(function (h) {
      if (!Array.isArray(h.days)) h.days = [];
      return h;
    });
  }

  // Undated pages: a full 6-week grid with no day numbers — the user writes
  // dates in by hand (31-day convention; extras get struck out).
  function blankMonthMatrix() {
    var weeks = [];
    for (var w = 0; w < 6; w++) {
      var row = [];
      for (var d = 0; d < 7; d++) row.push(null);
      weeks.push(row);
    }
    return weeks;
  }

  // Undated Daily generates a user-chosen number of pages. Garbage → 31
  // (a month's worth); otherwise clamp to [1, 93].
  function clampDailyCount(raw) {
    var n = parseInt(raw, 10);
    if (isNaN(n)) return 31;
    return Math.min(93, Math.max(1, n));
  }

  // Text for the canvas-mode banner: the pages canvas shows either a preview
  // of the current selection or the assembled booklet, and the banner is what
  // tells the user which one they're looking at.
  function canvasBannerText(mode, label, pageCount) {
    if (mode === 'preview') return 'Previewing: ' + label + ' — not in booklet yet';
    return 'Your booklet — ' + pageCount + (pageCount === 1 ? ' page' : ' pages');
  }

  // Flatten a {day: [names]} holiday map (holidayMap's shape) into
  // render-ready {day, name} entries sorted ascending by day.
  function holidayListEntries(map) {
    if (!map || typeof map !== 'object') return [];
    var out = [];
    Object.keys(map).map(Number).sort(function (a, b) { return a - b; })
      .forEach(function (d) {
        (map[d] || []).forEach(function (name) { out.push({ day: d, name: name }); });
      });
    return out;
  }

  // User-typed text (tracker titles/labels, habit names) is interpolated into
  // SVG markup strings; escape it so "&" or "<" can't break the parse.
  function escapeXML(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var api = {
    NOTEBOOK_SIZES: NOTEBOOK_SIZES,
    NOTEBOOK_MIN_MM: NOTEBOOK_MIN_MM,
    NOTEBOOK_MAX_MM: NOTEBOOK_MAX_MM,
    clampNotebookDim: clampNotebookDim,
    sanitizeCollection: sanitizeCollection,
    sanitizeHabits: sanitizeHabits,
    futureLogBandCount: futureLogBandCount,
    monthMatrix: monthMatrix,
    blankMonthMatrix: blankMonthMatrix,
    clampDailyCount: clampDailyCount,
    canvasBannerText: canvasBannerText,
    holidayListEntries: holidayListEntries,
    escapeXML: escapeXML,
    paginateMonths: paginateMonths,
    bookletAdd: bookletAdd,
    bookletRemove: bookletRemove,
    bookletMove: bookletMove,
    bookletTotalPages: bookletTotalPages,
    facingAlignInserts: facingAlignInserts,
    flatImposition: flatImposition
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TNCore = api;
})(typeof self !== 'undefined' ? self : this);

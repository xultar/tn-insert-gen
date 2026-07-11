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

  var api = {
    NOTEBOOK_SIZES: NOTEBOOK_SIZES,
    futureLogBandCount: futureLogBandCount,
    monthMatrix: monthMatrix,
    paginateMonths: paginateMonths,
    bookletAdd: bookletAdd,
    bookletRemove: bookletRemove,
    bookletMove: bookletMove,
    bookletTotalPages: bookletTotalPages,
    facingAlignInserts: facingAlignInserts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TNCore = api;
})(typeof self !== 'undefined' ? self : this);

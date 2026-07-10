'use strict';
(function (root) {
  var NOTEBOOK_SIZES = {
    pocket:   { label: 'Pocket (3.5×5.5")', w: 89,  h: 140 },
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

  var api = {
    NOTEBOOK_SIZES: NOTEBOOK_SIZES,
    futureLogBandCount: futureLogBandCount,
    monthMatrix: monthMatrix
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TNCore = api;
})(typeof self !== 'undefined' ? self : this);

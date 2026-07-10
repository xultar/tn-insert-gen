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

  var api = {
    NOTEBOOK_SIZES: NOTEBOOK_SIZES,
    futureLogBandCount: futureLogBandCount
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TNCore = api;
})(typeof self !== 'undefined' ? self : this);

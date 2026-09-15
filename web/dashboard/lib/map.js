(function () {
  var cfg = window.MAP_TILE_CONFIG || {};
  var errors = 0, mode = "street";
  function recordError() { errors += 1; if (errors >= (cfg.errorThreshold || 3)) mode = "satellite"; return mode; }
  function current() { return mode === "satellite" ? cfg.satelliteUrl : cfg.streetUrl; }
  function reset() { errors = 0; mode = "street"; }
  window.ResilientTileSource = { recordError: recordError, current: current, reset: reset, mode: function () { return mode; } };
}());

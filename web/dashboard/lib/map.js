(function () {
  "use strict";
  var cfg = window.MAP_TILE_CONFIG || {};
  var errors = 0, mode = "street", active = null;
  var STATUS_COLOR = {
    surveying: "#df6c3a",
    candidate: "#e9b949",
    selected: "#1677a6",
    archived: "#766d65",
    operating: "#087f77"
  };

  function recordError() { errors += 1; if (errors >= (cfg.errorThreshold || 3)) mode = "satellite"; return mode; }
  function current() { return mode === "satellite" ? cfg.satelliteUrl : cfg.streetUrl; }
  function reset() { errors = 0; mode = "street"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]; }); }
  function validPoint(site) {
    if (!site || site.status === "hidden" || site.lat == null || site.lon == null || String(site.lat).trim() === "" || String(site.lon).trim() === "") return false;
    var lat = Number(site.lat), lon = Number(site.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function installFallback(map, layer, nextLayer, label) {
    var failures = 0, switched = false;
    layer.on("tileload", function () { failures = 0; });
    layer.on("tileerror", function () {
      failures += 1;
      if (switched || failures < (cfg.errorThreshold || 3) || !map.hasLayer(layer)) return;
      switched = true;
      recordError();
      map.removeLayer(layer);
      nextLayer.addTo(map);
      console.warn("Basemap unavailable; switched to " + label + ".");
    });
  }

  function displayPoint(site, occupied) {
    var lat = Number(site.lat), lon = Number(site.lon), key = lat.toFixed(6) + "/" + lon.toFixed(6);
    var count = occupied[key] || 0;
    occupied[key] = count + 1;
    if (count) lon += count * 9 / (111320 * Math.cos(lat * Math.PI / 180));
    return [lat, lon];
  }

  function render(containerId, sites, options) {
    options = options || {};
    var container = document.getElementById(containerId);
    if (!container) return null;
    if (active && active.map) { active.map.remove(); active = null; }
    var mapped = (sites || []).filter(validPoint);
    if (!window.L) {
      container.innerHTML = '<div class="map-empty"><strong>Map library unavailable</strong><span>Reload when the connection is available.</span></div>';
      return null;
    }
    if (!mapped.length) {
      container.innerHTML = '<div class="map-empty"><strong>No mapped locations</strong><span>Add a Google Maps location to a Survey record.</span></div>';
      return null;
    }

    reset();
    var map = L.map(container, { minZoom: 11, maxZoom: 19, zoomControl: true });
    var streets = L.tileLayer(cfg.streetUrl, { maxZoom: 19, attribution: "Tiles &copy; Esri" });
    var satellite = L.tileLayer(cfg.satelliteUrl, { maxZoom: 19, attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics" });
    streets.addTo(map);
    L.control.layers({ Streets: streets, Satellite: satellite }, {}, { collapsed: false, position: "topright" }).addTo(map);
    installFallback(map, streets, satellite, "satellite");

    var markers = {}, bounds = [], occupied = {};
    mapped.forEach(function (site) {
      var point = displayPoint(site, occupied), color = STATUS_COLOR[site.status] || "#57534e";
      var marker = L.marker(point, {
        icon: L.divIcon({
          className: "atlas-marker-wrap",
          iconSize: [30, 36], iconAnchor: [15, 34], popupAnchor: [0, -30],
          html: '<span class="atlas-marker" style="--marker-color:' + color + '"><i></i></span>'
        })
      });
      marker.bindPopup(options.popup ? options.popup(site) : '<strong>' + esc(site.name) + '</strong>', { maxWidth: 320, minWidth: 230 });
      marker.bindTooltip(esc(site.name), { direction: "top", offset: [0, -28], className: "atlas-tooltip" });
      marker.addTo(map);
      markers[site.id] = { marker: marker, point: point };
      bounds.push(point);
    });

    if (bounds.length === 1) map.setView(bounds[0], 16);
    else map.fitBounds(L.latLngBounds(bounds), { padding: [42, 42], maxZoom: 16 });

    container.addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("[data-map-detail]");
      if (!button || !options.openRecord) return;
      var site = mapped.find(function (row) { return row.id === button.getAttribute("data-map-detail"); });
      if (site) options.openRecord(site);
    });

    active = {
      map: map,
      markers: markers,
      focus: function (id) {
        var hit = markers[id];
        if (!hit) return false;
        map.flyTo(hit.point, 17, { duration: 0.85 });
        hit.marker.openPopup();
        return true;
      }
    };
    setTimeout(function () { map.invalidateSize(); }, 60);
    return active;
  }

  window.ResilientTileSource = { recordError: recordError, current: current, reset: reset, mode: function () { return mode; } };
  window.DashboardMap = { render: render, isMappable: validPoint, statusColor: function (status) { return STATUS_COLOR[status] || "#57534e"; } };
}());

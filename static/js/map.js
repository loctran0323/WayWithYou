/**
 * Map: origin/destination pins, driving route line and ETA using free services only.
 * Nominatim (OpenStreetMap) for geocoding – US only so no wrong locations.
 * OSRM for driving route and drive time – no API key needed.
 */
(function () {
  var map;
  var currentMarker;
  var originMarker;
  var destinationMarker;
  var routeLayer;
  var userLatLng = null;

  /** Prefer US: "City, ST" -> "City, ST, USA" so geocoding stays in the US. */
  function forUS(query) {
    if (!query || typeof query !== "string") return query;
    var t = query.trim();
    if (/,\s*[A-Za-z]{2}\s*$/.test(t)) return t + ", USA";
    return t;
  }

  /** Geocode one place – US only (countrycodes=us) so we never get Antarctica etc. */
  function geocode(query) {
    var q = forUS(query);
    var url = "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(q) + "&format=json&limit=1&countrycodes=us";
    return fetch(url, { headers: { "Accept": "application/json", "User-Agent": "WayWithYouRides/1.0" } })
      .then(function (r) { return r.json(); })
      .then(function (results) {
        if (!results || results.length === 0) return null;
        var r = results[0];
        return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), display_name: r.display_name };
      });
  }

  /** Get driving route and duration from OSRM (no key). Coords: [lat, lng]. */
  function osrmRoute(fromLatLng, toLatLng) {
    var c = fromLatLng[0] + "," + fromLatLng[1] + ";" + toLatLng[0] + "," + toLatLng[1];
    var url = "https://router.project-osrm.org/route/v1/driving/" + c + "?overview=full&geometries=geojson";
    return fetch(url).then(function (r) { return r.json(); });
  }

  function initMap() {
    if (typeof L === "undefined") return;
    if (map) return;
    var container = document.getElementById("wty-map");
    if (!container) return;
    map = L.map("wty-map").setView([39.83, -98.58], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    var etaEl = document.getElementById("map-eta");
    var destInput = document.getElementById("map-destination");
    var setDestBtn = document.getElementById("map-set-destination");

    if (setDestBtn) {
      setDestBtn.addEventListener("click", function () {
        var q = (destInput && destInput.value) ? destInput.value.trim() : "";
        if (!q) {
          etaEl.classList.add("hidden");
          etaEl.textContent = "";
          return;
        }
        setDestination(q, etaEl);
      });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          userLatLng = [pos.coords.latitude, pos.coords.longitude];
          if (currentMarker) map.removeLayer(currentMarker);
          currentMarker = L.marker(userLatLng, {
            icon: L.divIcon({
              className: "wty-marker-current",
              html: "<div style='background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>",
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            }),
          })
            .addTo(map)
            .bindPopup("Your location");
          if (!originMarker && !destinationMarker) map.setView(userLatLng, 13);
        },
        function () {
          if (!originMarker && !destinationMarker) map.setView([39.83, -98.58], 4);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }

  function drawLine(latlngs, etaEl, durationSeconds) {
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.polyline(latlngs, { color: "#1e40af", weight: 5, opacity: 0.9 }).addTo(map);
    if (etaEl) {
      etaEl.classList.remove("hidden");
      if (durationSeconds != null && durationSeconds > 0) {
        var min = Math.round(durationSeconds / 60);
        etaEl.textContent = min < 60 ? "Drive time: ~" + min + " min" : "Drive time: ~" + Math.floor(min / 60) + " hr " + (min % 60) + " min";
      } else {
        etaEl.textContent = "Route shown (drive time not available).";
      }
    }
    map.fitBounds(latlngs, { padding: [50, 50], maxZoom: 14 });
  }

  /**
   * Join ride: show route from ride origin to destination (US geocoding + OSRM line + ETA).
   */
  function setMapRoute(originStr, destinationStr) {
    if (!originStr || !destinationStr) return;
    originStr = originStr.trim();
    destinationStr = destinationStr.trim();
    if (!originStr || !destinationStr) return;

    if (!map && typeof L !== "undefined" && document.getElementById("wty-map")) initMap();
    if (!map) return;

    var etaEl = document.getElementById("map-eta");
    if (etaEl) {
      etaEl.textContent = "Finding route…";
      etaEl.classList.remove("hidden");
    }
    var mapCard = document.querySelector(".wty-map-card");
    if (mapCard) mapCard.scrollIntoView({ behavior: "smooth", block: "start" });

    removeRouteAndMarkers();

    Promise.all([geocode(originStr), geocode(destinationStr)]).then(function (pair) {
      var origin = pair[0];
      var dest = pair[1];
      if (!origin || !dest) {
        if (etaEl) etaEl.textContent = "Could not find one or both places. Use city and state (e.g. Princeton, NJ).";
        return;
      }
      var start = [origin.lat, origin.lon];
      var end = [dest.lat, dest.lon];

      if (originMarker) map.removeLayer(originMarker);
      originMarker = L.marker(start, {
        icon: L.divIcon({
          className: "wty-marker-origin",
          html: "<div style='background:#16a34a;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(map).bindPopup("Start: " + (origin.display_name || originStr));

      if (destinationMarker) map.removeLayer(destinationMarker);
      destinationMarker = L.marker(end, {
        icon: L.divIcon({
          className: "wty-marker-dest",
          html: "<div style='background:#dc2626;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>",
          iconSize: [24, 24],
          iconAnchor: [12, 22],
        }),
      }).addTo(map).bindPopup("Destination: " + (dest.display_name || destinationStr));

      osrmRoute(start, end).then(function (data) {
        if (data.code === "Ok" && data.routes && data.routes[0]) {
          var route = data.routes[0];
          var geom = route.geometry;
          var durationSec = route.duration != null ? route.duration : 0;
          if (geom && geom.coordinates && geom.coordinates.length > 0) {
            var latlngs = geom.coordinates.map(function (c) { return [c[1], c[0]]; });
            drawLine(latlngs, etaEl, durationSec);
          } else {
            drawLine([start, end], etaEl, durationSec > 0 ? durationSec : null);
          }
        } else {
          drawLine([start, end], etaEl, null);
        }
      }).catch(function () {
        drawLine([start, end], etaEl, null);
      });
    }).catch(function () {
      if (etaEl) etaEl.textContent = "Could not find places. Try city, state (e.g. Princeton, NJ).";
    });
  }

  /** Set destination (manual): route from your location to typed address. */
  function setDestination(query, etaEl) {
    if (!etaEl) etaEl = document.getElementById("map-eta");
    etaEl.textContent = "Finding destination…";
    etaEl.classList.remove("hidden");

    geocode(query).then(function (dest) {
      if (!dest) {
        etaEl.textContent = "Destination not found. Try city, state (e.g. Princeton, NJ).";
        removeRouteAndMarkers();
        return;
      }
      var destLatLng = [dest.lat, dest.lon];

      if (originMarker) map.removeLayer(originMarker);
      originMarker = null;
      if (destinationMarker) map.removeLayer(destinationMarker);
      destinationMarker = L.marker(destLatLng, {
        icon: L.divIcon({
          className: "wty-marker-dest",
          html: "<div style='background:#dc2626;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>",
          iconSize: [24, 24],
          iconAnchor: [12, 22],
        }),
      }).addTo(map).bindPopup("Destination: " + (dest.display_name || query));

      if (routeLayer) map.removeLayer(routeLayer);
      routeLayer = null;

      var from = userLatLng || destLatLng;
      osrmRoute(from, destLatLng).then(function (data) {
        if (data.code === "Ok" && data.routes && data.routes[0]) {
          var route = data.routes[0];
          var geom = route.geometry;
          var durationSec = route.duration != null ? route.duration : 0;
          if (geom && geom.coordinates && geom.coordinates.length > 0) {
            var latlngs = geom.coordinates.map(function (c) { return [c[1], c[0]]; });
            drawLine(latlngs, etaEl, durationSec);
          } else {
            drawLine([from, destLatLng], etaEl, durationSec > 0 ? durationSec : null);
          }
        } else {
          drawLine([from, destLatLng], etaEl, null);
        }
      }).catch(function () {
        drawLine([from, destLatLng], etaEl, null);
      });
    }).catch(function () {
      etaEl.textContent = "Could not find destination. Try city, state.";
      removeRouteAndMarkers();
    });
  }

  function removeRouteAndMarkers() {
    if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
    if (destinationMarker) { map.removeLayer(destinationMarker); destinationMarker = null; }
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  }

  function setMapDestination(destinationStr) {
    if (!destinationStr || !destinationStr.trim()) return;
    if (!map && typeof L !== "undefined" && document.getElementById("wty-map")) initMap();
    if (!map) return;
    var destInput = document.getElementById("map-destination");
    if (destInput) destInput.value = destinationStr.trim();
    var mapCard = document.querySelector(".wty-map-card");
    if (mapCard) mapCard.scrollIntoView({ behavior: "smooth", block: "start" });
    setDestination(destinationStr.trim(), document.getElementById("map-eta"));
  }

  window.setMapDestination = setMapDestination;
  window.setMapRoute = setMapRoute;

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest(".wty-join-ride");
    if (!btn) return;
    var origin = btn.dataset.origin;
    var dest = btn.dataset.destination;
    if (origin && dest) {
      setMapRoute(origin, dest);
    } else if (dest) {
      setMapDestination(dest);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMap);
  } else {
    initMap();
  }
})();

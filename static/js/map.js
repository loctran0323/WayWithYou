/**
 * Map: route line + ETA via backend (Mapbox when token set, else OSRM). Geocoding US-only.
 * Tiles: OpenStreetMap (Leaflet).
 */
(function () {
  var map;
  var currentMarker;
  var originMarker;
  var destinationMarker;
  var routeLayer;
  var userLatLng = null;

  function getDirectionsUrl() {
    var el = document.getElementById("wty-map");
    var url = (el && el.getAttribute("data-directions-url")) || "";
    if (!url && typeof window !== "undefined" && window.location && window.location.pathname) {
      var base = window.location.pathname.replace(/\/?$/, "");
      if (base.indexOf("/rides") !== -1) url = (base.split("/rides")[0] || "") + "/rides/api/directions/";
      else url = "/rides/api/directions/";
    }
    return url;
  }

  /** Call backend directions API (Mapbox or OSRM). origin/destination = address or "lat,lng". */
  function fetchDirections(origin, destination) {
    var base = getDirectionsUrl();
    if (!base) return Promise.reject(new Error("Directions API not configured"));
    var url = base + "?origin=" + encodeURIComponent(origin) + "&destination=" + encodeURIComponent(destination);
    return fetch(url).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (j) { throw new Error(j.error || "Request failed"); }).catch(function () { throw new Error("Request failed " + r.status); });
      }
      return r.json();
    });
  }

  /** Client-side fallback: Nominatim (US) + OSRM when backend fails. No API key. */
  function geocodeUS(q) {
    var query = (q || "").trim();
    if (!query) return Promise.resolve(null);
    if (/^-?[\d.]+,-?[\d.]+$/.test(query)) {
      var parts = query.split(",");
      var lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lon)) return Promise.resolve({ lat: lat, lon: lon });
    }
    if (/,\s*[A-Za-z]{2}\s*$/.test(query)) query = query + ", USA";
    else if (query.indexOf(",") === -1) query = query + ", USA";
    var url = "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(query) + "&format=json&limit=1&countrycodes=us";
    return fetch(url, { headers: { "Accept": "application/json", "User-Agent": "WayWithYouRides/1.0" } })
      .then(function (r) { return r.json(); })
      .then(function (arr) { if (!arr || !arr[0]) return null; var t = arr[0]; return { lat: parseFloat(t.lat), lon: parseFloat(t.lon) }; });
  }
  function osrmRoute(from, to) {
    var c = from[0] + "," + from[1] + ";" + to[0] + "," + to[1];
    return fetch("https://router.project-osrm.org/route/v1/driving/" + c + "?overview=full&geometries=geojson")
      .then(function (r) { return r.json(); });
  }
  /** Exclude Antarctic/wrong points so we never zoom the map there. */
  function boundsForPath(path) {
    if (!path || !path.length) return path;
    var ok = path.filter(function (p) { return p && p[0] >= -60 && p[0] <= 90; });
    return ok.length ? ok : path;
  }
  function applyRoute(start, end, path, durationSec, etaEl, originStr, destStr) {
    if (originMarker) map.removeLayer(originMarker);
    originMarker = L.marker(start, { icon: L.divIcon({ className: "wty-marker-origin", html: "<div style='background:#16a34a;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>", iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map).bindPopup("Start: " + (originStr || ""));
    if (destinationMarker) map.removeLayer(destinationMarker);
    destinationMarker = L.marker(end, { icon: L.divIcon({ className: "wty-marker-dest", html: "<div style='background:#dc2626;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>", iconSize: [24, 24], iconAnchor: [12, 22] }) }).addTo(map).bindPopup("Destination: " + (destStr || ""));
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.polyline(path, { color: "#1e40af", weight: 5, opacity: 0.9 }).addTo(map);
    if (etaEl) { etaEl.classList.remove("hidden"); etaEl.textContent = (durationSec != null && durationSec > 0) ? "Drive time: ~" + (durationSec < 60 ? Math.round(durationSec / 60) + " min" : Math.floor(durationSec / 3600) + " hr " + Math.round((durationSec % 3600) / 60) + " min") : "Route shown (drive time not available)."; }
    map.fitBounds(boundsForPath(path), { padding: [50, 50], maxZoom: 14 });
  }
  function tryClientSideRoute(originStr, destinationStr, etaEl) {
    Promise.all([geocodeUS(originStr), geocodeUS(destinationStr)]).then(function (pair) {
      var a = pair[0], b = pair[1];
      if (!a || !b) { if (etaEl) { etaEl.textContent = "Could not find one or both places. Use city and state (e.g. Princeton, NJ)."; etaEl.classList.remove("hidden"); } return; }
      var start = [a.lat, a.lon], end = [b.lat, b.lon];
      osrmRoute(start, end).then(function (data) {
        var path = [start, end], dur = null;
        if (data && data.code === "Ok" && data.routes && data.routes[0]) {
          var geom = data.routes[0].geometry;
          if (geom && geom.coordinates && geom.coordinates.length) path = geom.coordinates.map(function (c) { return [c[1], c[0]]; });
          dur = (data.routes[0].duration != null) ? data.routes[0].duration : null;
        }
        applyRoute(start, end, path, dur, etaEl, originStr, destinationStr);
      }).catch(function () { applyRoute(start, end, [start, end], null, etaEl, originStr, destinationStr); });
    }).catch(function () { if (etaEl) { etaEl.textContent = "Could not find places. Use city, state (e.g. Princeton, NJ)."; etaEl.classList.remove("hidden"); } });
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

    /** Ignore obviously wrong locations (e.g. Antarctica/Ongul Island from bad geolocation). */
    function isReasonableLocation(lat, lng) {
      if (lat == null || lng == null) return false;
      if (lat < -60 || lat > 90 || lng < -180 || lng > 180) return false;
      return true;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude, lng = pos.coords.longitude;
          if (!isReasonableLocation(lat, lng)) return;
          userLatLng = [lat, lng];
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

  function drawRoute(data, etaEl, originStr, destStr) {
    var start = [data.start_lat, data.start_lng];
    var end = [data.end_lat, data.end_lng];
    if (routeLayer) map.removeLayer(routeLayer);
    var path = data.path && data.path.length >= 2 ? data.path : [start, end];
    routeLayer = L.polyline(path, { color: "#1e40af", weight: 5, opacity: 0.9 }).addTo(map);
    if (etaEl) {
      etaEl.classList.remove("hidden");
      etaEl.textContent = data.duration_text ? "Drive time: " + data.duration_text : "Route shown (drive time not available).";
    }
    map.fitBounds(boundsForPath(path), { padding: [50, 50], maxZoom: 14 });
  }

  function setMapRoute(originStr, destinationStr) {
    if (!originStr || !destinationStr) return;
    originStr = originStr.trim().replace(/^,|,$/g, "");
    destinationStr = destinationStr.trim().replace(/^,|,$/g, "");
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

    fetchDirections(originStr, destinationStr)
      .then(function (data) {
        var start = [data.start_lat, data.start_lng];
        var end = [data.end_lat, data.end_lng];
        if (originMarker) map.removeLayer(originMarker);
        originMarker = L.marker(start, {
          icon: L.divIcon({
            className: "wty-marker-origin",
            html: "<div style='background:#16a34a;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        }).addTo(map).bindPopup("Start: " + originStr);
        if (destinationMarker) map.removeLayer(destinationMarker);
        destinationMarker = L.marker(end, {
          icon: L.divIcon({
            className: "wty-marker-dest",
            html: "<div style='background:#dc2626;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>",
            iconSize: [24, 24],
            iconAnchor: [12, 22],
          }),
        }).addTo(map).bindPopup("Destination: " + destinationStr);
        drawRoute(data, etaEl, originStr, destinationStr);
      })
      .catch(function (err) {
        tryClientSideRoute(originStr, destinationStr, etaEl);
      });
  }

  function setDestination(query, etaEl) {
    if (!etaEl) etaEl = document.getElementById("map-eta");
    etaEl.textContent = "Finding route…";
    etaEl.classList.remove("hidden");

    var origin;
    if (userLatLng && userLatLng.length === 2) {
      origin = userLatLng[0] + "," + userLatLng[1];
    } else {
      etaEl.textContent = "Allow location access to see route from your position.";
      return;
    }

    removeRouteAndMarkers();
    if (destinationMarker) map.removeLayer(destinationMarker);
    destinationMarker = null;
    if (originMarker) map.removeLayer(originMarker);
    originMarker = null;

    fetchDirections(origin, query)
      .then(function (data) {
        var start = [data.start_lat, data.start_lng];
        var end = [data.end_lat, data.end_lng];
        if (currentMarker) map.removeLayer(currentMarker);
        currentMarker = L.marker(start, {
          icon: L.divIcon({
            className: "wty-marker-current",
            html: "<div style='background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        }).addTo(map).bindPopup("Your location");
        destinationMarker = L.marker(end, {
          icon: L.divIcon({
            className: "wty-marker-dest",
            html: "<div style='background:#dc2626;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>",
            iconSize: [24, 24],
            iconAnchor: [12, 22],
          }),
        }).addTo(map).bindPopup("Destination: " + query);
        drawRoute(data, etaEl, origin, query);
      })
      .catch(function (err) {
        if (userLatLng && userLatLng.length === 2) {
          geocodeUS(query).then(function (dest) {
            if (!dest) { if (etaEl) { etaEl.textContent = "Could not find destination."; etaEl.classList.remove("hidden"); } return; }
            var start = userLatLng, end = [dest.lat, dest.lon];
            osrmRoute(start, end).then(function (data) {
              var path = [start, end], dur = null;
              if (data && data.code === "Ok" && data.routes && data.routes[0]) {
                var geom = data.routes[0].geometry;
                if (geom && geom.coordinates && geom.coordinates.length) path = geom.coordinates.map(function (c) { return [c[1], c[0]]; });
                dur = (data.routes[0].duration != null) ? data.routes[0].duration : null;
              }
              if (currentMarker) map.removeLayer(currentMarker);
              currentMarker = L.marker(start, { icon: L.divIcon({ className: "wty-marker-current", html: "<div style='background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>", iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map).bindPopup("Your location");
              if (destinationMarker) map.removeLayer(destinationMarker);
              destinationMarker = L.marker(end, { icon: L.divIcon({ className: "wty-marker-dest", html: "<div style='background:#dc2626;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>", iconSize: [24, 24], iconAnchor: [12, 22] }) }).addTo(map).bindPopup("Destination: " + query);
              if (routeLayer) map.removeLayer(routeLayer);
              routeLayer = L.polyline(path, { color: "#1e40af", weight: 5, opacity: 0.9 }).addTo(map);
              if (etaEl) { etaEl.classList.remove("hidden"); etaEl.textContent = (dur != null && dur > 0) ? "Drive time: ~" + (dur < 3600 ? Math.round(dur / 60) + " min" : Math.floor(dur / 3600) + " hr " + Math.round((dur % 3600) / 60) + " min") : "Route shown (drive time not available)."; }
              map.fitBounds(boundsForPath(path), { padding: [50, 50], maxZoom: 14 });
            }).catch(function () {
              if (currentMarker) map.removeLayer(currentMarker);
              currentMarker = L.marker(start, { icon: L.divIcon({ className: "wty-marker-current", html: "<div style='background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>", iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map).bindPopup("Your location");
              if (destinationMarker) map.removeLayer(destinationMarker);
              destinationMarker = L.marker(end, { icon: L.divIcon({ className: "wty-marker-dest", html: "<div style='background:#dc2626;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'></div>", iconSize: [24, 24], iconAnchor: [12, 22] }) }).addTo(map).bindPopup("Destination: " + query);
              if (routeLayer) map.removeLayer(routeLayer);
              routeLayer = L.polyline([start, end], { color: "#1e40af", weight: 5, opacity: 0.9 }).addTo(map);
              if (etaEl) { etaEl.classList.remove("hidden"); etaEl.textContent = "Route shown (drive time not available)."; }
              map.fitBounds(boundsForPath([start, end]), { padding: [50, 50], maxZoom: 14 });
            });
          }).catch(function () { if (etaEl) { etaEl.textContent = "Could not find destination."; etaEl.classList.remove("hidden"); } });
        } else if (etaEl) { etaEl.textContent = err.message || "Could not get route."; etaEl.classList.remove("hidden"); }
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
    if (origin && dest) setMapRoute(origin, dest);
    else if (dest) setMapDestination(dest);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMap);
  } else {
    initMap();
  }
})();

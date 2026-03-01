/**
 * WayWithYou search dev server.
 * Serves the search page and API to query riders.json by city and state (case insensitive).
 */
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Path to riders data (Django fixture format)
const RIDERS_PATH = path.join(__dirname, "data", "riders.json");

// Parse riders from Django fixture format into flat array of { pk, ...fields }
function loadRiders() {
  const raw = fs.readFileSync(RIDERS_PATH, "utf8");
  const fixture = JSON.parse(raw);
  if (!Array.isArray(fixture)) return [];
  return fixture.map((entry) => ({
    pk: entry.pk,
    ...(entry.fields || {}),
  }));
}

let riders = [];
try {
  riders = loadRiders();
} catch (e) {
  console.warn("Could not load riders.json:", e.message);
}

// Static files (HTML, CSS, images)
app.use(express.static(path.join(__dirname, "public")));

// API: GET /api/riders?state=ca&origin_city=Beverly&destination_city=West Hollywood&date=2025-11-08&taking_passengers=1
// - state: 2-letter abbreviation, case insensitive
// - origin_city, destination_city: optional; case insensitive
// - date: optional; YYYY-MM-DD, exact match on ride date
// - taking_passengers: optional; "1" or "yes" = Yes, "0" or "no" = No, else no filter
app.get("/api/riders", (req, res) => {
  const state = (req.query.state || "").trim();
  const originCity = (req.query.origin_city || "").trim();
  const destinationCity = (req.query.destination_city || "").trim();
  const date = (req.query.date || "").trim();
  const takingPassengers = (req.query.taking_passengers || "").trim().toLowerCase();

  let results = riders;

  // Filter by state (destination state): case insensitive
  if (state) {
    const stateUpper = state.toUpperCase();
    results = results.filter(
      (r) => (r.destination_state || "").toUpperCase() === stateUpper
    );
  }

  // Filter by origination city: case insensitive
  if (originCity) {
    const originLower = originCity.toLowerCase();
    results = results.filter((r) =>
      (r.origination || "").toLowerCase().includes(originLower)
    );
  }

  // Filter by destination city: case insensitive
  if (destinationCity) {
    const destLower = destinationCity.toLowerCase();
    results = results.filter((r) =>
      (r.destination_city || "").toLowerCase().includes(destLower)
    );
  }

  // Filter by date: exact match (YYYY-MM-DD)
  if (date) {
    results = results.filter((r) => (r.date || "") === date);
  }

  // Filter by taking passengers: 1/yes = true, 0/no = false
  if (takingPassengers === "1" || takingPassengers === "yes") {
    results = results.filter((r) => r.taking_passengers === true);
  } else if (takingPassengers === "0" || takingPassengers === "no") {
    results = results.filter((r) => r.taking_passengers === false);
  }

  res.json(results);
});

// Serve search page at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`WayWithYou search server at http://localhost:${PORT}`);
});

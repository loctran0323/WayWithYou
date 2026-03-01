/**
 * WayWithYou search page: query registrants by state and city (case insensitive).
 * Two arguments: state (2-letter) and optional city (origination or destination).
 */
(function () {
  const form = document.getElementById("search-form");
  const resultsSection = document.getElementById("results-section");
  const resultsHeading = document.getElementById("results-heading");
  const resultsTableWrap = document.getElementById("results-table-wrap");
  const noResults = document.getElementById("no-results");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const state = (document.getElementById("state").value || "").trim();
    const originCity = (document.getElementById("origin_city").value || "").trim();
    const destinationCity = (document.getElementById("destination_city").value || "").trim();
    const date = (document.getElementById("date").value || "").trim();
    const takingPassengers = (document.getElementById("taking_passengers").value || "").trim();
    if (!state && !originCity && !destinationCity && !date && !takingPassengers) {
      resultsSection.classList.add("hidden");
      return;
    }
    search(state, originCity, destinationCity, date, takingPassengers);
  });

  function search(state, originCity, destinationCity, date, takingPassengers) {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (originCity) params.set("origin_city", originCity);
    if (destinationCity) params.set("destination_city", destinationCity);
    if (date) params.set("date", date);
    if (takingPassengers) params.set("taking_passengers", takingPassengers);
    const url = "/api/riders?" + params.toString();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("Search failed");
        return res.json();
      })
      .then(function (data) {
        renderResults(data, state, originCity, destinationCity, date, takingPassengers);
      })
      .catch(function () {
        resultsTableWrap.innerHTML = "";
        noResults.classList.remove("hidden");
        resultsHeading.textContent = "Search error. Please try again.";
        resultsSection.classList.remove("hidden");
      });
  }

  function renderResults(people, searchState, searchOriginCity, searchDestinationCity, searchDate, searchTakingPassengers) {
    const parts = [];
    if (searchOriginCity) parts.push('origin "' + escapeHtml(searchOriginCity) + '"');
    if (searchDestinationCity) parts.push('destination "' + escapeHtml(searchDestinationCity) + '"');
    if (searchState) parts.push('state "' + escapeHtml(searchState) + '"');
    if (searchDate) parts.push("date " + escapeHtml(searchDate));
    if (searchTakingPassengers === "1") parts.push("taking passengers: Yes");
    if (searchTakingPassengers === "0") parts.push("taking passengers: No");
    const criteria = parts.length ? ": " + parts.join(" and ") : "";
    resultsHeading.textContent = "Registrants matching your search" + criteria;

    if (!people || people.length === 0) {
      resultsTableWrap.innerHTML = "";
      noResults.classList.remove("hidden");
    } else {
      noResults.classList.add("hidden");
      const table = document.createElement("table");
      table.innerHTML =
        "<thead><tr><th>Name</th><th>Origination</th><th>Destination</th><th>State</th><th>Date</th><th>Time</th><th>Taking Passengers</th><th>Seats Available</th></tr></thead><tbody></tbody>";
      const tbody = table.querySelector("tbody");
      people.forEach(function (r) {
        const row = document.createElement("tr");
        row.innerHTML =
          "<td>" + escapeHtml(r.first_name) + "</td>" +
          "<td>" + escapeHtml(r.origination || "") + "</td>" +
          "<td>" + escapeHtml(r.destination_city || "") + "</td>" +
          "<td>" + escapeHtml(r.destination_state || "") + "</td>" +
          "<td>" + escapeHtml(r.date || "") + "</td>" +
          "<td>" + escapeHtml(r.time || "") + "</td>" +
          "<td>" + (r.taking_passengers ? "Yes" : "No") + "</td>" +
          "<td>" + (r.seats_available != null ? r.seats_available : "") + "</td>";
        tbody.appendChild(row);
      });
      resultsTableWrap.innerHTML = "";
      resultsTableWrap.appendChild(table);
    }
    resultsSection.classList.remove("hidden");
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
})();

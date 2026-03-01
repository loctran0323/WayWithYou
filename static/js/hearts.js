/**
 * Heart toggle: click heart icon to save/unsave a ride. POSTs to /rides/heart/ and updates the icon.
 */
(function () {
  function getCsrfToken() {
    var name = "csrftoken";
    var cookies = document.cookie.split(";");
    for (var i = 0; i < cookies.length; i++) {
      var parts = cookies[i].split("=");
      var key = parts[0].replace(/^\s+|\s+$/g, "");
      if (key === name) {
        return parts.slice(1).join("=").replace(/^\s+|\s+$/g, "");
      }
    }
    return "";
  }

  function initHearts() {
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest && e.target.closest(".wty-heart");
      if (!btn || !btn.dataset.personId) return;
      e.preventDefault();
      var personId = btn.dataset.personId;
      var formData = new FormData();
      formData.append("person_id", personId);
      formData.append("csrfmiddlewaretoken", getCsrfToken());
      var req = new XMLHttpRequest();
      req.open("POST", "/rides/heart/");
      req.setRequestHeader("X-CSRFToken", getCsrfToken());
      req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
      req.onload = function () {
        if (req.status !== 200) return;
        try {
          var data = JSON.parse(req.responseText);
          if (data.hearted !== undefined) {
            if (data.hearted) {
              btn.classList.add("wty-hearted");
            } else {
              btn.classList.remove("wty-hearted");
              var row = btn.closest("tr");
            if (row && document.querySelector("[data-hearted-page]")) {
              row.remove();
            }
            }
          }
        } catch (err) {}
      };
      req.send(formData);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHearts);
  } else {
    initHearts();
  }
})();

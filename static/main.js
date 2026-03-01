function getCookie(c_name) {
    var i,x,y,ARRcookies=document.cookie.split(";");
    for (i=0;i<ARRcookies.length;i++){
        x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
        y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
        x=x.replace(/^\s+|\s+$/g,"");
        if (x==c_name) {
            return unescape(y);
        }
    }
}

function setCookie(c_name,value,exdays) {
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
    document.cookie=c_name + "=" + c_value;
}

/**
 * Validate search form: do not submit if all inputs are blank;
 * if user searches for "Elon Musk", show popup and do not submit.
 * Returns false to prevent submit, true to allow.
 */
function checkForm(form) {
    if (!form) return true;
    var state = (form.state && form.state.value || "").replace(/^\s+|\s+$/g, "");
    var origin = (form.origin_city && form.origin_city.value || "").replace(/^\s+|\s+$/g, "");
    var dest = (form.destination_city && form.destination_city.value || "").replace(/^\s+|\s+$/g, "");
    var date = (form.date && form.date.value || "").replace(/^\s+|\s+$/g, "");
    var taking = (form.taking_passengers && form.taking_passengers.value || "").replace(/^\s+|\s+$/g, "");
    var allBlank = !state && !origin && !dest && !date && !taking;
    if (allBlank) {
        return false;
    }
    var combined = (state + " " + origin + " " + dest).toLowerCase();
    if (combined.indexOf("elon musk") !== -1) {
        alert("He's not here");
        return false;
    }
    return true;
}

/**
 * First visit: set cookie and redirect to splash page (/) if not already there.
 */
function initFirstVisit() {
    var visited = getCookie("visited");
    if (!visited) {
        setCookie("visited", "1", 365);
        var path = window.location.pathname.replace(/\/$/, "") || "/";
        if (path !== "" && path !== "/") {
            window.location = "/";
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFirstVisit);
} else {
    initFirstVisit();
}

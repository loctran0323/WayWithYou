import json
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from .models import HeartedRide, Person

# relative import of forms
from .forms import RideForm, NewRideForm


def _geocode_us(query):
    """Geocode with Nominatim, US only. Returns (lat, lon) or None."""
    q = query.strip()
    if not q:
        return None
    # Optional: if already "lat,lon" or "lon,lat", parse (Nominatim uses lat,lon in result)
    parts = [p.strip() for p in q.split(",")]
    if len(parts) == 2:
        try:
            a, b = float(parts[0]), float(parts[1])
            if -90 <= a <= 90 and -180 <= b <= 180:
                return (a, b)
            if -90 <= b <= 90 and -180 <= a <= 180:
                return (b, a)
        except ValueError:
            pass
    if len(parts) >= 2 and len(parts[-1].strip()) == 2:
        q = q + ", USA"
    elif "," not in q:
        q = q + ", USA"
    url = "https://nominatim.openstreetmap.org/search?q=" + urllib.parse.quote(q) + "&format=json&limit=1&countrycodes=us"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "WayWithYouRides/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return None
    if not data or not isinstance(data, list) or len(data) == 0:
        return None
    r = data[0]
    try:
        return (float(r["lat"]), float(r["lon"]))
    except (KeyError, TypeError, ValueError):
        return None


def _route_mapbox(start_lat, start_lon, end_lat, end_lon, token):
    """Get route from Mapbox Directions API. Returns (path_list, duration_seconds) or (None, None)."""
    coords = "{},{};{},{}".format(start_lon, start_lat, end_lon, end_lat)
    url = "https://api.mapbox.com/directions/v5/mapbox/driving/" + coords + "?geometries=geojson&access_token=" + token
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return None, None
    if not data.get("routes"):
        return None, None
    route = data["routes"][0]
    geom = route.get("geometry") or {}
    coords_list = geom.get("coordinates") or []
    path = [[c[1], c[0]] for c in coords_list]
    duration = route.get("duration")
    if duration is not None and not isinstance(duration, (int, float)):
        duration = None
    return (path if len(path) >= 2 else None), duration


def _route_osrm(start_lat, start_lon, end_lat, end_lon):
    """Get route from OSRM. Returns (path_list, duration_seconds) or (None, None)."""
    c = "{},{};{},{}".format(start_lat, start_lon, end_lat, end_lon)
    url = "https://router.project-osrm.org/route/v1/driving/" + c + "?overview=full&geometries=geojson"
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return None, None
    if data.get("code") != "Ok" or not data.get("routes"):
        return None, None
    route = data["routes"][0]
    geom = route.get("geometry") or {}
    coords_list = geom.get("coordinates") or []
    path = [[c[1], c[0]] for c in coords_list]
    duration = route.get("duration")
    if duration is not None and not isinstance(duration, (int, float)):
        duration = None
    return (path if len(path) >= 2 else None), duration


def api_directions(request):
    """
    GET ?origin=...&destination=... → geocode (US only), then Mapbox or OSRM route.
    Returns JSON: path, duration_seconds, duration_text, start_lat, start_lng, end_lat, end_lng.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    origin = request.GET.get("origin", "").strip().strip(",")
    destination = request.GET.get("destination", "").strip().strip(",")
    if not origin or not destination:
        return JsonResponse({"error": "origin and destination required"}, status=400)
    start = _geocode_us(origin)
    end = _geocode_us(destination)
    if start is None or end is None:
        return JsonResponse({"error": "Could not find one or both places. Use city and state (e.g. Princeton, NJ)."}, status=404)
    start_lat, start_lon = start
    end_lat, end_lon = end
    token = (getattr(settings, "MAPBOX_ACCESS_TOKEN", None) or "").strip()
    if token:
        path, duration = _route_mapbox(start_lat, start_lon, end_lat, end_lon, token)
    else:
        path, duration = None, None
    if not path:
        path, duration = _route_osrm(start_lat, start_lon, end_lat, end_lon)
    if not path:
        path = [[start_lat, start_lon], [end_lat, end_lon]]
    if duration is not None and duration > 0:
        mins = int(round(duration / 60))
        duration_text = "{} min".format(mins) if mins < 60 else "{} hr {} min".format(mins // 60, mins % 60)
    else:
        duration_text = ""
    return JsonResponse({
        "path": path,
        "duration_seconds": int(duration) if duration is not None else None,
        "duration_text": duration_text,
        "start_lat": start_lat,
        "start_lng": start_lon,
        "end_lat": end_lat,
        "end_lng": end_lon,
    })


# Create your views here.


def register_view(request):
    """Create a new user profile (sign up). Redirect to rides if already logged in."""
    if request.user.is_authenticated:
        return redirect("rides:index")
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("rides:index")
    else:
        form = UserCreationForm()
    return render(request, "register.html", {"form": form})


def index(request):
    """
    Search page for finding registrants by origination/destination city and state.
    Search is case insensitive (e.g., 'ny' returns 'NY' results).
    """
    context = {"hearted_ids": set()}

    # Check if user submitted a search (cities, state, date, or taking passengers)
    origin_city = request.GET.get("origin_city", "").strip()
    destination_city = request.GET.get("destination_city", "").strip()
    state = request.GET.get("state", "").strip()
    date_str = request.GET.get("date", "").strip()
    taking_passengers = request.GET.get("taking_passengers", "").strip()

    if origin_city or destination_city or state or date_str or taking_passengers:
        context["inputExists"] = True
        # Start with all Person objects, then filter
        queryset = Person.objects.all()

        # Filter by state: case insensitive (e.g., "ny" matches "NY")
        if state:
            queryset = queryset.filter(destination_state__iexact=state)

        # Filter by origination city: case insensitive
        if origin_city:
            queryset = queryset.filter(origination__icontains=origin_city)
        # Filter by destination city: case insensitive
        if destination_city:
            queryset = queryset.filter(destination_city__icontains=destination_city)

        # Filter by date (YYYY-MM-DD): exact match on ride date
        if date_str:
            from django.utils.dateparse import parse_date
            parsed = parse_date(date_str)
            if parsed:
                queryset = queryset.filter(date=parsed)

        # Filter by taking passengers: Yes ('1') or No ('0')
        if taking_passengers == '1':
            queryset = queryset.filter(taking_passengers=True)
        elif taking_passengers == '0':
            queryset = queryset.filter(taking_passengers=False)

        context["people"] = queryset
        context["search_origin_city"] = origin_city
        context["search_destination_city"] = destination_city
        context["search_state"] = state
        context["search_date"] = date_str
        context["search_taking_passengers"] = taking_passengers
        # Pass which ride IDs the current user has hearted (for heart icon state)
        if request.user.is_authenticated:
            context["hearted_ids"] = set(
                HeartedRide.objects.filter(user=request.user).values_list("person_id", flat=True)
            )
        else:
            context["hearted_ids"] = set()

    context["form"] = RideForm(initial={
        "origin_city": origin_city,
        "destination_city": destination_city,
        "state": state,
        "date": date_str or None,
        "taking_passengers": taking_passengers,
    })
    context["directions_api_url"] = reverse("rides:api_directions")
    return render(request, "index_view.html", context)


def add_ride(request):
    """
    Add a new ride: GET shows the form; POST saves and redirects to search.
    """
    if request.method == "POST":
        form = NewRideForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("rides:index")
        # Invalid: re-render with errors
    else:
        form = NewRideForm()
    return render(request, "add_ride.html", {"form": form})


@login_required(login_url="/accounts/login/")
def hearted_list(request):
    """List of rides the current user has hearted."""
    hearted = HeartedRide.objects.filter(user=request.user).select_related("person")
    people = [h.person for h in hearted]
    return render(request, "hearted.html", {"people": people})


def heart_toggle(request):
    """
    Toggle heart for a ride (person_id). Requires POST and login.
    Returns JSON: { "hearted": true|false }.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Login required"}, status=401)
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    person_id = request.POST.get("person_id")
    if not person_id:
        return JsonResponse({"error": "person_id required"}, status=400)
    try:
        person_id = int(person_id)
    except ValueError:
        return JsonResponse({"error": "Invalid person_id"}, status=400)
    person = get_object_or_404(Person, pk=person_id)
    hr, created = HeartedRide.objects.get_or_create(user=request.user, person=person)
    if created:
        return JsonResponse({"hearted": True})
    hr.delete()
    return JsonResponse({"hearted": False})

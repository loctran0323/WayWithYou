from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render

from .models import HeartedRide, Person

# relative import of forms
from .forms import RideForm, NewRideForm

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

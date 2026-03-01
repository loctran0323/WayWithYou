from django import forms

from .models import Person


class RideForm(forms.Form):
    """Form for searching registrants by origination city, destination city, and state."""
    # Origination city: where the rider is from
    origin_city = forms.CharField(
        label='Origination city',
        max_length=64,
        required=False,
        widget=forms.TextInput(attrs={'placeholder': 'e.g., Beverly Hills, New York'})
    )
    # Destination city: where the rider is going
    destination_city = forms.CharField(
        label='Destination city',
        max_length=64,
        required=False,
        widget=forms.TextInput(attrs={'placeholder': 'e.g., West Hollywood, Washington'})
    )
    # State field: 2-letter abbreviation, case insensitive
    state = forms.CharField(
        label='State (2-letter abbreviation)',
        max_length=2,
        required=False,
        widget=forms.TextInput(attrs={'placeholder': 'e.g., DC, NY'})
    )
    # Date: filter by ride date (YYYY-MM-DD)
    date = forms.DateField(
        label='Date (YYYY-MM-DD)',
        required=False,
        widget=forms.DateInput(attrs={'type': 'date', 'class': 'wty-date'})
    )
    # Taking passengers: filter by whether registrant is taking passengers
    TAKING_CHOICES = [('', 'All'), ('1', 'Yes'), ('0', 'No')]
    taking_passengers = forms.TypedChoiceField(
        label='Taking passengers',
        choices=TAKING_CHOICES,
        required=False,
        coerce=lambda x: x,
        empty_value='',
        widget=forms.Select(attrs={'class': 'wty-select'})
    )


class NewRideForm(forms.ModelForm):
    """Form for creating a new ride (Person/registrant)."""
    class Meta:
        model = Person
        fields = [
            "first_name",
            "last_name",
            "email",
            "origination",
            "origination_state",
            "destination_city",
            "destination_state",
            "date",
            "time",
            "taking_passengers",
            "seats_available",
            "vehicle_type",
            "service_tier",
            "max_price_per_seat",
            "notes",
        ]


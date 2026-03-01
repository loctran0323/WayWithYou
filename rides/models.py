from django.conf import settings
from django.db import models


class Person(models.Model):
    """A ride listing: driver/registrant with origination, destination, and plan-ahead details."""
    # Name and contact (for planning ahead and coordination)
    first_name = models.CharField(max_length=64)
    last_name = models.CharField(max_length=64, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    # Origination: city and state (helps match riders in same area)
    origination = models.CharField(max_length=64)
    origination_state = models.CharField(max_length=2, blank=True, default="")
    # Destination
    destination_city = models.CharField(max_length=64)
    destination_state = models.CharField(max_length=2)
    date = models.DateField()
    time = models.TimeField()
    taking_passengers = models.BooleanField(default=False)
    seats_available = models.IntegerField(default=0)
    # Vehicle and service tier (assignment: Regular vs Premium CartyCity)
    VEHICLE_CHOICES = [
        ("", "Not specified"),
        ("sedan", "Sedan"),
        ("suv", "SUV"),
        ("van", "Van"),
        ("hatchback", "Hatchback"),
    ]
    vehicle_type = models.CharField(
        max_length=32, choices=VEHICLE_CHOICES, blank=True, default=""
    )
    SERVICE_TIER_CHOICES = [
        ("regular", "Regular CartyCity"),
        ("premium", "Premium CartyCity"),
    ]
    service_tier = models.CharField(
        max_length=16, choices=SERVICE_TIER_CHOICES, default="regular"
    )
    # Cheap / plan-ahead: max price per seat (optional; driver can leave blank for free/carpool)
    max_price_per_seat = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Max $ per seat (leave blank for free/carpool)"
    )
    notes = models.TextField(blank=True, default="")


class HeartedRide(models.Model):
    """Tracks which rides (Person) a user has hearted/saved for later."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hearted_rides",
    )
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="hearted_by",
    )

    class Meta:
        unique_together = ["user", "person"]

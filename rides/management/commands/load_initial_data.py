"""
Load Princeton rides fixture on first deploy so the website has sample data.
Safe to run every deploy: only loads if no Person records exist.
Usage: python manage.py load_initial_data
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand

from rides.models import Person


class Command(BaseCommand):
    help = "Load princeton_rides fixture if the database is empty (for deploy)."

    def handle(self, *args, **options):
        if Person.objects.exists():
            self.stdout.write("Rides data already present, skipping load.")
            return
        self.stdout.write("Loading Princeton rides (princeton_rides.json)...")
        try:
            call_command("loaddata", "princeton_rides", verbosity=1)
            self.stdout.write(self.style.SUCCESS("Loaded princeton_rides."))
        except Exception as e:
            self.stdout.write(self.style.WARNING("Could not load fixture: %s" % e))

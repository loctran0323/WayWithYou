"""
Management command to create sample users for development/demo.
Usage: python manage.py create_sample_users
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Create sample users for the ride-sharing app (dev/demo)."

    def handle(self, *args, **options):
        users_to_create = [
            {"username": "alice", "email": "alice@example.com", "password": "testpass123"},
            {"username": "bob", "email": "bob@example.com", "password": "testpass123"},
            {"username": "carol", "email": "carol@example.com", "password": "testpass123"},
            {"username": "dave", "email": "dave@example.com", "password": "testpass123"},
        ]
        created = 0
        for u in users_to_create:
            if not User.objects.filter(username=u["username"]).exists():
                User.objects.create_user(
                    username=u["username"],
                    email=u["email"],
                    password=u["password"],
                )
                created += 1
                self.stdout.write(self.style.SUCCESS(f"Created user: {u['username']}"))
            else:
                self.stdout.write(f"User already exists: {u['username']}")
        self.stdout.write(self.style.SUCCESS(f"Done. Created {created} new user(s)."))

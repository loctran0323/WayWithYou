"""
Vercel Python runtime expects a module with a variable named ``app`` (not ``application``).
This wraps Django's WSGI app; local dev still uses HandyRides.wsgi via runserver.
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "HandyRides.settings")

app = get_wsgi_application()

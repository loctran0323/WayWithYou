# WayWithYou

WayWithYou is a Django web app for event ride-sharing. Users can browse registrants, find carpool matches by location, and view routes on an interactive map.

## Tech Stack

- Python 3.10
- Django 3.1.6
- SQLite (local development)
- PostgreSQL (production on Render/Heroku)
- Leaflet + OpenStreetMap (map UI)

## Features

- Search ride offers by origin, destination, state, date, and passenger availability.
- Register and log in users with Django auth.
- Create new rides through the app.
- Show route lines and drive-time info on a map.
- Optional backend directions API support (OSRM/Mapbox flow in the app).

## Project Structure

- `HandyRides/` - Django project settings and root URLs
- `rides/` - Main app: models, views, forms, templates, URLs
- `templates/` - Shared templates
- `static/` - Static assets (CSS/JS/images)
- `rides/fixtures/` - Seed data (`princeton_rides.json`, `riders.json`)
- `DEPLOY.md` - Deployment guide (Render/Heroku)
- `DEPLOY_VERCEL.md` - Vercel-specific deployment notes

## Local Development

### 1) Create and activate a virtual environment

```bash
cd /Users/loctran/Downloads/Orf401S26_HandiRides
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) Run migrations

```bash
python manage.py migrate
```

### 4) (Optional) Load sample data

```bash
python manage.py loaddata princeton_rides
```

or:

```bash
python manage.py load_initial_data
```

### 5) Run the server

```bash
python manage.py runserver
```

Open: [http://127.0.0.1:8000](http://127.0.0.1:8000)

## Environment Variables

Common variables used by this project:

- `DEBUG` - `True`/`False` (default is `True` locally)
- `SECRET_KEY` - Django secret key for production
- `ALLOWED_HOSTS` - Comma-separated host list
- `DATABASE_URL` - Required in production for PostgreSQL
- `MAPBOX_ACCESS_TOKEN` - Optional token for Mapbox directions
- `PYTHON_VERSION` - For Render, set to `3.10.14`

## Deployment (Render Quick Start)

1. Push this repo to GitHub.
2. Create a Render Web Service from the repo.
3. Set:
   - Build command:
     - `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - Start command:
     - `python manage.py migrate --noinput && python manage.py load_initial_data && gunicorn HandyRides.wsgi`
4. Create a Render PostgreSQL database.
5. Add `DATABASE_URL` to the Web Service environment using the Postgres **Internal Database URL**.
6. Deploy.

If `DATABASE_URL` is missing on Render, app startup is blocked intentionally to avoid silently using empty SQLite.

## Deployment (Other Hosts)

- Heroku and Vercel notes are documented in:
  - `DEPLOY.md`
  - `DEPLOY_VERCEL.md`

## Common Commands

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput
```

## Notes

- Local commands should use `python3` if `python` is unavailable on your machine.
- Production should use PostgreSQL, not SQLite.

# WayWithYou

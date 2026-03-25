web: gunicorn HandyRides.wsgi
release: python manage.py migrate --noinput && python manage.py load_initial_data

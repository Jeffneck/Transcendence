#!/bin/bash
# entrypoint.sh

set -e

echo "==> Waiting for postgreSQL"
python wait-for-postgres.py
echo "==> Applying migrations"
python manage.py makemigrations
python manage.py migrate

echo "==> Collecting static files"
python manage.py collectstatic --noinput

echo "==> Starting Uvicorn ASGI server"
# UVICORN replace shell process (better signals management...)
exec uvicorn pong_project.asgi:application --host 0.0.0.0 --port 8000

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Asset collection needs *some* settings module to import cleanly, but not real
# secrets — config.settings.production refuses to import without
# DJANGO_ALLOWED_HOSTS set (a deliberate production safety check), which isn't
# available at build time. config.settings.local has no such requirement and
# this step never touches the database, so it's a safe stand-in here.
RUN DJANGO_SETTINGS_MODULE=config.settings.local python manage.py collectstatic --noinput

EXPOSE 8080

# gthread (not sync): the two SSE views (apps/core/sse.py) hold connections
# open for minutes, polling Redis every ~1s — gunicorn's sync workers only
# notify the arbiter between requests, never mid-stream, so they get killed
# as "WORKER TIMEOUT" the moment a stream outlives --timeout. Threads in the
# same gthread worker keep serving other requests concurrently while one
# thread sits in a long-lived stream — confirmed locally: held an SSE
# connection open past 35s (longer than --timeout 30) with zero drops, while
# concurrent /api/jobs requests kept returning normally throughout.
CMD gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --worker-class gthread --workers 2 --threads 4 --timeout 30

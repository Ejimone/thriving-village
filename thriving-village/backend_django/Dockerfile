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

CMD gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 30

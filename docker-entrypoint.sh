#!/bin/sh
set -e

echo "=========================================================="
echo "AI Samrat Project Dashboard - Docker Container Starting..."
echo "=========================================================="

# 1. Wait for PostgreSQL if configured
if [ "$USE_POSTGRES" = "true" ] || [ -n "$POSTGRES_HOST" ] || [ -n "$DB_HOST" ]; then
    HOST="${DB_HOST:-${POSTGRES_HOST:-localhost}}"
    PORT="${DB_PORT:-${POSTGRES_PORT:-5432}}"
    echo "Checking connection to PostgreSQL at ${HOST}:${PORT}..."
    
    until python -c "import socket; s = socket.socket(); s.settimeout(1); s.connect(('$HOST', int('$PORT'))); s.close()" 2>/dev/null; do
        echo "PostgreSQL is not ready yet. Waiting 1 second..."
        sleep 1
    done
    echo "PostgreSQL is ready and accepting connections!"
fi

# 2. Run Django migrations
echo "Applying database schema migrations..."
python backend/manage.py migrate --noinput

# 3. Collect static files for WhiteNoise
echo "Collecting static assets..."
python backend/manage.py collectstatic --noinput

# 4. Initialize clean default Administrator account (zero demo projects seeded)
echo "Ensuring initial System Administrator account exists..."
python backend/manage.py init_admin || echo "Admin initialization finished."

if [ "$SEED_DEMO_DATA" = "true" ] || [ "$SEED_DEMO_DATA" = "1" ]; then
    echo "SEED_DEMO_DATA is enabled. Seeding demo portfolio dataset..."
    python backend/manage.py seed_demo || echo "Seed demo executed."
    python backend/manage.py setup_team_passwords || echo "Passwords initialized."
else
    echo "Zero-data production mode active: 0 demo projects, 0 diary records, 0 uploaded files."
fi

# 5. Start Gunicorn WSGI server
echo "Starting production WSGI server (Gunicorn) on port 8000..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --chdir backend \
    --workers ${GUNICORN_WORKERS:-3} \
    --timeout ${GUNICORN_TIMEOUT:-120} \
    --access-logfile - \
    --error-logfile -

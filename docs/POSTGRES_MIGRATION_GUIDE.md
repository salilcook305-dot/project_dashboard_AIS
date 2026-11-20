# PostgreSQL Database Migration Guide

This guide walks you through migrating your **AI Samrat Project Dashboard** from **SQLite** to **PostgreSQL**.

---

## 1. Quick Start

Ensure your PostgreSQL service is running (locally or on a cloud provider like Neon, Supabase, Render, AWS RDS, etc.).

### Option A: Run the Automated Migration Script (Recommended)

Run the migration script with your PostgreSQL details:

```powershell
python scripts/migrate_to_postgres.py --name project_dashboard --user postgres --password your_password --host localhost --port 5432
```

Or if you have a connection URL (e.g. from Supabase / Neon / Render):

```powershell
python scripts/migrate_to_postgres.py --url "postgresql://user:password@host:5432/dbname"
```

The script will automatically:
1. Connect to PostgreSQL (and auto-create the database if it doesn't exist yet).
2. Export all SQLite records cleanly.
3. Run Django schema migrations on PostgreSQL.
4. Load all 48 Users, 54 Projects, 211 Memberships, and Diary Entries into PostgreSQL.
5. Reset PostgreSQL auto-increment ID sequences (`sqlsequencereset`).
6. Display a verification table comparing SQLite vs PostgreSQL record counts.
7. Update `.env` to make PostgreSQL active.

---

## 2. Configuration Settings (`.env`)

You can also configure PostgreSQL directly in your `.env` file:

```env
# Set to True to enable PostgreSQL
USE_POSTGRES=True

DB_ENGINE=django.db.backends.postgresql
DB_NAME=project_dashboard
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432

# Alternatively, use a single DATABASE_URL:
# DATABASE_URL=postgresql://user:password@localhost:5432/project_dashboard
```

---

## 3. Manual Step-by-Step Migration (Alternative)

If you prefer running each Django command manually:

```powershell
# 1. Export clean data from SQLite (excluding content types to prevent duplicate key errors)
python backend/manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 2 -o database/sqlite_dump.json

# 2. Set environment variables for PostgreSQL in your terminal or .env
$env:USE_POSTGRES="True"
$env:DB_NAME="project_dashboard"
$env:DB_USER="postgres"
$env:DB_PASSWORD="your_password"
$env:DB_HOST="localhost"
$env:DB_PORT="5432"

# 3. Apply schema migrations on PostgreSQL
python backend/manage.py migrate

# 4. Load the dumped data into PostgreSQL
python backend/manage.py loaddata database/sqlite_dump.json

# 5. Reset PostgreSQL ID sequences (so new users and projects don't hit ID collisions)
python backend/manage.py sqlsequencereset accounts projects documents auth admin
```

---

## 4. Starting the Application

Start the server normally:

```powershell
python app.py
```


---

## 5. Reverting to SQLite (Safety & Rollback)

Your SQLite database (`database/db.sqlite3`) remains 100% untouched as a safe backup.
If you ever want to revert back to SQLite, simply set:

```env
USE_POSTGRES=False
```
in your `.env` file and restart the application.

# Docker Deployment Guide for AI Samrat Project Dashboard

This project is fully containerized and production-ready with **Docker** and **Docker Compose**.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Host Browser (Port 8000)  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |      web (Docker Container) |
                      | - Gunicorn WSGI Server       |
                      | - Django 5.x Backend        |
                      | - WhiteNoise (Static/React) |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |       db (Docker Container) |
                      | - PostgreSQL 16 Alpine      |
                      | - Persistent Volume Data    |
                      +-----------------------------+
```

1. **Multi-stage Dockerfile**:
   - **Stage 1 (`frontend-builder`)**: Compiles React 18 + Vite TypeScript SPA.
   - **Stage 2 (`runner`)**: Python 3.11-slim container with Gunicorn and PostgreSQL client libraries.
2. **Auto-provisioning & Entrypoint (`docker-entrypoint.sh`)**:
   - Automatically waits for PostgreSQL health check.
   - Applies all database migrations (`python backend/manage.py migrate`).
   - Collects all static files into WhiteNoise cache (`collectstatic`).
   - Automatically seeds initial accounts and project data if the database is fresh.
   - Starts Gunicorn on `0.0.0.0:8000`.

---

## Quick Start (1 Command)

Make sure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

Run in your terminal from the project root:

```bash
docker compose up --build
```

That's it! Once built, open your browser:
- **Application URL**: [http://localhost:8000/](http://localhost:8000/)
- **Django Admin**: [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## Default Login Credentials

| Role | Username / Email | Password | Access Level |
|---|---|---|---|
| **System Admin** | `admin` or `admin@aisamrat.com` | `Password123!` | Full control, user creation, deletion, settings |
| **Project Manager** | `manager_priya` or `priya.sharma@aisamrat.com` | `Password123!` | Project management, diary review, team updates |
| **Employee** | Any username from `team_credentials.csv` | Initial password in CSV | View-only projects, submit daily diary |

---

## Useful Docker Commands

### Run in Background (Detached Mode)
```bash
docker compose up -d
```

### View Live Logs
```bash
docker compose logs -f web
```

### Stop Containers
```bash
docker compose down
```

### Reset / Wipe Database (Fresh Re-seed)
```bash
docker compose down -v
docker compose up --build
```

### Run Commands Inside Container
```bash
# Open a shell in the web container
docker compose exec web bash

# Create an additional superuser
docker compose exec web python backend/manage.py createsuperuser

# Re-run migrations
docker compose exec web python backend/manage.py migrate
```

---

## Environment Configuration

You can override defaults in a `.env` file or pass them directly in `docker-compose.yml`:

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_DB` | `project_dashboard` | PostgreSQL database name |
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `SECRET_KEY` | *(Pre-configured)* | Django security key |
| `DEBUG` | `False` | Production debug toggle |
| `ALLOWED_HOSTS` | `*` | Allowed host headers |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:8000,...` | Trusted CSRF origins for external domains |

# AI Samrat Project Dashboard — Production Server Deployment Guide

This guide explains how to deploy the **AI Samrat Project Dashboard** onto any production server (Ubuntu, Debian, Rocky Linux, AWS EC2, DigitalOcean, Hetzner, etc.) using Docker.

---

## 1. Zero-Data Production Readiness

This project is configured for **Zero-Data Production Deployment**:
- **0 Projects**: All project lists, gantt timelines, and charts start completely blank.
- **0 Work Diaries**: No mock daily logs or pending reviews.
- **0 Uploaded Documents**: Clean document vault ready for actual files.
- **No Infinite Spinners**: All stat counters, pie charts, and tables display clean zeros and user-friendly onboarding prompts.
- **Data Separation**: All original demo spreadsheets (`projects_data.xlsx`, `projects_data.csv`, `team_credentials.csv`, and `sqlite_dump.json`) are preserved in the `demo_data/` folder and will **not** be seeded into your live server database automatically.

---

## 2. Default Administrator Credentials

Upon first startup, the database automatically runs schema migrations and provisions a single root Administrator account:

| Parameter | Value |
| :--- | :--- |
| **URL** | `http://<SERVER_IP>:8000/login` |
| **Username** | `admin` |
| **Password** | `Password123!` |
| **Role** | System Administrator (Full Access) |

> [!TIP]
> You can customize the administrator credentials before first launch by setting `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL` in `.env`.

---

## 3. Server Prerequisites

You only need **Docker** and **Docker Compose** installed on your server:

```bash
# Verify Docker is installed
docker --version
docker compose version
```

If not installed on Ubuntu/Debian:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

---

## 4. Step-by-Step Deployment Instructions

### Step 1: Upload the Project Package to Your Server
Upload `project_dashboard.zip` to your server via `scp`, `rsync`, or direct download:

```bash
# Example uploading from your local computer:
scp project_dashboard.zip user@<SERVER_IP>:/home/user/
```

### Step 2: Extract the Package
SSH into your server and extract the archive:

```bash
cd /home/user/
unzip project_dashboard.zip
cd project_dashboard
```

### Step 3: (Optional) Customize Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Review or edit settings:
```bash
nano .env
```
Key production variables:
- `ALLOWED_HOSTS`: Set to your domain or server IP (e.g. `yourdomain.com,192.168.1.100,localhost`).
- `CSRF_TRUSTED_ORIGINS`: Set to `http://yourdomain.com:8000` or `https://yourdomain.com`.
- `ADMIN_PASSWORD`: Your desired secure master password.
- `SEED_DEMO_DATA`: Defaults to `false` (keeps database at zero data).

### Step 4: Build & Launch with Docker Compose
Start the multi-container stack in detached background mode:

```bash
docker compose up -d --build
```

Docker will:
1. Compile the React 18 + Vite frontend into optimized static production bundles.
2. Build the Python 3.11 Django runtime with Gunicorn WSGI.
3. Launch PostgreSQL 16 Alpine and wait for healthchecks.
4. Run Django migrations and static asset collection.
5. Provision the clean `admin` user.
6. Serve the unified web dashboard on port `8000`.

### Step 5: Check Startup Status
Verify both containers are running and healthy:

```bash
docker compose ps
docker compose logs -f web
```
You should see:
```text
PostgreSQL is ready and accepting connections!
Applying database schema migrations...
Collecting static assets...
Ensuring initial System Administrator account exists...
Created clean Administrator account: admin (admin@aisamrat.com)
Zero-data production mode active: 0 demo projects, 0 diary records, 0 uploaded files.
Starting production WSGI server (Gunicorn) on port 8000...
[INFO] Listening at: http://0.0.0.0:8000
```

### Step 6: Access Your Live Dashboard
Open your web browser and navigate to:
```
http://<YOUR_SERVER_IP>:8000/
```
Log in using:
- **Username**: `admin`
- **Password**: `Password123!`

---

## 5. Getting Started with Your Clean System

Once logged in:
1. **Create Projects**:
   Click the **Create First Project** button or **+ New Project** in the navigation bar to register live projects, assign POCs, and configure delivery deadlines.
2. **Add Team Members**:
   Navigate to **Team Management** to create accounts for project leads and engineers.
3. **Upload Roadmaps & Files**:
   Navigate to **Documents** to upload project files, architecture designs, and roadmap decks.
4. **Inspect Live System & Audit Logs**:
   Navigate to **System Logs** in the sidebar (Admin only) to monitor real-time server activity, security events, and exception tracebacks directly from the web browser, with 1-click `.log` downloads.

---

## 6. (Optional) Importing Demo or Historical Datasets

If you ever wish to import datasets onto the server later:

### Option A: Import via Excel in the Web UI
1. Navigate to the main dashboard.
2. Click **Import Excel**.
3. Select your `.xlsx` or `.csv` file.

### Option B: Run CLI Import Command in Docker
```bash
# Import the demo spreadsheet kept in demo_data/
docker compose exec web python backend/manage.py import_projects_data --file demo_data/projects_data.xlsx

# Initialize employee passwords
docker compose exec web python backend/manage.py setup_team_passwords
```

---

## 7. Operational Cheat Sheet

| Task | Command |
| :--- | :--- |
| **View Live Logs** | `docker compose logs -f web` |
| **Stop Dashboard** | `docker compose down` |
| **Restart Dashboard** | `docker compose restart` |
| **Rebuild After Code Changes** | `docker compose up -d --build` |
| **PostgreSQL Backup** | `docker compose exec db pg_dump -U postgres project_dashboard > backup.sql` |
| **PostgreSQL Restore** | `cat backup.sql \| docker compose exec -T db psql -U postgres -d project_dashboard` |
| **Reset Password for Admin** | `docker compose exec web python backend/manage.py changepassword admin` |

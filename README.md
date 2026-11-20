# AI SAMRAT - Enterprise Project Dashboard Platform

An enterprise-grade, high-performance project management and workforce intelligence dashboard engineered for **AI Samrat Private Limited**. Built with a pure **Django full-stack** architecture, SQLite database, Tailwind CSS UI engine, and comprehensive REST APIs with Role-Based Access Control (RBAC).

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Portal Roles & Permissions](#portal-roles--permissions)
4. [Directory & Project Structure](#directory--project-structure)
5. [Prerequisites & Installation](#prerequisites--installation)
6. [Running the Application](#running-the-application)
7. [Authentication & Credential Management](#authentication--credential-management)
8. [REST API Documentation](#rest-api-documentation)
9. [Database & Data Ingestion](#database--data-ingestion)
10. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Overview

The platform provides centralized management for all enterprise client software initiatives, team directory allocations, document vaults, roadmap tracking, and executive velocity analytics.

### Key Capabilities
- **Multi-Role Portals:** Dynamic interface routing for Administrator, Project Managers (Deepak & Megha), and Employees/Interns.
- **Project Lifecycle Management:** Create, track, filter, search, and update projects across Planning, In Progress, On Hold, Completed, and Cancelled statuses.
- **Team Directory & Workload Allocation:** Live directory linking team members directly to their assigned projects with zero duplicate or phantom zero-project entries.
- **Document & Roadmap Vault:** Secure storage and download pipeline for architectural roadmaps, SRS documentation, and project deliverables.
- **Live Velocity Analytics:** Instant visual metrics for sprint progress, completion percentages, overdue deadlines, and department distribution.
- **Zero-Hardcoded Security:** Salted PBKDF2 password hashing backed by SQLite with environment-configured secrets.

---

## Architecture & Technology Stack

```
                        +------------------------------------------+
                        |           Client Web Browsers            |
                        +------------------------------------------+
                                     |                   |
                     HTTP / Templates|                   | REST JSON APIs
                                     v                   v
+----------------------------------------------------------------------------------+
|                              Django Web Server                                   |
|                             (Port 8000 / WSGI)                                   |
|                                                                                  |
|  +---------------------+   +---------------------+   +------------------------+  |
|  |     Templates UI    |   |   REST API Views    |   |     Authentication     |  |
|  |  (Tailwind + HTML)  |   | (Django REST / JSON)|   | (PBKDF2 Sessions/Auth) |  |
|  +---------------------+   +---------------------+   +------------------------+  |
|             |                         |                          |               |
|             +-------------------------+--------------------------+               |
|                                       |                                          |
|                                       v                                          |
|  +----------------------------------------------------------------------------+  |
|  |                             Django ORM Engine                              |  |
|  |    Accounts (User)  |  Projects & Memberships  |  Documents (File Vault)   |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
               |                                                   |
               v                                                   v
+-----------------------------+                       +----------------------------+
|       SQLite Database       |                       |    Media & Upload Vault    |
|    (database/db.sqlite3)    |                       |         (uploads/)         |
+-----------------------------+                       +----------------------------+
```

### Technologies Used
- **Backend:** Python 3.10+, Django 5.x / 6.x, Django REST Framework, `django-cors-headers`, `python-dotenv`
- **Database:** SQLite 3 (stored in `database/db.sqlite3`)
- **Frontend SPA:** React 18, Vite, TypeScript, TanStack Query, Recharts, React Hook Form + Zod, Sonner, Tailwind CSS (`frontend/`)
- **Data Ingestion:** `pandas`, `openpyxl`

---

## Portal Roles & Permissions

The system implements Role-Based Access Control (RBAC). Upon login, the user's role in the database (strictly evaluated on the authenticated server session `request.user`) automatically determines their portal access and editing rights:

| Portal | Role Code | Designated Users | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin Portal** | `ADMIN` | System Administrator (`admin@aisamrat.com`) | Full permissions: Create/Edit/Delete projects, reassign members, delete documents, manage employee passwords & overrides, review all diaries, access `/admin/`. |
| **Manager Portal** | `MANAGER` | Deepak S J (`deepak@aisamrat.com`)<br>Priya Sharma (`priya.sharma@aisamrat.com`) | Management permissions: Create new projects, update project statuses & progress, assign team members & POCs, upload roadmaps & documents, review project diary entries. |
| **Employee Portal** | `EMPLOYEE` | All Team Interns / Developers (e.g. `emp_akash@aisamrat.com`) | View-only directory access: Browse projects, inspect details, view workload analytics and team directory, download documentation, **AND write/edit their own daily diary entries** for assigned projects. |

---

## Workload & Availability Intelligence

The platform computes live workload and availability for every employee based on their active project allocations:

### 1. Workload Thresholds
Only **ACTIVE** projects count toward employee workload (`IN_PROGRESS` and `PLANNING`). Delivered (`COMPLETED`), stopped (`CANCELLED`), and `ON_HOLD` projects do **NOT** count:
- **0 active projects:** `AVAILABLE` (Badge: Green `#2E7D32`)
- **1 - 2 active projects:** `BUSY` (Badge: Blue `#1E7BE0`, e.g. "Busy · 2 projects")
- **3 - 4 active projects:** `HEAVY` (Badge: Gold `#D4921A`, e.g. "Heavy · 3 projects")
- **5+ active projects:** `OVERLOADED` (Badge: Red `#C62828`, e.g. "Overloaded · 5 projects")

### 2. Availability Overrides
Users can update their own availability override; Admins and Managers can update any user's availability:
- `ON_LEAVE`: Grey `#6B7A99` (e.g. "On leave until 23 Nov")
- `AWAY`: Grey `#6B7A99` (e.g. "Away until 25 Nov")
When an override is active and `leave_until` is in the future or not set, the override takes precedence over computed project workload.

---

## Work Diary & Point of Contact (POC) System

To guarantee project transparency and accountability, each active project has a designated Point of Contact (POC) and a continuous daily work diary.

### 1. Point of Contact (POC)
- Assigned by Admin or Manager during project creation or editing.
- Must be an assigned member of the project team.
- Serves as the primary contact and reviewer for project progress updates.

### 2. Work Diary Architecture (`DiaryEntry`)
Each diary record tracks:
- `project` (FK Project) & `author` (FK User - taken strictly from session)
- `entry_date` (default today in `Asia/Kolkata` timezone)
- `done` (Text, max 2000 chars): Work completed today
- `in_progress` (Text, max 2000 chars): Tasks currently in progress
- `next_up` (Text, max 2000 chars): Next steps planned
- `blockers` (Text, optional, max 2000 chars): Operational impediments
- `reviewed_by` & `reviewed_at`: Marked when POC, manager, or admin reviews the entry
- Unique constraint: `(project, author, entry_date)` prevents duplicate entries per member per day.
- Author can edit their entry only on its own date; Admins can edit any.

### 3. Updates Due & Overdue Indicators
- `GET /api/diary/due/`: Reports members who have not submitted today's diary for active projects.
- `GET /api/diary/my/`: Returns each active project the logged-in user is a member of, prefilled with yesterday's `next_up` as today's `in_progress`.
- `last_diary_date` and `diary_overdue`: Flagged in project payloads as overdue (red alert) when an active project has had no diary update for 2 or more days.

---

## Directory & Project Structure

```
project_dashboard/
├── .env                                # Master environment variables (git-ignored)
├── .env.example                        # Production environment template
├── .gitignore                          # Version control ignore rules
├── .dockerignore                       # Docker build exclusions
├── Dockerfile                          # Multi-stage production Dockerfile
├── docker-compose.yml                  # Docker Compose (PostgreSQL 16 + Web app)
├── docker-entrypoint.sh                # Container orchestrator & auto-migration
├── app.py                              # Python application launcher CLI
├── requirements.txt                    # Python backend dependencies
├── start.bat                           # One-click Windows launch script
├── SERVER_DEPLOYMENT_GUIDE.md          # Production server deployment guide
│
├── docs/                               # Architecture & Deployment Documentation
│   ├── SERVER_DEPLOYMENT_GUIDE.md      # Step-by-step zero-data deployment guide
│   ├── DOCKER_GUIDE.md                 # Docker compose reference guide
│   └── POSTGRES_MIGRATION_GUIDE.md     # SQLite to PostgreSQL migration manual
│
├── demo_data/                          # Separated spreadsheets & demo datasets
│   ├── projects_data.xlsx              # Master project portfolio spreadsheet
│   ├── projects_data.csv               # CSV format of portfolio dataset
│   ├── team_credentials.csv            # Employee login onboarding roster
│   └── sqlite_dump.json                # JSON dump of initial prototype database
│
├── backend/                            # Django project root
│   ├── manage.py                       # Django management CLI
│   ├── config/                         # Core Django application configuration
│   │   ├── settings.py                 # Django settings (DB, templates, auth)
│   │   ├── urls.py                     # Primary routing (pages & REST APIs)
│   │   ├── views.py                    # Unified REST APIs & page views
│   │   └── wsgi.py / asgi.py           # Web server interfaces
│   ├── accounts/                       # Custom User & Authentication App
│   │   ├── models.py                   # User model (roles: ADMIN, MANAGER, EMPLOYEE)
│   │   ├── serializers.py              # DRF User serializers
│   │   └── management/commands/        # init_admin (creates clean superuser)
│   ├── projects/                       # Projects & Team Memberships App
│   │   ├── models.py                   # Project, ProjectMembership, ActivityLog, DiaryEntry
│   │   ├── serializers.py              # Project serializers
│   │   └── management/commands/        # import_projects_data, seed_demo
│   └── documents/                      # Document & Roadmap Vault App
│       ├── models.py                   # Document metadata model
│       └── validators.py               # Upload size & mime validators
│
├── frontend/                           # React 18 + Vite SPA
│   ├── package.json                    # Node dependencies
│   ├── src/                            # React components, pages, hooks & charts
│   └── dist/                           # Compiled production build
│
├── database/                           # Dedicated SQLite database directory
│   └── db.sqlite3                      # Active Django SQLite database (git-ignored)
│
├── scripts/                            # Utility & automation scripts
│   ├── create_zip.py                   # Production deployment packager
│   └── migrate_to_postgres.py          # PostgreSQL migration helper
│
├── static/                             # Public static assets & distribution zips
└── uploads/                            # Stored user files, roadmaps & specifications
```

---

## Prerequisites & Installation

### 1. Prerequisites
- **Python:** Version `3.10` or higher (`python --version`)
- **Node.js (Optional):** Version `18+` (only if you want to rebuild the React SPA frontend)

### 2. Install Python Dependencies
From the project root:
```bash
pip install -r requirements.txt
```
Installed packages:
- `django` &mdash; Core web framework
- `djangorestframework` &mdash; REST APIs
- `django-cors-headers` &mdash; Cross-Origin Resource Sharing
- `python-dotenv` &mdash; Environment configuration
- `pandas` & `openpyxl` &mdash; Excel file ingestion


### 4. Database Setup & Migrations
Initialize database tables in `database/db.sqlite3` (Django creates the `database/` directory automatically):
```bash
python backend/manage.py migrate
```

### 5. Setup Team Passwords
Hash and configure initial passwords for Admin, Deepak, Megha, and all employees:
```bash
python backend/manage.py setup_team_passwords
```
*(This command reads `DEFAULT_USER_PASSWORD` from `.env` and exports [team_credentials.csv](file:///c:/Users/sunil/Downloads/project_dashboard/team_credentials.csv)).*

---

## Running the Application

### Method 1: One-Click Windows Launcher (Recommended)
Double-click `start.bat` or run in terminal:
```cmd
start.bat
```
This script:
1. Detects your Python environment.
2. Verifies database migrations.
3. Automatically launches your default browser at `http://127.0.0.1:8000/`.
4. Starts the Django development server on port `8000`.

### Method 2: Python Launcher
```bash
python app.py
```
*(Optionally specify a custom port: `python app.py 8080`).*

### Method 3: Standard Django CLI
```bash
python backend/manage.py runserver 0.0.0.0:8000
```

---

## System Access URLs

| Interface | URL | Description |
| :--- | :--- | :--- |
| **Main Dashboard** | `http://127.0.0.1:8000/` | Full-featured responsive web dashboard |
| **Login Gateway** | `http://127.0.0.1:8000/login/` | Role authentication login portal |
| **System Logs** | `http://127.0.0.1:8000/logs/` | Real-time terminal log viewer & audit console (Admin) |
| **Django Admin** | `http://127.0.0.1:8000/admin/` | Low-level database administration |
| **Projects API** | `http://127.0.0.1:8000/api/projects` | JSON REST API for projects |
| **Team Users API** | `http://127.0.0.1:8000/api/users` | JSON REST API for team roster |
| **Logs API** | `http://127.0.0.1:8000/api/admin/logs/` | REST API for logs inspection & direct download |
| **React SPA (Alt)** | `http://127.0.0.1:8000/spa/` | React Vite single page application |

---

## Authentication & Credential Management

### Default Administrator Login

| Role | Username / Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` (or `admin@aisamrat.com`) | `Password123!` | Full Superuser & Admin Privileges |

*(In production Docker deployments, `init_admin` creates this clean administrator account automatically with 0 demo projects).*

### Demo & Team Member Accounts (When Demo Data is Seeded)

| Portal | Full Name | Email or Username | Initial Password |
| :--- | :--- | :--- | :--- |
| **Manager Portal** | Deepak S J | `deepak@aisamrat.com` or `deepak` | `AiSamrat@2026!` |
| **Manager Portal** | Megha | `megha@aisamrat.com` or `megha` | `AiSamrat@2026!` |
| **Employee Portal** | Any Team Member | e.g. `emp_akash@aisamrat.com` | `AiSamrat@2026!` |

*(Full roster of demo accounts is preserved in `demo_data/team_credentials.csv`).*

---

## System & Audit Logging (Viewing & Downloading Logs)

The project includes an enterprise-grade rotating logging engine based on Python's `logging` module and Django's centralized logging system.

### 1. View & Download in the Web UI
- **URL**: `http://127.0.0.1:8000/logs` (accessible from the **System Logs** sidebar tab for Admins).
- **Features**:
  - Live console terminal with a dark theme and auto-refresh.
  - Switch between **`app.log (All Events)`** and **`error.log (Crashes Only)`**.
  - Filter by log severity: `ALL`, `INFO`, `WARNING`, `ERROR`.
  - Live text search across all log messages.
  - Line count selectors (`50`, `150`, `300`, `500` lines).
  - 1-click **Download .log** button to download raw log files to your computer.
  - 1-click **Copy Entry** for stack traces and error diagnostics.

### 2. Download via REST API
While logged in as administrator:
- **Download Application Logs (`app.log`)**:
  ```
  GET http://127.0.0.1:8000/api/admin/logs/?download=true
  ```
- **Download Error Logs (`error.log`)**:
  ```
  GET http://127.0.0.1:8000/api/admin/logs/?file=error&download=true
  ```
- **Query Filtered Logs JSON**:
  ```
  GET http://127.0.0.1:8000/api/admin/logs/?level=ERROR&search=login&lines=100
  ```

### 3. File System Log Storage
Physical log files are stored on disk in the `logs/` directory:
- `logs/app.log` &mdash; Captures all operations (successful logins, project creations, status changes, Excel ingestion).
- `logs/error.log` &mdash; Dedicated error log capturing exceptions, tracebacks, and HTTP 500 faults.
- **Automatic Rotation**: Uses Python's `RotatingFileHandler` configured in `settings.py` (10 MB maximum size per file, preserving 5 backup archives).

### 4. Docker Production Log Persistence
In Docker, logs persist across container restarts via the `logs_data` volume:
```bash
# View live output:
docker compose logs -f web

# Inspect log file inside container:
docker compose exec web tail -n 100 logs/app.log

# Copy log file out of container to host:
docker compose cp web:/app/logs/app.log ./app.log
```

### How Passwords Work
- **Security:** Passwords are never stored in plain text. They are hashed using Django's **PBKDF2-SHA256** algorithm with a unique cryptographic salt and 1,500,000 iterations.
- **Storage Location:** SQLite database table `accounts_user`, column `password` (`database/db.sqlite3`).
- **Flexible Login:** Users can log in using either their **Email Address** OR their **Username**.

### Changing Passwords

#### Option A: Direct Web UI (Admin & Manager Only)
1. Log in to the **Manager Portal** (e.g. `deepak@aisamrat.com`) or **Admin Portal**.
2. Navigate to the **Team Management** tab in the top navigation bar (or click the key icon on any employee card in the Team Directory).
3. Click **Edit Password** next to any employee.
4. Enter or generate a new strong password and click **Update Password**.
5. The password PBKDF2 hash is immediately updated in the database and synchronized to `team_credentials.csv`.

#### Option B: Adding New Employees via Web UI (Admin & Manager Only)
1. In the **Team Management** or **Team Directory** tab, click **+ Add Employee**.
2. Enter Name, Corporate Email, Role (Employee or Manager), Department, Job Title, and Password.
3. Click **Create Employee**. The account is created immediately with zero terminal access needed.

#### Option C: Command Line (CLI)
To change any user's password securely from the terminal:
```bash
python backend/manage.py changepassword <email_or_username>
```
*Example:*
```bash
python backend/manage.py changepassword deepak@aisamrat.com
```

---

## REST API Documentation

All REST APIs support Session authentication and standard JSON payloads.

### 1. Authentication Endpoints

#### `POST /api/auth/login`
Authenticates a user and establishes session.
- **Request Body:**
  ```json
  {
    "username": "deepak@aisamrat.com",
    "password": "YourPasswordHere"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "portal": "manager",
    "role": "project_manager",
    "user": {
      "id": 114,
      "name": "Deepak S J",
      "email": "deepak@aisamrat.com",
      "role": "project_manager",
      "department": "Engineering"
    }
  }
  ```

#### `POST /api/auth/logout`
Terminates the active session and logs out.

#### `GET /api/auth/me`
Returns current authenticated user details.

---

### 2. Projects Endpoints

#### `GET /api/projects`
Retrieves filtered and sorted project list.
- **Query Parameters:**
  - `status`: Filter by status (`all`, `In Progress`, `Planning`, `Completed`, `On Hold`, `Cancelled`, `ending_soon`, `overdue`).
  - `search`: Case-insensitive search across project name, code, and description.
  - `priority`: Filter by priority (`High`, `Medium`, `Low`).
  - `member_id`: Filter by assigned employee user ID.
  - `sort_by`: Column to sort (`name`, `status`, `start_date`, `end_date`, `priority`, `progress`).
  - `sort_order`: `asc` or `desc`.

#### `POST /api/projects`
Creates a new project *(Admin & Manager only)*.
- **Request Body:**
  ```json
  {
    "name": "AI Automation Platform",
    "project_code": "AIS-AUTO-01",
    "status": "In Progress",
    "project_manager": "Deepak S J",
    "created_by_id": 114,
    "start_date": "2026-11-16",
    "end_date": "2026-12-31",
    "priority": "High",
    "progress": 25,
    "category": "Software Solutions",
    "description": "Enterprise automated workflow system.",
    "team": [
      { "user_id": 114, "name": "Deepak S J", "role": "Project Manager" },
      { "user_id": 65, "name": "Akash", "role": "Developer" }
    ]
  }
  ```
- **Response:** `201 Created`

#### `GET /api/projects/<id>`
Retrieves full details for a single project, including memberships, documents, and activity history.

#### `PUT /api/projects/<id>`
Updates an existing project *(Admin & Manager only)*.

#### `DELETE /api/projects/<id>`
Permanently deletes a project and its memberships *(Admin & Manager only)*.

---

### 3. Users & Team Management Endpoints

#### `GET /api/users`
Returns active team members who hold manager/admin roles or have active project assignments (eliminates zero-project/duplicate records). Includes `assigned_projects_count`.

#### `POST /api/users` *(Admin & Manager Only)*
Creates a new employee or manager account with PBKDF2 password hashing and records in `team_credentials.csv`.
- **Request Body:**
  ```json
  {
    "first_name": "Rahul",
    "last_name": "Sharma",
    "email": "rahul.sharma@aisamrat.com",
    "username": "rahul.sharma",
    "role": "EMPLOYEE",
    "department": "Engineering",
    "job_title": "Developer",
    "password": "InitialSecurePassword123!"
  }
  ```
- **Response:** `201 Created`

#### `POST /api/users/<id>/password` *(Admin & Manager Only)*
Updates the login password for a user. Encrypts the password with PBKDF2-SHA256 and synchronizes `team_credentials.csv`.
- **Request Body:**
  ```json
  {
    "password": "NewSecurePassword456!"
  }
  ```
- **Response:** `200 OK`

#### `DELETE /api/users/<id>` *(Admin & Manager Only)*
Deactivates/removes a team member account. Managers cannot delete Administrators.

---

### 4. Metrics & Summary Endpoints

#### `GET /api/summary`
Returns live metrics for dashboard counters:
```json
{
  "total": 53,
  "in_progress": 38,
  "planning": 8,
  "completed": 5,
  "cancelled": 2,
  "on_hold": 0,
  "overdue": 12,
  "ending_soon": 6,
  "total_files": 8,
  "total_users": 43,
  "avg_progress": 42.6
}
```

---

### 5. Workload & Availability Endpoints

#### `GET /api/employees/workload/`
Retrieves live workload status for all employees.
- **Query Parameters:**
  - `active_only`: `true` (default) | `false`
  - `sort`: `projects_desc` | `projects_asc` | `name`
  - `department`: Filter by department (optional)
  - `status`: Filter by status (`AVAILABLE`, `BUSY`, `HEAVY`, `OVERLOADED`, `ON_LEAVE`, `AWAY`)
- **Response Format:**
```json
[
  {
    "id": 1,
    "name": "Priya Sharma",
    "initials": "PS",
    "job_title": "Senior Engineering Manager",
    "department": "Product Delivery",
    "active_count": 2,
    "total_count": 5,
    "status": "BUSY",
    "availability_override": null,
    "leave_until": null,
    "projects": [
      { "id": 10, "name": "AI Automation Platform", "status": "In Progress", "priority": "High" }
    ]
  }
]
```

#### `PATCH /api/users/<id>/`
Updates employee availability override. Employees can update their own; Admins/Managers can update anyone:
```json
{
  "availability_override": "ON_LEAVE",
  "leave_until": "2026-11-25"
}
```

---

### 6. Work Diary Endpoints

#### `GET /api/diary/my/`
Returns all active projects the authenticated user belongs to, paired with today's entry (if present) or pre-filled with yesterday's `next_up` as today's `in_progress`.

#### `POST /api/projects/<id>/diary/`
Creates or updates **today's** diary entry for the logged-in user on the given project.
- **Request Body:**
```json
{
  "done": "Implemented CSRF and session auth checks.",
  "in_progress": "Refactoring analytics workload doughnut.",
  "next_up": "Verify responsive layouts.",
  "blockers": ""
}
```

#### `PATCH /api/diary/<id>/`
Updates an existing diary entry. Only the author can edit, and only on the date the entry was created. Administrators can edit any entry.

#### `POST /api/diary/<id>/review/`
Marks a diary entry as reviewed. Restricted to the project's POC, Project Manager, or Administrator. Automatically sets `reviewed_by` and `reviewed_at`.

#### `GET /api/diary/due/`
For POCs, Project Managers, and Administrators: lists all members missing today's diary update grouped per active project.

---

### 7. Document & File Vault Endpoints

#### `GET /api/files/`
Returns the centralized registry of documents and architectural roadmaps across all projects.

#### `GET /api/files/<id>/download/`
Authenticated document download streaming directly from storage. Requires user login; public static access is disabled for security.

#### `DELETE /api/files/<id>/`
Permanently removes a document *(Admin & Manager only)*.

---

## Database & Data Ingestion

### Database Location
The active database is stored at:
```
database/db.sqlite3
```
Configured in `backend/config/settings.py` via `BASE_DIR.parent / 'database' / 'db.sqlite3'`.

### Ingesting Projects from Excel
To re-ingest projects and interns from an Excel spreadsheet (`projects_data.xlsx`):
```bash
python import_excel.py
```
Or via Django management command:
```bash
python backend/manage.py import_projects_data
```

---

## Troubleshooting & FAQ

### 1. Port 8000 is already in use
Specify a different port when launching:
```bash
python app.py 8080
```
Or with Django manage:
```bash
python backend/manage.py runserver 0.0.0.0:8080
```

### 2. "Permission denied: Employees have view-only access"
You are logged into an Employee account. Log out and sign in using Manager credentials (`deepak@aisamrat.com` or `megha@aisamrat.com`) or Admin credentials (`admin@aisamrat.com`).

### 3. Missing dependencies after Git pull
Re-run pip install:
```bash
pip install -r requirements.txt
```

### 4. System check validation
You can verify the entire backend integrity at any time with:
```bash
python backend/manage.py check
```

---

## License & Intellectual Property
Confidential & Proprietary &bull; **AI Samrat Private Limited** &bull; Software Solutions Internal Platform.

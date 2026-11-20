"""
Unified Django Views for AI Samrat Project Dashboard.
Serves frontend HTML templates, React SPA build, and complete REST API endpoints.
"""

import os
import io
import re
import csv
import json
from datetime import datetime, date, timedelta
from pathlib import Path
from functools import wraps

from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, FileResponse, HttpResponse, Http404
from django.middleware.csrf import get_token
from django.contrib.auth import authenticate, login, logout
from django.conf import settings
from django.db.models import Q, Avg, Count
from django.utils import timezone

from accounts.models import User
from projects.models import Project, ProjectMembership, ActivityLog, DiaryEntry
from documents.models import Document
from config.constants import (
    ACTIVE_PROJECT_STATUSES,
    AvailabilityStatus,
    calculate_workload_status,
)

BASE_DIR = Path(settings.BASE_DIR)
ROOT_DIR = BASE_DIR.parent
UPLOAD_DIR = ROOT_DIR / 'uploads'

import logging
logger = logging.getLogger('project_dashboard')

def get_client_ip(request):
    """Safely extracts client IP from request headers or remote addr."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '127.0.0.1')


# ==============================================================================
# AUTH & PERMISSION HELPERS
# ==============================================================================

def check_role_permission(request):
    """
    Admin and Manager can mutate data; Employee is view-only.
    Strictly reads role from request.user (session). Never from headers, params, or body.
    """
    if not request.user or not request.user.is_authenticated:
        return False
    if request.user.is_superuser:
        return True
    return request.user.role in (User.Role.ADMIN, User.Role.MANAGER)


def require_auth(view_func):
    """Decorator ensuring request.user is authenticated for /api/ endpoints."""
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return JsonResponse({'detail': 'Authentication credentials were not provided.'}, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped


def format_project_dict(p, today=None, active_counts_map=None):
    """Formats a Project model instance to the exact JSON structure expected by frontend."""
    if today is None:
        today = timezone.localdate()

    start_d = p.start_date or today
    end_d = p.end_date or today

    if isinstance(start_d, str):
        try:
            start_d = datetime.strptime(start_d[:10], '%Y-%m-%d').date()
        except Exception:
            start_d = today
    elif hasattr(start_d, 'date') and callable(getattr(start_d, 'date')):
        start_d = start_d.date()

    if isinstance(end_d, str):
        try:
            end_d = datetime.strptime(end_d[:10], '%Y-%m-%d').date()
        except Exception:
            end_d = today
    elif hasattr(end_d, 'date') and callable(getattr(end_d, 'date')):
        end_d = end_d.date()

    days_remaining = (end_d - today).days

    if p.status == 'Completed':
        deadline_status = 'completed'
        deadline_label = 'Completed'
        deadline_badge = 'bg-emerald-50 text-emerald-700 border-emerald-200'
    elif p.status == 'Cancelled':
        deadline_status = 'cancelled'
        deadline_label = 'Cancelled'
        deadline_badge = 'bg-slate-100 text-slate-600 border-slate-200'
    elif p.status == 'On Hold':
        deadline_status = 'on_hold'
        deadline_label = 'On Hold'
        deadline_badge = 'bg-amber-50 text-amber-700 border-amber-200 font-bold'
    elif days_remaining < 0:
        deadline_status = 'overdue'
        deadline_label = f"Overdue by {abs(days_remaining)}d"
        deadline_badge = 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
    elif days_remaining <= 7:
        deadline_status = 'ending_soon'
        deadline_label = f"Ending in {days_remaining}d"
        deadline_badge = 'bg-amber-50 text-amber-700 border-amber-200 font-bold'
    elif today < start_d:
        deadline_status = 'upcoming'
        deadline_label = f"Starts in {(start_d - today).days}d"
        deadline_badge = 'bg-purple-50 text-purple-700 border-purple-200'
    else:
        deadline_status = 'on_track'
        deadline_label = f"{days_remaining}d remaining"
        deadline_badge = 'bg-blue-50 text-blue-700 border-blue-200'

    # Team members with availability status and active count
    team = []
    for m in p.memberships.all():
        emp = m.employee
        if active_counts_map is not None:
            act_count = active_counts_map.get(emp.id, 0)
            override = emp.availability_override
            leave_until = emp.leave_until
            if override and (not leave_until or leave_until >= today):
                emp_status = override
            else:
                emp_status = calculate_workload_status(act_count)
        else:
            emp_status = emp.get_availability_status(today)
            act_count = emp.get_active_project_count()

        team.append({
            'member_record_id': m.id,
            'project_role': m.role_on_project,
            'user_id': emp.id,
            'name': emp.get_full_name() or emp.username,
            'email': emp.email,
            'avatar_initials': emp.initials if hasattr(emp, 'initials') else 'EM',
            'department': emp.department or 'Engineering',
            'status': emp_status,
            'active_count': act_count,
            'availability_override': emp.availability_override,
            'leave_until': emp.leave_until.strftime('%Y-%m-%d') if emp.leave_until else None,
        })

    # Files (documents)
    files = []
    for d in p.documents.all():
        f_type = 'roadmap' if d.doc_type == Document.DocType.ROADMAP else 'documentation'
        uploader = getattr(d, 'uploaded_by', None)
        uploader_name = (uploader.get_full_name() or uploader.username) if uploader else 'Staff'
        files.append({
            'id': d.id,
            'project_id': p.id,
            'file_type': f_type,
            'original_filename': d.original_name,
            'stored_filename': os.path.basename(d.file.name) if d.file else d.original_name,
            'file_size': d.size_bytes,
            'mime_type': 'application/octet-stream',
            'uploader_name': uploader_name,
            'uploaded_at': d.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    # Diary information: last_diary_date & diary_overdue
    diaries = list(p.diary_entries.all())
    latest_diary = max(diaries, key=lambda de: de.entry_date) if diaries else None
    last_diary_date = latest_diary.entry_date.strftime('%Y-%m-%d') if latest_diary else None
    
    is_active = p.status in ('In Progress', 'Planning', 'IN_PROGRESS', 'PLANNING')
    diary_overdue = False
    if is_active:
        if latest_diary:
            diary_overdue = (today - latest_diary.entry_date).days >= 2
        else:
            base_date = p.start_date or (p.created_at.date() if p.created_at else today)
            diary_overdue = (today - base_date).days >= 2

    # Format dates
    s_formatted = start_d.strftime('%d %b %Y')
    e_formatted = end_d.strftime('%d %b %Y')

    poc_info = None
    if p.poc:
        poc_info = {
            'id': p.poc.id,
            'name': p.poc.get_full_name() or p.poc.username,
            'email': p.poc.email,
            'initials': p.poc.initials if hasattr(p.poc, 'initials') else 'PC'
        }

    # Module completion breakdown for Bar Graph
    base_prog = p.progress or 0
    fe_prog = getattr(p, 'frontend_progress', 0) or 0
    be_prog = getattr(p, 'backend_progress', 0) or 0
    db_prog = getattr(p, 'database_progress', 0) or 0
    if p.status == 'Completed':
        fe_prog = 100
        be_prog = 100
        db_prog = 100
    elif p.status == 'Planning' and (fe_prog == 0 and be_prog == 0 and db_prog == 0):
        db_prog = min(100, max(20, base_prog + 15))
        be_prog = min(100, max(10, base_prog + 5))
        fe_prog = min(100, max(5, base_prog))
    elif p.status in ('Cancelled', 'On Hold') and (fe_prog == 0 and be_prog == 0 and db_prog == 0):
        db_prog = base_prog
        be_prog = base_prog
        fe_prog = base_prog
    elif fe_prog == 0 and be_prog == 0 and db_prog == 0:
        # In Progress fallback: realistic engineering progress across layers
        db_prog = min(100, max(0, int(base_prog * 1.12 + (p.id % 7))))
        be_prog = min(100, max(0, int(base_prog * 1.02 + (p.id % 5) - 2)))
        fe_prog = min(100, max(0, int(base_prog * 0.92 + (p.id % 9) - 3)))

    return {
        'id': p.id,
        'project_code': p.project_code or f"PRJ-{p.id:03d}",
        'name': p.name,
        'title': p.name,  # Compatibility with React types
        'status': p.status,
        'start_date': start_d.strftime('%Y-%m-%d'),
        'end_date': end_d.strftime('%Y-%m-%d'),
        'start_date_formatted': s_formatted,
        'end_date_formatted': e_formatted,
        'description': p.description,
        'priority': p.priority,
        'progress': p.progress,
        'frontend_progress': fe_prog,
        'backend_progress': be_prog,
        'database_progress': db_prog,
        'latest_progress_report': getattr(p, 'latest_progress_report', '') or '',
        'progress_reported_at': p.progress_reported_at.strftime('%Y-%m-%d %H:%M:%S') if getattr(p, 'progress_reported_at', None) else None,
        'category': p.category,
        'deadline_status': deadline_status,
        'deadline_label': deadline_label,
        'deadline_badge': deadline_badge,
        'creator_name': (p.project_manager.get_full_name() or p.project_manager.username) if p.project_manager else 'System',
        'creator_email': p.project_manager.email if p.project_manager else '',
        'project_manager': {
            'id': p.project_manager.id,
            'name': p.project_manager.get_full_name() or p.project_manager.username,
            'email': p.project_manager.email
        } if p.project_manager else None,
        'poc': poc_info,
        'last_diary_date': last_diary_date,
        'diary_overdue': diary_overdue,
        'team': team,
        'files': files,
        'roadmaps': [f for f in files if f['file_type'] == 'roadmap'],
        'docs': [f for f in files if f['file_type'] == 'documentation'],
    }


# ==============================================================================
# HTML PAGE VIEWS
# ==============================================================================

def dashboard_page_view(request):
    """Serves the React Vite SPA index.html."""
    return spa_page_view(request)


def login_page_view(request):
    """Serves the React Vite SPA index.html."""
    return spa_page_view(request)


def logout_page_view(request):
    """Clears user session and redirects to login."""
    logout(request)
    request.session.flush()
    return redirect('/login/')


def spa_page_view(request):
    """Serves the React Vite SPA index.html, redirecting unauthenticated users to /login."""
    dist_index = ROOT_DIR / 'frontend' / 'dist' / 'index.html'
    if not dist_index.exists():
        raise Http404("React frontend dist not found. Please build frontend first.")

    path = request.path.strip('/')
    if not request.user.is_authenticated and path != 'login' and not path.startswith('login'):
        return redirect('/login')

    return FileResponse(open(dist_index, 'rb'), content_type='text/html; charset=utf-8')


def download_dashboard_zip_view(request):
    """Serves project_dashboard.zip for instant project export."""
    candidates = [
        ROOT_DIR / 'project_dashboard.zip',
        ROOT_DIR.parent / 'project_dashboard.zip',
        ROOT_DIR.parent / 'project_dashboard_final.zip',
    ]
    for p in candidates:
        if p.exists():
            return FileResponse(open(p, 'rb'), as_attachment=True, filename='project_dashboard.zip')
    return JsonResponse({'error': 'Dashboard zip not found'}, status=404)


# ==============================================================================
# REST API: AUTHENTICATION
# ==============================================================================

def api_auth_login(request):
    """
    Standard Django authentication (Email or Username).
    CSRF token enforced. Never creates hardcoded accounts.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        data = {}

    identifier = (data.get('username') or data.get('email') or '').strip()
    password = (data.get('password') or '').strip()

    if not identifier or not password:
        return JsonResponse({'success': False, 'error': 'Please provide both email/username and password.'}, status=400)

    # Resolve target user by email or username
    target = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
    if not target:
        logger.warning(f"Failed login attempt: unknown identifier '{identifier}' from IP {get_client_ip(request)}")
        return JsonResponse({'success': False, 'error': 'Invalid email/username or password.'}, status=401)

    user = authenticate(request, username=target.username, password=password)
    if user is None:
        logger.warning(f"Failed login attempt: invalid credentials for '{target.username}' from IP {get_client_ip(request)}")
        return JsonResponse({'success': False, 'error': 'Invalid email/username or password.'}, status=401)

    if not user.is_active:
        logger.warning(f"Blocked login attempt: inactive account '{user.username}' from IP {get_client_ip(request)}")
        return JsonResponse({'success': False, 'error': 'This user account is inactive.'}, status=403)

    login(request, user)
    logger.info(f"User '{user.username}' (Role: {user.role}) logged in successfully from IP {get_client_ip(request)}")

    if user.role == User.Role.ADMIN or user.is_superuser:
        role = 'admin'
        portal = 'admin'
    elif user.role == User.Role.MANAGER:
        role = 'project_manager'
        portal = 'manager'
    else:
        role = 'developer'
        portal = 'employee'

    user_info = {
        'id': user.id,
        'username': user.username,
        'name': user.get_full_name() or user.username,
        'email': user.email,
        'role': role,
        'raw_role': user.role,
        'department': user.department or 'Engineering',
        'job_title': user.job_title or '',
        'avatar_initials': user.initials if hasattr(user, 'initials') else 'US',
        'status': user.get_availability_status(),
        'active_count': user.get_active_project_count(),
    }

    request.session['user'] = user_info
    request.session['portal'] = portal
    request.session['role'] = role

    return JsonResponse({
        'success': True,
        'detail': 'Login successful',
        'csrfToken': get_token(request),
        'portal': portal,
        'role': role,
        'user': user_info
    })


@require_auth
def api_auth_logout(request):
    """API logout."""
    uname = request.user.username if (request.user and request.user.is_authenticated) else 'Anonymous'
    logout(request)
    request.session.flush()
    logger.info(f"User '{uname}' logged out successfully")
    return JsonResponse({'success': True, 'detail': 'Logged out successfully.'})


@require_auth
def api_admin_logs(request):
    """
    Admin-only endpoint to view, search, stream, and download system & error logs.
    Query parameters:
      file: 'app' (default) or 'error'
      level: 'ALL' (default), 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
      lines: int (default 150, max 1000)
      search: string (case-insensitive substring filter)
      download: '1' or 'true' (returns log file download response)
      clear: '1' (clears the log file, Admin only)
    """
    user = request.user
    is_admin = bool(user.is_superuser or user.role == User.Role.ADMIN or user.is_staff)
    if not is_admin:
        return JsonResponse({'error': 'Permission denied: System Logs require Administrator privileges.'}, status=403)

    logs_dir = getattr(settings, 'LOGS_DIR', BASE_DIR.parent / 'logs')
    log_type = request.GET.get('file', 'app').lower()
    target_filename = 'error.log' if log_type == 'error' else 'app.log'
    log_path = logs_dir / target_filename

    # 1. Download full log file
    if request.GET.get('download') in ('1', 'true'):
        if not log_path.exists():
            return HttpResponse(f"# No log entries recorded in {target_filename} yet.\n", content_type='text/plain')
        logger.info(f"Admin '{user.username}' downloaded log archive: {target_filename}")
        response = FileResponse(open(log_path, 'rb'), content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{target_filename}"'
        return response

    # 2. Clear log file
    if request.method == 'POST' and request.GET.get('clear') == '1':
        if log_path.exists():
            with open(log_path, 'w', encoding='utf-8') as f:
                f.write(f"# Log reset by admin '{user.username}' on {timezone.now().strftime('%Y-%m-%d %H:%M:%S %Z')}\n")
            logger.info(f"Admin '{user.username}' cleared log file: {target_filename}")
        return JsonResponse({'success': True, 'message': f'{target_filename} has been cleared.'})

    # 3. Read & parse log lines
    if not log_path.exists():
        return JsonResponse({
            'logs': [],
            'file_name': target_filename,
            'file_size': '0 B',
            'total_lines': 0,
            'levels_count': {'INFO': 0, 'WARNING': 0, 'ERROR': 0, 'CRITICAL': 0}
        })

    try:
        size_bytes = os.path.getsize(log_path)
        if size_bytes < 1024:
            size_formatted = f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            size_formatted = f"{(size_bytes / 1024):.1f} KB"
        else:
            size_formatted = f"{(size_bytes / (1024 * 1024)):.2f} MB"

        max_lines = min(int(request.GET.get('lines', 150)), 1000)
        level_filter = request.GET.get('level', '').strip().upper()
        search_filter = request.GET.get('search', '').strip().lower()

        with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()

        total_lines_in_file = len(all_lines)
        parsed_logs = []
        levels_count = {'INFO': 0, 'WARNING': 0, 'ERROR': 0, 'CRITICAL': 0}

        log_pattern = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[([A-Z]+)\]\s+([^:]+?)(?:\s+\([^)]+\))?:\s+(.*)$')

        for raw_line in reversed(all_lines):
            line_str = raw_line.strip()
            if not line_str or line_str.startswith('#'):
                continue

            match = log_pattern.match(line_str)
            if match:
                ts, lvl, src, msg = match.groups()
            else:
                ts, lvl, src, msg = '', 'INFO', 'system', line_str

            lvl_upper = lvl.upper()
            if lvl_upper in levels_count:
                levels_count[lvl_upper] += 1

            if level_filter and level_filter != 'ALL' and lvl_upper != level_filter:
                continue

            if search_filter:
                candidate = f"{ts} {lvl_upper} {src} {msg}".lower()
                if search_filter not in candidate:
                    continue

            parsed_logs.append({
                'timestamp': ts,
                'level': lvl_upper,
                'logger': src.strip(),
                'message': msg.strip(),
                'raw': line_str
            })

            if len(parsed_logs) >= max_lines:
                break

        return JsonResponse({
            'logs': parsed_logs,
            'file_name': target_filename,
            'file_size': size_formatted,
            'total_lines': total_lines_in_file,
            'levels_count': levels_count
        })

    except Exception as e:
        logger.error(f"Error reading {target_filename}: {e}", exc_info=True)
        return JsonResponse({'error': f"Failed to read logs: {str(e)}"}, status=500)


@require_auth
def api_auth_me(request):
    """Returns the currently logged in user info."""
    user = request.user
    role_label = 'admin' if (user.role == User.Role.ADMIN or user.is_superuser) else ('project_manager' if user.role == User.Role.MANAGER else 'developer')

    return JsonResponse({
        'id': user.id,
        'username': user.username,
        'name': user.get_full_name() or user.username,
        'email': user.email,
        'role': user.role,
        'role_label': role_label,
        'department': user.department or 'Engineering',
        'job_title': user.job_title or '',
        'initials': user.initials if hasattr(user, 'initials') else 'US',
        'is_admin': user.is_admin_role if hasattr(user, 'is_admin_role') else user.is_superuser,
        'is_manager': user.is_manager_role if hasattr(user, 'is_manager_role') else user.is_staff,
        'availability_override': user.availability_override,
        'leave_until': user.leave_until.strftime('%Y-%m-%d') if user.leave_until else None,
        'status': user.get_availability_status(),
        'active_count': user.get_active_project_count(),
    })


def api_csrf(request):
    """Returns fresh CSRF token."""
    return JsonResponse({'csrfToken': get_token(request)})


# ==============================================================================
# REST API: SUMMARY METRICS & USERS
# ==============================================================================

@require_auth
def api_summary(request):
    """Computes and returns summary KPI metrics for dashboard analytics."""
    today = timezone.localdate()
    total = Project.objects.count()
    in_progress = Project.objects.filter(status='In Progress').count()
    planning = Project.objects.filter(status='Planning').count()
    completed = Project.objects.filter(status='Completed').count()
    cancelled = Project.objects.filter(status='Cancelled').count()
    on_hold = Project.objects.filter(status='On Hold').count()

    overdue = Project.objects.exclude(status__in=['Completed', 'Cancelled', 'On Hold']).filter(end_date__lt=today).count()
    ending_soon = Project.objects.exclude(status__in=['Completed', 'Cancelled', 'On Hold']).filter(end_date__gte=today, end_date__lte=today + timedelta(days=7)).count()

    total_files = Document.objects.count()
    total_users = User.objects.count()

    avg_p = Project.objects.filter(status='In Progress').aggregate(avg=Avg('progress'))['avg']
    avg_progress = round(avg_p, 1) if avg_p is not None else 0

    return JsonResponse({
        'total': total,
        'in_progress': in_progress,
        'planning': planning,
        'completed': completed,
        'cancelled': cancelled,
        'on_hold': on_hold,
        'overdue': overdue,
        'ending_soon': ending_soon,
        'total_files': total_files,
        'total_users': total_users,
        'avg_progress': avg_progress
    })


def sync_csv_credentials(user, plain_password, is_new=False):
    """Synchronizes user credentials with team_credentials.csv if it exists."""
    csv_path = ROOT_DIR / 'team_credentials.csv'
    if not csv_path.exists():
        return

    try:
        rows = []
        found = False
        with open(csv_path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or ['Name', 'Role', 'Portal', 'Email', 'Username', 'InitialPassword']
            for row in reader:
                if row.get('Email', '').strip().lower() == user.email.strip().lower() or row.get('Username', '').strip().lower() == user.username.strip().lower():
                    row['InitialPassword'] = plain_password
                    row['Role'] = user.role
                    row['Name'] = user.get_full_name() or user.username
                    found = True
                rows.append(row)

        if not found and is_new:
            portal_label = 'Admin Portal' if (user.role == User.Role.ADMIN or user.is_superuser) else ('Manager Portal' if user.role == User.Role.MANAGER else 'Employee Portal')
            rows.append({
                'Name': user.get_full_name() or user.username,
                'Role': user.role,
                'Portal': portal_label,
                'Email': user.email,
                'Username': user.username,
                'InitialPassword': plain_password
            })

        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['Name', 'Role', 'Portal', 'Email', 'Username', 'InitialPassword'])
            writer.writeheader()
            writer.writerows(rows)
    except Exception as e:
        print(f"Warning: Failed to sync team_credentials.csv: {e}")


def remove_from_csv_credentials(email, username):
    """Removes a deleted user from team_credentials.csv."""
    csv_path = ROOT_DIR / 'team_credentials.csv'
    if not csv_path.exists():
        return
    try:
        rows = []
        with open(csv_path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or ['Name', 'Role', 'Portal', 'Email', 'Username', 'InitialPassword']
            for row in reader:
                r_email = (row.get('Email') or '').strip().lower()
                r_user = (row.get('Username') or '').strip().lower()
                if (email and r_email == email.strip().lower()) or (username and r_user == username.strip().lower()):
                    continue
                rows.append(row)
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    except Exception as e:
        print(f"Warning: Failed to update team_credentials.csv on delete: {e}")


@require_auth
def api_users(request):
    """GET /api/users returns active users; POST /api/users creates a new employee (Admin/Manager only)."""
    if request.method == 'GET':
        today = timezone.localdate()
        is_admin_user = bool(
            request.user.is_authenticated and (
                getattr(request.user, 'is_admin_role', False)
                or request.user.is_superuser
                or getattr(request.user, 'role', '') == User.Role.ADMIN
            )
        )
        users = User.objects.filter(is_active=True).order_by('first_name', 'username')
        if not is_admin_user:
            users = users.exclude(role=User.Role.ADMIN).exclude(is_superuser=True).exclude(username='admin')

        from django.db.models import Count
        act_counts_map = dict(
            ProjectMembership.objects.filter(
                project__status__in=ACTIVE_PROJECT_STATUSES
            ).values('employee_id').annotate(c=Count('id')).values_list('employee_id', 'c')
        )
        tot_counts_map = dict(
            ProjectMembership.objects.exclude(
                project__status__in=['Completed', 'Cancelled']
            ).values('employee_id').annotate(c=Count('id')).values_list('employee_id', 'c')
        )

        result = []
        for u in users:
            role_label = 'admin' if (u.role == User.Role.ADMIN or u.is_superuser) else ('project_manager' if u.role == User.Role.MANAGER else 'developer')
            act_count = act_counts_map.get(u.id, 0)
            tot_count = tot_counts_map.get(u.id, 0)
            if u.availability_override and (not u.leave_until or u.leave_until >= today):
                st = u.availability_override
            else:
                st = calculate_workload_status(act_count)

            result.append({
                'id': u.id,
                'name': u.get_full_name() or u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'username': u.username,
                'email': u.email,
                'role': role_label,
                'raw_role': u.role,
                'department': u.department or 'Engineering',
                'job_title': u.job_title or ('Project Manager' if u.role == User.Role.MANAGER else 'Developer'),
                'avatar_initials': u.initials if hasattr(u, 'initials') else 'EM',
                'assigned_projects_count': tot_count,
                'active_count': act_count,
                'total_count': tot_count,
                'status': st,
                'availability_override': u.availability_override,
                'leave_until': u.leave_until.strftime('%Y-%m-%d') if u.leave_until else None,
                'is_superuser': u.is_superuser
            })
        return JsonResponse(result, safe=False)

    elif request.method == 'POST':
        if not check_role_permission(request):
            return JsonResponse({'error': 'Permission denied: Employees have view-only access. Only Admin and Manager can add employees.'}, status=403)

        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        first_name = (data.get('first_name') or data.get('name') or '').strip()
        last_name = (data.get('last_name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = (data.get('password') or '').strip()
        role_input = (data.get('role') or 'EMPLOYEE').strip()
        department = (data.get('department') or 'Engineering').strip()
        job_title = (data.get('job_title') or '').strip()

        if not first_name or not email or not password:
            return JsonResponse({'error': 'First name, email address, and initial password are required.'}, status=400)

        if len(password) < 6:
            return JsonResponse({'error': 'Password must be at least 6 characters.'}, status=400)

        if User.objects.filter(email__iexact=email).exists():
            return JsonResponse({'error': f'An account with email "{email}" already exists.'}, status=400)

        # Normalize role
        if role_input.upper() in ['ADMIN', 'ADMINISTRATOR']:
            if not (request.user.role == User.Role.ADMIN or request.user.is_superuser):
                return JsonResponse({'error': 'Permission denied: Only Administrators can create Admin accounts.'}, status=403)
            role = User.Role.ADMIN
            job_title = job_title or 'System Administrator'
        elif role_input.upper() in ['MANAGER', 'PROJECT_MANAGER', 'PROJECT MANAGER']:
            role = User.Role.MANAGER
            job_title = job_title or 'Project Manager'
        else:
            role = User.Role.EMPLOYEE
            job_title = job_title or 'Developer'

        # Generate unique username
        base_username = (data.get('username') or '').strip().lower()
        if not base_username:
            base_username = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0])
            if not base_username.startswith('emp_') and role == User.Role.EMPLOYEE:
                base_username = f"emp_{base_username}"
        username = base_username
        counter = 1
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        new_user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=role,
            department=department,
            job_title=job_title
        )

        sync_csv_credentials(new_user, password, is_new=True)

        user_full_name = new_user.get_full_name() or new_user.username
        role_label = 'admin' if (new_user.role == User.Role.ADMIN or new_user.is_superuser) else ('project_manager' if new_user.role == User.Role.MANAGER else 'developer')

        return JsonResponse({
            'success': True,
            'message': f"Employee '{user_full_name}' added successfully.",
            'user': {
                'id': new_user.id,
                'name': user_full_name,
                'first_name': new_user.first_name,
                'last_name': new_user.last_name,
                'username': new_user.username,
                'email': new_user.email,
                'role': role_label,
                'raw_role': new_user.role,
                'department': new_user.department,
                'job_title': new_user.job_title,
                'avatar_initials': new_user.initials if hasattr(new_user, 'initials') else 'EM',
                'assigned_projects_count': 0,
                'active_count': 0,
                'status': new_user.get_availability_status(),
            }
        }, status=201)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@require_auth
def api_user_change_password(request, user_id):
    """Allows Admin and Manager to change an employee/user password directly from the UI."""
    if request.method not in ['POST', 'PUT']:
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Employees have view-only access. Only Admin and Manager can modify credentials.'}, status=403)

    target_user = get_object_or_404(User, id=user_id)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    new_password = (data.get('password') or data.get('new_password') or '').strip()
    if not new_password:
        return JsonResponse({'error': 'New password is required.'}, status=400)

    if len(new_password) < 6:
        return JsonResponse({'error': 'Password must be at least 6 characters.'}, status=400)

    if (target_user.role == User.Role.ADMIN or target_user.is_superuser) and not (request.user.role == User.Role.ADMIN or request.user.is_superuser):
        return JsonResponse({'error': 'Permission denied: Managers cannot modify Administrator passwords.'}, status=403)

    target_user.set_password(new_password)
    target_user.save()

    sync_csv_credentials(target_user, new_password, is_new=False)

    user_name = target_user.get_full_name() or target_user.username
    return JsonResponse({
        'success': True,
        'message': f"Password for '{user_name}' ({target_user.email}) updated successfully."
    })


@require_auth
def api_user_detail_update_delete(request, user_id):
    """
    View, update, or deactivate a user account.
    Users may update their own availability_override and leave_until. Admin/Manager can update anyone's.
    """
    target_user = get_object_or_404(User, id=user_id)
    is_self = (request.user.id == target_user.id)
    is_admin_or_mgr = check_role_permission(request)
    is_admin_user = bool(
        request.user.is_authenticated and (
            getattr(request.user, 'is_admin_role', False)
            or request.user.is_superuser
            or getattr(request.user, 'role', '') == User.Role.ADMIN
        )
    )
    target_is_admin = bool(
        getattr(target_user, 'is_admin_role', False)
        or target_user.is_superuser
        or getattr(target_user, 'role', '') == User.Role.ADMIN
        or target_user.username == 'admin'
    )

    if target_is_admin and not is_admin_user:
        return JsonResponse({'error': 'Permission denied: Administrator account is restricted to Administrators.'}, status=403)

    if request.method == 'GET':
        today = timezone.localdate()
        act_count = target_user.get_active_project_count()
        tot_count = target_user.get_total_projects_qs().exclude(status__in=['Completed', 'Cancelled']).count()
        role_label = 'admin' if (target_user.role == User.Role.ADMIN or target_user.is_superuser) else ('project_manager' if target_user.role == User.Role.MANAGER else 'developer')
        return JsonResponse({
            'id': target_user.id,
            'name': target_user.get_full_name() or target_user.username,
            'first_name': target_user.first_name,
            'last_name': target_user.last_name,
            'username': target_user.username,
            'email': target_user.email,
            'role': role_label,
            'raw_role': target_user.role,
            'department': target_user.department,
            'job_title': target_user.job_title,
            'avatar_initials': target_user.initials if hasattr(target_user, 'initials') else 'EM',
            'assigned_projects_count': tot_count,
            'active_count': act_count,
            'total_count': tot_count,
            'status': target_user.get_availability_status(today),
            'availability_override': target_user.availability_override,
            'leave_until': target_user.leave_until.strftime('%Y-%m-%d') if target_user.leave_until else None,
        })

    elif request.method in ['PUT', 'PATCH']:
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        # Self-updating availability override and leave_until is allowed for any employee
        if not is_self and not is_admin_or_mgr:
            return JsonResponse({'error': 'Permission denied: Only Admin and Manager can edit other users.'}, status=403)

        if 'availability_override' in data:
            ov = data['availability_override']
            if ov in ['ON_LEAVE', 'AWAY', None, '']:
                target_user.availability_override = ov if ov else None
            else:
                return JsonResponse({'error': 'Invalid availability override. Must be ON_LEAVE, AWAY, or null.'}, status=400)

        if 'leave_until' in data:
            lu = data['leave_until']
            if lu:
                try:
                    target_user.leave_until = datetime.strptime(str(lu)[:10], '%Y-%m-%d').date()
                except Exception:
                    return JsonResponse({'error': 'Invalid leave_until date format. Use YYYY-MM-DD.'}, status=400)
            else:
                target_user.leave_until = None

        # Administrative field updates require admin/manager role
        if any(f in data for f in ['first_name', 'last_name', 'email', 'department', 'job_title', 'role']):
            if not is_admin_or_mgr:
                return JsonResponse({'error': 'Permission denied: Only Admin and Manager can edit user profile attributes.'}, status=403)

            if 'first_name' in data:
                target_user.first_name = data['first_name'].strip()
            if 'last_name' in data:
                target_user.last_name = data['last_name'].strip()
            if 'email' in data:
                new_email = data['email'].strip().lower()
                if new_email and new_email != target_user.email:
                    if User.objects.filter(email__iexact=new_email).exclude(id=target_user.id).exists():
                        return JsonResponse({'error': f'Email "{new_email}" is already used by another account.'}, status=400)
                    target_user.email = new_email
            if 'department' in data:
                target_user.department = data['department'].strip()
            if 'job_title' in data:
                target_user.job_title = data['job_title'].strip()
            if 'role' in data:
                r = data['role'].strip().upper()
                if r in ['ADMIN', 'MANAGER', 'EMPLOYEE']:
                    if r == 'ADMIN' and not (request.user.role == User.Role.ADMIN or request.user.is_superuser):
                        return JsonResponse({'error': 'Permission denied: Only Administrators can promote to Admin.'}, status=403)
                    target_user.role = r

        target_user.save()
        user_name = target_user.get_full_name() or target_user.username
        return JsonResponse({
            'success': True,
            'message': f"User '{user_name}' updated successfully.",
            'user': {
                'id': target_user.id,
                'status': target_user.get_availability_status(),
                'active_count': target_user.get_active_project_count(),
                'availability_override': target_user.availability_override,
                'leave_until': target_user.leave_until.strftime('%Y-%m-%d') if target_user.leave_until else None,
            }
        })

    elif request.method == 'DELETE':
        if not is_admin_or_mgr:
            return JsonResponse({'error': 'Permission denied: Only Admin and Manager can delete users.'}, status=403)

        if target_user.is_superuser or target_user.role == User.Role.ADMIN:
            return JsonResponse({'error': 'Cannot delete System Administrator account.'}, status=403)

        if not (request.user.role == User.Role.ADMIN or request.user.is_superuser) and target_user.role == User.Role.MANAGER:
            return JsonResponse({'error': 'Managers cannot delete other Project Managers. Contact Administrator.'}, status=403)

        name = target_user.get_full_name() or target_user.username
        user_email = target_user.email
        user_username = target_user.username

        target_user.delete()
        remove_from_csv_credentials(user_email, user_username)

        return JsonResponse({'success': True, 'message': f"Employee '{name}' deleted successfully."})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ==============================================================================
# REST API: WORKLOAD & AVAILABILITY
# ==============================================================================

@require_auth
def api_employees_workload(request):
    """
    GET /api/employees/workload/
    query: active_only=true|false (default true), sort=projects_desc|projects_asc|name,
           department=<optional>, status=<optional>
    returns per employee: id, name, initials, job_title, department, active_count,
    total_count, status, availability_override, leave_until, and projects:[{id, name,
    status, priority}] (only the counted projects when active_only=true).
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    today = timezone.localdate()
    active_only_param = request.GET.get('active_only', 'true').lower() in ('true', '1', 'yes')
    sort_param = request.GET.get('sort', 'projects_desc').lower()
    department_filter = request.GET.get('department', '').strip()
    status_filter = request.GET.get('status', '').strip().upper()

    is_admin_user = bool(
        request.user.is_authenticated and (
            getattr(request.user, 'is_admin_role', False)
            or request.user.is_superuser
            or getattr(request.user, 'role', '') == User.Role.ADMIN
        )
    )

    users = User.objects.filter(is_active=True).prefetch_related(
        'project_memberships__project',
        'managed_projects'
    )
    if not is_admin_user:
        users = users.exclude(role=User.Role.ADMIN).exclude(is_superuser=True).exclude(username='admin')

    if department_filter:
        users = users.filter(department__iexact=department_filter)

    records = []
    for u in users:
        # Collect projects
        active_prjs = list(u.get_active_projects_qs())
        total_prjs = list(u.get_total_projects_qs().exclude(status__in=['Completed', 'Cancelled']))

        active_count = len(active_prjs)
        total_count = len(total_prjs)

        st = u.get_availability_status(today)

        if status_filter and st != status_filter:
            continue

        chosen_projects = active_prjs if active_only_param else total_prjs
        project_dicts = [
            {
                'id': p.id,
                'name': p.name,
                'status': p.status,
                'priority': p.priority,
            }
            for p in chosen_projects
        ]

        records.append({
            'id': u.id,
            'name': u.get_full_name() or u.username,
            'initials': u.initials if hasattr(u, 'initials') else 'EM',
            'job_title': u.job_title or ('Project Manager' if u.role == User.Role.MANAGER else 'Developer'),
            'department': u.department or 'Engineering',
            'active_count': active_count,
            'total_count': total_count,
            'status': st,
            'availability_override': u.availability_override,
            'leave_until': u.leave_until.strftime('%Y-%m-%d') if u.leave_until else None,
            'projects': project_dicts,
        })

    # Sort records
    if sort_param == 'projects_desc':
        key_metric = (lambda r: (r['active_count'] if active_only_param else r['total_count']))
        records.sort(key=lambda r: (-key_metric(r), r['name'].lower()))
    elif sort_param == 'projects_asc':
        key_metric = (lambda r: (r['active_count'] if active_only_param else r['total_count']))
        records.sort(key=lambda r: (key_metric(r), r['name'].lower()))
    elif sort_param == 'name':
        records.sort(key=lambda r: r['name'].lower())

    return JsonResponse(records, safe=False)


# ==============================================================================
# REST API: PROJECTS (LIST, CREATE, DETAIL, UPDATE, DELETE, STATUS, MEMBERS, UPLOAD)
# ==============================================================================

@require_auth
def api_projects_list_create(request):
    """GET /api/projects with search & filters; POST /api/projects to create."""
    today = timezone.localdate()

    if request.method == 'GET':
        qs = Project.objects.all().prefetch_related(
            'memberships__employee',
            'documents__uploaded_by',
            'diary_entries'
        ).select_related('project_manager', 'poc')

        search = request.GET.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(project_code__icontains=search) |
                Q(description__icontains=search)
            )

        status_param = request.GET.get('status', '').strip()
        if status_param and status_param != 'all':
            if status_param == 'ending_soon':
                qs = qs.exclude(status__in=['Completed', 'Cancelled', 'On Hold']).filter(end_date__gte=today, end_date__lte=today + timedelta(days=7))
            elif status_param == 'overdue':
                qs = qs.exclude(status__in=['Completed', 'Cancelled', 'On Hold']).filter(end_date__lt=today)
            else:
                qs = qs.filter(status__iexact=status_param)

        priority_param = request.GET.get('priority', '').strip()
        if priority_param and priority_param != 'all':
            qs = qs.filter(priority__iexact=priority_param)

        member_id = request.GET.get('member_id', '').strip()
        if member_id and member_id != 'all':
            try:
                qs = qs.filter(memberships__employee__id=int(member_id))
            except ValueError:
                pass

        sort_by = request.GET.get('sort_by', 'id')
        sort_order = request.GET.get('sort_order', 'asc')

        sort_map = {
            'id': 'id',
            'name': 'name',
            'code': 'project_code',
            'project_code': 'project_code',
            'status': 'status',
            'start_date': 'start_date',
            'end_date': 'end_date',
            'priority': 'priority',
            'progress': 'progress'
        }
        order_col = sort_map.get(sort_by, 'id')
        if str(sort_order).lower() == 'desc':
            order_col = f"-{order_col}"

        qs = qs.order_by(order_col)

        from django.db.models import Count
        active_counts_map = dict(
            ProjectMembership.objects.filter(
                project__status__in=ACTIVE_PROJECT_STATUSES
            ).values('employee_id').annotate(c=Count('id')).values_list('employee_id', 'c')
        )
        projects_data = [format_project_dict(p, today, active_counts_map) for p in qs]
        return JsonResponse(projects_data, safe=False)

    elif request.method == 'POST':
        if not check_role_permission(request):
            return JsonResponse({'error': 'Permission denied: Employees have view-only access. Only Admin and Manager can create projects.'}, status=403)

        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        name = data.get('name', '').strip()
        if not name:
            return JsonResponse({'error': 'Project name is required'}, status=400)

        now_str = today.strftime('%Y-%m-%d')
        last_p = Project.objects.order_by('-id').first()
        next_id = (last_p.id + 1) if last_p else 1
        code = (data.get('project_code') or '').strip() or f"PRJ-{next_id:03d}"

        status_val = data.get('status', 'Planning')
        start_d = data.get('start_date') or now_str
        end_d = data.get('end_date') or now_str
        description = data.get('description', '')
        priority = data.get('priority', 'Medium')
        progress = int(data.get('progress', 0))
        category = data.get('category', 'Software Solutions')

        if isinstance(start_d, str) and start_d.strip():
            try:
                start_date_obj = datetime.strptime(start_d[:10], '%Y-%m-%d').date()
            except Exception:
                start_date_obj = today
        else:
            start_date_obj = today

        if isinstance(end_d, str) and end_d.strip():
            try:
                end_date_obj = datetime.strptime(end_d[:10], '%Y-%m-%d').date()
            except Exception:
                end_date_obj = today
        else:
            end_date_obj = today

        pm_user = None
        created_by_id = data.get('created_by_id')
        if created_by_id:
            pm_user = User.objects.filter(id=created_by_id).first()
        pm_name_top = (data.get('project_manager') or '').strip()
        if not pm_user and pm_name_top:
            pm_user = User.objects.filter(Q(first_name__icontains=pm_name_top) | Q(username__icontains=pm_name_top)).first()
        if not pm_user and request.user.is_authenticated:
            pm_user = request.user

        proj = Project.objects.create(
            project_code=code,
            name=name,
            status=status_val,
            start_date=start_date_obj,
            end_date=end_date_obj,
            description=description,
            priority=priority,
            progress=progress,
            category=category,
            project_manager=pm_user
        )

        # Team members assignment
        team_members = data.get('team', [])
        has_pm = False
        member_ids = set()

        for m in team_members:
            uid = m.get('user_id')
            role = m.get('role', 'Developer')
            m_name = (m.get('name') or '').strip()

            emp = None
            if uid:
                emp = User.objects.filter(id=uid).first()
            if not emp and m_name:
                emp = User.objects.filter(Q(first_name__icontains=m_name) | Q(username__icontains=m_name)).first()
            if emp:
                ProjectMembership.objects.get_or_create(project=proj, employee=emp, defaults={'role_on_project': role})
                member_ids.add(emp.id)
                if 'manager' in role.lower():
                    has_pm = True

        if pm_name_top and not has_pm:
            mgr = User.objects.filter(Q(first_name__icontains=pm_name_top) | Q(username__icontains=pm_name_top)).first()
            if mgr:
                ProjectMembership.objects.get_or_create(project=proj, employee=mgr, defaults={'role_on_project': 'Project Manager'})
                member_ids.add(mgr.id)

        # Assign POC if specified (must be a member of the project)
        poc_id = data.get('poc_id') or (data.get('poc') or {}).get('id')
        if poc_id:
            poc_user = User.objects.filter(id=poc_id).first()
            if poc_user:
                if poc_user.id in member_ids or (proj.project_manager_id == poc_user.id):
                    proj.poc = poc_user
                    proj.save()
                else:
                    return JsonResponse({'error': f"POC '{poc_user.get_full_name() or poc_user.username}' must be an assigned member of this project."}, status=400)

        ActivityLog.objects.create(
            project=proj,
            user_name=request.user.get_full_name() or request.user.username,
            action='Created Project',
            details=f"Created {name} ({code})"
        )
        logger.info(f"Project '{proj.name}' (#{proj.id}, code: {code}) created by '{request.user.username}'")

        return JsonResponse({'success': True, 'project': format_project_dict(proj, today)}, status=201)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@require_auth
def api_project_detail_update_delete(request, project_id):
    """GET /api/projects/<id>; PUT/PATCH /api/projects/<id>; DELETE /api/projects/<id>."""
    proj = get_object_or_404(Project, id=project_id)
    today = timezone.localdate()

    if request.method == 'GET':
        data = format_project_dict(proj, today)
        activities = []
        for a in proj.activity_logs.all()[:20]:
            activities.append({
                'id': a.id,
                'user_name': a.user_name,
                'action': a.action,
                'details': a.details,
                'timestamp': a.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            })
        data['activity'] = activities
        return JsonResponse(data)

    elif request.method in ['PUT', 'PATCH']:
        if not check_role_permission(request):
            return JsonResponse({'error': 'Permission denied: Employees have view-only access. Only Admin and Manager can edit projects.'}, status=403)

        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        old_status = proj.status
        proj.name = data.get('name', proj.name)
        proj.status = data.get('status', proj.status)
        if 'start_date' in data:
            s_val = data.get('start_date')
            if isinstance(s_val, str) and s_val.strip():
                try:
                    proj.start_date = datetime.strptime(s_val[:10], '%Y-%m-%d').date()
                except Exception:
                    pass
        if 'end_date' in data:
            e_val = data.get('end_date')
            if isinstance(e_val, str) and e_val.strip():
                try:
                    proj.end_date = datetime.strptime(e_val[:10], '%Y-%m-%d').date()
                except Exception:
                    pass
        proj.description = data.get('description', proj.description)
        proj.priority = data.get('priority', proj.priority)
        proj.progress = int(data.get('progress', proj.progress))
        proj.category = data.get('category', proj.category)

        # Sync team members if provided
        if 'team' in data:
            proj.memberships.all().delete()
            for m in data.get('team', []):
                uid = m.get('user_id')
                role = m.get('role', 'Developer')
                m_name = (m.get('name') or '').strip()
                emp = None
                if uid:
                    emp = User.objects.filter(id=uid).first()
                if not emp and m_name:
                    emp = User.objects.filter(Q(first_name__icontains=m_name) | Q(username__icontains=m_name)).first()
                if emp:
                    ProjectMembership.objects.create(project=proj, employee=emp, role_on_project=role)

        # Update POC if provided
        if 'poc_id' in data or 'poc' in data:
            poc_val = data.get('poc_id') if 'poc_id' in data else (data['poc'].get('id') if isinstance(data.get('poc'), dict) else data.get('poc'))
            if poc_val:
                poc_user = User.objects.filter(id=poc_val).first()
                if poc_user:
                    is_member = proj.memberships.filter(employee=poc_user).exists()
                    is_pm = (proj.project_manager_id == poc_user.id)
                    if not (is_member or is_pm):
                        return JsonResponse({'error': f"POC '{poc_user.get_full_name() or poc_user.username}' must be an assigned member of this project."}, status=400)
                    proj.poc = poc_user
            else:
                proj.poc = None

        proj.save()
        proj.refresh_from_db()
        logger.info(f"Project '{proj.name}' (#{proj.id}) updated by '{request.user.username}'")

        if proj.status != old_status:
            ActivityLog.objects.create(
                project=proj,
                user_name=request.user.get_full_name() or request.user.username,
                action='Status Changed',
                details=f"Status updated to '{proj.status}'"
            )

        return JsonResponse({'success': True, 'project': format_project_dict(proj, today)})

    elif request.method == 'DELETE':
        if not check_role_permission(request):
            return JsonResponse({'error': 'Permission denied: Employees have view-only access. Only Admin and Manager can delete projects.'}, status=403)

        name = proj.name
        code = proj.project_code
        pid = proj.id
        proj.delete()
        logger.warning(f"Project '{name}' (#{pid}, code: {code}) permanently deleted by '{request.user.username}'")
        return JsonResponse({'success': True, 'message': f"Project {name} ({code}) deleted successfully"})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@require_auth
def api_project_status(request, project_id):
    """Updates project status and optionally progress."""
    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Employees have view-only access.'}, status=403)

    proj = get_object_or_404(Project, id=project_id)
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    new_status = data.get('status')
    if not new_status:
        return JsonResponse({'error': 'Status is required'}, status=400)

    old_status = proj.status
    proj.status = new_status
    progress = 100 if new_status == 'Completed' else data.get('progress', proj.progress)
    proj.progress = progress
    proj.save()

    ActivityLog.objects.create(
        project=proj,
        user_name=request.user.get_full_name() or request.user.username,
        action='Status Changed',
        details=f"Status changed from {old_status} to {new_status}"
    )

    return JsonResponse({'success': True, 'status': new_status, 'progress': progress})


@require_auth
def api_project_update_progress(request, project_id):
    """
    POST/PATCH /api/projects/<project_id>/progress/
    Allows ONLY the assigned Point of Contact (POC) or Admin/Manager to update
    frontend, backend, and database module completion.
    Overall delivery is automatically calculated, and an official progress report is generated.
    """
    if request.method not in ('POST', 'PATCH', 'PUT'):
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    proj = get_object_or_404(Project, id=project_id)
    user = request.user
    is_admin_or_mgr = user.is_superuser or (getattr(user, 'role', '') in (User.Role.ADMIN, User.Role.MANAGER))
    is_poc = (proj.poc_id == user.id)

    if not (is_admin_or_mgr or is_poc):
        poc_name = (proj.poc.get_full_name() or proj.poc.username) if proj.poc else 'Unassigned'
        return JsonResponse({
            'error': f"Permission denied: In the dashboard only the assigned Point of Contact ({poc_name}) can update module progress."
        }, status=403)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    try:
        fe_prog = max(0, min(100, int(data.get('frontend_progress', proj.frontend_progress or 0))))
        be_prog = max(0, min(100, int(data.get('backend_progress', proj.backend_progress or 0))))
        db_prog = max(0, min(100, int(data.get('database_progress', proj.database_progress or 0))))
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Progress values must be integers between 0 and 100.'}, status=400)

    # Overall delivery is automatically calculated from frontend, backend, and database
    overall_delivery = round((fe_prog + be_prog + db_prog) / 3)

    proj.frontend_progress = fe_prog
    proj.backend_progress = be_prog
    proj.database_progress = db_prog
    proj.progress = overall_delivery

    # Auto-update status if 100% completed or reopened
    if overall_delivery == 100:
        proj.status = 'Completed'
    elif proj.status == 'Completed' and overall_delivery < 100:
        proj.status = 'In Progress'

    now = timezone.now()
    poc_name = user.get_full_name() or user.username
    notes = (data.get('notes') or '').strip()

    report_lines = [
        f"📊 PROGRESS REPORT — {proj.name} ({proj.project_code or f'PRJ-{proj.id}'})",
        f"Generated by POC: {poc_name}",
        f"Timestamp: {now.strftime('%d %b %Y, %I:%M %p')}",
        "--------------------------------------------------",
        f"• Frontend Module:  {fe_prog}% completed",
        f"• Backend Module:   {be_prog}% completed",
        f"• Database Module:  {db_prog}% completed",
        f"• Overall Delivery: {overall_delivery}% ({proj.status})",
    ]
    if notes:
        report_lines.append(f"• POC Notes: {notes}")

    report_summary = "\n".join(report_lines)
    proj.latest_progress_report = report_summary
    proj.progress_reported_at = now
    proj.save()

    ActivityLog.objects.create(
        project=proj,
        user_name=poc_name,
        action='Progress Report Generated',
        details=f"POC updated module completion: Frontend {fe_prog}%, Backend {be_prog}%, Database {db_prog}%. Overall: {overall_delivery}%."
    )

    today = timezone.localdate()
    return JsonResponse({
        'success': True,
        'message': f"Progress updated successfully! Overall Delivery: {overall_delivery}%.",
        'project': format_project_dict(proj, today),
        'report': report_summary,
        'overall_delivery': overall_delivery,
    })


@require_auth
def api_project_members(request, project_id):
    """POST: Adds a member to project."""
    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Employees have view-only access.'}, status=403)

    proj = get_object_or_404(Project, id=project_id)
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    user_id = data.get('user_id')
    role = (data.get('role') or 'Developer').strip()
    if not user_id:
        return JsonResponse({'error': 'User ID is required'}, status=400)

    emp = get_object_or_404(User, id=user_id)
    pm, created = ProjectMembership.objects.get_or_create(
        project=proj,
        employee=emp,
        defaults={'role_on_project': role}
    )
    if not created:
        pm.role_on_project = role
        pm.save()

    ActivityLog.objects.create(
        project=proj,
        user_name=request.user.get_full_name() or request.user.username,
        action='Added Team Member',
        details=f"Assigned {emp.get_full_name() or emp.username} as {role}"
    )

    return JsonResponse({'success': True, 'message': f"Assigned {emp.get_full_name() or emp.username} as {role}"})


@require_auth
def api_project_member_delete(request, project_id, user_id):
    """DELETE: Removes a member from project."""
    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Employees have view-only access.'}, status=403)

    proj = get_object_or_404(Project, id=project_id)
    
    # If the user being removed is the POC, reset POC to None
    if proj.poc_id == int(user_id):
        proj.poc = None
        proj.save()

    ProjectMembership.objects.filter(project=proj, employee__id=user_id).delete()
    return JsonResponse({'success': True, 'message': 'Member removed from project'})


@require_auth
def api_project_upload(request, project_id):
    """Handles file uploads for roadmaps and documentation."""
    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Employees have view-only access.'}, status=403)

    if 'file' not in request.FILES:
        return JsonResponse({'error': 'No file part in request'}, status=400)

    file_obj = request.FILES['file']
    if not file_obj.name:
        return JsonResponse({'error': 'No file selected'}, status=400)

    proj = get_object_or_404(Project, id=project_id)

    raw_file_type = request.POST.get('file_type', 'documentation').lower()
    doc_type = Document.DocType.ROADMAP if raw_file_type == 'roadmap' else Document.DocType.DOCUMENTATION

    doc = Document(
        project=proj,
        original_name=file_obj.name,
        doc_type=doc_type,
        size_bytes=file_obj.size,
        file=file_obj,
        uploaded_by=request.user
    )
    doc.save()

    ActivityLog.objects.create(
        project=proj,
        user_name=request.user.get_full_name() or request.user.username,
        action='Uploaded File',
        details=f"Uploaded {file_obj.name} ({raw_file_type})"
    )

    return JsonResponse({
        'success': True,
        'message': f"Uploaded {file_obj.name} successfully!",
        'file': {
            'id': doc.id,
            'file_type': raw_file_type,
            'original_filename': file_obj.name,
            'file_size': file_obj.size,
            'uploaded_at': doc.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')
        }
    }, status=201)


@require_auth
def api_project_documents_list(request, project_id):
    """Returns documents for a specific project."""
    proj = get_object_or_404(Project, id=project_id)
    docs = proj.documents.select_related('uploaded_by').order_by('-uploaded_at')
    result = []
    for d in docs:
        result.append({
            'id': d.id,
            'project': proj.id,
            'original_name': d.original_name,
            'doc_type': d.doc_type,
            'size_bytes': d.size_bytes,
            'file': f"/api/documents/{d.id}/download/",
            'uploaded_at': d.uploaded_at.isoformat()
        })
    return JsonResponse(result, safe=False)


# ==============================================================================
# REST API: FILES & DOCUMENTS (GLOBAL LIST, DOWNLOAD, DELETE)
# ==============================================================================

@require_auth
def api_files_list(request):
    """Returns all project files / documents across the system."""
    docs = Document.objects.select_related('project', 'uploaded_by').order_by('-uploaded_at')
    result = []
    for d in docs:
        f_type = 'roadmap' if d.doc_type == Document.DocType.ROADMAP else 'documentation'
        result.append({
            'id': d.id,
            'project_id': d.project.id,
            'project_name': d.project.name,
            'project_code': d.project.project_code,
            'file_type': f_type,
            'original_filename': d.original_name,
            'stored_filename': os.path.basename(d.file.name) if d.file else d.original_name,
            'file_size': d.size_bytes,
            'uploader_name': (d.uploaded_by.get_full_name() or d.uploaded_by.username) if d.uploaded_by else 'Staff',
            'uploaded_at': d.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    return JsonResponse(result, safe=False)


@require_auth
def api_file_download(request, file_id):
    """Downloads a document attachment. Requires authenticated session."""
    doc = get_object_or_404(Document, id=file_id)
    if not doc.file:
        raise Http404("Document file missing.")

    try:
        handle = doc.file.open('rb')
        return FileResponse(handle, as_attachment=True, filename=doc.original_name)
    except Exception:
        raise Http404("Physical file missing from storage.")


@require_auth
def api_file_delete(request, file_id):
    """Deletes a document attachment."""
    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Employees have view-only access.'}, status=403)

    doc = get_object_or_404(Document, id=file_id)
    if doc.file:
        try:
            doc.file.delete(save=False)
        except Exception:
            pass
    doc.delete()
    return JsonResponse({'success': True, 'message': 'File removed successfully'})


# ==============================================================================
# REST API: WORK DIARY & POC ENDPOINTS
# ==============================================================================

def format_diary_dict(entry):
    """Formats a DiaryEntry to JSON structure."""
    return {
        'id': entry.id,
        'project_id': entry.project_id,
        'project_name': entry.project.name,
        'project_code': entry.project.project_code,
        'author': {
            'id': entry.author.id,
            'name': entry.author.get_full_name() or entry.author.username,
            'initials': entry.author.initials if hasattr(entry.author, 'initials') else 'EM',
            'job_title': entry.author.job_title or '',
            'department': entry.author.department or '',
        },
        'entry_date': entry.entry_date.strftime('%Y-%m-%d'),
        'done': entry.done,
        'in_progress': entry.in_progress,
        'next_up': entry.next_up,
        'blockers': entry.blockers,
        'reviewed_by': {
            'id': entry.reviewed_by.id,
            'name': entry.reviewed_by.get_full_name() or entry.reviewed_by.username,
        } if entry.reviewed_by else None,
        'reviewed_at': entry.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if entry.reviewed_at else None,
        'created_at': entry.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'updated_at': entry.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
    }


@require_auth
def api_project_diary(request, project_id):
    """
    GET  /api/projects/<id>/diary/?from=&to=&author=
         members, POC, project manager, ADMIN/MANAGER can read; newest first
    POST /api/projects/<id>/diary/
         create-or-update TODAY'S entry for the logged-in user.
         Author comes from the session, never request body.
         User must be a member of the project.
    """
    proj = get_object_or_404(Project, id=project_id)
    today = timezone.localdate()
    user = request.user

    is_member = proj.memberships.filter(employee=user).exists()
    is_poc = (proj.poc_id == user.id)
    is_pm = (proj.project_manager_id == user.id)
    is_mgr_or_admin = check_role_permission(request)

    if request.method == 'GET':
        if not (is_member or is_poc or is_pm or is_mgr_or_admin):
            return JsonResponse({'error': 'Permission denied: You must be an assigned member, POC, or manager of this project to view its work diary.'}, status=403)

        entries = proj.diary_entries.select_related('author', 'reviewed_by').order_by('-entry_date', '-created_at')

        from_date = request.GET.get('from', '').strip()
        to_date = request.GET.get('to', '').strip()
        author_param = request.GET.get('author', '').strip()

        if from_date:
            try:
                f_d = datetime.strptime(from_date[:10], '%Y-%m-%d').date()
                entries = entries.filter(entry_date__gte=f_d)
            except Exception:
                pass

        if to_date:
            try:
                t_d = datetime.strptime(to_date[:10], '%Y-%m-%d').date()
                entries = entries.filter(entry_date__lte=t_d)
            except Exception:
                pass

        if author_param:
            try:
                entries = entries.filter(author_id=int(author_param))
            except ValueError:
                pass

        return JsonResponse([format_diary_dict(e) for e in entries], safe=False)

    elif request.method == 'POST':
        # Only Point of Contact (or Admin) can update the works diary; other employees in that group can only view
        is_poc = (proj.poc_id == user.id)
        is_admin = (user.role == User.Role.ADMIN or user.is_superuser)
        if not (is_poc or is_admin):
            return JsonResponse({'error': 'Permission denied: Only the Point of Contact (POC) can update the works diary for this project. Other employees can only view.'}, status=403)

        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        done = (data.get('done') or '').strip()
        in_progress = (data.get('in_progress') or '').strip()
        next_up = (data.get('next_up') or '').strip()
        blockers = (data.get('blockers') or '').strip()

        if not done or not in_progress or not next_up:
            return JsonResponse({'error': 'Done, In Progress, and Next Up fields are required.'}, status=400)

        if len(done) > 2000 or len(in_progress) > 2000 or len(next_up) > 2000 or len(blockers) > 2000:
            return JsonResponse({'error': 'Text fields cannot exceed 2000 characters.'}, status=400)

        entry, created = DiaryEntry.objects.update_or_create(
            project=proj,
            author=user,
            entry_date=today,
            defaults={
                'done': done,
                'in_progress': in_progress,
                'next_up': next_up,
                'blockers': blockers,
            }
        )

        ActivityLog.objects.create(
            project=proj,
            user_name=user.get_full_name() or user.username,
            action='Diary Saved',
            details=f"Saved work diary entry for {today}"
        )

        return JsonResponse({
            'success': True,
            'message': f"Diary entry for {today} {'created' if created else 'updated'} successfully.",
            'entry': format_diary_dict(entry)
        }, status=201 if created else 200)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@require_auth
def api_diary_detail(request, entry_id):
    """
    PATCH /api/diary/<id>/
    author only, and only on the entry's own date; ADMIN can edit any.
    """
    if request.method != 'PATCH':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    entry = get_object_or_404(DiaryEntry, id=entry_id)
    user = request.user
    today = timezone.localdate()

    is_admin = (user.role == User.Role.ADMIN or user.is_superuser)
    is_poc = (entry.project.poc_id == user.id)

    # Only Point of Contact (or Admin) can update the works diary
    if not (is_admin or is_poc):
        return JsonResponse({'error': "Permission denied: Only the Point of Contact (POC) can update the works diary."}, status=403)

    if not is_admin and entry.entry_date != today:
        return JsonResponse({'error': 'Permission denied: Diary updates can only be edited on the entry date.'}, status=403)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    if 'done' in data:
        val = data['done'].strip()
        if not val:
            return JsonResponse({'error': 'Done field cannot be empty.'}, status=400)
        if len(val) > 2000:
            return JsonResponse({'error': 'Done field cannot exceed 2000 characters.'}, status=400)
        entry.done = val

    if 'in_progress' in data:
        val = data['in_progress'].strip()
        if not val:
            return JsonResponse({'error': 'In Progress field cannot be empty.'}, status=400)
        if len(val) > 2000:
            return JsonResponse({'error': 'In Progress field cannot exceed 2000 characters.'}, status=400)
        entry.in_progress = val

    if 'next_up' in data:
        val = data['next_up'].strip()
        if not val:
            return JsonResponse({'error': 'Next Up field cannot be empty.'}, status=400)
        if len(val) > 2000:
            return JsonResponse({'error': 'Next Up field cannot exceed 2000 characters.'}, status=400)
        entry.next_up = val

    if 'blockers' in data:
        val = (data['blockers'] or '').strip()
        if len(val) > 2000:
            return JsonResponse({'error': 'Blockers field cannot exceed 2000 characters.'}, status=400)
        entry.blockers = val

    entry.save()

    ActivityLog.objects.create(
        project=entry.project,
        user_name=user.get_full_name() or user.username,
        action='Diary Updated',
        details=f"Updated diary entry of {entry.author.username} for {entry.entry_date}"
    )

    return JsonResponse({
        'success': True,
        'message': 'Diary entry updated successfully.',
        'entry': format_diary_dict(entry)
    })


@require_auth
def api_diary_review(request, entry_id):
    """
    POST /api/diary/<id>/review/
    POC, project manager, ADMIN/MANAGER sets reviewed_by and reviewed_at.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    entry = get_object_or_404(DiaryEntry, id=entry_id)
    proj = entry.project
    user = request.user

    is_poc = (proj.poc_id == user.id)
    is_pm = (proj.project_manager_id == user.id)
    is_admin_or_mgr = check_role_permission(request)

    if not (is_poc or is_pm or is_admin_or_mgr):
        return JsonResponse({'error': 'Permission denied: Only POC, Project Manager, or Admin/Manager can review diary entries.'}, status=403)

    entry.reviewed_by = user
    entry.reviewed_at = timezone.now()
    entry.save()

    ActivityLog.objects.create(
        project=proj,
        user_name=user.get_full_name() or user.username,
        action='Diary Reviewed',
        details=f"Reviewed diary entry of {entry.author.username} for {entry.entry_date}"
    )

    return JsonResponse({
        'success': True,
        'message': f"Diary entry reviewed by {user.get_full_name() or user.username}.",
        'entry': format_diary_dict(entry)
    })


@require_auth
def api_diary_my(request):
    """
    GET /api/diary/my/
    every active project I am a member of, with today's entry if it exists,
    otherwise a prefill: in_progress = yesterday's next_up
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    today = timezone.localdate()
    user = request.user

    # Find active projects user is member of (or PM/POC)
    active_projects = Project.objects.filter(
        Q(memberships__employee=user) | Q(project_manager=user) | Q(poc=user),
        status__in=ACTIVE_PROJECT_STATUSES
    ).distinct().order_by('name')

    result = []
    for p in active_projects:
        # Check today's entry
        today_entry = p.diary_entries.filter(author=user, entry_date=today).first()

        # Prior entry for prefill
        prior_entry = p.diary_entries.filter(author=user, entry_date__lt=today).order_by('-entry_date').first()
        prefill_in_progress = prior_entry.next_up if prior_entry else ''

        result.append({
            'project': {
                'id': p.id,
                'name': p.name,
                'project_code': p.project_code or f"PRJ-{p.id:03d}",
                'status': p.status,
                'priority': p.priority,
                'poc': {
                    'id': p.poc.id,
                    'name': p.poc.get_full_name() or p.poc.username,
                } if p.poc else None
            },
            'can_update': (p.poc_id == user.id) or (user.role == User.Role.ADMIN or user.is_superuser),
            'today_entry': format_diary_dict(today_entry) if today_entry else None,
            'prefill': {
                'done': '',
                'in_progress': prefill_in_progress,
                'next_up': '',
                'blockers': ''
            }
        })

    return JsonResponse(result, safe=False)


@require_auth
def api_diary_due(request):
    """
    GET /api/diary/due/
    for POC/manager/admin: per project, members who have no entry today.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    user = request.user
    today = timezone.localdate()

    is_admin_or_mgr = check_role_permission(request)
    managed_or_poc_projects = Project.objects.filter(Q(poc=user) | Q(project_manager=user))

    if not is_admin_or_mgr and not managed_or_poc_projects.exists():
        return JsonResponse({'error': 'Permission denied: Only POC, Project Manager, or Admin/Manager can view due updates.'}, status=403)

    if is_admin_or_mgr:
        projects_qs = Project.objects.filter(status__in=ACTIVE_PROJECT_STATUSES).distinct()
    else:
        projects_qs = managed_or_poc_projects.filter(status__in=ACTIVE_PROJECT_STATUSES).distinct()

    result = []
    total_missing_count = 0

    for p in projects_qs.prefetch_related('memberships__employee', 'diary_entries'):
        # Find entries submitted today
        submitted_author_ids = set(p.diary_entries.filter(entry_date=today).values_list('author_id', flat=True))

        missing_members = []
        for m in p.memberships.select_related('employee').all():
            emp = m.employee
            if emp.id not in submitted_author_ids:
                missing_members.append({
                    'id': emp.id,
                    'name': emp.get_full_name() or emp.username,
                    'initials': emp.initials if hasattr(emp, 'initials') else 'EM',
                    'email': emp.email,
                    'role_on_project': m.role_on_project,
                    'status': emp.get_availability_status(today),
                })

        if missing_members:
            total_missing_count += len(missing_members)
            result.append({
                'project_id': p.id,
                'project_name': p.name,
                'project_code': p.project_code,
                'poc': {
                    'id': p.poc.id,
                    'name': p.poc.get_full_name() or p.poc.username,
                } if p.poc else None,
                'missing_count': len(missing_members),
                'missing_members': missing_members,
            })

    return JsonResponse({
        'total_missing': total_missing_count,
        'projects': result
    })


# ==============================================================================
# REST API: CSV EXPORT & EXCEL IMPORT
# ==============================================================================

@require_auth
def api_export_csv(request):
    """Generates and downloads a CSV spreadsheet of all projects."""
    projects = Project.objects.all().prefetch_related('memberships__employee', 'documents').order_by('id')

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Project Code", "Project Name", "Status", "Start Date", "End Date",
        "Progress %", "Priority", "Category", "POC", "Team Members", "Files Count"
    ])

    for p in projects:
        team_str = "; ".join([
            f"{m.employee.get_full_name() or m.employee.username} ({m.role_on_project})"
            for m in p.memberships.all()
        ])
        poc_name = (p.poc.get_full_name() or p.poc.username) if p.poc else 'Unassigned'
        writer.writerow([
            p.project_code,
            p.name,
            p.status,
            p.start_date.strftime('%Y-%m-%d') if p.start_date else '',
            p.end_date.strftime('%Y-%m-%d') if p.end_date else '',
            p.progress,
            p.priority,
            p.category,
            poc_name,
            team_str,
            p.documents.count()
        ])

    output.seek(0)
    filename = f"AI_Samrat_Projects_Export_{timezone.localdate().strftime('%Y%m%d')}.csv"
    response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@require_auth
def api_import_excel(request):
    """Re-runs Excel data import into Django database."""
    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Only Admin and Manager can run import.'}, status=403)

    try:
        from django.core.management import call_command
        logger.info(f"Excel import initiated by '{request.user.username}'")
        call_command('import_projects_data')
        logger.info(f"Excel import completed successfully by '{request.user.username}'")
        return JsonResponse({'success': True, 'message': 'Successfully imported all projects and squads from Excel data!'})
    except Exception as e:
        logger.error(f"Excel import failed for user '{request.user.username}': {e}", exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_auth
def api_team_upload_preview(request):
    """
    POST /api/team/upload-preview/
    Parses uploaded Excel (.xlsx, .xls) or CSV (.csv) file with team members.
    Returns preview data with normalized columns and database validation status.
    """
    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Only Admin and Manager can upload team data.'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed. Use POST.'}, status=405)

    file_obj = request.FILES.get('file')
    if not file_obj:
        return JsonResponse({'error': 'No file uploaded. Please select an Excel or CSV file.'}, status=400)

    filename = file_obj.name.lower()
    df = None
    file_type = ''

    try:
        import pandas as pd
        if filename.endswith('.csv'):
            file_type = 'CSV'
            df = pd.read_csv(file_obj, encoding='utf-8-sig', dtype=str, keep_default_na=False)
        elif filename.endswith(('.xlsx', '.xls')):
            file_type = 'Excel'
            xl = pd.ExcelFile(file_obj)
            sheet_to_use = xl.sheet_names[0]
            for s in xl.sheet_names:
                if any(k in s.lower() for k in ['team', 'employee', 'staff', 'intern', 'user']):
                    sheet_to_use = s
                    break
            df = pd.read_excel(xl, sheet_name=sheet_to_use, dtype=str, keep_default_na=False)
        else:
            return JsonResponse({'error': 'Unsupported file format. Please upload a .xlsx, .xls, or .csv file.'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Failed to parse file: {str(e)}'}, status=400)

    # Normalize columns
    col_mapping = {}
    for col in df.columns:
        clean = re.sub(r'[^a-z0-9]', '', str(col).lower())
        col_mapping[col] = clean

    def find_col(aliases):
        for orig, clean in col_mapping.items():
            if clean in aliases:
                return orig
        for orig, clean in col_mapping.items():
            for alias in aliases:
                if alias in clean:
                    return orig
        return None

    name_col = find_col(['name', 'fullname', 'employeename', 'internname', 'staffname', 'membername', 'personname'])
    fname_col = find_col(['firstname', 'fname', 'first'])
    lname_col = find_col(['lastname', 'lname', 'last', 'surname'])
    email_col = find_col(['email', 'emailaddress', 'useremail', 'mail', 'emailid'])
    role_col = find_col(['role', 'portal', 'userrole', 'roletype', 'access', 'usertype', 'permission'])
    dept_col = find_col(['department', 'dept', 'team', 'division', 'group'])
    title_col = find_col(['jobtitle', 'title', 'designation', 'position', 'roleonproject', 'projectrole', 'job'])
    user_col = find_col(['username', 'user', 'userid', 'login', 'handle', 'empusername'])
    pass_col = find_col(['initialpassword', 'password', 'pass', 'pwd', 'temppassword'])

    rows = []
    for idx, row in df.iterrows():
        raw_name = str(row[name_col]).strip() if name_col and name_col in row else ''
        first_name = str(row[fname_col]).strip() if fname_col and fname_col in row else ''
        last_name = str(row[lname_col]).strip() if lname_col and lname_col in row else ''

        if not first_name and raw_name:
            parts = raw_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''
        elif not raw_name and (first_name or last_name):
            raw_name = f"{first_name} {last_name}".strip()

        email = (str(row[email_col]).strip().lower() if email_col and email_col in row else '')
        raw_role = (str(row[role_col]).strip() if role_col and role_col in row else '')
        dept = (str(row[dept_col]).strip() if dept_col and dept_col in row else '') or 'Engineering'
        job_title = (str(row[title_col]).strip() if title_col and title_col in row else '')
        username = (str(row[user_col]).strip() if user_col and user_col in row else '')
        password = (str(row[pass_col]).strip() if pass_col and pass_col in row else '')

        # Skip completely blank lines
        if not raw_name and not email and not username:
            continue

        # Normalize role
        role_upper = raw_role.upper()
        if 'ADMIN' in role_upper:
            role = 'ADMIN'
            role_label = 'Admin'
            default_title = 'System Administrator'
        elif any(k in role_upper for k in ['MANAGER', 'LEAD', 'PM', 'MANAGEMENT']):
            role = 'MANAGER'
            role_label = 'Project Manager'
            default_title = 'Project Manager'
        else:
            role = 'EMPLOYEE'
            role_label = 'Employee'
            default_title = 'Software Engineer'

        job_title = job_title or default_title

        # Check existing user
        existing_user = None
        if email:
            existing_user = User.objects.filter(email__iexact=email).first()
        if not existing_user and username:
            existing_user = User.objects.filter(username__iexact=username).first()

        is_existing = bool(existing_user)
        status = 'new'
        status_message = 'New member (ready to add)'

        if is_existing:
            status = 'existing'
            status_message = f'Account exists ({existing_user.username}) - will update details'
        elif not email and not username:
            status = 'warning'
            status_message = 'Email missing (will auto-generate from username)'

        # If username is empty, suggest one
        suggested_username = username
        if not suggested_username:
            if email and '@' in email:
                suggested_username = email.split('@')[0]
            else:
                suggested_username = re.sub(r'[^a-zA-Z0-9_]', '', raw_name.lower().replace(' ', '_'))
            if role == 'EMPLOYEE' and not suggested_username.startswith('emp_'):
                suggested_username = f"emp_{suggested_username}"

        rows.append({
            'row_index': len(rows) + 1,
            'name': raw_name or f"{first_name} {last_name}".strip() or suggested_username,
            'first_name': first_name or raw_name,
            'last_name': last_name,
            'email': email,
            'role': role,
            'role_label': role_label,
            'department': dept,
            'job_title': job_title,
            'username': suggested_username,
            'initial_password': password or 'AiSamrat@2026!',
            'is_existing': is_existing,
            'existing_id': existing_user.id if existing_user else None,
            'status': status,
            'status_message': status_message,
        })

    valid_count = sum(1 for r in rows if r['status'] in ('new', 'warning'))
    existing_count = sum(1 for r in rows if r['status'] == 'existing')

    return JsonResponse({
        'success': True,
        'filename': file_obj.name,
        'file_type': file_type,
        'total_rows': len(rows),
        'valid_count': valid_count,
        'existing_count': existing_count,
        'rows': rows,
    })


@require_auth
def api_team_upload_confirm(request):
    """
    POST /api/team/upload-confirm/
    Commits confirmed rows to the User model.
    """
    if not check_role_permission(request):
        return JsonResponse({'error': 'Permission denied: Only Admin and Manager can commit team imports.'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed. Use POST.'}, status=405)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body.'}, status=400)

    rows = body.get('rows', [])
    update_existing = body.get('update_existing', True)

    if not rows:
        return JsonResponse({'error': 'No team member rows provided for upload.'}, status=400)

    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []

    for r in rows:
        try:
            name = (r.get('name') or '').strip()
            first_name = (r.get('first_name') or '').strip()
            last_name = (r.get('last_name') or '').strip()
            if not first_name and name:
                parts = name.split(' ', 1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ''

            email = (r.get('email') or '').strip().lower()
            role_str = (r.get('role') or 'EMPLOYEE').strip().upper()
            role = User.Role.ADMIN if 'ADMIN' in role_str else (User.Role.MANAGER if 'MANAGER' in role_str else User.Role.EMPLOYEE)
            dept = (r.get('department') or 'Engineering').strip()
            job_title = (r.get('job_title') or '').strip() or ('Project Manager' if role == User.Role.MANAGER else ('System Administrator' if role == User.Role.ADMIN else 'Software Engineer'))
            pwd = (r.get('initial_password') or r.get('password') or '').strip() or 'AiSamrat@2026!'
            username = (r.get('username') or '').strip().lower()

            existing_user = None
            if email:
                existing_user = User.objects.filter(email__iexact=email).first()
            if not existing_user and username:
                existing_user = User.objects.filter(username__iexact=username).first()

            if existing_user:
                if update_existing:
                    if first_name:
                        existing_user.first_name = first_name
                    if last_name:
                        existing_user.last_name = last_name
                    existing_user.role = role
                    if dept:
                        existing_user.department = dept
                    if job_title:
                        existing_user.job_title = job_title
                    if pwd and len(pwd) >= 6:
                        existing_user.set_password(pwd)
                    existing_user.is_active = True
                    existing_user.save()
                    updated_count += 1
                else:
                    skipped_count += 1
            else:
                if not username:
                    if email and '@' in email:
                        base_un = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0])
                    else:
                        base_un = re.sub(r'[^a-zA-Z0-9_]', '', f"{first_name}_{last_name}".lower())
                    if role == User.Role.EMPLOYEE and not base_un.startswith('emp_'):
                        base_un = f"emp_{base_un}"
                    username = base_un

                base_un = username
                cnt = 1
                while User.objects.filter(username__iexact=username).exists():
                    username = f"{base_un}_{cnt}"
                    cnt += 1

                User.objects.create_user(
                    username=username,
                    email=email or f"{username}@aisamrat.internal",
                    password=pwd,
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    department=dept,
                    job_title=job_title
                )
                created_count += 1
        except Exception as e:
            errors.append(f"Row {r.get('name', 'Unknown')}: {str(e)}")

    first_proj = Project.objects.first()
    if first_proj:
        ActivityLog.objects.create(
            project=first_proj,
            user_name=request.user.get_full_name() or request.user.username,
            action='Imported Team Roster',
            details=f"Uploaded {created_count + updated_count} team members ({created_count} new, {updated_count} updated) via Excel/CSV."
        )

    return JsonResponse({
        'success': True,
        'message': f'Successfully uploaded {created_count + updated_count} team members ({created_count} added, {updated_count} updated).',
        'created_count': created_count,
        'updated_count': updated_count,
        'skipped_count': skipped_count,
        'errors': errors,
    })


@require_auth
def api_team_template_download(request):
    """
    GET /api/team/template/?format=csv (or excel)
    Downloads a sample template for bulk team upload.
    """
    fmt = request.GET.get('format', 'csv').lower()

    if fmt == 'excel':
        import pandas as pd
        data = [
            {
                "Name": "Vikram Rao",
                "Role": "EMPLOYEE",
                "Email": "emp_vikram@aisamrat.com",
                "Department": "Engineering",
                "Job Title": "Full Stack Developer",
                "Username": "emp_vikram_rao",
                "InitialPassword": "AiSamrat@2026!"
            },
            {
                "Name": "Ananya Sharma",
                "Role": "MANAGER",
                "Email": "ananya_sharma@aisamrat.com",
                "Department": "Product",
                "Job Title": "Project Manager",
                "Username": "ananya_sharma",
                "InitialPassword": "AiSamrat@2026!"
            }
        ]
        df = pd.DataFrame(data)
        out = io.BytesIO()
        df.to_excel(out, index=False, engine='openpyxl')
        out.seek(0)
        response = HttpResponse(out.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="ai_samrat_team_template.xlsx"'
        return response
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Name", "Role", "Email", "Department", "Job Title", "Username", "InitialPassword"])
        writer.writerow(["Vikram Rao", "EMPLOYEE", "emp_vikram@aisamrat.com", "Engineering", "Full Stack Developer", "emp_vikram_rao", "AiSamrat@2026!"])
        writer.writerow(["Ananya Sharma", "MANAGER", "ananya_sharma@aisamrat.com", "Product", "Project Manager", "ananya_sharma", "AiSamrat@2026!"])
        output.seek(0)
        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="ai_samrat_team_template.csv"'
        return response

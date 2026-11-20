import os
import re
from datetime import datetime, timedelta
import pandas as pd
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from projects.models import Project, ProjectMembership
from django.conf import settings

User = get_user_model()


def parse_date(d_str):
    if not d_str or pd.isna(d_str):
        return None
    d_str = str(d_str).strip()
    if not d_str:
        return None
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d-%m-%y', '%Y/%m/%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(d_str, fmt).date()
        except ValueError:
            pass
    return None


def normalize_status(st_str):
    if not st_str or pd.isna(st_str):
        return Project.Status.PLANNING
    s = str(st_str).strip().lower()
    if 'complete' in s:
        return Project.Status.COMPLETED
    if 'progress' in s or 'ongoing' in s:
        return Project.Status.IN_PROGRESS
    if 'cancel' in s:
        return Project.Status.CANCELLED
    return Project.Status.PLANNING


def normalize_name(raw):
    raw = raw.strip()
    parts = [p.capitalize() for p in raw.split()]
    return " ".join(parts)


def make_username(name):
    clean = re.sub(r'[^a-zA-Z0-9]+', '_', name.lower()).strip('_')
    return f"emp_{clean}"


class Command(BaseCommand):
    help = 'Import project records and interns from projects_data.xlsx or projects_data.csv'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='projects_data.xlsx',
            help='Path to the xlsx or csv file to import',
        )

    def handle(self, *args, **options):
        file_path = options['file']
        if not os.path.isabs(file_path):
            candidates = [
                os.path.join(settings.BASE_DIR.parent, file_path),
                os.path.join(settings.BASE_DIR.parent, 'demo_data', file_path),
                os.path.join(settings.BASE_DIR, file_path),
                file_path,
            ]
            for c in candidates:
                if os.path.exists(c):
                    file_path = c
                    break

        if not os.path.exists(file_path):
            self.stderr.write(f"File not found: {file_path}")
            return

        self.stdout.write(f"Loading data from {file_path}...")
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)

        manager_user = User.objects.filter(role=User.Role.MANAGER).first()
        if not manager_user:
            manager_user = User.objects.filter(is_superuser=True).first()

        created_users = 0
        created_projects = 0
        created_memberships = 0

        for idx, row in df.iterrows():
            p_name = str(row['Project Name']).strip()
            if not p_name or p_name.lower() == 'nan':
                continue

            status = normalize_status(row.get('project status'))
            start_date = parse_date(row.get('start date'))
            end_date = parse_date(row.get('end date'))

            if not start_date:
                start_date = datetime(2026, 10, 1).date()

            if not end_date:
                if status == Project.Status.COMPLETED:
                    end_date = start_date + timedelta(days=30)
                elif status == Project.Status.IN_PROGRESS:
                    end_date = start_date + timedelta(days=90)
                else:
                    end_date = start_date + timedelta(days=60)

            if end_date < start_date:
                end_date = start_date + timedelta(days=30)

            desc = f"Enterprise initiative: {p_name}. Assigned to interns engineering team."

            project, p_created = Project.objects.update_or_create(
                name=p_name,
                defaults={
                    'description': desc,
                    'start_date': start_date,
                    'end_date': end_date,
                    'status': status,
                    'project_manager': manager_user,
                }
            )
            if p_created:
                created_projects += 1

            project.memberships.all().delete()

            raw_interns = str(row.get('Interns', ''))
            if raw_interns and raw_interns.lower() != 'nan':
                intern_names = [i.strip() for i in raw_interns.split(',') if i.strip()]
                seen_in_proj = set()
                for idx_intern, i_name in enumerate(intern_names):
                    clean_name = normalize_name(i_name)
                    uname = make_username(clean_name)
                    if not uname or uname in seen_in_proj:
                        continue
                    seen_in_proj.add(uname)

                    parts = clean_name.split()
                    first_name = parts[0] if parts else clean_name
                    last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

                    user, u_created = User.objects.get_or_create(
                        username=uname,
                        defaults={
                            'first_name': first_name,
                            'last_name': last_name,
                            'email': f"{uname}@aisamrat.com",
                            'role': User.Role.EMPLOYEE,
                            'job_title': 'Software Engineering Intern',
                            'department': 'Intern Product Engineering',
                            'is_staff': False,
                            'is_active': True,
                        }
                    )
                    if u_created:
                        user.set_password('Password123!')
                        user.save()
                        created_users += 1

                    role_on_project = 'Lead Intern' if idx_intern == 0 else 'Intern Contributor'
                    ProjectMembership.objects.create(
                        project=project,
                        employee=user,
                        role_on_project=role_on_project,
                    )
                    created_memberships += 1

        self.stdout.write(self.style.SUCCESS(
            f"Successfully synced: {Project.objects.count()} projects, "
            f"{User.objects.count()} users, {ProjectMembership.objects.count()} memberships."
        ))


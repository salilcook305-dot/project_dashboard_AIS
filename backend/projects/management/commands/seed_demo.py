from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from projects.models import Project, ProjectMembership, DiaryEntry, ActivityLog

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds initial users, imports project records, sets on-leave employees, and creates sample diary entries'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Seeding AI Samrat Private Limited users and projects...'))

        # Create Admin
        admin_user, _ = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@aisamrat.com',
                'first_name': 'Samrat',
                'last_name': 'Admin',
                'role': User.Role.ADMIN,
                'job_title': 'Chief Technology Officer',
                'department': 'Executive Engineering',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        admin_user.set_password('Password123!')
        admin_user.save()

        # Create Manager
        manager_user, _ = User.objects.get_or_create(
            username='manager_priya',
            defaults={
                'email': 'priya.sharma@aisamrat.com',
                'first_name': 'Priya',
                'last_name': 'Sharma',
                'role': User.Role.MANAGER,
                'job_title': 'Senior Engineering Manager',
                'department': 'Product Delivery',
                'is_staff': True,
                'is_superuser': False,
            }
        )
        manager_user.set_password('Password123!')
        manager_user.save()

        # Import user projects data if available
        try:
            call_command('import_projects_data')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'import_projects_data skipped or failed: {e}'))

        # Seed an on-leave employee
        today = timezone.localdate()
        on_leave_user = User.objects.filter(role=User.Role.EMPLOYEE).first()
        if on_leave_user:
            on_leave_user.availability_override = User.AvailabilityOverride.ON_LEAVE
            on_leave_user.leave_until = today + timedelta(days=5)
            on_leave_user.save()
            self.stdout.write(self.style.SUCCESS(f'Set on-leave override for employee {on_leave_user.username} until {on_leave_user.leave_until}'))

        # Seed sample POC and Work Diary entries
        active_projects = Project.objects.filter(status__in=[Project.Status.IN_PROGRESS, Project.Status.PLANNING])
        if active_projects.exists():
            first_project = active_projects.first()
            memberships = list(first_project.memberships.select_related('employee').all())
            if memberships:
                poc_user = memberships[0].employee
                first_project.poc = poc_user
                first_project.save(update_fields=['poc'])
                self.stdout.write(self.style.SUCCESS(f'Assigned POC {poc_user.username} to project {first_project.name}'))

                # Create or update diary entry for yesterday (reviewed)
                yesterday = today - timedelta(days=1)
                entry_yest, _ = DiaryEntry.objects.update_or_create(
                    project=first_project,
                    author=poc_user,
                    entry_date=yesterday,
                    defaults={
                        'done': 'Refactored backend authorization checks to rely strictly on request.user sessions.',
                        'in_progress': 'Integrating React Hook Form with Zod validation on /diary page.',
                        'next_up': 'Perform load testing and cross-browser responsive testing for Confluence table.',
                        'blockers': '',
                        'reviewed_by': manager_user,
                        'reviewed_at': timezone.now(),
                    }
                )

                # Create or update diary entry for today
                entry_today, _ = DiaryEntry.objects.update_or_create(
                    project=first_project,
                    author=poc_user,
                    entry_date=today,
                    defaults={
                        'done': 'Integrating React Hook Form with Zod validation on /diary page.',
                        'in_progress': 'Perform load testing and cross-browser responsive testing for Confluence table.',
                        'next_up': 'Final staging verification and production build generation.',
                        'blockers': 'Awaiting final signoff on branding color shades.',
                    }
                )
                self.stdout.write(self.style.SUCCESS(f'Seeded sample work diary entries for {poc_user.username} on {first_project.name}'))

        self.stdout.write(self.style.SUCCESS('Seeding complete!'))

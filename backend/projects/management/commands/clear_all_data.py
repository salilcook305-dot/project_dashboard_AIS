import os
import shutil
import logging
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.conf import settings
from projects.models import Project, ProjectMembership, DiaryEntry, ActivityLog
from documents.models import Document

User = get_user_model()
logger = logging.getLogger('project_dashboard')


class Command(BaseCommand):
    help = 'Clears all projects, members, diaries, logs, and mock users from the database for a clean zero-data production state, keeping only the root admin user.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep-users',
            action='store_true',
            help='Keep user accounts and only remove projects, diaries, and documents.',
        )

    def handle(self, *args, **options):
        keep_users = options.get('keep_users', False)
        self.stdout.write(self.style.WARNING("Clearing application data..."))

        # 1. Delete Diary Entries
        diary_count = DiaryEntry.objects.count()
        DiaryEntry.objects.all().delete()
        self.stdout.write(f"Deleted {diary_count} diary entries.")

        # 2. Delete Activity Logs
        activity_count = ActivityLog.objects.count()
        ActivityLog.objects.all().delete()
        self.stdout.write(f"Deleted {activity_count} activity logs.")

        # 3. Delete Documents
        doc_count = Document.objects.count()
        Document.objects.all().delete()
        self.stdout.write(f"Deleted {doc_count} document records.")

        # 4. Delete Project Memberships
        membership_count = ProjectMembership.objects.count()
        ProjectMembership.objects.all().delete()
        self.stdout.write(f"Deleted {membership_count} project memberships.")

        # 5. Delete Projects
        project_count = Project.objects.count()
        Project.objects.all().delete()
        self.stdout.write(f"Deleted {project_count} projects.")

        # 6. Delete Users (except admin)
        if not keep_users:
            users_to_delete = User.objects.exclude(username='admin')
            deleted_users_count = users_to_delete.count()
            users_to_delete.delete()
            self.stdout.write(f"Deleted {deleted_users_count} non-admin user accounts.")

        # 7. Ensure clean root Admin user exists
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@aisamrat.com',
                'first_name': 'System',
                'last_name': 'Administrator',
                'role': User.Role.ADMIN,
                'job_title': 'System Administrator',
                'department': 'Administration',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        admin_user.role = User.Role.ADMIN
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.set_password('Password123!')
        admin_user.save()
        self.stdout.write(self.style.SUCCESS(f"Verified Administrator account: {admin_user.username} (Password123!)"))

        # 8. Clean uploaded files in uploads directory
        uploads_root = getattr(settings, 'MEDIA_ROOT', settings.BASE_DIR.parent / 'uploads')
        if os.path.exists(uploads_root):
            for item in os.listdir(uploads_root):
                item_path = os.path.join(uploads_root, item)
                if os.path.isdir(item_path):
                    for sub in os.listdir(item_path):
                        sub_path = os.path.join(item_path, sub)
                        try:
                            if os.path.isfile(sub_path) or os.path.islink(sub_path):
                                os.unlink(sub_path)
                            elif os.path.isdir(sub_path):
                                shutil.rmtree(sub_path)
                        except Exception as e:
                            self.stderr.write(f"Could not delete {sub_path}: {e}")

        logger.info("Executed clear_all_data: Database successfully reset to zero data with 1 root Administrator.")
        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] All data removed! The system is now at completely ZERO data."))

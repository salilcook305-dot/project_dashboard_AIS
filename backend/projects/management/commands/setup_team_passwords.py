import os
import csv
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.conf import settings
from pathlib import Path

User = get_user_model()

class Command(BaseCommand):
    help = "Sets secure hashed passwords for team members from environment variable and exports credentials list."

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default=None,
            help='Override the password from DEFAULT_USER_PASSWORD environment variable'
        )

    def handle(self, *args, **options):
        default_pwd = options['password'] or os.environ.get('DEFAULT_USER_PASSWORD', 'AiSamrat@2026!')
        
        self.stdout.write(self.style.NOTICE("Setting secure hashed passwords for all team accounts..."))

        users = User.objects.all().order_by('role', 'first_name', 'username')
        count = 0
        credentials_records = []

        for u in users:
            u.set_password(default_pwd)
            u.save()
            count += 1

            if u.role == User.Role.ADMIN or u.is_superuser:
                portal_label = 'Admin Portal'
            elif u.role == User.Role.MANAGER:
                portal_label = 'Manager Portal'
            else:
                portal_label = 'Employee Portal'

            credentials_records.append({
                'Name': u.get_full_name() or u.username,
                'Role': u.role,
                'Portal': portal_label,
                'Email': u.email,
                'Username': u.username,
                'InitialPassword': default_pwd
            })

        # Export to CSV in project root
        root_dir = Path(settings.BASE_DIR).parent
        csv_path = root_dir / 'team_credentials.csv'
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['Name', 'Role', 'Portal', 'Email', 'Username', 'InitialPassword'])
            writer.writeheader()
            writer.writerows(credentials_records)

        self.stdout.write(self.style.SUCCESS(f"Successfully configured {count} user passwords using PBKDF2 hashing."))
        self.stdout.write(self.style.SUCCESS(f"Exported confidential credentials list to: {csv_path}"))
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("--- KEY PORTAL ACCESS ACCOUNTS ---"))
        self.stdout.write(f"  * Admin Portal:   admin@aisamrat.com (System Administrator)")
        self.stdout.write(f"  * Manager Portal: deepak@aisamrat.com (Deepak S J)")
        self.stdout.write(f"  * Manager Portal: megha@aisamrat.com (Megha)")
        self.stdout.write(f"  * Employee Portal: Any employee email (e.g. emp_akash@aisamrat.com)")
        self.stdout.write(f"  * Default Password: [Read from .env: DEFAULT_USER_PASSWORD]")

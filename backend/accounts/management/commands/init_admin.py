import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Ensures an initial Administrator account exists for a clean zero-data production deployment'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', 'admin').strip()
        email = os.environ.get('ADMIN_EMAIL', 'admin@aisamrat.com').strip()
        password = os.environ.get('ADMIN_PASSWORD', 'Password123!').strip()
        first_name = os.environ.get('ADMIN_FIRST_NAME', 'System').strip()
        last_name = os.environ.get('ADMIN_LAST_NAME', 'Admin').strip()

        admin_user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'role': User.Role.ADMIN,
                'job_title': 'System Administrator',
                'department': 'Administration',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin_user.set_password(password)
            admin_user.save()
            self.stdout.write(self.style.SUCCESS(f'Created clean Administrator account: {username} ({email})'))
        else:
            self.stdout.write(self.style.NOTICE(f'Administrator account already exists: {username}'))

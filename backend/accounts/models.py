from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        MANAGER = 'MANAGER', 'Manager'
        EMPLOYEE = 'EMPLOYEE', 'Employee'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        help_text='User system role (ADMIN, MANAGER, EMPLOYEE)',
    )
    job_title = models.CharField(max_length=120, blank=True, default='')
    department = models.CharField(max_length=120, blank=True, default='')

    class AvailabilityOverride(models.TextChoices):
        ON_LEAVE = 'ON_LEAVE', 'On Leave'
        AWAY = 'AWAY', 'Away'

    availability_override = models.CharField(
        max_length=20,
        choices=AvailabilityOverride.choices,
        null=True,
        blank=True,
        help_text='Manual availability override (ON_LEAVE or AWAY)',
    )
    leave_until = models.DateField(
        null=True,
        blank=True,
        help_text='Date until which leave is active',
    )

    @property
    def is_admin_role(self) -> bool:
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_manager_role(self) -> bool:
        return self.role in (self.Role.ADMIN, self.Role.MANAGER) or self.is_superuser

    @property
    def initials(self) -> str:
        if self.first_name and self.last_name:
            return f"{self.first_name[0]}{self.last_name[0]}".upper()
        if self.first_name:
            return self.first_name[:2].upper()
        if self.username:
            return self.username[:2].upper()
        return 'U'

    def get_active_projects_qs(self):
        from config.constants import ACTIVE_PROJECT_STATUSES
        from projects.models import Project
        return Project.objects.filter(
            models.Q(memberships__employee=self) | models.Q(project_manager=self),
            status__in=ACTIVE_PROJECT_STATUSES
        ).distinct()

    def get_active_project_count(self) -> int:
        return self.get_active_projects_qs().count()

    def get_total_projects_qs(self):
        from projects.models import Project
        return Project.objects.filter(
            models.Q(memberships__employee=self) | models.Q(project_manager=self)
        ).distinct()

    def get_availability_status(self, today=None) -> str:
        from config.constants import calculate_workload_status
        return calculate_workload_status(
            active_project_count=self.get_active_project_count(),
            override=self.availability_override,
            leave_until=self.leave_until,
            today=today
        )

    def __str__(self):
        full_name = self.get_full_name()
        if full_name:
            return f"{full_name} ({self.username}) [{self.role}]"
        return f"{self.username} [{self.role}]"

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone


class Project(models.Model):
    class Status(models.TextChoices):
        PLANNING = 'Planning', 'Planning'
        IN_PROGRESS = 'In Progress', 'In Progress'
        COMPLETED = 'Completed', 'Completed'
        CANCELLED = 'Cancelled', 'Cancelled'
        ON_HOLD = 'On Hold', 'On Hold'

    project_code = models.CharField(max_length=50, blank=True, default='', help_text='Project Code (e.g. AIS-CON-01)')
    name = models.CharField(max_length=200, unique=True, help_text='Unique name of the project')
    description = models.TextField(blank=True, default='')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=40,
        default='In Progress',
    )
    priority = models.CharField(max_length=30, default='Medium')
    progress = models.IntegerField(default=0)
    frontend_progress = models.IntegerField(default=0)
    backend_progress = models.IntegerField(default=0)
    database_progress = models.IntegerField(default=0)
    latest_progress_report = models.TextField(blank=True, default='')
    progress_reported_at = models.DateTimeField(null=True, blank=True)
    category = models.CharField(max_length=120, default='Software Solutions')
    project_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_projects',
    )
    poc = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='poc_projects',
        help_text='Point of Contact (must be an assigned project member)',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        super().clean()
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValidationError({'end_date': 'End date must be greater than or equal to start date.'})

    def save(self, *args, **kwargs):
        # Normalize status
        if self.status:
            status_map = {
                'IN_PROGRESS': 'In Progress',
                'PLANNING': 'Planning',
                'COMPLETED': 'Completed',
                'CANCELLED': 'Cancelled',
                'ON_HOLD': 'On Hold'
            }
            self.status = status_map.get(self.status, self.status)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.project_code} - {self.name} ({self.status})"


class ProjectMembership(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_memberships',
    )
    role_on_project = models.CharField(max_length=120, default='Contributor')

    class Meta:
        unique_together = ('project', 'employee')
        ordering = ['project', 'employee']

    def __str__(self):
        return f"{self.employee.username} on {self.project.name} as {self.role_on_project}"


class ActivityLog(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='activity_logs',
        null=True,
        blank=True
    )
    user_name = models.CharField(max_length=150, default='Staff')
    action = models.CharField(max_length=100)
    details = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user_name} - {self.action} ({self.timestamp})"


class DiaryEntry(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='diary_entries',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='diary_entries',
    )
    entry_date = models.DateField(default=timezone.localdate)
    done = models.TextField(max_length=2000, help_text='What was completed')
    in_progress = models.TextField(max_length=2000, help_text='What is in progress')
    next_up = models.TextField(max_length=2000, help_text='What will be worked on next')
    blockers = models.TextField(max_length=2000, blank=True, default='', help_text='Any blockers or impediments')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_diary_entries',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'author', 'entry_date')
        ordering = ['-entry_date', '-created_at']

    def __str__(self):
        return f"Diary by {self.author.username} for {self.project.name} on {self.entry_date}"


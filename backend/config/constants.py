"""
Constants for AI Samrat Project Dashboard.
Workload thresholds, project active statuses, and availability definitions.
"""

ACTIVE_PROJECT_STATUSES = [
    'In Progress',
    'Planning',
    'IN_PROGRESS',
    'PLANNING',
]

class AvailabilityStatus:
    AVAILABLE = 'AVAILABLE'
    BUSY = 'BUSY'
    HEAVY = 'HEAVY'
    OVERLOADED = 'OVERLOADED'
    ON_LEAVE = 'ON_LEAVE'
    AWAY = 'AWAY'

    CHOICES = [
        (AVAILABLE, 'Available'),
        (BUSY, 'Busy'),
        (HEAVY, 'Heavy'),
        (OVERLOADED, 'Overloaded'),
        (ON_LEAVE, 'On Leave'),
        (AWAY, 'Away'),
    ]

# Workload thresholds: (max_inclusive_active_projects, status)
# 0 active -> AVAILABLE; 1-2 -> BUSY; 3-4 -> HEAVY; 5+ -> OVERLOADED
WORKLOAD_THRESHOLDS = [
    (0, AvailabilityStatus.AVAILABLE),
    (2, AvailabilityStatus.BUSY),
    (4, AvailabilityStatus.HEAVY),
]

def calculate_workload_status(active_project_count: int, override=None, leave_until=None, today=None) -> str:
    """
    Computes status per employee counting only ACTIVE projects.
    If availability_override is set (and leave_until is empty or in the future),
    the status is that override instead.
    """
    if override:
        if leave_until is None:
            return override
        if today is None:
            from django.utils import timezone
            today = timezone.localdate()
        if leave_until >= today:
            return override

    if active_project_count <= 0:
        return AvailabilityStatus.AVAILABLE
    elif active_project_count <= 2:
        return AvailabilityStatus.BUSY
    elif active_project_count <= 4:
        return AvailabilityStatus.HEAVY
    else:
        return AvailabilityStatus.OVERLOADED

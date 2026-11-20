from rest_framework import permissions


class IsAdminUserRole(permissions.BasePermission):
    """Allows access only to ADMIN role or superusers."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.role == 'ADMIN' or request.user.is_superuser))


class IsManagerOrAdmin(permissions.BasePermission):
    """Allows access to MANAGER or ADMIN role, or superusers."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.role in ('ADMIN', 'MANAGER') or request.user.is_superuser))


class IsManagerOrAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access (GET, HEAD, OPTIONS) to all authenticated users (including EMPLOYEE).
    Write actions (POST, PUT, PATCH, DELETE) require MANAGER or ADMIN role.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return (request.user.role in ('ADMIN', 'MANAGER')) or request.user.is_superuser


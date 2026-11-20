from datetime import date, timedelta
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Project
from .serializers import ProjectSerializer
from .permissions import IsManagerOrAdminOrReadOnly


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().prefetch_related('memberships__employee', 'documents').select_related('project_manager')
    serializer_class = ProjectSerializer
    permission_classes = [IsManagerOrAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search) |
                Q(project_manager__first_name__icontains=search) |
                Q(project_manager__last_name__icontains=search) |
                Q(project_manager__username__icontains=search) |
                Q(memberships__employee__first_name__icontains=search) |
                Q(memberships__employee__last_name__icontains=search)
            ).distinct()

        status_param = self.request.query_params.get('status', '').strip()
        if status_param:
            today = date.today()
            if status_param == 'attention':
                cutoff = today + timedelta(days=30)
                qs = qs.exclude(status__in=['COMPLETED', 'CANCELLED']).filter(end_date__lte=cutoff)
            elif status_param == 'overdue':
                qs = qs.exclude(status__in=['COMPLETED', 'CANCELLED']).filter(end_date__lt=today)
            elif status_param == 'ending_soon':
                cutoff = today + timedelta(days=7)
                qs = qs.exclude(status__in=['COMPLETED', 'CANCELLED']).filter(end_date__gte=today, end_date__lte=cutoff)
            elif status_param in Project.Status.values:
                qs = qs.filter(status=status_param)

        member_param = self.request.query_params.get('member', '').strip()
        if member_param:
            qs = qs.filter(
                Q(memberships__employee__id=member_param) |
                Q(memberships__employee__username=member_param) |
                Q(project_manager__id=member_param) |
                Q(project_manager__username=member_param)
            ).distinct()

        ordering = self.request.query_params.get('ordering', '-created_at').strip()
        allowed_ordering = [
            'name', '-name',
            'start_date', '-start_date',
            'end_date', '-end_date',
            'status', '-status',
            'created_at', '-created_at'
        ]
        if ordering in allowed_ordering:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by('-created_at')
        return qs

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        for doc in project.documents.all():
            if doc.file:
                try:
                    doc.file.delete(save=False)
                except Exception:
                    pass
        project.delete()
        return Response({'detail': 'Project deleted successfully.'}, status=status.HTTP_200_OK)

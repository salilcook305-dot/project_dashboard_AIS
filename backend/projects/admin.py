from django.contrib import admin
from .models import Project, ProjectMembership
from documents.models import Document


class ProjectMembershipInline(admin.TabularInline):
    model = ProjectMembership
    extra = 1
    autocomplete_fields = ['employee']


class DocumentInline(admin.TabularInline):
    model = Document
    extra = 0
    readonly_fields = ['original_name', 'file', 'doc_type', 'size_bytes', 'uploaded_by', 'uploaded_at']
    can_delete = True


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'project_manager', 'start_date', 'end_date', 'created_at')
    list_filter = ('status', 'start_date', 'end_date')
    search_fields = ('name', 'description')
    inlines = [ProjectMembershipInline, DocumentInline]


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(admin.ModelAdmin):
    list_display = ('project', 'employee', 'role_on_project')
    list_filter = ('role_on_project', 'project')
    search_fields = ('project__name', 'employee__username', 'role_on_project')

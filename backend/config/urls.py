"""
URL configuration for AI Samrat Private Limited Project Dashboard.
Full Django Backend Architecture.
"""

from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.views.static import serve
from . import views

STATIC_DIR = str(settings.BASE_DIR.parent / 'static')
MEDIA_DIR = str(settings.MEDIA_ROOT)
FRONTEND_ASSETS = str(settings.BASE_DIR.parent / 'frontend' / 'dist' / 'assets')

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Web Dashboard Pages (React SPA from frontend/dist)
    path('', views.spa_page_view, name='dashboard'),
    re_path(r'^dashboard/?$', views.spa_page_view, name='dashboard-alt'),
    re_path(r'^projects/?$', views.spa_page_view, name='projects-page'),
    re_path(r'^analytics/?$', views.spa_page_view, name='analytics-page'),
    re_path(r'^documents/?$', views.spa_page_view, name='documents-page'),
    re_path(r'^files/?$', views.spa_page_view, name='files-page'),
    re_path(r'^team/?$', views.spa_page_view, name='team-page'),
    re_path(r'^team-management/?$', views.spa_page_view, name='team-management-page'),
    re_path(r'^roadmap/?$', views.spa_page_view, name='roadmap-page'),
    re_path(r'^diary/?$', views.spa_page_view, name='diary-page'),
    re_path(r'^logs/?$', views.spa_page_view, name='logs-page'),
    re_path(r'^system-logs/?$', views.spa_page_view, name='system-logs-page'),
    re_path(r'^login/?$', views.spa_page_view, name='login'),
    re_path(r'^logout/?$', views.logout_page_view, name='logout'),
    re_path(r'^spa/?$', views.spa_page_view, name='react-spa'),
    re_path(r'^download-dashboard/?$', views.download_dashboard_zip_view, name='download-dashboard-zip'),

    # REST APIs: System & Server Logs
    re_path(r'^api/admin/logs/?$', views.api_admin_logs, name='api-admin-logs'),
    re_path(r'^api/logs/?$', views.api_admin_logs, name='api-logs'),

    # REST APIs: Authentication
    re_path(r'^api/auth/login/?$', views.api_auth_login, name='api-auth-login'),
    re_path(r'^api/auth/logout/?$', views.api_auth_logout, name='api-auth-logout'),
    re_path(r'^api/auth/csrf/?$', views.api_csrf, name='api-auth-csrf'),
    re_path(r'^api/auth/me/?$', views.api_auth_me, name='api-auth-me'),

    # REST APIs: Metrics & Users
    re_path(r'^api/summary/?$', views.api_summary, name='api-summary'),
    re_path(r'^api/employees/workload/?$', views.api_employees_workload, name='api-employees-workload'),
    re_path(r'^api/users/(?P<user_id>\d+)/password/?$', views.api_user_change_password, name='api-user-change-password'),
    re_path(r'^api/users/(?P<user_id>\d+)/?$', views.api_user_detail_update_delete, name='api-user-detail-update-delete'),
    re_path(r'^api/users/?$', views.api_users, name='api-users'),
    re_path(r'^api/employees/?$', views.api_users, name='api-employees'),

    # REST APIs: Work Diary
    re_path(r'^api/diary/my/?$', views.api_diary_my, name='api-diary-my'),
    re_path(r'^api/diary/due/?$', views.api_diary_due, name='api-diary-due'),
    re_path(r'^api/diary/(?P<entry_id>\d+)/review/?$', views.api_diary_review, name='api-diary-review'),
    re_path(r'^api/diary/(?P<entry_id>\d+)/?$', views.api_diary_detail, name='api-diary-detail'),
    re_path(r'^api/projects/(?P<project_id>\d+)/diary/?$', views.api_project_diary, name='api-project-diary'),

    # REST APIs: Projects
    re_path(r'^api/projects/?$', views.api_projects_list_create, name='api-projects-list-create'),
    re_path(r'^api/projects/(?P<project_id>\d+)/?$', views.api_project_detail_update_delete, name='api-project-detail'),
    re_path(r'^api/projects/(?P<project_id>\d+)/status/?$', views.api_project_status, name='api-project-status'),
    re_path(r'^api/projects/(?P<project_id>\d+)/progress/?$', views.api_project_update_progress, name='api-project-progress'),
    re_path(r'^api/projects/(?P<project_id>\d+)/members/?$', views.api_project_members, name='api-project-members'),
    re_path(r'^api/projects/(?P<project_id>\d+)/members/(?P<user_id>\d+)/?$', views.api_project_member_delete, name='api-project-member-delete'),
    re_path(r'^api/projects/(?P<project_id>\d+)/upload/?$', views.api_project_upload, name='api-project-upload'),
    re_path(r'^api/projects/(?P<project_id>\d+)/documents/?$', views.api_project_documents_list, name='api-project-documents'),

    # REST APIs: Files & Documents
    re_path(r'^api/files/?$', views.api_files_list, name='api-files-list'),
    re_path(r'^api/files/(?P<file_id>\d+)/download/?$', views.api_file_download, name='api-file-download'),
    re_path(r'^api/documents/(?P<file_id>\d+)/download/?$', views.api_file_download, name='api-document-download'),
    re_path(r'^api/files/(?P<file_id>\d+)/?$', views.api_file_delete, name='api-file-delete'),
    re_path(r'^api/documents/(?P<file_id>\d+)/?$', views.api_file_delete, name='api-document-delete'),

    # REST APIs: CSV Export & Excel Import
    re_path(r'^api/export/csv/?$', views.api_export_csv, name='api-export-csv'),
    re_path(r'^api/import/excel/?$', views.api_import_excel, name='api-import-excel'),

    # REST APIs: Team Management Excel/CSV Bulk Upload & Template
    re_path(r'^api/team/upload-preview/?$', views.api_team_upload_preview, name='api-team-upload-preview'),
    re_path(r'^api/team/upload-confirm/?$', views.api_team_upload_confirm, name='api-team-upload-confirm'),
    re_path(r'^api/team/template/?$', views.api_team_template_download, name='api-team-template-download'),

    # Static files serving (direct regex for reliable dev/demo mode)
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': STATIC_DIR}),
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': FRONTEND_ASSETS}),
]

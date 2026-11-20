from django.contrib import admin
from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('original_name', 'project', 'doc_type', 'size_bytes', 'uploaded_by', 'uploaded_at')
    list_filter = ('doc_type', 'uploaded_at', 'project')
    search_fields = ('original_name', 'project__name')

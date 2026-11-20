from django.db import models
from django.conf import settings
from .validators import document_upload_path, validate_document_file


class Document(models.Model):
    class DocType(models.TextChoices):
        ROADMAP = 'ROADMAP', 'Roadmap'
        DOCUMENTATION = 'DOCUMENTATION', 'Documentation'
        OTHER = 'OTHER', 'Other'

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='documents',
    )
    file = models.FileField(
        upload_to=document_upload_path,
        validators=[validate_document_file],
    )
    original_name = models.CharField(max_length=255)
    doc_type = models.CharField(
        max_length=20,
        choices=DocType.choices,
        default=DocType.DOCUMENTATION,
    )
    size_bytes = models.BigIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_name} ({self.doc_type}) - {self.project.name}"

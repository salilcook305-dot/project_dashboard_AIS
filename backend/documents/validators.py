import os
import uuid
from django.core.exceptions import ValidationError

ALLOWED_EXTENSIONS = {'txt', 'jpg', 'doc', 'md', 'xlsx', 'docx', 'pptx', 'pdf', 'png', 'jpeg'}

ALLOWED_CONTENT_TYPES = {
    'application/pdf': {'pdf'},
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {'docx'},
    'application/msword': {'doc'},
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': {'pptx'},
    'application/vnd.ms-powerpoint': {'ppt', 'pptx'},
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {'xlsx'},
    'application/vnd.ms-excel': {'xls', 'xlsx'},
    'image/png': {'png'},
    'image/jpeg': {'jpg', 'jpeg'},
    'text/markdown': {'md'},
    'text/x-markdown': {'md'},
    'text/plain': {'txt', 'md'},
    'application/octet-stream': {'docx', 'md', 'xlsx', 'pptx'},
}

MAX_FILE_SIZE_BYTES = 10485760  # 10 MB


def validate_document_file(file_obj):
    if file_obj.size > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        raise ValidationError(f"File size exceeds {max_mb}MB limit.")

    ext = os.path.splitext(file_obj.name)[1].lower().lstrip('.')
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ', '.join(sorted(ALLOWED_EXTENSIONS))
        raise ValidationError(f"Unsupported file extension '.{ext}'. Allowed types are: {allowed}.")

    content_type = getattr(file_obj, 'content_type', None)
    if content_type:
        content_type = content_type.lower().split(';')[0].strip()
        if content_type in ALLOWED_CONTENT_TYPES:
            allowed_for_type = ALLOWED_CONTENT_TYPES[content_type]
            if ext not in allowed_for_type and 'octet-stream' not in content_type:
                raise ValidationError(f"Content type '{content_type}' does not match file extension '.{ext}'.")


def document_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    random_filename = f"{uuid.uuid4().hex}{ext}"
    return os.path.join('vault', random_filename)


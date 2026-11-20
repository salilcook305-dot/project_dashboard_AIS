from rest_framework import serializers
from .models import Document
from accounts.models import User


class DocumentUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    initials = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'initials']

    def get_name(self, obj):
        full = obj.get_full_name()
        if full:
            return full
        return obj.username


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = DocumentUserSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(read_only=True, source='project.id')
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'project_id', 'original_name', 'doc_type',
            'size_bytes', 'uploaded_by', 'uploaded_at', 'download_url'
        ]
        read_only_fields = [
            'id', 'project_id', 'original_name', 'size_bytes',
            'uploaded_by', 'uploaded_at', 'download_url'
        ]

    def get_download_url(self, obj):
        return f"/api/documents/{obj.id}/download/"


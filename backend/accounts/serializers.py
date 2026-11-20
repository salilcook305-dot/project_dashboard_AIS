from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    initials = serializers.ReadOnlyField()
    is_admin = serializers.ReadOnlyField(source='is_admin_role')
    is_manager = serializers.ReadOnlyField(source='is_manager_role')

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'name', 'initials', 'role', 'job_title', 'department',
            'is_admin', 'is_manager'
        ]
        read_only_fields = [
            'id', 'username', 'email', 'role', 'job_title', 'department',
            'is_admin', 'is_manager'
        ]

    def get_name(self, obj):
        full = obj.get_full_name()
        if full:
            return full
        return obj.username


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

